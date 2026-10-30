"use client";

import Link from "next/link";
import { AlertTriangle, Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <Link href="/" className="inline-flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white text-lg">
            A
          </div>
          <span className="font-bold text-lg text-slate-900">Annapurna</span>
        </Link>

        {/* Error code */}
        <div className="text-7xl font-black text-slate-200 leading-none mb-4">404</div>
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={20} className="text-amber-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Page not found</h1>
        <p className="text-sm text-slate-500 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Home size={15} />
            Go to Dashboard
          </Link>
          <button
            onClick={() => history.back()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors"
          >
            <ArrowLeft size={15} />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
