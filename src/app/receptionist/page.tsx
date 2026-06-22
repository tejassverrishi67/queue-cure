"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { 
  useSocket, 
  QueueState 
} from "@/hooks/useSocket";
import ThemeToggle from "@/components/ThemeToggle";
import { useToast } from "@/components/Toast";
import { 
  Plus, 
  ChevronRight, 
  Clock, 
  Users, 
  Activity, 
  ArrowLeft, 
  RotateCcw, 
  AlertCircle,
  Timer,
  BarChart3,
  UserCheck,
  CheckCircle
} from "lucide-react";

export default function ReceptionistPage() {
  const { socket } = useSocket();
  const { addToast } = useToast();
  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [patientName, setPatientName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync state on socket updates with complete lifecycle cleanup
  useEffect(() => {
    if (!socket) return;

    const handleQueueUpdated = (state: QueueState) => {
      console.log("[Receptionist] Queue state updated:", state);
      console.log(`[CLIENT]\nReceived queueUpdated\nCurrent Token: ${state.currentToken || "null"}\nQueue Length: ${state.waitingPatients.filter(p => p.status === "waiting").length}\n`);
      setQueueState(state);
    };

    const handlePatientAdded = (data: { name: string; tokenNumber: string }) => {
      console.log("[Receptionist] Patient added:", data);
      addToast(`Patient registered: ${data.name} (${data.tokenNumber})`, "success");
    };

    const handleTokenAdvanced = (data: { currentToken: string; patientName: string }) => {
      console.log("[Receptionist] Token called:", data);
      addToast(`Called next patient: ${data.patientName} (${data.currentToken})`, "info");
    };

    const handleQueueReset = () => {
      console.log("[Receptionist] Queue database reset");
      addToast("Queue database cleared successfully", "warning");
    };

    const handleConsultationTimeUpdated = (data: { minutes: number }) => {
      console.log("[Receptionist] Average consultation time updated:", data);
      addToast(`Consultation duration set to ${data.minutes} mins`, "info");
    };

    // Subscriptions
    socket.on("queueUpdated", handleQueueUpdated);
    socket.on("patientAdded", handlePatientAdded);
    socket.on("tokenAdvanced", handleTokenAdvanced);
    socket.on("queueReset", handleQueueReset);
    socket.on("consultationTimeUpdated", handleConsultationTimeUpdated);

    // Initial state request handshake
    socket.emit("requestQueue");

    // Cleanup listeners
    return () => {
      socket.off("queueUpdated", handleQueueUpdated);
      socket.off("patientAdded", handlePatientAdded);
      socket.off("tokenAdvanced", handleTokenAdvanced);
      socket.off("queueReset", handleQueueReset);
      socket.off("consultationTimeUpdated", handleConsultationTimeUpdated);
    };
  }, [socket, addToast]);

  // Autofocus input on initial page load
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keyboard shortcut: Pressing Escape focuses the register input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Form submission: Add patient
  const handleAddPatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim() || !socket) return;

    socket.emit("addPatient", { name: patientName });
    
    // Clear and refocus input instantly
    setPatientName("");
    setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
  };

  // Call Next Patient
  const handleCallNext = () => {
    if (!socket) return;
    socket.emit("callNext");
  };

  // Update Consultation Time
  const handleUpdateConsultationTime = (val: number) => {
    if (!socket || val < 1) return;
    socket.emit("updateAverageConsultationTime", { minutes: val });
  };

  // Reset Queue
  const handleResetQueue = () => {
    if (!socket) return;
    if (confirm("Are you sure you want to reset the queue state and clear all patient records?")) {
      socket.emit("resetQueue");
    }
  };

  // Derived state from authoritative QueueState only
  const waitingPatients = queueState?.waitingPatients.filter(p => p.status === "waiting") || [];
  const calledPatients = queueState?.waitingPatients.filter(p => p.status === "called") || [];
  
  // Show most recently called first in history
  const sortedCalledPatients = [...calledPatients].reverse();

  const currentToken = queueState?.currentToken || "—";
  const nextPatient = waitingPatients[0];
  const nextToken = nextPatient ? nextPatient.tokenNumber : "—";
  const queueLength = waitingPatients.length;
  const avgConsultation = queueState?.averageConsultationTime || 5;

  // Lightweight analytics calculations
  const patientsServedCount = calledPatients.length;
  const avgEstimatedWait = queueLength > 0 ? Math.round(((queueLength - 1) * avgConsultation) / 2) : 0;

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "—";
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Navbar Header */}
      <header className="border-b border-[var(--card-border)] bg-[var(--card-bg)]/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 py-4 transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link 
              href="/" 
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              aria-label="Back to landing page"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                  Receptionist Dashboard
                </h1>
              </div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {"Queue Cure '26 Clinical Core Management Portal"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            <ThemeToggle />
            <button
              onClick={handleResetQueue}
              className="px-3.5 py-2.5 rounded-xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-455 text-xs font-bold flex items-center gap-1.5 transition-all focus:ring-2 focus:ring-rose-500/20 outline-none cursor-pointer"
              title="Reset queue database"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Database
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Register Patient & Controls */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Serve Info & Action */}
          <div className="glass-card p-6 space-y-4">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Queue Status Summary
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[var(--clinic-primary-light)] border border-[var(--clinic-primary)]/10 dark:border-[var(--clinic-primary)]/20 rounded-2xl p-4 transition-colors">
                <span className="text-2xs text-teal-600 dark:text-teal-400 font-extrabold block mb-1 uppercase tracking-wider">Serving Token</span>
                <span className="text-3xl font-extrabold font-mono text-slate-800 dark:text-slate-100">
                  {currentToken}
                </span>
              </div>
              <div className="bg-[var(--clinic-secondary)]/5 border border-[var(--clinic-secondary)]/10 dark:border-[var(--clinic-secondary)]/20 rounded-2xl p-4 transition-colors">
                <span className="text-2xs text-sky-600 dark:text-sky-400 font-extrabold block mb-1 uppercase tracking-wider">Next Token</span>
                <span className="text-3xl font-extrabold font-mono text-slate-800 dark:text-slate-100">
                  {nextToken}
                </span>
              </div>
            </div>
          </div>

          {/* Add Patient Form */}
          <div className="glass-card p-6">
            <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
              <span className="p-1.5 rounded-lg bg-[var(--clinic-primary-light)] text-[var(--clinic-primary)] transition-colors">
                <Plus className="w-4.5 h-4.5" />
              </span>
              Register Patient
            </h2>
            <form onSubmit={handleAddPatient} className="space-y-4">
              <div>
                <label className="block text-2xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                  Patient Full Name
                </label>
                <input
                  type="text"
                  ref={inputRef}
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Enter name (e.g. John Doe)"
                  className="w-full px-4 py-3 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)]/40 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-[var(--clinic-primary)] dark:focus:border-[var(--clinic-primary)] focus:ring-2 focus:ring-[var(--clinic-primary)]/10 outline-none transition-all font-medium text-sm"
                  required
                  autoComplete="off"
                />
              </div>
              
              <button
                type="submit"
                disabled={!patientName.trim()}
                className="w-full py-3.5 px-4 rounded-2xl bg-[var(--clinic-primary)] hover:bg-[var(--clinic-primary-hover)] disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white font-extrabold text-sm shadow-lg shadow-teal-500/10 hover:shadow-teal-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed border-none font-bold"
              >
                <Plus className="w-4.5 h-4.5" />
                Add to Queue
              </button>
            </form>
            <p className="text-[10px] text-slate-400 mt-3 text-center">
              Press <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[9px]">Enter</kbd> to submit. Focus is returned automatically. Press <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[9px]">Esc</kbd> to refocus.
            </p>
          </div>

          {/* Queue Controls */}
          <div className="glass-card p-6 space-y-4">
            <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[var(--clinic-secondary)]/10 text-[var(--clinic-secondary)] transition-colors">
                <UserCheck className="w-4.5 h-4.5" />
              </span>
              Queue Controls
            </h2>
            
            <button
              onClick={handleCallNext}
              disabled={waitingPatients.length === 0}
              className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-sky-600 to-teal-650 hover:from-sky-700 hover:to-teal-700 disabled:from-slate-200 dark:disabled:from-slate-800 disabled:to-slate-200 dark:disabled:to-slate-800 disabled:text-slate-400 dark:disabled:text-slate-655 text-white font-extrabold text-base shadow-xl shadow-sky-500/10 hover:shadow-sky-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed border-none"
            >
              Call Next Patient
              <ChevronRight className="w-5 h-5" />
            </button>

            {waitingPatients.length === 0 && (
              <div className="flex items-center gap-2.5 p-3.5 rounded-2xl border border-[var(--clinic-accent)]/20 bg-[var(--clinic-accent)]/5 text-[var(--clinic-accent)] text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>The waiting list is currently empty.</span>
              </div>
            )}
          </div>

          {/* Configuration Settings */}
          <div className="glass-card p-6 space-y-4">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Timer className="w-4 h-4 text-slate-450" />
              Consultation Settings
            </h2>
            
            <div>
              <label className="block text-2xs font-extrabold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
                Average Consultation Duration
              </label>
              
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleUpdateConsultationTime(avgConsultation - 1)}
                  disabled={avgConsultation <= 1}
                  className="w-10 h-10 rounded-xl bg-[var(--card-bg)]/80 hover:bg-[var(--card-bg)] border border-[var(--card-border)] text-slate-800 dark:text-slate-200 flex items-center justify-center font-extrabold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  -
                </button>
                
                <div className="flex-1 flex items-center justify-center border border-[var(--card-border)] rounded-xl bg-[var(--card-bg)]/40 h-10 px-3">
                  <input
                    type="number"
                    min="1"
                    value={avgConsultation}
                    onChange={(e) => handleUpdateConsultationTime(parseInt(e.target.value, 10) || 1)}
                    className="w-full text-center bg-transparent border-none outline-none font-extrabold text-sm text-slate-800 dark:text-slate-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-xs text-slate-400 font-extrabold ml-1">min</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleUpdateConsultationTime(avgConsultation + 1)}
                  className="w-10 h-10 rounded-xl bg-[var(--card-bg)]/80 hover:bg-[var(--card-bg)] border border-[var(--card-border)] text-slate-800 dark:text-slate-200 flex items-center justify-center font-extrabold transition-colors cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Live Analytics & Dual list view (Side-by-Side) */}
        <div className="lg:col-span-2 space-y-6 flex flex-col">
          
          {/* Clinic Analytics Section */}
          <div className="glass-card p-6">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5 mb-4">
              <BarChart3 className="w-4 h-4" />
              Live Clinic Analytics
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="border border-[var(--card-border)] bg-[var(--card-bg)]/30 rounded-2xl p-4">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold block mb-1 uppercase tracking-wider">Served Today</span>
                <span className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{patientsServedCount}</span>
              </div>
              <div className="border border-[var(--card-border)] bg-[var(--card-bg)]/30 rounded-2xl p-4">
                <span className="text-[10px] text-slate-400 dark:text-slate-550 font-extrabold block mb-1 uppercase tracking-wider">Queue Length</span>
                <span className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{queueLength}</span>
              </div>
              <div className="border border-[var(--card-border)] bg-[var(--card-bg)]/30 rounded-2xl p-4">
                <span className="text-[10px] text-slate-400 dark:text-slate-550 font-extrabold block mb-1 uppercase tracking-wider">Avg Wait Time</span>
                <span className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">
                  {avgEstimatedWait} <span className="text-xs font-bold text-slate-400">mins</span>
                </span>
              </div>
              <div className="border border-[var(--card-border)] bg-[var(--card-bg)]/30 rounded-2xl p-4">
                <span className="text-[10px] text-slate-400 dark:text-slate-550 font-extrabold block mb-1 uppercase tracking-wider">Consult Duration</span>
                <span className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">
                  {avgConsultation} <span className="text-xs font-bold text-slate-400">mins</span>
                </span>
              </div>
            </div>
          </div>

          {/* Dual List Subgrid (Side-by-Side to eliminate excessive scroll) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 items-stretch">
            
            {/* Waiting Queue List */}
            <div className="glass-card flex flex-col overflow-hidden max-h-[500px]">
              <div className="px-5 py-4 border-b border-[var(--card-border)] flex items-center justify-between bg-[var(--card-bg)]/20">
                <div className="flex items-center gap-2">
                  <Users className="w-4.5 h-4.5 text-[var(--clinic-primary)]" />
                  <h3 className="font-extrabold text-slate-850 dark:text-slate-100 text-sm">
                    Waiting List
                  </h3>
                </div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">
                  Check-In Order
                </span>
              </div>

              {/* Scrollable list */}
              <div className="flex-1 overflow-y-auto p-4 divide-y divide-[var(--card-border)]/40">
                {waitingPatients.length === 0 ? (
                  <div className="h-full flex flex-col justify-center items-center text-center py-16 text-slate-405 space-y-3">
                    <Activity className="w-8 h-8 text-slate-300 dark:text-slate-700 animate-pulse" />
                    <div>
                      <p className="font-bold text-xs text-slate-500 dark:text-slate-400">Queue is Clear</p>
                      <p className="text-[10px] mt-0.5 max-w-[150px] mx-auto text-slate-400">Register new patients to populate the active queue.</p>
                    </div>
                  </div>
                ) : (
                  waitingPatients.map((patient, index) => {
                    const waitTime = index * avgConsultation;
                    return (
                      <div 
                        key={patient.id} 
                        className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 animate-fade-in"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-14 bg-[var(--clinic-primary)]/10 text-[var(--clinic-primary)] rounded-xl flex items-center justify-center font-extrabold font-mono text-sm tracking-wide border border-[var(--clinic-primary)]/20">
                            {patient.tokenNumber}
                          </div>
                          <div>
                            <p className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate max-w-[90px]">
                              {patient.name}
                            </p>
                            <span className="text-[10px] text-slate-400 flex items-center gap-0.5 mt-0.5 font-semibold">
                              <Clock className="w-3 h-3 text-slate-450" />
                              {formatTime(patient.createdAt)}
                            </span>
                          </div>
                        </div>

                        <div className="text-right flex flex-col items-end gap-0.5">
                          {index === 0 ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-extrabold tracking-wider uppercase animate-pulse">
                              Next Up
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-[var(--card-bg)] border border-[var(--card-border)] text-slate-500 dark:text-slate-400 text-[9px] font-bold">
                              Waiting
                            </span>
                          )}
                          <span className="text-[10px] text-slate-550 dark:text-slate-450 font-bold flex items-center gap-0.5">
                            <Timer className="w-3 h-3 text-slate-400" />
                            {waitTime} min
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Called Patients History (Audit Log) */}
            <div className="glass-card flex flex-col overflow-hidden max-h-[500px]">
              <div className="px-5 py-4 border-b border-[var(--card-border)] flex items-center justify-between bg-[var(--card-bg)]/20">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4.5 h-4.5 text-slate-500" />
                  <h3 className="font-extrabold text-slate-850 dark:text-slate-100 text-sm">
                    Called History
                  </h3>
                </div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">
                  Most Recent First
                </span>
              </div>

              {/* Scrollable list */}
              <div className="flex-1 overflow-y-auto p-4 divide-y divide-[var(--card-border)]/40">
                {sortedCalledPatients.length === 0 ? (
                  <div className="h-full flex flex-col justify-center items-center text-center py-16 text-slate-400">
                    <Clock className="w-8 h-8 text-slate-350 dark:text-slate-700 mb-2" />
                    <p className="font-bold text-xs text-slate-500 dark:text-slate-450">No Called Patients</p>
                    <p className="text-[10px] mt-0.5 max-w-[150px] mx-auto text-slate-400">Patients will appear here once called.</p>
                  </div>
                ) : (
                  sortedCalledPatients.map((patient) => (
                    <div 
                      key={patient.id} 
                      className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs animate-fade-in"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold font-mono text-xs text-slate-650 dark:text-slate-400 bg-[var(--card-bg)] px-2 py-0.5 rounded border border-[var(--card-border)]">
                          {patient.tokenNumber}
                        </span>
                        <div>
                          <p className="font-extrabold text-slate-750 dark:text-slate-200 truncate max-w-[100px]">
                            {patient.name}
                          </p>
                          <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                            Checked in: {formatTime(patient.createdAt)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-0.5 rounded bg-[var(--clinic-primary)]/10 text-[var(--clinic-primary)] text-[9px] font-extrabold tracking-wider uppercase block mb-1">
                          Called
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-450 font-bold">
                          {patient.calledAt ? formatTime(patient.calledAt) : "—"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

        </div>

      </main>
    </div>
  );
}
