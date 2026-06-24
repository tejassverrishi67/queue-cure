"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { 
  UserPlus, 
  Users, 
  ArrowRight, 
  Clock, 
  Zap, 
  AlertCircle, 
  Lock, 
  Smartphone 
} from "lucide-react";
import { useRealtimeQueue, QueueState } from "@/hooks/useRealtimeQueue";

export default function HomePage() {
  const { queueManager } = useRealtimeQueue();
  const [queueState, setQueueState] = useState<QueueState | null>(null);

  useEffect(() => {
    if (!queueManager) return;

    const handleQueueUpdated = (state: QueueState) => {
      setQueueState(state);
    };

    queueManager.on("queueUpdated", handleQueueUpdated);

    // Load initial queue state if server is online
    queueManager.sendAction("queueUpdated").catch((err) => {
      console.warn("[LandingPage] Failed to fetch initial queue state:", err);
    });

    return () => {
      queueManager.off("queueUpdated", handleQueueUpdated);
    };
  }, [queueManager]);

  // Derived state with robust offline fallback values
  const waitingPatientsCount = queueState?.waitingPatients
    ? queueState.waitingPatients.filter(p => p.status === "waiting").length
    : 0;
  const averageConsultationTime = queueState?.averageConsultationTime || 5;
  const estimatedWaitTime = waitingPatientsCount * averageConsultationTime;

  return (
    <div className="flex-1 flex flex-col justify-between items-center px-4 py-8 md:py-12 relative overflow-hidden bg-radial from-teal-500/5 via-transparent to-transparent min-h-screen">
      {/* Background patterns: slow floating blobs with very low opacity, premium SaaS feel */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-teal-500/[0.03] dark:bg-teal-500/[0.02] blur-3xl -z-10 animate-float-blob" style={{ animationDuration: '25s' }}></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-sky-500/[0.03] dark:bg-sky-500/[0.02] blur-3xl -z-10 animate-float-blob animation-delay-4000" style={{ animationDuration: '30s' }}></div>

      {/* Header with Branding */}
      <header className="w-full max-w-5xl px-2 py-3 flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏥</span>
          <div>
            <h1 className="text-base font-bold text-slate-800 dark:text-slate-100 tracking-tight">
              Queue Cure
            </h1>
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 tracking-wide uppercase">
              Smart Clinic Queue Management
            </p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      {/* Main Content Area */}
      <div className="max-w-4xl w-full text-center space-y-6 md:space-y-8 animate-slide-up my-auto px-2 py-4">
        
        {/* Hero Section */}
        <div className="space-y-4">
          <h1 className="hero-title text-4xl sm:text-6xl font-extrabold tracking-tight pb-1">
            Care Without the Wait
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-xl mx-auto leading-relaxed font-semibold">
            Replace legacy paper slips with a real-time digital queue system. Keep receptionists productive and patients informed directly from their devices.
          </p>
        </div>

        {/* Live Stats Bar */}
        <div className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-4 py-2 rounded-full glass-card border border-teal-500/10 shadow-sm text-2xs md:text-xs font-bold text-slate-700 dark:text-slate-300 mx-auto">
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Clinic Open</span>
          </span>
          <span className="text-slate-300 dark:text-slate-800">•</span>
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-teal-655 dark:text-teal-400" />
            <span>{waitingPatientsCount} {waitingPatientsCount === 1 ? "Patient" : "Patients"} Waiting</span>
          </span>
          <span className="text-slate-300 dark:text-slate-800">•</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-sky-655 dark:text-sky-400" />
            <span>Avg Wait: {waitingPatientsCount > 0 ? `${estimatedWaitTime} mins` : `${averageConsultationTime} mins`}</span>
          </span>
        </div>

        {/* Portal Options Wrapper */}
        <div className="max-w-2xl w-full mx-auto pt-2">
          <div className="grid md:grid-cols-2 gap-5 text-left">
            
            {/* Receptionist Portal Card */}
            <Link href="/receptionist" className="group block h-full">
              <div className="card glass-card p-6 h-full flex flex-col items-start border-teal-500/20 dark:border-teal-500/20 hover:border-teal-500/40 dark:hover:border-teal-500/40">
                {/* Visual Badge */}
                <span className="mb-4 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-500/10 text-teal-655 dark:text-teal-400 border border-teal-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                  Staff Access
                </span>
                
                <div className="p-3 rounded-xl bg-teal-500/10 text-teal-655 dark:text-teal-400 mb-4 group-hover:scale-105 transition-transform duration-300">
                  <UserPlus className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 group-hover:text-teal-655 dark:group-hover:text-teal-400 transition-colors">
                  Receptionist View
                </h2>
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 flex-1 leading-relaxed font-semibold">
                  Add patients, manage consultation wait times, and advance the queue in seconds. Custom-engineered for fast keyboard-based registration workflows.
                </p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-2xs font-extrabold tracking-wider uppercase text-teal-655 dark:text-teal-400">
                  Open Dashboard <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </Link>

            {/* Patient Portal Card */}
            <Link href="/patient" className="group block h-full">
              <div className="card glass-card p-6 h-full flex flex-col items-start border-sky-500/20 dark:border-sky-500/20 hover:border-sky-500/40 dark:hover:border-sky-500/40">
                {/* Visual Badge */}
                <span className="mb-4 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                  Patient Access
                </span>

                <div className="p-3 rounded-xl bg-sky-500/10 text-sky-655 dark:text-sky-400 mb-4 group-hover:scale-105 transition-transform duration-300">
                  <Users className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 group-hover:text-sky-655 dark:group-hover:text-sky-400 transition-colors">
                  Patient Waiting Room
                </h2>
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 flex-1 leading-relaxed font-semibold">
                  Track live queue position, currently serving ticket, and estimated wait durations. Automatically syncs with clinical updates without refreshes.
                </p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-2xs font-extrabold tracking-wider uppercase text-sky-655 dark:text-sky-400">
                  Track My Token <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </Link>
          </div>
        </div>

        {/* How It Works Section */}
        <div className="max-w-2xl w-full mx-auto pt-4 pb-2">
          <div className="text-center mb-3">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              How It Works
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-2 items-stretch justify-center p-3 rounded-2xl border border-slate-200/50 dark:border-slate-800/40 bg-slate-500/[0.01] backdrop-blur-xs">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center p-2 rounded-xl hover:bg-slate-500/[0.02] transition-colors">
              <div className="w-6 h-6 rounded-full bg-teal-500/10 text-teal-655 dark:text-teal-400 flex items-center justify-center font-extrabold text-xs mb-1.5">
                1
              </div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Check In</h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-450 mt-0.5 leading-normal max-w-[180px]">
                Receptionist checks in patient at the desk
              </p>
            </div>
            
            {/* Step 2 */}
            <div className="flex flex-col items-center text-center p-2 rounded-xl hover:bg-slate-500/[0.02] transition-colors">
              <div className="w-6 h-6 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-400 flex items-center justify-center font-extrabold text-xs mb-1.5">
                2
              </div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Get Ticket</h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-450 mt-0.5 leading-normal max-w-[180px]">
                A unique digital queue token is generated
              </p>
            </div>
            
            {/* Step 3 */}
            <div className="flex flex-col items-center text-center p-2 rounded-xl hover:bg-slate-500/[0.02] transition-colors">
              <div className="w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 flex items-center justify-center font-extrabold text-xs mb-1.5">
                3
              </div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Track Live</h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-450 mt-0.5 leading-normal max-w-[180px]">
                Monitor live queue progress on any device
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Trust Strip */}
      <footer className="w-full max-w-4xl mx-auto pt-6 border-t border-slate-200/50 dark:border-slate-850/30 mt-6 z-20">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-slate-450 dark:text-slate-500 text-[10px] md:text-2xs font-extrabold tracking-wider uppercase">
          <div className="flex items-center gap-1.5 hover:text-slate-650 dark:hover:text-slate-450 transition-colors">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Real-Time Sync</span>
          </div>
          <span className="hidden sm:inline text-slate-350 dark:text-slate-800">•</span>
          <div className="flex items-center gap-1.5 hover:text-slate-650 dark:hover:text-slate-450 transition-colors">
            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
            <span>Emergency Priority</span>
          </div>
          <span className="hidden sm:inline text-slate-350 dark:text-slate-800">•</span>
          <div className="flex items-center gap-1.5 hover:text-slate-650 dark:hover:text-slate-450 transition-colors">
            <Smartphone className="w-3.5 h-3.5 text-sky-500" />
            <span>Mobile Ready</span>
          </div>
          <span className="hidden sm:inline text-slate-350 dark:text-slate-800">•</span>
          <div className="flex items-center gap-1.5 hover:text-slate-650 dark:hover:text-slate-450 transition-colors">
            <Lock className="w-3.5 h-3.5 text-teal-500" />
            <span>Staff Protected</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
