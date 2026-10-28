"use client";

import React from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

export interface ToastMessage {
  type: "success" | "error" | "info";
  message: string;
}

interface ToastBannerProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export function ToastBanner({ toast, onDismiss }: ToastBannerProps) {
  if (!toast) return null;

  const bgStyles = {
    success: "bg-emerald-50 border-emerald-200 text-emerald-900",
    error: "bg-rose-50 border-rose-200 text-rose-900",
    info: "bg-blue-50 border-blue-200 text-blue-900",
  }[toast.type];

  const icon = {
    success: <CheckCircle2 className="text-emerald-600 shrink-0" size={18} />,
    error: <AlertCircle className="text-rose-600 shrink-0" size={18} />,
    info: <Info className="text-blue-600 shrink-0" size={18} />,
  }[toast.type];

  return (
    <div
      role="alert"
      className={`fixed top-4 right-4 z-50 max-w-md w-full p-4 rounded-xl border shadow-lg transition-all flex items-start gap-3 ${bgStyles}`}
    >
      {icon}
      <div className="flex-1 text-sm font-medium leading-relaxed">
        {toast.message}
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="text-slate-400 hover:text-slate-700 p-0.5 rounded-md transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
}
