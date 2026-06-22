"use client";

import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { Activity, UserPlus, Users, ArrowRight, Heart } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden bg-radial from-teal-500/5 via-transparent to-transparent min-h-screen">
      {/* Background patterns */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-teal-500/5 blur-3xl -z-10 animate-pulse" style={{ animationDuration: '8s' }}></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-sky-500/5 blur-3xl -z-10 animate-pulse" style={{ animationDuration: '10s' }}></div>

      {/* Floating Theme Toggle in top-right */}
      <div className="absolute top-5 right-5 z-40">
        <ThemeToggle />
      </div>

      <div className="max-w-4xl w-full text-center space-y-8 animate-slide-up">
        {/* Brand Header */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-teal-500/20 bg-teal-500/5 text-teal-650 dark:text-teal-400 text-xs font-extrabold tracking-wider uppercase mb-2">
          <Activity className="w-4 h-4 animate-pulse" />
          {"Queue Cure '26 MVP"}
        </div>
        
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-teal-600 via-emerald-600 to-sky-600 dark:from-teal-400 dark:via-emerald-450 dark:to-sky-400 bg-clip-text text-transparent pb-1">
            Care Without the Wait
          </h1>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed font-semibold">
            Replace legacy paper slips with a real-time digital queue system. Keep receptionists productive and patients informed directly from their devices.
          </p>
        </div>

        {/* Portal Options */}
        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto pt-6">
          
          {/* Receptionist Portal Card */}
          <Link href="/receptionist" className="group block text-left">
            <div className="glass-card p-8 h-full flex flex-col items-start hover:border-teal-550/40 dark:hover:border-teal-500/40 hover:shadow-xl hover:shadow-teal-500/5 transition-all duration-300 transform hover:-translate-y-1">
              <div className="p-4 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 mb-6 group-hover:scale-105 transition-transform duration-300">
                <UserPlus className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                Receptionist View
              </h2>
              <p className="mt-3 text-sm text-slate-605 dark:text-slate-400 flex-1 leading-relaxed font-semibold">
                Add patients, manage consultation wait times, and advance the queue in seconds. Custom-engineered for fast keyboard-based registration workflows.
              </p>
              <span className="mt-6 inline-flex items-center gap-2 text-xs font-extrabold tracking-wider uppercase text-teal-600 dark:text-teal-400">
                Open Dashboard <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </div>
          </Link>

          {/* Patient Portal Card */}
          <Link href="/patient" className="group block text-left">
            <div className="glass-card p-8 h-full flex flex-col items-start hover:border-sky-500/40 dark:hover:border-sky-500/40 hover:shadow-xl hover:shadow-sky-500/5 transition-all duration-300 transform hover:-translate-y-1">
              <div className="p-4 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 mb-6 group-hover:scale-105 transition-transform duration-300">
                <Users className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                Patient Waiting Room
              </h2>
              <p className="mt-3 text-sm text-slate-605 dark:text-slate-400 flex-1 leading-relaxed font-semibold">
                Track live queue position, currently serving ticket, and estimated wait durations. Automatically syncs with clinical updates without refreshes.
              </p>
              <span className="mt-6 inline-flex items-center gap-2 text-xs font-extrabold tracking-wider uppercase text-sky-600 dark:text-sky-400">
                Track My Token <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </div>
          </Link>
        </div>

        {/* Footer */}
        <footer className="pt-12 text-[10px] text-slate-450 dark:text-slate-650 flex items-center justify-center gap-1.5 font-bold uppercase tracking-wider">
          <span>Queue Cure © 2026</span>
          <span>•</span>
          <span>Phase 2 Clinical Core</span>
          <span>•</span>
          <span className="flex items-center gap-0.5"><Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> Patient Experience</span>
        </footer>
      </div>
    </div>
  );
}
