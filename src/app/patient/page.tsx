"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { 
  useRealtimeQueue, 
  QueueState,
  Patient
} from "@/hooks/useRealtimeQueue";
import ThemeToggle from "@/components/ThemeToggle";
import { useToast } from "@/components/Toast";
import { 
  ArrowLeft, 
  Timer, 
  HelpCircle,
  RotateCcw,
  ArrowRight,
  UserCheck,
  MapPin,
  Calendar,
  ShieldAlert
} from "lucide-react";
import EmergencyRequestModal from "@/components/EmergencyRequestModal";

export default function PatientPage() {
  const { queueManager } = useRealtimeQueue();
  const { addToast } = useToast();
  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [myTokenInput, setMyTokenInput] = useState("");
  const [myToken, setMyToken] = useState<string | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);


  // Reference to keep track of the current token in listeners
  const myTokenRef = useRef(myToken);

  useEffect(() => {
    myTokenRef.current = myToken;
  }, [myToken]);

  // Sync state on updates
  useEffect(() => {
    if (!queueManager) return;

    const handleQueueUpdated = (state: QueueState) => {
      console.log("[Patient] Queue state updated:", state);
      console.log(`[CLIENT]\nReceived queueUpdated\nCurrent Token: ${state.currentToken || "null"}\nQueue Length: ${state.waitingPatients.filter(p => p.status === "waiting").length}\n`);
      setQueueState(state);
    };

    const handleTokenAdvanced = (data: { currentToken: string; patientName: string }) => {
      console.log("[Patient] Token advanced:", data);
      
      // Display general call toast
      addToast(`Token Called: ${data.currentToken}`, "info");
    };

    const handleQueueReset = () => {
      console.log("[Patient] Queue database reset");
      addToast("Queue state has been reset by the clinic", "warning");
    };

    const handleConsultationTimeUpdated = (data: { minutes: number }) => {
      console.log("[Patient] Clinic consultation time updated:", data);
      addToast(`Estimated wait durations adjusted.`, "info");
    };

    const handleEmergencyRequestSubmitted = (data: { tokenNumber: string; reason: string }) => {
      console.log("[Patient] Emergency request submitted broadcast:", data);
    };

    const handleEmergencyRequestReviewed = (data: { tokenNumber: string; status: "approved" | "rejected" }) => {
      console.log("[Patient] Emergency request reviewed broadcast:", data);
      if (data.tokenNumber === myTokenRef.current) {
        if (data.status === "approved") {
          addToast("Your emergency priority request has been APPROVED!", "success");
        } else {
          addToast("Your emergency priority request was declined.", "warning");
        }
      }
    };

    // Subscriptions
    queueManager.on("queueUpdated", handleQueueUpdated);
    queueManager.on("tokenAdvanced", handleTokenAdvanced);
    queueManager.on("queueReset", handleQueueReset);
    queueManager.on("consultationTimeUpdated", handleConsultationTimeUpdated);
    queueManager.on("emergencyRequestSubmitted", handleEmergencyRequestSubmitted);
    queueManager.on("emergencyRequestReviewed", handleEmergencyRequestReviewed);

    // Initial state request handshake
    queueManager.sendAction("queueUpdated");

    // Cleanup listeners on unmount
    return () => {
      queueManager.off("queueUpdated", handleQueueUpdated);
      queueManager.off("tokenAdvanced", handleTokenAdvanced);
      queueManager.off("queueReset", handleQueueReset);
      queueManager.off("consultationTimeUpdated", handleConsultationTimeUpdated);
      queueManager.off("emergencyRequestSubmitted", handleEmergencyRequestSubmitted);
      queueManager.off("emergencyRequestReviewed", handleEmergencyRequestReviewed);
    };
  }, [queueManager, addToast]);

  // Load state from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("selectedToken");
    if (savedToken) {
      setTimeout(() => setMyToken(savedToken), 0);
    }
  }, []);

  // Form submission: Track token
  const handleTrackToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!myTokenInput.trim()) return;

    const formattedToken = myTokenInput.trim().toUpperCase();
    setMyToken(formattedToken);
    localStorage.setItem("selectedToken", formattedToken);
    setMyTokenInput("");
    addToast(`Tracking Token ${formattedToken}`, "success");
  };

  // Select token from quick-select list
  const handleQuickSelect = (token: string) => {
    setMyToken(token);
    localStorage.setItem("selectedToken", token);
    addToast(`Tracking Token ${token}`, "success");
  };

  // Reset tracked token
  const handleClearTrackedToken = () => {
    addToast(`Stopped tracking Token ${myToken}`, "info");
    setMyToken(null);
    localStorage.removeItem("selectedToken");
  };

  // Derived calculations from state (always single source of truth)
  const currentToken = queueState?.currentToken || "—";
  const averageConsultationTime = queueState?.averageConsultationTime || 5;
  
  // Sort waiting patients: emergency first, then by check-in order (FIFO)
  const waitingPatients = queueState?.waitingPatients
    ? [...queueState.waitingPatients]
        .filter(p => p.status === "waiting")
        .sort((a, b) => {
          if (a.isEmergency && !b.isEmergency) return -1;
          if (!a.isEmergency && b.isEmergency) return 1;
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        })
    : [];
  
  // Find my patient details in the full queue list
  const myPatientRecord = queueState?.waitingPatients.find(p => p.tokenNumber === myToken);

  // Find my latest emergency request status
  const myEmergencyRequest = queueState?.emergencyRequests && myToken
    ? [...queueState.emergencyRequests]
        .filter(r => r.tokenNumber === myToken)
        .reverse()[0] || null
    : null;
  
  let tokensAhead = 0;
  let estimatedWait = 0;
  let tokenStatus: "waiting" | "called" | "not_found" = "not_found";

  if (myToken) {
    if (myPatientRecord) {
      if (myPatientRecord.status === "waiting") {
        tokenStatus = "waiting";
        const indexInWaiting = waitingPatients.findIndex(p => p.tokenNumber === myToken);
        tokensAhead = indexInWaiting !== -1 ? indexInWaiting : 0;
        estimatedWait = tokensAhead * averageConsultationTime;
      } else if (myPatientRecord.status === "called") {
        tokenStatus = "called";
      }
    } else {
      if (myToken === currentToken && currentToken !== "—") {
        tokenStatus = "called";
      } else {
        tokenStatus = "not_found";
      }
    }
  }

  // Generate Queue Progress Line Steps
  const renderQueueProgress = () => {
    if (tokenStatus !== "waiting" || !myToken) return null;
    
    const indexInWaiting = waitingPatients.findIndex(p => p.tokenNumber === myToken);
    
    // We will show up to 4 nodes in a progressive timeline
    // Node 1: Current Serving
    // Node 2-3: Intermediate patients
    // Node 4: The patient (You)
    const steps: { label: string; active: boolean; isYou: boolean }[] = [];
    
    steps.push({ label: `Serving: ${currentToken}`, active: true, isYou: false });
    
    const youLabel = `${myToken} (You)${myPatientRecord?.isEmergency ? " 🚨" : ""}`;

    if (indexInWaiting === 0) {
      // You are next up
      steps.push({ label: "You are next up!", active: true, isYou: true });
    } else if (indexInWaiting === 1) {
      const p0Label = waitingPatients[0].tokenNumber + (waitingPatients[0].isEmergency ? " 🚨" : "");
      steps.push({ label: p0Label, active: false, isYou: false });
      steps.push({ label: youLabel, active: true, isYou: true });
    } else if (indexInWaiting === 2) {
      const p0Label = waitingPatients[0].tokenNumber + (waitingPatients[0].isEmergency ? " 🚨" : "");
      const p1Label = waitingPatients[1].tokenNumber + (waitingPatients[1].isEmergency ? " 🚨" : "");
      steps.push({ label: p0Label, active: false, isYou: false });
      steps.push({ label: p1Label, active: false, isYou: false });
      steps.push({ label: youLabel, active: true, isYou: true });
    } else {
      // Collapse intermediate patients for readability
      const p0Label = `Next: ${waitingPatients[0].tokenNumber}${waitingPatients[0].isEmergency ? " 🚨" : ""}`;
      steps.push({ label: p0Label, active: false, isYou: false });
      steps.push({ label: `${indexInWaiting - 1} patients ahead`, active: false, isYou: false });
      steps.push({ label: youLabel, active: true, isYou: true });
    }

    return (
      <div className="space-y-4">
        <h3 className="text-2xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 text-center">
          Live Position Timeline
        </h3>
        <div className="relative flex items-center justify-between w-full max-w-md mx-auto py-2">
          {/* Connector Line */}
          <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-slate-200 dark:bg-slate-855 -translate-y-1/2 -z-10 transition-colors"></div>
          
          {steps.map((step, idx) => (
            <div key={idx} className="flex flex-col items-center gap-1.5 bg-[var(--background)] px-2 relative transition-colors">
              <div 
                className={`w-6 h-6 rounded-full flex items-center justify-center border-2 text-[10px] font-bold transition-all ${
                  step.isYou 
                    ? "bg-teal-500 border-teal-500 text-white shadow-lg shadow-teal-500/20 animate-pulse" 
                    : step.active
                      ? "bg-sky-500/10 border-sky-500 text-sky-650 dark:text-sky-400"
                      : "bg-[var(--card-bg)] border-[var(--card-border)] text-slate-500"
                }`}
              >
                {step.isYou ? "★" : idx + 1}
              </div>
              <span className={`text-[10px] font-extrabold ${
                step.isYou 
                  ? "text-teal-650 dark:text-teal-400" 
                  : "text-slate-600 dark:text-slate-400"
              }`}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--card-border)] bg-[var(--card-bg)]/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 py-4 transition-colors">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link 
              href="/" 
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              aria-label="Back to home"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                  Patient Waiting Room
                </h1>
              </div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Real-Time Queue Tracking Portal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex-1 flex flex-col justify-center">
        
        {/* State 1: Patient has not entered their token yet */}
        {!myToken && (
          <div className="w-full max-w-md mx-auto space-y-6 animate-slide-up">
            
            {/* Live Serving Banner */}
            <div className="glass-card p-6 text-center border-[var(--clinic-primary)]/20 bg-[var(--clinic-primary-light)]">
              <span className="text-2xs font-extrabold text-teal-600 dark:text-teal-400 uppercase tracking-wider block mb-1">
                Currently Serving
              </span>
              <span className="text-5xl font-extrabold font-mono tracking-wider text-slate-800 dark:text-slate-100">
                {currentToken}
              </span>
            </div>

            {/* Token entry card */}
            <div className="glass-card p-6">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 text-center mb-6">
                Track Your Position
              </h2>
              
              <form onSubmit={handleTrackToken} className="space-y-4">
                <div>
                  <label className="block text-2xs font-extrabold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
                    Enter Your Token Number
                  </label>
                  <input
                    type="text"
                    value={myTokenInput}
                    onChange={(e) => setMyTokenInput(e.target.value)}
                    placeholder="e.g. A001"
                    className="w-full px-4 py-3.5 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)]/40 text-center text-xl font-extrabold font-mono tracking-widest text-slate-800 dark:text-slate-100 placeholder-slate-350 uppercase focus:border-[var(--clinic-secondary)] focus:ring-2 focus:ring-[var(--clinic-secondary)]/10 outline-none transition-all"
                    required
                    autoComplete="off"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={!myTokenInput.trim()}
                  className="w-full py-4 px-4 rounded-2xl bg-sky-650 hover:bg-sky-750 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-655 text-white font-extrabold text-sm shadow-lg shadow-sky-500/10 hover:shadow-sky-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer border-none"
                >
                  Start Tracking
                  <ArrowRight className="w-4.5 h-4.5" />
                </button>
              </form>
            </div>

            {/* Quick selection of active waiting tokens */}
            {waitingPatients.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-2xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center">
                  Quick Select Active Tokens
                </h3>
                <div className="flex flex-wrap gap-2 justify-center">
                  {waitingPatients.map((patient) => (
                    <button
                      key={patient.id}
                      onClick={() => handleQuickSelect(patient.tokenNumber)}
                      className={`px-3.5 py-2 rounded-xl border font-extrabold font-mono text-xs transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm backdrop-blur-md ${
                        patient.isEmergency
                          ? "bg-rose-500/10 border-rose-500/30 text-rose-655 dark:text-rose-455 hover:bg-rose-500/15"
                          : "bg-[var(--card-bg)] border-[var(--card-border)] text-slate-700 dark:text-slate-300 hover:bg-[var(--clinic-primary-light)] hover:text-[var(--clinic-primary)] hover:border-[var(--clinic-primary)]/45"
                      }`}
                    >
                      {patient.tokenNumber} {patient.isEmergency && "🚨"}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-450 dark:text-slate-500 text-xs font-semibold">
                No active patients registered in the queue today.
              </div>
            )}
          </div>
        )}

        {/* State 2: Patient is tracking their token */}
        {myToken && (
          <div className="w-full max-w-lg mx-auto space-y-6 animate-slide-up">
            
            {/* Celebration: Token has been called */}
            {tokenStatus === "called" && (
              <div className="glass-card overflow-hidden border-[var(--clinic-primary)]/30 bg-[var(--clinic-primary-light)] p-8 text-center space-y-6 pulse-glow relative">
                {/* SVG Confetti background for celebratory visuals */}
                <div className="absolute inset-0 pointer-events-none -z-10 opacity-70">
                  <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="20%" cy="30%" r="4" fill="#14b8a6" className="animate-bounce" style={{ animationDelay: '0.2s', animationDuration: '3s' }} />
                    <circle cx="80%" cy="20%" r="5" fill="#38bdf8" className="animate-bounce" style={{ animationDelay: '0.5s', animationDuration: '4s' }} />
                    <circle cx="50%" cy="80%" r="3" fill="#fbbf24" className="animate-bounce" style={{ animationDelay: '0.8s', animationDuration: '2.5s' }} />
                    <rect x="15%" y="70%" width="8" height="8" rx="2" fill="#14b8a6" transform="rotate(45)" className="animate-pulse" />
                    <rect x="85%" y="65%" width="6" height="6" rx="1" fill="#fbbf24" transform="rotate(15)" className="animate-pulse" />
                  </svg>
                </div>

                <div className="mx-auto w-16 h-16 rounded-full bg-teal-500/20 text-teal-650 dark:text-teal-400 flex items-center justify-center animate-bounce">
                  <UserCheck className="w-8 h-8" />
                </div>
                
                <div className="space-y-3">
                  <h2 className="text-3xl font-extrabold text-teal-650 dark:text-teal-450">
                    {"It's Your Turn!"}
                  </h2>
                  <div className="py-2.5 px-6 bg-[var(--clinic-primary)]/10 rounded-2xl inline-block">
                    <span className="font-mono text-4xl font-extrabold text-slate-800 dark:text-slate-100 tracking-widest">{myToken}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-350 font-bold max-w-sm mx-serif mx-auto leading-relaxed pt-2">
                    Please proceed directly to the clinical consultation room. A healthcare provider is ready to assist you.
                  </p>
                </div>
              </div>
            )}

            {/* Info Card: Token is currently waiting */}
            {tokenStatus === "waiting" && (
              <div className="glass-card overflow-hidden">
                {/* Visual Ticket Header */}
                <div className="bg-gradient-to-r from-teal-500/10 to-sky-500/10 border-b border-[var(--card-border)] p-6 text-center relative">
                  {/* Decorative ticket notch cutouts on sides */}
                  <div className="absolute -left-3 bottom-0 w-6 h-6 rounded-full bg-[var(--background)] border border-[var(--card-border)]"></div>
                  <div className="absolute -right-3 bottom-0 w-6 h-6 rounded-full bg-[var(--background)] border border-[var(--card-border)]"></div>

                  <span className="text-[10px] font-extrabold text-slate-455 dark:text-slate-500 uppercase tracking-widest block mb-1">
                    Active Ticket Info
                  </span>
                  
                  {/* Visual Ticket Container */}
                  <div className="max-w-xs mx-auto border-2 border-dashed border-[var(--card-border)] bg-[var(--card-bg)]/60 rounded-2xl p-4 shadow-sm my-2">
                    <div className="flex items-center justify-between text-[9px] text-slate-400 font-extrabold uppercase border-b border-[var(--card-border)] pb-1.5 mb-2.5">
                      <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3 text-slate-400" /> Queue Cure</span>
                      <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3 text-slate-400" /> Today</span>
                    </div>
                    
                    <h2 className="text-5xl font-extrabold font-mono tracking-wider text-slate-800 dark:text-slate-100">
                      {myToken}
                    </h2>
                    
                    {myPatientRecord && (
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-extrabold mt-1.5 uppercase truncate">
                        Registered Name: {myPatientRecord.name}
                      </p>
                    )}
                  </div>
                </div>

                {/* Grid details */}
                <div className="grid grid-cols-2 divide-x divide-[var(--card-border)] border-b border-[var(--card-border)]">
                  {/* Current Serving */}
                  <div className="p-5 text-center space-y-1">
                    <span className="text-3xs font-extrabold text-slate-400 dark:text-slate-550 uppercase tracking-wider block">
                      Currently Serving
                    </span>
                    <span className="text-3xl font-extrabold font-mono text-teal-650 dark:text-teal-400 block animate-pulse">
                      {currentToken}
                    </span>
                  </div>

                  {/* Tokens Ahead */}
                  <div className="p-5 text-center space-y-1">
                    <span className="text-3xs font-extrabold text-slate-400 dark:text-slate-555 uppercase tracking-wider block">
                      Tokens Ahead
                    </span>
                    <span className="text-3xl font-extrabold font-mono text-slate-800 dark:text-slate-100 block">
                      {tokensAhead}
                    </span>
                  </div>
                </div>

                {/* Estimated wait time */}
                <div className="p-6 text-center bg-[var(--clinic-primary-light)] dark:bg-[var(--clinic-primary)]/5 flex flex-col justify-center items-center">
                  <div className="flex items-center gap-1.5 text-teal-650 dark:text-teal-450 text-xs font-extrabold uppercase tracking-wider mb-2">
                    <Timer className="w-4 h-4 animate-pulse" />
                    Estimated Wait Time
                  </div>
                  <span className="text-4xl font-extrabold text-slate-800 dark:text-slate-100">
                    {estimatedWait === 0 ? "Under 5" : estimatedWait}
                    <span className="text-sm font-bold text-slate-400 ml-1.5">minutes</span>
                  </span>
                  <p className="text-[10px] text-slate-450 dark:text-slate-500 mt-2 font-bold max-w-xs leading-normal">
                    Calculated dynamically from {tokensAhead} patients ahead × {averageConsultationTime}m average consult.
                  </p>
                </div>

                {/* Render Queue Progress Visualization */}
                <div className="p-6 border-t border-[var(--card-border)] bg-[var(--card-bg)]/20">
                  {renderQueueProgress()}
                </div>
              </div>
            )}

            {/* State: Token not found in active list (likely reset or invalid input) */}
            {tokenStatus === "not_found" && (
              <div className="glass-card p-8 text-center border-[var(--clinic-accent)]/20 bg-[var(--clinic-accent)]/5 space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-200">
                    Token Not Found in Active Queue
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed font-semibold">
                    Token <span className="font-bold font-mono">{myToken}</span> is not registered in the active queue. It may have been completed, canceled, or the database was reset.
                  </p>
                </div>
              </div>
            )}

            {/* Reassuring helpful notice for waiting patients */}
            {tokenStatus === "waiting" && (
              <div className="p-4 rounded-2xl bg-[var(--card-bg)]/40 border border-[var(--card-border)] text-slate-500 dark:text-slate-400 text-[11px] text-center leading-normal font-semibold">
                🔔 <span className="text-slate-700 dark:text-slate-350">Tip:</span> {"Ensure you keep this screen open. We will update the counter in real time and trigger an alert when it's your turn."}
              </div>
            )}

            {/* Emergency Request Status section */}
            {myEmergencyRequest && (
              <div className={`p-5 rounded-2xl border text-center space-y-3 animate-slide-up ${
                myEmergencyRequest.status === "pending"
                  ? "border-amber-500/25 bg-amber-500/5 text-amber-855 dark:text-amber-300"
                  : myEmergencyRequest.status === "approved"
                    ? "border-emerald-500/25 bg-emerald-550/5 text-emerald-855 dark:text-emerald-300"
                    : "border-slate-500/25 bg-slate-500/5 text-slate-700 dark:text-slate-400"
              }`}>
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-1.5 text-2xs font-extrabold uppercase tracking-wider">
                    <ShieldAlert className="w-4 h-4 shrink-0 text-current" />
                    Emergency Priority Status
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-extrabold tracking-wide inline-block ${
                    myEmergencyRequest.status === "pending"
                      ? "bg-amber-550/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                      : myEmergencyRequest.status === "approved"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-slate-500/10 text-slate-550 dark:text-slate-400 border border-slate-500/20"
                  }`}>
                    {myEmergencyRequest.status === "pending" && "🟠 Awaiting receptionist review"}
                    {myEmergencyRequest.status === "approved" && "🚨 Emergency priority approved"}
                    {myEmergencyRequest.status === "rejected" && "⚪ Emergency priority declined"}
                  </span>
                  <p className="text-xs font-semibold leading-relaxed max-w-sm mt-1">
                    {myEmergencyRequest.status === "pending" && "Emergency request submitted. Clinic staff will review it shortly."}
                    {myEmergencyRequest.status === "approved" && "Emergency priority approved."}
                    {myEmergencyRequest.status === "rejected" && "Your emergency request was reviewed. Please continue waiting for your scheduled turn."}
                  </p>
                </div>
              </div>
            )}

            {/* Quick Action bar: change/clear token */}
            <div className="flex justify-center">
              <button
                onClick={handleClearTrackedToken}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-650 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors focus:ring-2 focus:ring-slate-500/20 outline-none cursor-pointer border-none"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {tokenStatus === "called" ? "Track Another Token" : "Change Tracked Token"}
              </button>
            </div>

          </div>
        )}

        {/* Emergency Request Trigger Card */}
        {(!myEmergencyRequest || myEmergencyRequest.status === "rejected") && (
          <div className="w-full max-w-md md:max-w-lg mx-auto mt-8 border border-rose-500/15 bg-rose-500/5 dark:bg-rose-500/5 rounded-3xl p-5 text-center sm:text-left sm:flex sm:items-center sm:justify-between gap-5 transition-all animate-slide-up">
            <div className="flex-1 space-y-1">
              <h3 className="text-sm font-extrabold text-slate-850 dark:text-slate-105 flex items-center justify-center sm:justify-start gap-1.5">
                <span className="text-base text-rose-600 dark:text-rose-400">🚨</span>
                Emergency Priority Request
              </h3>
              <p className="text-2xs text-slate-500 dark:text-slate-400 font-semibold leading-normal max-w-sm">
                Experiencing chest pain, breathing difficulty, severe bleeding, or child with high fever? Request immediate priority clinical review.
              </p>
            </div>
            <button
              onClick={() => setIsRequestModalOpen(true)}
              className="mt-4 sm:mt-0 px-4 py-3 bg-rose-655 hover:bg-rose-750 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-rose-500/10 hover:shadow-rose-500/20 active:scale-[0.98] transition-all cursor-pointer border-none shrink-0"
            >
              Request Emergency Priority
            </button>
          </div>
        )}

      </main>

      <EmergencyRequestModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        initialToken={myToken || ""}
        onSubmit={async (token, reason) => {
          if (!queueManager) return;
          await queueManager.sendAction("emergencyRequestSubmitted", {
            tokenNumber: token,
            reason: reason
          });
        }}
      />
    </div>
  );
}
