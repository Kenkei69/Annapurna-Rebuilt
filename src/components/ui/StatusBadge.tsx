import React from "react";

interface StatusBadgeProps {
  status: string;
  variant?: "shipment" | "alert" | "rescue" | "device";
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const formatted = status.replace(/_/g, " ");

  let colorClasses = "bg-slate-100 text-slate-700 border-slate-200";

  switch (status.toUpperCase()) {
    // Healthy / Active / Completed / Accepted
    case "IN_TRANSIT":
    case "DELIVERED":
    case "RESCUED":
    case "COMPLETED":
    case "ACTIVE":
    case "ACCEPTED":
      colorClasses = "bg-emerald-50 text-emerald-700 border-emerald-200";
      break;

    // Warnings / Pending / In Progress
    case "DISPATCHED":
    case "DRAFT":
    case "ACKNOWLEDGED":
    case "OPEN":
    case "OFFERED":
    case "IN_PROGRESS":
    case "SUBMITTED":
      colorClasses = "bg-amber-50 text-amber-700 border-amber-200";
      break;

    // Critical / Breached / Cancelled / Rejected
    case "ALERTED":
    case "RESCUE_PENDING":
    case "CRITICAL":
    case "CANCELLED":
    case "REJECTED":
    case "SUSPENDED":
    case "DECOMMISSIONED":
      colorClasses = "bg-red-50 text-red-700 border-red-200";
      break;

    // Informational / High
    case "HIGH":
      colorClasses = "bg-orange-50 text-orange-700 border-orange-200";
      break;
    case "MEDIUM":
      colorClasses = "bg-amber-50 text-amber-700 border-amber-200";
      break;
    case "LOW":
      colorClasses = "bg-blue-50 text-blue-700 border-blue-200";
      break;
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorClasses} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-75" />
      {formatted}
    </span>
  );
}
