"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { 
  useRealtimeQueue, 
  QueueState 
} from "@/hooks/useRealtimeQueue";
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
  CheckCircle,
  Lock,
  LogOut,
  Eye,
  EyeOff,
  User
} from "lucide-react";

export default function ReceptionistPage() {
  const { queueManager } = useRealtimeQueue();
  const { addToast } = useToast();
  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [patientName, setPatientName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Authentication State
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Action Loading States
  const [isAddingPatient, setIsAddingPatient] = useState(false);
  const [isCallingNext, setIsCallingNext] = useState(false);
  const [isUpdatingConsultTime, setIsUpdatingConsultTime] = useState(false);
  const [isResettingQueue, setIsResettingQueue] = useState(false);
  const [reviewingRequestIds, setReviewingRequestIds] = useState<Record<string, boolean>>({});

  // Sync state on updates with complete lifecycle cleanup
  useEffect(() => {
    if (!queueManager) return;

    const handleQueueUpdated = (state: QueueState) => {
      if (process.env.NODE_ENV === "development") {
        console.log("[Receptionist] Queue state updated:", state);
        console.log("[CLIENT]\nReceived queueUpdated\nCurrent Token: " + (state.currentToken || "null") + "\nQueue Length: " + state.waitingPatients.filter(p => p.status === "waiting").length + "\n");
      }
      setQueueState(state);
    };

    const handlePatientAdded = (data: { name: string; tokenNumber: string }) => {
      if (process.env.NODE_ENV === "development") {
        console.log("[Receptionist] Patient added:", data);
      }
      addToast("Patient registered: " + data.name + " (" + data.tokenNumber + ")", "success");
    };

    const handleTokenAdvanced = (data: { currentToken: string; patientName: string }) => {
      if (process.env.NODE_ENV === "development") {
        console.log("[Receptionist] Token called:", data);
      }
      addToast("Called next patient: " + data.patientName + " (" + data.currentToken + ")", "info");
    };

    const handleQueueReset = () => {
      if (process.env.NODE_ENV === "development") {
        console.log("[Receptionist] Queue database reset");
      }
      addToast("Queue database cleared successfully", "warning");
    };

    const handleConsultationTimeUpdated = (data: { minutes: number }) => {
      if (process.env.NODE_ENV === "development") {
        console.log("[Receptionist] Average consultation time updated:", data);
      }
      addToast("Consultation duration set to " + data.minutes + " mins", "info");
    };

    const handleEmergencyRequestSubmitted = (data: { tokenNumber: string; reason: string }) => {
      if (process.env.NODE_ENV === "development") {
        console.log("[Receptionist] Emergency request submitted broadcast:", data);
      }
      addToast("🚨 Emergency request submitted for Token " + data.tokenNumber + "!", "error");
    };

    const handleEmergencyRequestReviewed = (data: { tokenNumber: string; status: "approved" | "rejected" }) => {
      if (process.env.NODE_ENV === "development") {
        console.log("[Receptionist] Emergency request reviewed broadcast:", data);
      }
      addToast("Emergency request for " + data.tokenNumber + " " + data.status + ".", data.status === "approved" ? "success" : "info");
    };

    // Subscriptions
    queueManager.on("queueUpdated", handleQueueUpdated);
    queueManager.on("patientAdded", handlePatientAdded);
    queueManager.on("tokenAdvanced", handleTokenAdvanced);
    queueManager.on("queueReset", handleQueueReset);
    queueManager.on("consultationTimeUpdated", handleConsultationTimeUpdated);
    queueManager.on("emergencyRequestSubmitted", handleEmergencyRequestSubmitted);
    queueManager.on("emergencyRequestReviewed", handleEmergencyRequestReviewed);

    // Initial state request handshake
    queueManager.sendAction("queueUpdated");

    // Cleanup listeners
    return () => {
      queueManager.off("queueUpdated", handleQueueUpdated);
      queueManager.off("patientAdded", handlePatientAdded);
      queueManager.off("tokenAdvanced", handleTokenAdvanced);
      queueManager.off("queueReset", handleQueueReset);
      queueManager.off("consultationTimeUpdated", handleConsultationTimeUpdated);
      queueManager.off("emergencyRequestSubmitted", handleEmergencyRequestSubmitted);
      queueManager.off("emergencyRequestReviewed", handleEmergencyRequestReviewed);
    };
  }, [queueManager, addToast]);

  // Check auth session storage on mount to avoid server-side render mismatch
  useEffect(() => {
    const adminSession = sessionStorage.getItem("isAdmin");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoggedIn(adminSession === "true");
  }, []);

  // Autofocus input on initial page load once logged in
  useEffect(() => {
    if (isLoggedIn) {
      inputRef.current?.focus();
    }
  }, [isLoggedIn]);

  // Keyboard shortcut: Pressing Escape focuses the register input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isLoggedIn) {
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLoggedIn]);

  // Handlers for authentication
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    
    // Simulate slight lag for a premium feel
    setTimeout(() => {
      if (username.trim() === "admin" && password === "admin") {
        sessionStorage.setItem("isAdmin", "true");
        setIsLoggedIn(true);
        addToast("Logged in successfully", "success");
      } else {
        addToast("Invalid username or password", "error");
      }
      setIsLoggingIn(false);
    }, 450);
  };

  // Handlers for logout
  const handleLogout = () => {
    sessionStorage.removeItem("isAdmin");
    setIsLoggedIn(false);
    setUsername("");
    setPassword("");
    addToast("Logged out successfully", "info");
  };  // Form submission: Add patient
  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = patientName.trim();
    if (!trimmedName || !queueManager || isAddingPatient) return;

    setIsAddingPatient(true);
    try {
      await queueManager.sendAction("patientAdded", { name: trimmedName });
      setPatientName("");
      // Success toast is already handled in useEffect for handlePatientAdded broadcast, so we don't duplicate it here.
    } catch (err) {
      const error = err as Error;
      addToast(error.message || "Failed to register patient.", "error");
    } finally {
      setIsAddingPatient(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
    }
  };

  // Call Next Patient
  const handleCallNext = async () => {
    if (!queueManager || isCallingNext) return;
    setIsCallingNext(true);
    try {
      await queueManager.sendAction("tokenAdvanced");
    } catch (err) {
      const error = err as Error;
      addToast(error.message || "Failed to call next patient.", "error");
    } finally {
      setIsCallingNext(false);
    }
  };

  // Update Consultation Time
  const handleUpdateConsultationTime = async (val: number) => {
    if (!queueManager || isUpdatingConsultTime) return;
    if (val < 1 || val > 60) {
      addToast("Consultation time must be between 1 and 60 minutes.", "warning");
      return;
    }
    setIsUpdatingConsultTime(true);
    try {
      await queueManager.sendAction("consultationTimeUpdated", { minutes: val });
    } catch (err) {
      const error = err as Error;
      addToast(error.message || "Failed to update consultation time.", "error");
    } finally {
      setIsUpdatingConsultTime(false);
    }
  };

  // Reset Queue
  const handleResetQueue = async () => {
    if (!queueManager || isResettingQueue) return;
    if (confirm("Are you sure you want to reset the queue state and clear all patient records?")) {
      setIsResettingQueue(true);
      try {
        await queueManager.sendAction("queueReset");
      } catch (err) {
        const error = err as Error;
        addToast(error.message || "Failed to reset database.", "error");
      } finally {
        setIsResettingQueue(false);
      }
    }
  };

  const handleReviewEmergency = async (requestId: string, tokenNumber: string, status: "approved" | "rejected") => {
    if (!queueManager || reviewingRequestIds[requestId]) return;
    setReviewingRequestIds(prev => ({ ...prev, [requestId]: true }));
    try {
      await queueManager.sendAction("emergencyRequestReviewed", {
        requestId,
        tokenNumber,
        status
      });
    } catch (err) {
      const error = err as Error;
      addToast(error.message || "Failed to review emergency request.", "error");
    } finally {
      setReviewingRequestIds(prev => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
    }
  };

  // Derived state from authoritative QueueState only
  // Sort waiting patients: emergency first (FIFO among themselves), then normal patients (FIFO among themselves)
  const waitingPatients = queueState?.waitingPatients
    ? [...queueState.waitingPatients]
        .filter(p => p.status === "waiting")
        .sort((a, b) => {
          if (a.isEmergency && !b.isEmergency) return -1;
          if (!a.isEmergency && b.isEmergency) return 1;
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        })
    : [];

  const calledPatients = queueState?.waitingPatients.filter(p => p.status === "called") || [];
  
  // Show most recently called first in history, sorted by calledAt DESC
  const sortedCalledPatients = [...calledPatients].sort((a, b) => {
    const timeA = a.calledAt ? new Date(a.calledAt).getTime() : 0;
    const timeB = b.calledAt ? new Date(b.calledAt).getTime() : 0;
    return timeB - timeA;
  });

  const currentToken = queueState?.currentToken || "—";
  const nextPatient = waitingPatients[0];
  const nextToken = nextPatient ? nextPatient.tokenNumber : "—";
  const queueLength = waitingPatients.length;
  const avgConsultation = queueState?.averageConsultationTime || 5;

  // Sort: pending first, then approved, then rejected.
  // Within pending: oldest first (to handle FIFO review)
  // Within others: newest first (to see recent decisions)
  const sortedEmergencyRequests = queueState?.emergencyRequests
    ? [...queueState.emergencyRequests].sort((a, b) => {
        const statusOrder = { pending: 0, approved: 1, rejected: 2 };
        if (statusOrder[a.status] !== statusOrder[b.status]) {
          return statusOrder[a.status] - statusOrder[b.status];
        }
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        if (a.status === "pending") {
          return timeA - timeB; // oldest pending first
        }
        return timeB - timeA; // newest reviewed first
      })
    : [];

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

  // Render loading screen while resolving auth status to avoid hydration flash
  if (isLoggedIn === null) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center min-h-screen bg-slate-50 dark:bg-[#0b1329]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-teal-500/30 border-t-teal-650 dark:border-teal-400/30 dark:border-t-teal-400 animate-spin"></div>
          <p className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest animate-pulse">
            Verifying Portal Access...
          </p>
        </div>
      </div>
    );
  }

  // Render Login screen if not logged in
  if (isLoggedIn === false) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden bg-radial from-teal-500/5 via-transparent to-transparent min-h-screen">
        {/* Background patterns */}
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-teal-500/5 blur-3xl -z-10 animate-pulse" style={{ animationDuration: '8s' }}></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-sky-500/5 blur-3xl -z-10 animate-pulse" style={{ animationDuration: '10s' }}></div>

        {/* Top bar with Back Button and Theme Toggle */}
        <div className="absolute top-5 left-5 right-5 flex justify-between items-center z-40">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-855 dark:text-slate-400 dark:hover:text-slate-200 backdrop-blur-md transition-all duration-200 text-xs font-bold shadow-sm hover:shadow-md cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <ThemeToggle />
        </div>

        <div className="max-w-md w-full text-center space-y-6 animate-slide-up mt-8">
          {/* Badge & Welcome Header */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400">
              <span>🔒 Staff Only Portal</span>
            </div>
            
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-850 dark:text-slate-100">
              Receptionist Login
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed font-semibold">
              Receptionists use this dashboard to register patients and manage the live queue.
            </p>
          </div>

          {/* Login Card */}
          <div className="glass-card p-8 text-left space-y-6">
            <div className="flex items-center gap-3.5 pb-4 border-b border-[var(--card-border)]">
              <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-650 dark:text-teal-400">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">
                  Sign In
                </h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-wider">
                  Clinical Session Access
                </p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-2xs font-extrabold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-2">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter admin username"
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)]/40 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-[var(--clinic-primary)] dark:focus:border-[var(--clinic-primary)] focus:ring-2 focus:ring-[var(--clinic-primary)]/10 outline-none transition-all font-semibold text-sm"
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <label className="block text-2xs font-extrabold text-slate-500 dark:text-slate-455 uppercase tracking-wider mb-2">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full pl-10 pr-12 py-3 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)]/40 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-[var(--clinic-primary)] dark:focus:border-[var(--clinic-primary)] focus:ring-2 focus:ring-[var(--clinic-primary)]/10 outline-none transition-all font-semibold text-sm"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 dark:text-slate-500 hover:text-slate-655 dark:hover:text-slate-350 cursor-pointer transition-colors outline-none border-none bg-transparent"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn || !username.trim() || !password}
                className="w-full mt-2 py-3.5 px-4 rounded-2xl bg-[var(--clinic-primary)] hover:bg-[var(--clinic-primary-hover)] disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white font-extrabold text-sm shadow-lg shadow-teal-500/10 hover:shadow-teal-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed border-none font-bold"
              >
                {isLoggingIn ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                    Authenticating...
                  </>
                ) : (
                  <>
                    <span>Access Dashboard</span>
                    <ChevronRight className="w-4.5 h-4.5" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Credentials Helper Card */}
          <div className="glass-card p-5 bg-teal-500/5 dark:bg-teal-500/5 border border-teal-500/10 text-center space-y-2">
            <h4 className="text-2xs font-extrabold text-teal-600 dark:text-teal-400 uppercase tracking-widest">
              🔑 Demo Credentials
            </h4>
            <div className="flex justify-center gap-6 text-xs text-slate-600 dark:text-slate-350 font-semibold">
              <div>
                <span className="text-slate-400 dark:text-slate-500 font-medium">Username:</span>{" "}
                <code className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded font-bold font-mono">admin</code>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 font-medium">Password:</span>{" "}
                <code className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded font-bold font-mono">admin</code>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

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
            <button
              onClick={() => {
                const analyticsUrl = process.env.NEXT_PUBLIC_ANALYTICS_URL || "http://localhost:8000";
                window.open(`${analyticsUrl}/analytics/dashboard/`, "_blank");
              }}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all focus:ring-2 focus:ring-slate-500/20 outline-none cursor-pointer shadow-sm hover:shadow-md"
              title="Open Analytics Dashboard"
            >
              📊 Analytics Dashboard
            </button>
            <ThemeToggle />
            <button
              onClick={handleResetQueue}
              disabled={isResettingQueue}
              className="px-3.5 py-2.5 rounded-xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-455 text-xs font-bold flex items-center gap-1.5 transition-all focus:ring-2 focus:ring-rose-500/20 outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Reset queue database"
            >
              {isResettingQueue ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-rose-550/30 border-t-rose-600 animate-spin"></div>
                  Resetting...
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Database
                </>
              )}
            </button>
            <button
              onClick={handleLogout}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all focus:ring-2 focus:ring-slate-500/20 outline-none cursor-pointer shadow-sm hover:shadow-md"
              title="Logout of portal session"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
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
                  disabled={isAddingPatient}
                  className="w-full px-4 py-3 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)]/40 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-[var(--clinic-primary)] dark:focus:border-[var(--clinic-primary)] focus:ring-2 focus:ring-[var(--clinic-primary)]/10 outline-none transition-all font-medium text-sm disabled:opacity-75 disabled:cursor-not-allowed"
                  required
                  autoComplete="off"
                />
              </div>
              
              <button
                type="submit"
                disabled={!patientName.trim() || isAddingPatient}
                className="w-full py-3.5 px-4 rounded-2xl bg-[var(--clinic-primary)] hover:bg-[var(--clinic-primary-hover)] disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white font-extrabold text-sm shadow-lg shadow-teal-500/10 hover:shadow-teal-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed border-none font-bold"
              >
                {isAddingPatient ? (
                  <>
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                    Registering...
                  </>
                ) : (
                  <>
                    <Plus className="w-4.5 h-4.5" />
                    Add to Queue
                  </>
                )}
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
              disabled={waitingPatients.length === 0 || isCallingNext}
              className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-sky-600 to-teal-650 hover:from-sky-700 hover:to-teal-700 disabled:from-slate-200 dark:disabled:from-slate-800 disabled:to-slate-200 dark:disabled:to-slate-800 disabled:text-slate-405 text-white font-extrabold text-base shadow-xl shadow-sky-500/10 hover:shadow-sky-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed border-none"
            >
              {isCallingNext ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                  Calling Next Patient...
                </>
              ) : (
                <>
                  Call Next Patient
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
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
                  disabled={avgConsultation <= 1 || isUpdatingConsultTime}
                  className="w-10 h-10 rounded-xl bg-[var(--card-bg)]/80 hover:bg-[var(--card-bg)] border border-[var(--card-border)] text-slate-800 dark:text-slate-200 flex items-center justify-center font-extrabold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  -
                </button>
                
                <div className="flex-1 flex items-center justify-center border border-[var(--card-border)] rounded-xl bg-[var(--card-bg)]/40 h-10 px-3 opacity-90">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    disabled={isUpdatingConsultTime}
                    value={avgConsultation}
                    onChange={(e) => handleUpdateConsultationTime(parseInt(e.target.value, 10) || 1)}
                    className="w-full text-center bg-transparent border-none outline-none font-extrabold text-sm text-slate-800 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-xs text-slate-400 font-extrabold ml-1">min</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleUpdateConsultationTime(avgConsultation + 1)}
                  disabled={isUpdatingConsultTime}
                  className="w-10 h-10 rounded-xl bg-[var(--card-bg)]/80 hover:bg-[var(--card-bg)] border border-[var(--card-border)] text-slate-800 dark:text-slate-200 flex items-center justify-center font-extrabold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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

          {/* 🚨 Emergency Requests Card */}
          <div className="glass-card p-6 border-rose-500/20 bg-rose-500/5 space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-extrabold text-slate-850 dark:text-slate-100 flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  🚨
                </span>
                Emergency Requests
              </h2>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-wider">
                Receptionist Review
              </span>
            </div>

            {sortedEmergencyRequests.length === 0 ? (
              <div className="text-center py-6 text-slate-450 dark:text-slate-500 text-xs font-semibold">
                No active emergency priority requests.
              </div>
            ) : (
              <div className="space-y-4 divide-y divide-slate-100 dark:divide-slate-800 max-h-[300px] overflow-y-auto pr-1">
                {sortedEmergencyRequests.map((req) => (
                  <div key={req.id} className="pt-4 first:pt-0 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 font-extrabold font-mono text-xs border border-rose-500/20">
                          {req.tokenNumber}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          Time Submitted: {formatTime(req.createdAt)}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold tracking-wide flex items-center gap-1 ${
                          req.status === "pending"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                            : req.status === "approved"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : "bg-slate-500/10 text-slate-550 dark:text-slate-400 border border-slate-500/20"
                        }`}>
                          {req.status === "pending" && "🟠 Pending"}
                          {req.status === "approved" && "🟢 Approved"}
                          {req.status === "rejected" && "⚪ Rejected"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold leading-relaxed break-words">
                        {req.reason}
                      </p>
                    </div>
                    {req.status === "pending" && (
                      <div className="flex items-center gap-2 mt-2 md:mt-0 shrink-0">
                        <button
                          onClick={() => handleReviewEmergency(req.id, req.tokenNumber, "approved")}
                          disabled={!!reviewingRequestIds[req.id]}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-2xs font-extrabold transition-all shadow-sm active:scale-95 border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {reviewingRequestIds[req.id] ? (
                            <>
                              <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                              Approve...
                            </>
                          ) : (
                            "✅ Approve Priority"
                          )}
                        </button>
                        <button
                          onClick={() => handleReviewEmergency(req.id, req.tokenNumber, "rejected")}
                          disabled={!!reviewingRequestIds[req.id]}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-2xs font-extrabold transition-all shadow-sm active:scale-95 border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {reviewingRequestIds[req.id] ? (
                            <>
                              <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                              Reject...
                            </>
                          ) : (
                            "❌ Reject Request"
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
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
                        className={`py-3 flex items-center justify-between gap-3 animate-fade-in transition-all ${
                          patient.isEmergency 
                            ? "border border-rose-500/30 rounded-2xl bg-rose-500/5 px-4 my-1.5 shadow-sm" 
                            : "first:pt-0 last:pb-0 border-b border-dashed border-slate-100 dark:border-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-14 rounded-xl flex items-center justify-center font-extrabold font-mono text-sm tracking-wide border relative ${
                            patient.isEmergency 
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30" 
                              : "bg-[var(--clinic-primary)]/10 text-[var(--clinic-primary)] border-[var(--clinic-primary)]/20"
                          }`}>
                            {patient.tokenNumber}
                            {patient.isEmergency && (
                              <span className="absolute -top-1.5 -right-1.5 text-2xs" title="Emergency Approved">
                                🚨
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate max-w-[90px] flex items-center gap-1">
                              {patient.name}
                              {patient.isEmergency && <span className="text-2xs" title="Emergency Approved">🚨</span>}
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
                          <span className="text-[10px] text-slate-550 dark:text-slate-455 font-bold flex items-center gap-0.5">
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
                    <p className="font-bold text-xs text-slate-500 dark:text-slate-455">No Called Patients</p>
                    <p className="text-[10px] mt-0.5 max-w-[150px] mx-auto text-slate-400">Patients will appear here once called.</p>
                  </div>
                ) : (
                  sortedCalledPatients.map((patient) => (
                    <div 
                      key={patient.id} 
                      className={`py-3.5 flex items-center justify-between gap-3 text-xs animate-fade-in transition-all ${
                        patient.isEmergency 
                          ? "border border-rose-500/30 rounded-2xl bg-rose-500/5 px-4 my-1.5 shadow-sm" 
                          : "first:pt-0 last:pb-0 border-b border-dashed border-slate-100 dark:border-slate-800"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`font-bold font-mono text-xs px-2 py-0.5 rounded border relative ${
                          patient.isEmergency 
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-455 border-rose-500/30" 
                            : "bg-[var(--card-bg)] text-slate-650 dark:text-slate-400 border-[var(--card-border)]"
                        }`}>
                          {patient.tokenNumber}
                          {patient.isEmergency && (
                            <span className="absolute -top-1.5 -right-1.5 text-2xs" title="Emergency Approved">
                              🚨
                            </span>
                          )}
                        </span>
                        <div>
                          <p className="font-extrabold text-slate-750 dark:text-slate-200 truncate max-w-[100px] flex items-center gap-1">
                            {patient.name}
                            {patient.isEmergency && <span className="text-2xs" title="Emergency Approved">🚨</span>}
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
                        <span className="text-[10px] text-slate-400 dark:text-slate-455 font-bold">
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
