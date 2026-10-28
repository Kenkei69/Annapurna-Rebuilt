"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  LifeBuoy,
  Building2,
  Truck,
  CheckCircle2,
  Clock,
  PlusCircle,
  ArrowRight,
  ShieldAlert,
  Award,
  Check,
  MapPin,
} from "lucide-react";

interface RescueHubProps {
  opportunities: any[];
  userRole: string;
  userOrgId: string;
  isPartner: boolean;
}

export function RescueHubClient({
  opportunities,
  userRole,
  userOrgId,
  isPartner,
}: RescueHubProps) {
  const router = useRouter();
  const [selectedOppId, setSelectedOppId] = useState<string>(
    opportunities[0]?.id || ""
  );

  // Partner Offer Form State
  const [offerAmount, setOfferAmount] = useState(15000);
  const [capacityKg, setCapacityKg] = useState(5000);
  const [storageType, setStorageType] = useState("COLD_STORAGE");
  const [etaMinutes, setEtaMinutes] = useState(25);
  const [offerNotes, setOfferNotes] = useState(
    "Pre-cooled intake bay prepared. Immediate receipt upon arrival."
  );
  const [submittingOffer, setSubmittingOffer] = useState(false);

  // Accept Offer State
  const [acceptingOfferId, setAcceptingOfferId] = useState<string | null>(null);

  // Milestone State
  const [milestoneType, setMilestoneType] = useState("EN_ROUTE_TO_CARGO");
  const [milestoneNotes, setMilestoneNotes] = useState("");
  const [submittingMilestone, setSubmittingMilestone] = useState(false);

  // Complete Rescue State
  const [completeNotes, setCompleteNotes] = useState("");
  const [submittingComplete, setSubmittingComplete] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  const selectedOpp = opportunities.find((o) => o.id === selectedOppId);

  // Submit Offer
  const handleSubmitOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOpp) return;
    try {
      setSubmittingOffer(true);
      const res = await fetch(`/api/rescue/opportunities/${selectedOpp.id}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerAmount,
          capacityOfferedKg: capacityKg,
          storageType,
          estimatedEtaMinutes: etaMinutes,
          notes: offerNotes,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to submit offer");
      }

      alert("Capacity offer successfully submitted to fleet operator!");
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingOffer(false);
    }
  };

  // Accept Offer (Fleet Operator action)
  const handleAcceptOffer = async (offerId: string) => {
    if (!selectedOpp) return;
    try {
      setAcceptingOfferId(offerId);
      const res = await fetch(`/api/rescue/opportunities/${selectedOpp.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to accept offer");
      }

      router.refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAcceptingOfferId(null);
    }
  };

  // Record Milestone
  const handleRecordMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOpp) return;
    try {
      setSubmittingMilestone(true);
      const res = await fetch(`/api/rescue/opportunities/${selectedOpp.id}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          milestoneType,
          notes: milestoneNotes || `Operational progress: ${milestoneType}`,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to record milestone");
      }

      setMilestoneNotes("");
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingMilestone(false);
    }
  };

  // Complete Rescue
  const handleCompleteRescue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOpp) return;
    if (!completeNotes.trim()) {
      alert("Final outcome verification notes are required.");
      return;
    }

    try {
      setSubmittingComplete(true);
      const res = await fetch(`/api/rescue/opportunities/${selectedOpp.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcomeNotes: completeNotes,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to complete rescue");
      }

      setShowCompleteModal(false);
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingComplete(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cargo Rescue Coordination Hub</h1>
          <p className="text-xs text-slate-500 mt-1">
            Emergency cold transfer marketplace, transactional assignment &amp; verifiable transfer audit trails
          </p>
        </div>
      </div>

      {opportunities.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">
          <LifeBuoy size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="text-base font-semibold text-slate-700">No active rescue opportunities</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            When a reefer encounters a sustained thermal breach, operators can initiate a rescue
            request directly from the shipment detail page.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Opportunity Master List */}
          <div className="lg:col-span-4 space-y-3">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Rescue Requests ({opportunities.length})
            </h2>

            <div className="space-y-2">
              {opportunities.map((opp) => {
                const isSelected = opp.id === selectedOppId;
                return (
                  <button
                    key={opp.id}
                    onClick={() => setSelectedOppId(opp.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-white border-emerald-500 shadow-sm ring-2 ring-emerald-500/20"
                        : "bg-white border-slate-200 hover:bg-slate-50/70"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <StatusBadge status={opp.status} />
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                        Urgency: {opp.urgency}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-sm">{opp.title}</h3>
                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{opp.cargoDescription}</p>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span>{opp.cargoWeightKg.toLocaleString()} kg payload</span>
                      <span className="font-mono text-slate-700 font-semibold">
                        {opp.offers?.length || 0} offers
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Opportunity Detail & Workflow */}
          {selectedOpp && (
            <div className="lg:col-span-8 space-y-6">
              {/* Header Box */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <StatusBadge status={selectedOpp.status} />
                      <span className="text-xs text-slate-400">
                        Incident Broadcasted: {new Date(selectedOpp.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">{selectedOpp.title}</h2>
                    <p className="text-xs text-slate-600 mt-1">{selectedOpp.cargoDescription}</p>
                  </div>

                  {selectedOpp.status === "ACCEPTED" && !isPartner && (
                    <button
                      onClick={() => setShowCompleteModal(true)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs shrink-0"
                    >
                      Complete &amp; Close Rescue
                    </button>
                  )}
                </div>

                {/* Specs Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Temp Requirement</span>
                    <p className="font-mono font-bold text-slate-800 text-sm mt-0.5">
                      {selectedOpp.tempRequirementMin}°C - {selectedOpp.tempRequirementMax}°C
                    </p>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Cargo Payload</span>
                    <p className="font-bold text-slate-800 text-sm mt-0.5">
                      {selectedOpp.cargoWeightKg.toLocaleString()} kg
                    </p>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Max Authorized Budget</span>
                    <p className="font-mono font-bold text-emerald-700 text-sm mt-0.5">
                      {selectedOpp.maxBudget ? `₹${selectedOpp.maxBudget.toLocaleString()}` : "Market Quote"}
                    </p>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Originating Fleet</span>
                    <p className="font-semibold text-slate-800 truncate mt-0.5">
                      {selectedOpp.organization?.name || "TransCold Express"}
                    </p>
                  </div>
                </div>

                {/* Schematics / Coordinates Banner (No fake live map) */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-emerald-600 shrink-0" />
                    <span>
                      Incident Target Coordinates:{" "}
                      <strong className="font-mono text-slate-800">
                        {selectedOpp.targetLat ?? 18.754}° N, {selectedOpp.targetLng ?? 73.407}° E
                      </strong>{" "}
                      (Lonavala / Pune Expressway corridor)
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded">
                    Hardware GPS Tag
                  </span>
                </div>
              </div>

              {/* Competing Partner Offers Section */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                    <Building2 size={16} className="text-slate-600" />
                    <span>Partner Capacity Offers ({selectedOpp.offers?.length || 0})</span>
                  </div>
                  <span className="text-xs text-slate-400">
                    Strict Single-Winner Transaction Guard
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {!selectedOpp.offers || selectedOpp.offers.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      No offers submitted yet. Certified partners have received notification.
                    </div>
                  ) : (
                    selectedOpp.offers.map((offer: any) => {
                      const isAccepted = offer.status === "ACCEPTED";
                      const isRejected = offer.status === "REJECTED";

                      return (
                        <div
                          key={offer.id}
                          className={`p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                            isAccepted ? "bg-emerald-50/50" : isRejected ? "opacity-60 bg-slate-50/40" : ""
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <StatusBadge status={offer.status} />
                              <span className="font-bold text-slate-900 text-sm">
                                {offer.partnerOrg?.name || "Rescue Partner"}
                              </span>
                              {isAccepted && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                                  <Award size={12} />
                                  <span>Winning Assignment</span>
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-600">{offer.notes || "Standard response facility."}</p>

                            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                              <span>Capacity: <strong>{offer.capacityOfferedKg.toLocaleString()} kg</strong></span>
                              <span>•</span>
                              <span>Type: <strong>{offer.storageType}</strong></span>
                              <span>•</span>
                              <span>ETA: <strong>~{offer.estimatedEtaMinutes} min</strong></span>
                            </div>
                          </div>

                          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                            <span className="font-mono text-base font-extrabold text-slate-900">
                              ₹{offer.offerAmount.toLocaleString()}
                            </span>

                            {/* Operator Accept Offer Button */}
                            {!isPartner &&
                              (selectedOpp.status === "OPEN" || selectedOpp.status === "OFFERED") &&
                              offer.status === "SUBMITTED" && (
                                <button
                                  onClick={() => handleAcceptOffer(offer.id)}
                                  disabled={acceptingOfferId !== null}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold shadow-xs disabled:opacity-50"
                                >
                                  {acceptingOfferId === offer.id ? "Assigning..." : "Accept Proposal"}
                                </button>
                              )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Partner Submit Offer Card (Visible to rescue partners when open/offered) */}
              {isPartner && (selectedOpp.status === "OPEN" || selectedOpp.status === "OFFERED") && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                    <PlusCircle size={18} className="text-emerald-600" />
                    <h3 className="font-bold text-sm text-slate-900">
                      Submit Partner Rescue Capacity Offer
                    </h3>
                  </div>

                  <form onSubmit={handleSubmitOffer} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                          Quote Amount (₹)
                        </label>
                        <input
                          type="number"
                          required
                          value={offerAmount}
                          onChange={(e) => setOfferAmount(Number(e.target.value))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                          Offered Capacity (kg)
                        </label>
                        <input
                          type="number"
                          required
                          value={capacityKg}
                          onChange={(e) => setCapacityKg(Number(e.target.value))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                          Estimated ETA (Minutes)
                        </label>
                        <input
                          type="number"
                          required
                          value={etaMinutes}
                          onChange={(e) => setEtaMinutes(Number(e.target.value))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-slate-900"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Facility Readiness &amp; Action Notes
                      </label>
                      <input
                        type="text"
                        required
                        value={offerNotes}
                        onChange={(e) => setOfferNotes(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={submittingOffer}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-xs"
                      >
                        {submittingOffer ? "Submitting Offer..." : "Submit Capacity Proposal"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Milestones & Traceable Timeline */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                    <Clock size={16} className="text-slate-600" />
                    <span>Traceable Operational Milestones</span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {selectedOpp.milestones?.length || 0} recorded events
                  </span>
                </div>

                <div className="space-y-3">
                  {!selectedOpp.milestones || selectedOpp.milestones.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No milestones recorded yet.</p>
                  ) : (
                    selectedOpp.milestones.map((m: any, idx: number) => (
                      <div key={m.id || idx} className="flex items-start gap-3 text-xs">
                        <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-[10px] border border-emerald-200">
                          {idx + 1}
                        </div>
                        <div className="flex-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-slate-800 font-mono text-[11px]">
                              {m.milestoneType}
                            </span>
                            <span className="text-slate-400 text-[10px]">
                              {new Date(m.recordedAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-slate-600">{m.notes}</p>
                          <p className="text-[10px] text-slate-400 mt-1">Logged by: {m.actor?.name || m.actorId}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Record Milestone Form if in progress */}
                {(selectedOpp.status === "ACCEPTED" || selectedOpp.status === "IN_PROGRESS") && (
                  <form onSubmit={handleRecordMilestone} className="pt-3 border-t border-slate-100 space-y-2">
                    <p className="text-xs font-semibold text-slate-700">Record Operational Progress Milestone:</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        value={milestoneType}
                        onChange={(e) => setMilestoneType(e.target.value)}
                        className="text-xs px-3 py-1.5 border border-slate-200 rounded bg-slate-50 text-slate-900"
                      >
                        <option value="EN_ROUTE_TO_CARGO">En Route to Distressed Cargo</option>
                        <option value="ARRIVED_AT_SCENE">Arrived at Vehicle Location</option>
                        <option value="TRANSFER_IN_PROGRESS">Transferring Pallets to Rescue Unit</option>
                        <option value="CARGO_SECURED_SAFE">Cargo Secured in Safe Environment</option>
                      </select>
                      <input
                        type="text"
                        value={milestoneNotes}
                        onChange={(e) => setMilestoneNotes(e.target.value)}
                        placeholder="Progress details (e.g. Temperature checked at 3.6°C, all pallets intact)"
                        className="flex-1 text-xs px-3 py-1.5 border border-slate-200 rounded text-slate-900"
                      />
                      <button
                        type="submit"
                        disabled={submittingMilestone}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold shrink-0"
                      >
                        {submittingMilestone ? "Recording..." : "Log Progress"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Complete Rescue Outcome Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">Close &amp; Finalize Cargo Rescue</h3>
            <p className="text-xs text-slate-500 mb-4">
              Verify cargo temperature, receipt condition, and finalize partner settlement into the
              immutable audit record.
            </p>

            <form onSubmit={handleCompleteRescue} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Final Outcome Verification Notes (Required)
                </label>
                <textarea
                  rows={4}
                  required
                  value={completeNotes}
                  onChange={(e) => setCompleteNotes(e.target.value)}
                  placeholder="e.g. 100% of cargo safely offloaded into Sahyadri cold storage at 3.4°C. Zero product loss recorded. Driver departure logged."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCompleteModal(false)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingComplete}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold shadow-xs"
                >
                  {submittingComplete ? "Finalizing..." : "Finalize & Mark Rescued"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
