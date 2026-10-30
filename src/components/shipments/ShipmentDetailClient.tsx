"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TelemetryChart } from "@/components/charts/TelemetryChart";
import { ToastBanner, ToastMessage } from "@/components/ui/ToastBanner";
import { safeFetch } from "@/lib/api-client";
import {
  Thermometer,
  ShieldAlert,
  LifeBuoy,
  Cpu,
  Sparkles,
  Clock,
  AlertTriangle,
  Copy,
  Check,
  Send,
  Radio,
  Volume2,
  VolumeX,
  Camera,
  UploadCloud,
  Languages,
  Image as ImageIcon,
  X,
} from "lucide-react";

interface ShipmentDetailProps {
  shipment: any;
  userRole: string;
  accessLevel?: string;
}

export function ShipmentDetailClient({
  shipment,
  userRole: _userRole,
  accessLevel: _accessLevel,
}: ShipmentDetailProps) {
  const router = useRouter();
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // AI Assistant State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(shipment.assessments?.[0] ? {
    riskLevel: shipment.assessments[0].riskLevel,
    summary: shipment.assessments[0].summary,
    advisoryAdvice: shipment.assessments[0].advisoryQuestion ? `Advisory: ${shipment.assessments[0].summary}` : undefined,
    suggestedActions: JSON.parse(shipment.assessments[0].suggestedActions || "[]"),
    draftDriverUpdate: shipment.assessments[0].draftDriverUpdate,
    uncertaintyNotes: shipment.assessments[0].uncertaintyNotes,
    source: shipment.assessments[0].source,
    warmingVelocityPer10Min: shipment.assessments[0].warmingVelocity,
    estimatedMinutesToSpoilage: shipment.assessments[0].estimatedMinutes,
  } : null);
  const [copiedDraft, setCopiedDraft] = useState(false);
  const [advisoryQuestion, setAdvisoryQuestion] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState<"en" | "hi" | "mr" | "ta" | "te" | "bn" | "gu">("en");
  const [budgetRemaining, setBudgetRemaining] = useState<number | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Cargo Photo State
  const [photos, setPhotos] = useState<any[]>(shipment.photos || []);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoCaption, setPhotoCaption] = useState("");
  const [previewPhoto, setPreviewPhoto] = useState<any | null>(null);

  // Alert Action State
  const [actingAlertId, setActingAlertId] = useState<string | null>(null);
  const [alertNotes, setAlertNotes] = useState("");
  const [alertActionLoading, setAlertActionLoading] = useState(false);

  // Rescue Creation State
  const [showRescueModal, setShowRescueModal] = useState(false);
  const [rescueLoading, setRescueLoading] = useState(false);
  const [rescueTitle, setRescueTitle] = useState(`Urgent Cold Transfer: ${shipment.title}`);
  const [rescueBudget, setRescueBudget] = useState(30000);
  const [rescueCargoWeightKg, setRescueCargoWeightKg] = useState<number>(3000);
  const [rescueNotes, setRescueNotes] = useState(
    `Perishable cargo at risk due to reefer thermal deviation. Requires immediate transfer to cold warehouse or backup reefer.`
  );

  // Status transition state
  const [transitionLoading, setTransitionLoading] = useState(false);

  // Calculate age of latest reading with 30-second live periodic update
  const [minutesSinceReading, setMinutesSinceReading] = useState<number | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowRescueModal(false);
        setActingAlertId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const updateAge = () => {
      if (shipment.latestRecordedAt) {
        const latest = new Date(shipment.latestRecordedAt).getTime();
        setMinutesSinceReading(Math.floor((Date.now() - latest) / 60000));
      } else {
        setMinutesSinceReading(null);
      }
    };
    updateAge();
    const interval = setInterval(updateAge, 30000);
    return () => clearInterval(interval);
  }, [shipment.latestRecordedAt]);

  const isStale = minutesSinceReading !== null && minutesSinceReading > 30;

  const isBreached =
    shipment.latestTemperature != null &&
    (shipment.latestTemperature > shipment.tempMax ||
      shipment.latestTemperature < shipment.tempMin);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleSpeak = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setToast({ type: "error", message: "Browser speech synthesis is not supported in this browser." });
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    if (!aiResult) return;
    const textToRead = `${aiResult.summary}. ${aiResult.advisoryAdvice || ""} Actions: ${aiResult.suggestedActions?.join(". ") || ""}. Driver draft: ${aiResult.draftDriverUpdate || ""}`;
    const utterance = new SpeechSynthesisUtterance(textToRead);
    const langMap: Record<string, string> = {
      en: "en-US",
      hi: "hi-IN",
      mr: "mr-IN",
      ta: "ta-IN",
      te: "te-IN",
      bn: "bn-IN",
      gu: "gu-IN",
    };
    utterance.lang = langMap[selectedLanguage] || "en-US";
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Trigger AI Incident Analysis
  const runAiAnalysis = async () => {
    try {
      setAiLoading(true);
      const res = await safeFetch("/api/ai/analyze-incident", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipmentId: shipment.id,
          advisoryQuestion: advisoryQuestion.trim() || undefined,
          language: selectedLanguage,
        }),
      });

      if (!res.ok || !res.data) {
        throw new Error(res.error || "AI Analysis failed");
      }
      setAiResult(res.data.analysis);
      if (res.data.budgetRemaining != null) {
        setBudgetRemaining(res.data.budgetRemaining);
      }
      setToast({ type: "success", message: "AI Heuristic incident assessment updated." });
    } catch (err: any) {
      console.error("AI Analysis error:", err);
      setToast({
        type: "error",
        message: err.message || "Failed to analyze incident with AI.",
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setToast({ type: "error", message: "Only JPEG, PNG, or WebP images are allowed." });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setToast({ type: "error", message: "Image exceeds 5 MB size limit." });
      return;
    }

    try {
      setUploadingPhoto(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        const res = await safeFetch(`/api/shipments/${shipment.id}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dataUrl,
            fileName: file.name,
            caption: photoCaption || undefined,
          }),
        });

        if (!res.ok || !res.data?.photo) {
          throw new Error(res.error || "Failed to upload photo");
        }

        setPhotos((prev) => [res.data.photo, ...prev]);
        setPhotoCaption("");
        setToast({ type: "success", message: "Cargo photo uploaded and securely stored." });
        setUploadingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setToast({ type: "error", message: err.message || "Failed to upload photo" });
      setUploadingPhoto(false);
    }
  };

  const copyDriverDraft = () => {
    if (!aiResult?.draftDriverUpdate) return;
    navigator.clipboard.writeText(aiResult.draftDriverUpdate);
    setCopiedDraft(true);
    setTimeout(() => setCopiedDraft(false), 2000);
  };

  // Acknowledge Alert
  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      setAlertActionLoading(true);
      const res = await safeFetch(`/api/alerts/${alertId}/acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: alertNotes || "Acknowledged by operator in control room." }),
      });
      if (!res.ok) {
        throw new Error(res.error || "Failed to acknowledge");
      }
      setActingAlertId(null);
      setAlertNotes("");
      setToast({ type: "success", message: "Alert acknowledged successfully." });
      router.refresh();
    } catch (err: any) {
      setToast({ type: "error", message: err.message });
    } finally {
      setAlertActionLoading(false);
    }
  };

  // Resolve Alert
  const handleResolveAlert = async (alertId: string) => {
    if (!alertNotes.trim()) {
      setToast({
        type: "error",
        message: "Resolution notes are required to document audit outcome.",
      });
      return;
    }
    try {
      setAlertActionLoading(true);
      const res = await safeFetch(`/api/alerts/${alertId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolutionNotes: alertNotes }),
      });
      if (!res.ok) {
        throw new Error(res.error || "Failed to resolve");
      }
      setActingAlertId(null);
      setAlertNotes("");
      setToast({ type: "success", message: "Alert successfully resolved and recorded in audit log." });
      router.refresh();
    } catch (err: any) {
      setToast({ type: "error", message: err.message });
    } finally {
      setAlertActionLoading(false);
    }
  };

  // Create Rescue Opportunity
  const handleCreateRescue = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setRescueLoading(true);
      const res = await safeFetch("/api/rescue/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipmentId: shipment.id,
          title: rescueTitle,
          cargoDescription: `${shipment.cargoType}: ${shipment.title}. ${rescueNotes}`,
          cargoWeightKg: rescueCargoWeightKg,
          tempRequirementMin: shipment.tempMin,
          tempRequirementMax: shipment.tempMax,
          urgency: "HIGH",
          maxBudget: rescueBudget,
        }),
      });

      if (!res.ok) {
        throw new Error(res.error || "Failed to create rescue opportunity");
      }

      setShowRescueModal(false);
      setToast({ type: "success", message: "Rescue opportunity initiated successfully." });
      router.push("/rescue");
      router.refresh();
    } catch (err: any) {
      setToast({ type: "error", message: err.message });
    } finally {
      setRescueLoading(false);
    }
  };

  // Status transition
  const handleTransition = async (targetStatus: string) => {
    try {
      setTransitionLoading(true);
      const res = await safeFetch(`/api/shipments/${shipment.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus, notes: `Manual transition to ${targetStatus}` }),
      });
      if (!res.ok) {
        throw new Error(res.error || "Transition failed");
      }
      setToast({ type: "success", message: `Shipment status updated to ${targetStatus}.` });
      router.refresh();
    } catch (err: any) {
      setToast({ type: "error", message: err.message });
    } finally {
      setTransitionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <StatusBadge status={shipment.status} />
            <span className="font-mono text-xs text-slate-500 font-semibold select-all">
              {shipment.trackingNumber}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-600 font-medium">{shipment.cargoType}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{shipment.title}</h1>
          <p className="text-xs text-slate-500 mt-1">
            Route: <span className="font-medium text-slate-700">{shipment.originName}</span> &rarr;{" "}
            <span className="font-medium text-slate-700">{shipment.destName}</span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {shipment.status === "DRAFT" && (
            <button
              onClick={() => handleTransition("DISPATCHED")}
              disabled={transitionLoading}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold"
            >
              Dispatch Shipment
            </button>
          )}

          {shipment.status === "DISPATCHED" && (
            <button
              onClick={() => handleTransition("IN_TRANSIT")}
              disabled={transitionLoading}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold"
            >
              Depart on Route
            </button>
          )}

          {(shipment.status === "IN_TRANSIT" || shipment.status === "ALERTED") && (
            <button
              onClick={() => handleTransition("DELIVERED")}
              disabled={transitionLoading}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold"
            >
              Confirm Delivery
            </button>
          )}

          {/* Rescue Initiation Button */}
          {!shipment.rescueOpportunity && shipment.status !== "DELIVERED" && shipment.status !== "CANCELLED" && (
            <button
              onClick={() => setShowRescueModal(true)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-xs"
            >
              <LifeBuoy size={14} />
              <span>Initiate Cargo Rescue</span>
            </button>
          )}

          {shipment.rescueOpportunity && (
            <Link
              href={`/rescue`}
              className="px-3 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded text-xs font-semibold flex items-center gap-1.5"
            >
              <LifeBuoy size={14} className="text-emerald-600" />
              <span>Rescue Active ({shipment.rescueOpportunity.status})</span>
            </Link>
          )}

          <Link
            href="/simulator"
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-xs font-semibold flex items-center gap-1"
          >
            <Radio size={14} className="text-emerald-600" />
            <span>Simulate Telemetry</span>
          </Link>
        </div>
      </div>

      {/* Real-time Telemetry Sensor Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Temperature */}
        <div
          className={`p-4 rounded-xl border shadow-xs ${
            isBreached ? "bg-red-50/80 border-red-200" : "bg-white border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold uppercase tracking-wider">Cargo Temperature</span>
            <Thermometer
              size={16}
              className={isBreached ? "text-red-600" : "text-emerald-600"}
            />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-3xl font-extrabold font-mono ${
                isBreached ? "text-red-700" : "text-slate-900"
              }`}
            >
              {shipment.latestTemperature != null
                ? `${shipment.latestTemperature.toFixed(1)}°C`
                : "—"}
            </span>
            <span className="text-xs text-slate-500">
              Safe: {shipment.tempMin}° to {shipment.tempMax}°C
            </span>
          </div>
          {isBreached && (
            <p className="text-[11px] font-semibold text-red-700 mt-2 flex items-center gap-1">
              <AlertTriangle size={12} />
              <span>Threshold violation detected</span>
            </p>
          )}
        </div>

        {/* Metric 2: Telemetry Age */}
        <div
          className={`p-4 rounded-xl border shadow-xs ${
            isStale ? "bg-amber-50/80 border-amber-200" : "bg-white border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold uppercase tracking-wider">Telemetry Freshness</span>
            <Clock size={16} className={isStale ? "text-amber-600" : "text-slate-400"} />
          </div>
          <div className="text-xl font-bold text-slate-900">
            {minutesSinceReading !== null ? `${minutesSinceReading} min ago` : "No telemetry"}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {minutesSinceReading === null ? (
              <span className="text-slate-400 font-medium">Awaiting initial sensor transmission</span>
            ) : isStale ? (
              <span className="text-amber-700 font-semibold">Stale: Telemetry packet delayed ({minutesSinceReading}m ago)</span>
            ) : (
              <span className="text-slate-700 font-medium flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                Recent reading recorded ({minutesSinceReading === 0 ? "just now" : `${minutesSinceReading}m ago`})
              </span>
            )}
          </div>
        </div>

        {/* Metric 3: Humidity */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold uppercase tracking-wider">Relative Humidity</span>
            <Radio size={16} className="text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {shipment.latestHumidity != null ? `${shipment.latestHumidity.toFixed(0)}%` : "N/A"}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {shipment.humidityMax
              ? `Max limit: ${shipment.humidityMax}%`
              : "Standard cargo hold bounds"}
          </div>
        </div>

        {/* Metric 4: IoT Edge Asset */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold uppercase tracking-wider">Assigned Edge Device</span>
            <Cpu size={16} className="text-slate-500" />
          </div>
          <div className="font-mono font-bold text-sm text-slate-900 truncate">
            {shipment.assignedDevice?.deviceIdentifier || "None Assigned"}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {shipment.assignedDevice?.hardwareModel || "Unprovisioned"}
          </div>
        </div>
      </div>

      {/* Telemetry Visualizer Chart */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Telemetry History &amp; Threshold Envelope</h2>
          <span className="text-xs text-slate-500 font-mono">
            {shipment.telemetryReadings?.length || 0} recorded readings
          </span>
        </div>
        <TelemetryChart
          readings={shipment.telemetryReadings || []}
          tempMin={shipment.tempMin}
          tempMax={shipment.tempMax}
          height={260}
        />
      </div>

      {/* AI Anomaly & Decision Support Card */}
      <div className="bg-slate-900 text-white border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">AI Cold-Chain Operational Assistant</h3>
              <p className="text-xs text-slate-400">
                Thermal gradient calculation, anomaly explanation &amp; human-reviewed driver drafting
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {aiResult && (
              <button
                onClick={handleSpeak}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition-colors shrink-0"
                title="Read AI advisory aloud using browser speech synthesis"
              >
                {isSpeaking ? (
                  <>
                    <VolumeX size={14} className="text-rose-400 animate-pulse" />
                    <span className="text-rose-300">Stop Speech</span>
                  </>
                ) : (
                  <>
                    <Volume2 size={14} className="text-emerald-400" />
                    <span>Read Aloud</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={runAiAnalysis}
              disabled={aiLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors shrink-0"
            >
              <Sparkles size={14} />
              <span>{aiLoading ? "Analyzing Incident..." : "Analyze Incident with AI"}</span>
            </button>
          </div>
        </div>

        {/* Advisory Input & Language Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4 p-3 bg-slate-950/80 rounded-lg border border-slate-800">
          <div className="sm:col-span-3">
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Custom Advisory Incident Question (Optional)
            </label>
            <input
              type="text"
              value={advisoryQuestion}
              onChange={(e) => setAdvisoryQuestion(e.target.value)}
              placeholder="e.g. Can vaccines survive ambient 32°C for 90 minutes without backup reefer?"
              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
              <Languages size={12} className="text-slate-400" />
              <span>Response Language</span>
            </label>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value as any)}
              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-xs text-white focus:outline-hidden focus:border-emerald-500"
            >
              <option value="en">English (en)</option>
              <option value="hi">हिन्दी - Hindi (hi)</option>
              <option value="mr">मराठी - Marathi (mr)</option>
              <option value="ta">தமிழ் - Tamil (ta)</option>
              <option value="te">తెలుగు - Telugu (te)</option>
              <option value="bn">বাংলা - Bengali (bn)</option>
              <option value="gu">ગુજરાતી - Gujarati (gu)</option>
            </select>
          </div>
        </div>

        {budgetRemaining !== null && (
          <div className="text-[11px] text-slate-400 mb-3 flex items-center gap-1.5">
            <Clock size={12} className="text-emerald-400" />
            <span>
              Request budget: <strong>{budgetRemaining}</strong> of 20 evaluations remaining for this hour.
            </span>
          </div>
        )}

        {aiResult ? (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Risk Classification</span>
                <p className="text-base font-bold text-emerald-400 mt-1">{aiResult.riskLevel}</p>
              </div>
              <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Warming Velocity</span>
                <p className="text-base font-bold text-slate-200 mt-1">
                  {aiResult.warmingVelocityPer10Min != null
                    ? `+${aiResult.warmingVelocityPer10Min}°C / 10 min`
                    : "Stable gradient"}
                </p>
              </div>
              <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Estimated Time to Spoilage</span>
                <p className="text-base font-bold text-amber-400 mt-1">
                  {aiResult.estimatedMinutesToSpoilage != null
                    ? `~${aiResult.estimatedMinutesToSpoilage} minutes`
                    : "Not currently at spoilage limit"}
                </p>
              </div>
            </div>

            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/60">
              <p className="font-semibold text-slate-200 mb-1">Operational Incident Summary:</p>
              <p className="text-slate-300 leading-relaxed">{aiResult.summary}</p>
            </div>

            {aiResult.advisoryAdvice && (
              <div className="bg-emerald-950/40 p-4 rounded-lg border border-emerald-800/60">
                <p className="font-semibold text-emerald-300 mb-1">Specific Incident Guidance &amp; Consultation:</p>
                <p className="text-emerald-100 leading-relaxed">{aiResult.advisoryAdvice}</p>
              </div>
            )}

            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/60">
              <p className="font-semibold text-slate-200 mb-2">Recommended Corrective Actions:</p>
              <ul className="space-y-1.5 text-slate-300">
                {aiResult.suggestedActions?.map((act: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span>{act}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Draft Driver Dispatch Message */}
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Send size={13} className="text-emerald-400" />
                  <span>Draft Driver Advisory Message (Human Approval Required):</span>
                </span>
                <button
                  onClick={copyDriverDraft}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] transition-colors"
                >
                  {copiedDraft ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{copiedDraft ? "Copied" : "Copy Message"}</span>
                </button>
              </div>
              <p className="text-slate-400 italic bg-slate-900/60 p-2.5 rounded border border-slate-800/60">
                &ldquo;{aiResult.draftDriverUpdate}&rdquo;
              </p>
            </div>

            <div className="text-[10px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800">
              <span>Source: {aiResult.source}</span>
              <span className="italic text-amber-400/90">{aiResult.uncertaintyNotes}</span>
            </div>
          </div>
        ) : (
          <div className="text-slate-400 text-xs py-2">
            Click &ldquo;Analyze Incident with AI&rdquo; to compute sensor gradients, evaluate thermal
            risks, and draft driver instructions.
          </div>
        )}
      </div>

      {/* Private Cargo Assessment Photos Section */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Camera size={18} className="text-slate-700" />
            <div>
              <h3 className="font-bold text-sm text-slate-900">Cargo Photos &amp; Condition Inspection</h3>
              <p className="text-xs text-slate-500">
                Private photographic evidence, dimension verification, and assessment audit trail
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={photoCaption}
              onChange={(e) => setPhotoCaption(e.target.value)}
              placeholder="Caption (e.g. Broken door latch)"
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:border-emerald-500 w-48"
            />
            <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors shrink-0">
              <UploadCloud size={14} />
              <span>{uploadingPhoto ? "Uploading..." : "Upload Photo"}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={uploadingPhoto}
                onChange={handlePhotoUpload}
              />
            </label>
          </div>
        </div>

        <div className="p-6">
          {photos.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs border-2 border-dashed border-slate-200 rounded-lg">
              <ImageIcon size={32} className="mx-auto mb-2 text-slate-300" />
              <p className="font-semibold text-slate-600">No cargo inspection photos uploaded yet</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Drivers and dispatchers can upload JPEG, PNG, or WebP photos up to 5 MB for verifiable condition audits.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
              {photos.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setPreviewPhoto(p)}
                  className="group relative cursor-pointer border border-slate-200 rounded-lg overflow-hidden bg-slate-50 hover:border-emerald-500 transition-all shadow-2xs"
                >
                  <div className="aspect-4/3 w-full bg-slate-100 flex items-center justify-center overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/shipments/${shipment.id}/photos/${p.id}`}
                      alt={p.caption || p.fileName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                  <div className="p-2 bg-white">
                    <p className="font-semibold text-[11px] text-slate-800 truncate" title={p.caption || p.fileName}>
                      {p.caption || p.fileName}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {p.widthPx && p.heightPx ? `${p.widthPx}x${p.heightPx} px • ` : ""}
                      {(p.fileSizeBytes / 1024).toFixed(0)} KB
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal for full-size photo preview */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="relative max-w-3xl w-full bg-slate-900 rounded-xl overflow-hidden shadow-2xl border border-slate-800">
            <div className="px-4 py-3 bg-slate-950 flex items-center justify-between border-b border-slate-800">
              <span className="text-xs font-semibold text-white truncate">
                {previewPhoto.caption || previewPhoto.fileName}
              </span>
              <button
                onClick={() => setPreviewPhoto(null)}
                className="text-slate-400 hover:text-white p-1 rounded-md"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center max-h-[70vh] overflow-hidden bg-slate-950/60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/shipments/${shipment.id}/photos/${previewPhoto.id}`}
                alt={previewPhoto.caption || previewPhoto.fileName}
                className="max-h-[65vh] w-auto object-contain rounded-sm"
              />
            </div>
            <div className="px-4 py-2.5 bg-slate-950 text-[11px] text-slate-400 border-t border-slate-800 flex justify-between">
              <span>MIME: {previewPhoto.mimeType}</span>
              <span>Dimensions: {previewPhoto.widthPx}x{previewPhoto.heightPx} px</span>
              <span>Uploaded: {new Date(previewPhoto.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Active & Resolved Alerts Section */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-slate-700" />
            <h3 className="font-bold text-sm text-slate-900">Incident Alerts &amp; Acknowledgment History</h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {shipment.alerts?.length || 0} recorded alerts
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {!shipment.alerts || shipment.alerts.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No thermal or connectivity alerts generated for this shipment.
            </div>
          ) : (
            shipment.alerts.map((alert: any) => (
              <div key={alert.id} className="p-6 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={alert.severity} />
                    <span className="font-bold text-slate-900 text-xs font-mono">{alert.ruleCode}</span>
                    <span className="text-slate-300">•</span>
                    <StatusBadge status={alert.status} />
                  </div>
                  <span className="text-xs text-slate-400">
                    Triggered: {new Date(alert.createdAt).toLocaleString()}
                  </span>
                </div>

                <p className="text-xs text-slate-800 font-medium">{alert.summary}</p>
                {alert.recommendedAction && (
                  <p className="text-xs text-slate-500">
                    <strong className="text-slate-700">Recommended Action:</strong> {alert.recommendedAction}
                  </p>
                )}

                {/* Audit notes if acknowledged or resolved */}
                {alert.ackNotes && (
                  <div className="text-xs bg-amber-50/60 border border-amber-200 text-amber-800 p-2.5 rounded">
                    <strong>Acknowledged Notes:</strong> {alert.ackNotes} (by {alert.acknowledgedBy?.email || "Operator"})
                  </div>
                )}

                {alert.resolutionNotes && (
                  <div className="text-xs bg-emerald-50/60 border border-emerald-200 text-emerald-800 p-2.5 rounded">
                    <strong>Resolution Outcome:</strong> {alert.resolutionNotes} (by {alert.resolvedBy?.email || "Operator"})
                  </div>
                )}

                {/* Operator Actions for ACTIVE or ACKNOWLEDGED */}
                {alert.status === "ACTIVE" && (
                  <div className="pt-2 flex items-center gap-2">
                    {actingAlertId === alert.id ? (
                      <div className="w-full space-y-2 bg-slate-50 p-3 rounded border border-slate-200">
                        <input
                          type="text"
                          value={alertNotes}
                          onChange={(e) => setAlertNotes(e.target.value)}
                          placeholder="Document acknowledgment notes (e.g. Driver contacted, checking unit)"
                          className="w-full text-xs px-3 py-1.5 bg-white border border-slate-300 rounded"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAcknowledgeAlert(alert.id)}
                            disabled={alertActionLoading}
                            className="px-3 py-1 bg-amber-600 text-white rounded text-xs font-semibold"
                          >
                            Confirm Acknowledge
                          </button>
                          <button
                            onClick={() => setActingAlertId(null)}
                            className="px-3 py-1 bg-slate-200 text-slate-700 rounded text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setActingAlertId(alert.id);
                          setAlertNotes("");
                        }}
                        className="px-3 py-1.5 bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100 rounded text-xs font-semibold"
                      >
                        Acknowledge Alert
                      </button>
                    )}
                  </div>
                )}

                {alert.status === "ACKNOWLEDGED" && (
                  <div className="pt-2 flex items-center gap-2">
                    {actingAlertId === alert.id ? (
                      <div className="w-full space-y-2 bg-slate-50 p-3 rounded border border-slate-200">
                        <input
                          type="text"
                          value={alertNotes}
                          onChange={(e) => setAlertNotes(e.target.value)}
                          placeholder="Document resolution outcome (e.g. Auxiliary generator engaged, temperature stabilized)"
                          className="w-full text-xs px-3 py-1.5 bg-white border border-slate-300 rounded"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleResolveAlert(alert.id)}
                            disabled={alertActionLoading}
                            className="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-semibold"
                          >
                            Mark Alert Resolved
                          </button>
                          <button
                            onClick={() => setActingAlertId(null)}
                            className="px-3 py-1 bg-slate-200 text-slate-700 rounded text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setActingAlertId(alert.id);
                          setAlertNotes("");
                        }}
                        className="px-3 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100 rounded text-xs font-semibold"
                      >
                        Resolve Alert
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Cargo Rescue Modal */}
      {showRescueModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <LifeBuoy className="text-emerald-600" size={20} />
                <span>Initiate Cargo Rescue Opportunity</span>
              </div>
              <button
                onClick={() => setShowRescueModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRescue} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Rescue Title
                </label>
                <input
                  type="text"
                  required
                  value={rescueTitle}
                  onChange={(e) => setRescueTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Cargo Description &amp; Incident Notes
                </label>
                <textarea
                  rows={3}
                  required
                  value={rescueNotes}
                  onChange={(e) => setRescueNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Authorized Rescue Budget (₹)
                </label>
                <input
                  type="number"
                  required
                  value={rescueBudget}
                  onChange={(e) => setRescueBudget(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Cargo Weight (kg)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={rescueCargoWeightKg}
                  onChange={(e) => setRescueCargoWeightKg(Number(e.target.value))}
                  placeholder="e.g. 3500"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 font-mono"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600">
                <p className="font-semibold text-slate-800 mb-1">Marketplace Broadcast:</p>
                <p>
                  Certified rescue partners within operational range will be notified of this
                  opportunity to submit storage or transshipment offers.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRescueModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rescueLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-xs"
                >
                  {rescueLoading ? "Broadcasting..." : "Broadcast Rescue Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
