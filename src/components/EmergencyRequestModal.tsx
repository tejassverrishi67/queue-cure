"use client";

import React, { useState, useEffect, useRef } from "react";
import { AlertCircle, X, Check, ShieldAlert } from "lucide-react";

interface EmergencyRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialToken: string;
  onSubmit: (tokenNumber: string, reason: string) => Promise<void>;
}

const QUICK_REASONS = [
  "Chest pain",
  "Breathing difficulty",
  "Pregnancy emergency",
  "Severe bleeding",
  "High fever child",
];

export default function EmergencyRequestModal({
  isOpen,
  onClose,
  initialToken,
  onSubmit,
}: EmergencyRequestModalProps) {
  const [tokenNumber, setTokenNumber] = useState(initialToken);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const reasonInputRef = useRef<HTMLTextAreaElement>(null);

  // Sync token value when modal opens or initialToken changes
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTokenNumber(initialToken);
      setReason("");
      // Autofocus the textarea
      setTimeout(() => {
        reasonInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, initialToken]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const characterCount = reason.length;
  const isReasonValid = reason.trim().length > 0 && characterCount <= 250;
  const isTokenValid = tokenNumber.trim().length > 0;
  const isValid = isReasonValid && isTokenValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(tokenNumber.trim().toUpperCase(), reason.trim());
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectQuickReason = (text: string) => {
    setReason(text);
    reasonInputRef.current?.focus();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop overlay */}
      <div
        className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        ref={modalRef}
        className="glass-card w-full max-w-md bg-white dark:bg-slate-900 border border-rose-500/25 dark:border-rose-500/20 shadow-2xl relative z-10 transform scale-100 transition-all duration-300 max-h-[90vh] overflow-y-auto flex flex-col p-6 animate-slide-up"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
            <h3 className="text-lg font-extrabold tracking-tight">
              Request Emergency Priority
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer outline-none border-none"
            aria-label="Close modal"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Warning Banner */}
        <div className="mt-4 p-3.5 rounded-2xl border border-rose-500/10 bg-rose-500/5 dark:bg-rose-500/5 text-rose-800 dark:text-rose-300 text-xs font-semibold leading-relaxed flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>Receptionist Approval Required:</strong> Clinic staff will review your request immediately. Patients do not automatically jump the queue.
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 flex-1">
          {/* Token Input */}
          <div>
            <label className="block text-2xs font-extrabold text-slate-500 dark:text-slate-455 uppercase tracking-wider mb-2">
              Patient Token Number
            </label>
            <input
              type="text"
              value={tokenNumber}
              onChange={(e) => setTokenNumber(e.target.value)}
              placeholder="e.g. A001"
              disabled={!!initialToken || isSubmitting}
              className="w-full px-4 py-3 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)]/40 text-slate-800 dark:text-slate-100 disabled:opacity-75 disabled:bg-slate-50 dark:disabled:bg-slate-900/50 font-extrabold font-mono tracking-wider focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 outline-none transition-all text-sm uppercase"
              required
            />
            {initialToken && (
              <span className="text-[10px] text-slate-400 mt-1 block font-semibold">
                ✓ Pre-filled from your active tracked token.
              </span>
            )}
          </div>

          {/* Reason Input */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-2xs font-extrabold text-slate-500 dark:text-slate-455 uppercase tracking-wider">
                Emergency Reason <span className="text-rose-500 font-bold">*</span>
              </label>
              <span
                className={`text-[10px] font-extrabold ${
                  characterCount > 250
                    ? "text-rose-500"
                    : characterCount > 200
                    ? "text-amber-500"
                    : "text-slate-400"
                }`}
              >
                {characterCount}/250
              </span>
            </div>
            <textarea
              ref={reasonInputRef}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the medical emergency (e.g. Sharp pain in central chest radiating to arm)"
              rows={4}
              maxLength={300} // allow slightly more for count overflow indication
              disabled={isSubmitting}
              className={`w-full px-4 py-3.5 rounded-2xl border bg-[var(--card-bg)]/40 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:ring-2 outline-none transition-all text-xs font-semibold leading-relaxed disabled:opacity-75 disabled:cursor-not-allowed ${
                characterCount > 250
                  ? "border-rose-500 focus:ring-rose-500/10 focus:border-rose-500"
                  : "border-[var(--card-border)] focus:border-rose-500 focus:ring-rose-500/10"
              }`}
              required
            />
            {characterCount > 250 && (
              <p className="text-[10px] text-rose-500 mt-1 font-bold">
                ⚠️ Reason exceeds maximum length of 250 characters.
              </p>
            )}
          </div>

          {/* Quick Select Buttons */}
          <div className="space-y-2">
            <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
              Quick Select Example Reasons:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_REASONS.map((txt) => (
                <button
                  key={txt}
                  type="button"
                  onClick={() => selectQuickReason(txt)}
                  disabled={isSubmitting}
                  className={`px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 hover:bg-rose-500/5 dark:bg-slate-900/30 dark:hover:bg-rose-500/5 text-[11px] font-bold text-slate-650 dark:text-slate-350 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    reason === txt ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400" : ""
                  }`}
                >
                  {txt}
                </button>
              ))}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-xs transition-colors cursor-pointer border-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid || isSubmitting}
              className="flex-1 py-3 px-4 rounded-xl bg-rose-650 hover:bg-rose-750 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white font-extrabold text-xs shadow-lg shadow-rose-500/10 hover:shadow-rose-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed border-none"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                  Submitting...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Submit Request
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
