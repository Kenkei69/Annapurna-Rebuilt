"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ToastBanner, ToastMessage } from "@/components/ui/ToastBanner";
import { safeFetch } from "@/lib/api-client";
import {
  LifeBuoy,
  Building2,
  Clock,
  PlusCircle,
  Award,
  MapPin,
  AlertTriangle,
  Check,
} from "lucide-react";

export interface PartnerProfileData {
  id?: string;
  organizationId?: string;
  facilityName?: string | null;
  facilityType?: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  capacityAvailableKg?: number | null;
  tempRangeMin?: number | null;
  tempRangeMax?: number | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  isActive?: boolean;
  onboardingComplete?: boolean;
  verificationStatus?: string;
}

interface RescueHubProps {
  opportunities: any[];
  userRole: string;
  userOrgId: string;
  isPartner: boolean;
  partnerProfile?: PartnerProfileData | null;
}

export function RescueHubClient({
  opportunities,
  userRole: _userRole,
  userOrgId: _userOrgId,
  isPartner,
  partnerProfile,
}: RescueHubProps) {
  const router = useRouter();
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [selectedOppId, setSelectedOppId] = useState<string>(
    opportunities[0]?.id || ""
  );

  // Partner Onboarding Modal State — Real placeholders instead of fake hardcoded business details
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [onboardFacilityName, setOnboardFacilityName] = useState(
    partnerProfile?.facilityName || ""
  );
  const [onboardFacilityType, setOnboardFacilityType] = useState(
    partnerProfile?.facilityType || "COLD_STORAGE"
  );
  const [onboardAddress, setOnboardAddress] = useState(
    partnerProfile?.address || ""
  );
  const [onboardLat, setOnboardLat] = useState<string | number>(
    partnerProfile?.latitude ?? ""
  );
  const [onboardLng, setOnboardLng] = useState<string | number>(
    partnerProfile?.longitude ?? ""
  );
  const [onboardCapacityKg, setOnboardCapacityKg] = useState<string | number>(
    partnerProfile?.capacityAvailableKg ?? ""
  );
  const [onboardTempMin, setOnboardTempMin] = useState<string | number>(
    partnerProfile?.tempRangeMin ?? ""
  );
  const [onboardTempMax, setOnboardTempMax] = useState<string | number>(
    partnerProfile?.tempRangeMax ?? ""
  );
  const [onboardPhone, setOnboardPhone] = useState(
    partnerProfile?.contactPhone || ""
  );
  const [onboardEmail, setOnboardEmail] = useState(
    partnerProfile?.contactEmail || ""
  );
  const [submittingOnboarding, setSubmittingOnboarding] = useState(false);

  // Partner Offer Form State
  const [offerAmount, setOfferAmount] = useState<string | number>("");
  const [capacityKg, setCapacityKg] = useState<string | number>("");
  const [storageType, setStorageType] = useState("COLD_STORAGE");
  const [etaMinutes, setEtaMinutes] = useState<string | number>("");
  const [offerNotes, setOfferNotes] = useState("");
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

  // Counter Offer State
  const [counteringOfferId, setCounteringOfferId] = useState<string | null>(null);
  const [counterAmountInput, setCounterAmountInput] = useState("");
  const [counterNotesInput, setCounterNotesInput] = useState("");
  const [submittingCounter, setSubmittingCounter] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowOnboardingModal(false);
        setShowCompleteModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const selectedOpp = opportunities.find((o) => o.id === selectedOppId);

  // Save Partner Onboarding
  const handleSaveOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onboardLat === "" || onboardLng === "" || onboardCapacityKg === "" || onboardTempMin === "" || onboardTempMax === "") {
      setToast({
        type: "error",
        message: "Please enter all required numerical facility coordinates and operational envelopes.",
      });
      return;
    }

    try {
      setSubmittingOnboarding(true);
      const res = await safeFetch("/api/partner/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facilityName: onboardFacilityName,
          facilityType: onboardFacilityType,
          address: onboardAddress,
          latitude: Number(onboardLat),
          longitude: Number(onboardLng),
          capacityAvailableKg: Number(onboardCapacityKg),
          tempRangeMin: Number(onboardTempMin),
          tempRangeMax: Number(onboardTempMax),
          contactPhone: onboardPhone,
          contactEmail: onboardEmail,
        }),
      });

      if (!res.ok) {
        throw new Error(res.error || "Failed to save onboarding profile");
      }

      setToast({
        type: "success",
        message: "Facility onboarding profile successfully completed (self-reported profile active).",
      });
      setShowOnboardingModal(false);
      router.refresh();
    } catch (err: any) {
      setToast({ type: "error", message: err.message });
    } finally {
      setSubmittingOnboarding(false);
    }
  };

  // Submit Offer
  const handleSubmitOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOpp) return;
    if (isPartner && !partnerProfile?.onboardingComplete) {
      setToast({
        type: "error",
        message: "Please complete facility onboarding before submitting offers.",
      });
      setShowOnboardingModal(true);
      return;
    }
    if (!offerAmount || !capacityKg || !etaMinutes) {
      setToast({
        type: "error",
        message: "Please provide valid quote amount, capacity, and estimated ETA.",
      });
      return;
    }
    try {
      setSubmittingOffer(true);
      const res = await safeFetch(`/api/rescue/opportunities/${selectedOpp.id}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerAmount: Number(offerAmount),
          capacityOfferedKg: Number(capacityKg),
          storageType,
          estimatedEtaMinutes: Number(etaMinutes),
          notes: offerNotes || "Capacity prepared for incoming cargo.",
        }),
      });

      if (!res.ok) {
        throw new Error(res.error || "Failed to submit offer");
      }

      setToast({
        type: "success",
        message: "Capacity offer successfully submitted to fleet operator!",
      });
      setOfferAmount("");
      setCapacityKg("");
      setEtaMinutes("");
      setOfferNotes("");
      router.refresh();
    } catch (err: any) {
      setToast({ type: "error", message: err.message });
    } finally {
      setSubmittingOffer(false);
    }
  };

  // Accept Offer (Fleet Operator action)
  const handleAcceptOffer = async (offerId: string) => {
    if (!selectedOpp) return;
    try {
      setAcceptingOfferId(offerId);
      const res = await safeFetch(`/api/rescue/opportunities/${selectedOpp.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId }),
      });

      if (!res.ok) {
        throw new Error(res.error || "Failed to accept offer");
      }

      setToast({
        type: "success",
        message: "Rescue offer accepted! Opportunity assigned and incident status updated.",
      });
      router.refresh();
    } catch (err: any) {
      setToast({ type: "error", message: err.message });
    } finally {
      setAcceptingOfferId(null);
    }
  };

  // Submit Counter-Offer (Fleet Operator action)
  const handleCounterOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOpp || !counteringOfferId) return;
    try {
      setSubmittingCounter(true);
      const res = await safeFetch(
        `/api/rescue/opportunities/${selectedOpp.id}/offers/${counteringOfferId}/counter`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            counterAmount: Number(counterAmountInput),
            counterNotes: counterNotesInput || undefined,
          }),
        }
      );
      if (!res.ok) {
        throw new Error(res.error || "Failed to submit counter-offer");
      }
      setToast({
        type: "success",
        message: "Counter-offer successfully submitted to partner facility.",
      });
      setCounteringOfferId(null);
      setCounterAmountInput("");
      setCounterNotesInput("");
      router.refresh();
    } catch (err: any) {
      setToast({ type: "error", message: err.message });
    } finally {
      setSubmittingCounter(false);
    }
  };

  // Partner Response to Counter-Offer
  const handleCounterResponse = async (offerId: string, accept: boolean) => {
    if (!selectedOpp) return;
    try {
      const res = await safeFetch(
        `/api/rescue/opportunities/${selectedOpp.id}/offers/${offerId}/counter-response`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accept }),
        }
      );
      if (!res.ok) {
        throw new Error(res.error || "Failed to respond to counter-offer");
      }
      setToast({
        type: "success",
        message: accept
          ? "Counter-offer accepted! Quote successfully updated."
          : "Counter-offer declined. Retaining original quote.",
      });
      router.refresh();
    } catch (err: any) {
      setToast({ type: "error", message: err.message });
    }
  };

  // Record Milestone
  const handleRecordMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOpp) return;
    try {
      setSubmittingMilestone(true);
      const res = await safeFetch(`/api/rescue/opportunities/${selectedOpp.id}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          milestoneType,
          notes: milestoneNotes || `Operational progress: ${milestoneType}`,
        }),
      });

      if (!res.ok) {
        throw new Error(res.error || "Failed to record milestone");
      }

      setToast({
        type: "success",
        message: "Operational milestone logged successfully.",
      });
      setMilestoneNotes("");
      router.refresh();
    } catch (err: any) {
      setToast({ type: "error", message: err.message });
    } finally {
      setSubmittingMilestone(false);
    }
  };

  // Complete Rescue
  const handleCompleteRescue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOpp) return;
    if (!completeNotes.trim()) {
      setToast({
        type: "error",
        message: "Final outcome verification notes are required.",
      });
      return;
    }

    try {
      setSubmittingComplete(true);
      const res = await safeFetch(`/api/rescue/opportunities/${selectedOpp.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcomeNotes: completeNotes,
        }),
      });

      if (!res.ok) {
        throw new Error(res.error || "Failed to complete rescue");
      }

      setToast({
        type: "success",
        message: "Cargo rescue operation successfully concluded and verified.",
      });
      setShowCompleteModal(false);
      router.refresh();
    } catch (err: any) {
      setToast({ type: "error", message: err.message });
    } finally {
      setSubmittingComplete(false);
    }
  };

  return (
    <div className="space-y-6">
      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cargo Rescue Coordination Hub</h1>
          <p className="text-xs text-slate-500 mt-1">
            Emergency cold transfer marketplace, transactional assignment &amp; verifiable transfer audit trails
          </p>
        </div>
      </div>

      {/* Partner Onboarding Incomplete Banner */}
      {isPartner && !partnerProfile?.onboardingComplete && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="text-sm font-bold text-amber-900">
                Partner Facility Onboarding Required
              </h4>
              <p className="text-xs text-amber-700 mt-0.5">
                To submit bids on cold-chain rescue opportunities, your partner organization must register its verified facility type, coordinates, available capacity, and thermal operating range.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowOnboardingModal(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg shrink-0 shadow-xs cursor-pointer"
          >
            Complete Facility Onboarding
          </button>
        </div>
      )}

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
                      No offers submitted yet. Active rescue partners have received notification.
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

                            {/* Counter-Offer Status Badges */}
                            {offer.counterStatus === "SUBMITTED" && (
                              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                  <span className="font-bold">Fleet Counter-Offer: ₹{offer.counterAmount?.toLocaleString()}</span>
                                  {offer.counterNotes && <span className="ml-1 text-amber-700">({offer.counterNotes})</span>}
                                </div>
                                {isPartner && (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleCounterResponse(offer.id, true)}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold"
                                    >
                                      Accept Counter
                                    </button>
                                    <button
                                      onClick={() => handleCounterResponse(offer.id, false)}
                                      className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[11px] font-semibold"
                                    >
                                      Decline
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {offer.isPartnerApproved && (
                              <div className="mt-1 text-[11px] font-medium text-emerald-700 flex items-center gap-1">
                                <Check size={12} />
                                <span>Counter quote agreed and accepted by partner</span>
                              </div>
                            )}

                            {offer.counterStatus === "DECLINED" && (
                              <div className="mt-1 text-[11px] font-medium text-slate-500">
                                Counter-offer was declined; original quote remains active
                              </div>
                            )}
                          </div>

                          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                            <span className="font-mono text-base font-extrabold text-slate-900">
                              ₹{offer.offerAmount.toLocaleString()}
                            </span>

                            {/* Operator Accept Offer / Counter Buttons */}
                            {!isPartner &&
                              (selectedOpp.status === "OPEN" || selectedOpp.status === "OFFERED") &&
                              offer.status === "SUBMITTED" && (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      setCounteringOfferId(offer.id);
                                      setCounterAmountInput(String(Math.round(offer.offerAmount * 0.9)));
                                    }}
                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold border border-slate-200"
                                  >
                                    Counter Quote
                                  </button>
                                  <button
                                    onClick={() => handleAcceptOffer(offer.id)}
                                    disabled={acceptingOfferId !== null}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold shadow-xs disabled:opacity-50"
                                  >
                                    {acceptingOfferId === offer.id ? "Assigning..." : "Accept Proposal"}
                                  </button>
                                </div>
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

                  {!partnerProfile?.onboardingComplete ? (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-3">
                      <div className="font-bold flex items-center gap-1.5 text-amber-900">
                        <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                        <span>Facility Onboarding Incomplete</span>
                      </div>
                      <p>
                        In accordance with cold-chain verified safety protocols, rescue partners must complete their facility profile and verified capacity before submitting rescue offers.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowOnboardingModal(true)}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded text-xs shadow-xs cursor-pointer"
                      >
                        Complete Facility Onboarding Now
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitOffer} className="space-y-4 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
                            Storage Type
                          </label>
                          <select
                            value={storageType}
                            onChange={(e) => setStorageType(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white"
                          >
                            <option value="COLD_STORAGE">Cold Storage</option>
                            <option value="WHOLESALE_BUYER">Wholesale Buyer</option>
                            <option value="EMERGENCY_REEFER">Emergency Reefer</option>
                          </select>
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
                  )}
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

      {/* Partner Facility Onboarding Modal */}
      {showOnboardingModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Building2 size={18} className="text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Rescue Partner Facility Onboarding
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowOnboardingModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Register your verified cold-chain facility profile, available capacity, and thermal operating range to unlock rescue offer bidding.
            </p>

            <form onSubmit={handleSaveOnboarding} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Facility Name
                  </label>
                  <input
                    type="text"
                    required
                    value={onboardFacilityName}
                    onChange={(e) => setOnboardFacilityName(e.target.value)}
                    placeholder="e.g. Sahyadri Cold Hub"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Facility Type
                  </label>
                  <select
                    value={onboardFacilityType}
                    onChange={(e) => setOnboardFacilityType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
                  >
                    <option value="COLD_STORAGE">Cold Storage Facility</option>
                    <option value="WHOLESALE_BUYER">Wholesale Buyer / Terminal</option>
                    <option value="EMERGENCY_REEFER">Emergency Mobile Reefer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Physical Address
                </label>
                <input
                  type="text"
                  required
                  value={onboardAddress}
                  onChange={(e) => setOnboardAddress(e.target.value)}
                  placeholder="Street address, industrial estate, city"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={onboardLat}
                    onChange={(e) => setOnboardLat(e.target.value)}
                    placeholder="e.g. 18.5204"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={onboardLng}
                    onChange={(e) => setOnboardLng(e.target.value)}
                    placeholder="e.g. 73.8567"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Available Storage Capacity (kg)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={onboardCapacityKg}
                    onChange={(e) => setOnboardCapacityKg(e.target.value)}
                    placeholder="e.g. 15000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Min Temp (°C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={onboardTempMin}
                    onChange={(e) => setOnboardTempMin(e.target.value)}
                    placeholder="e.g. -25.0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Max Temp (°C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={onboardTempMax}
                    onChange={(e) => setOnboardTempMax(e.target.value)}
                    placeholder="e.g. 8.0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    required
                    value={onboardPhone}
                    onChange={(e) => setOnboardPhone(e.target.value)}
                    placeholder="e.g. +91 20 2730 0000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    required
                    value={onboardEmail}
                    onChange={(e) => setOnboardEmail(e.target.value)}
                    placeholder="e.g. ops@partnerfacility.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowOnboardingModal(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOnboarding}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold shadow-xs cursor-pointer"
                >
                  {submittingOnboarding ? "Saving Profile..." : "Verify & Activate Profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Counter Offer Modal */}
      {counteringOfferId && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">Submit Fleet Counter-Offer</h3>
            <p className="text-xs text-slate-500 mb-4">
              Propose an adjusted compensation quote for this rescue opportunity. The partner facility will review and approve or decline.
            </p>

            <form onSubmit={handleCounterOffer} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Proposed Counter Amount (₹)
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={counterAmountInput}
                  onChange={(e) => setCounterAmountInput(e.target.value)}
                  placeholder="e.g. 24000"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Negotiation Notes / Operational Terms
                </label>
                <textarea
                  rows={3}
                  value={counterNotesInput}
                  onChange={(e) => setCounterNotesInput(e.target.value)}
                  placeholder="e.g. Rate adjusted based on 25km proximity and standard dock unloading equipment."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCounteringOfferId(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCounter}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold shadow-xs"
                >
                  {submittingCounter ? "Submitting..." : "Send Counter-Offer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
