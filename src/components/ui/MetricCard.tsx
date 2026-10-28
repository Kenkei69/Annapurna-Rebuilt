import React from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    label: string;
    positive?: boolean;
  };
  variant?: "default" | "success" | "warning" | "danger";
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = "default",
}: MetricCardProps) {
  let borderClass = "border-slate-200";
  let bgIconClass = "bg-slate-100 text-slate-600";

  if (variant === "success") {
    borderClass = "border-emerald-200";
    bgIconClass = "bg-emerald-50 text-emerald-700";
  } else if (variant === "warning") {
    borderClass = "border-amber-200";
    bgIconClass = "bg-amber-50 text-amber-700";
  } else if (variant === "danger") {
    borderClass = "border-red-200";
    bgIconClass = "bg-red-50 text-red-700";
  }

  return (
    <div className={`bg-white rounded-xl border p-5 shadow-xs flex flex-col justify-between ${borderClass}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
        </div>
        {icon && <div className={`p-2.5 rounded-lg ${bgIconClass}`}>{icon}</div>}
      </div>

      {(subtitle || trend) && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          {subtitle && <span>{subtitle}</span>}
          {trend && (
            <span
              className={`font-medium ${
                trend.positive ? "text-emerald-700" : "text-amber-700"
              }`}
            >
              {trend.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
