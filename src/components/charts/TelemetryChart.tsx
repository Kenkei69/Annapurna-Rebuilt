import React from "react";

interface TelemetryPoint {
  id: string;
  temperature: number;
  humidity?: number | null;
  recordedAt: string | Date;
  isSimulated?: boolean;
}

interface TelemetryChartProps {
  readings: TelemetryPoint[];
  tempMin: number;
  tempMax: number;
  height?: number;
}

export function TelemetryChart({
  readings,
  tempMin,
  tempMax,
  height = 240,
}: TelemetryChartProps) {
  if (!readings || readings.length === 0) {
    return (
      <div
        className="w-full flex items-center justify-center bg-slate-50 border border-dashed border-slate-200 rounded-lg p-8 text-slate-400 text-sm"
        style={{ height }}
      >
        No telemetry readings available yet. Ingest readings to visualize temperature history.
      </div>
    );
  }

  // Sort chronological for chart
  const sorted = [...readings].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );

  const temperatures = sorted.map((r) => r.temperature);
  const minTemp = Math.min(...temperatures, tempMin - 2);
  const maxTemp = Math.max(...temperatures, tempMax + 2);
  const range = maxTemp - minTemp || 1;

  const width = 640;
  const paddingX = 40;
  const paddingTop = 20;
  const paddingBottom = 30;
  const innerHeight = height - paddingTop - paddingBottom;
  const innerWidth = width - paddingX * 2;

  const getY = (val: number) => {
    return paddingTop + innerHeight - ((val - minTemp) / range) * innerHeight;
  };

  const getX = (index: number) => {
    if (sorted.length === 1) return paddingX + innerWidth / 2;
    return paddingX + (index / (sorted.length - 1)) * innerWidth;
  };

  const points = sorted.map((r, i) => `${getX(i)},${getY(r.temperature)}`).join(" ");

  const minThresholdY = getY(tempMin);
  const maxThresholdY = getY(tempMax);

  return (
    <div className="w-full bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-blue-600 rounded" />
            <span className="text-slate-600 font-medium">Temperature (°C)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-red-400 border-t border-dashed rounded" />
            <span className="text-slate-500">Thresholds ({tempMin}°C - {tempMax}°C)</span>
          </div>
        </div>
        <span className="text-slate-400">{sorted.length} recorded points</span>
      </div>

      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full overflow-visible"
          style={{ height }}
          role="img"
          aria-label="Telemetry temperature timeline graph"
        >
          {/* Safe threshold band */}
          <rect
            x={paddingX}
            y={maxThresholdY}
            width={innerWidth}
            height={Math.max(0, minThresholdY - maxThresholdY)}
            fill="#10b981"
            fillOpacity="0.08"
          />

          {/* Upper Threshold Line */}
          <line
            x1={paddingX}
            y1={maxThresholdY}
            x2={width - paddingX}
            y2={maxThresholdY}
            stroke="#ef4444"
            strokeDasharray="4 4"
            strokeWidth="1.5"
          />
          <text
            x={paddingX - 6}
            y={maxThresholdY + 4}
            textAnchor="end"
            fontSize="10"
            fill="#ef4444"
            fontWeight="600"
          >
            {tempMax}°C
          </text>

          {/* Lower Threshold Line */}
          <line
            x1={paddingX}
            y1={minThresholdY}
            x2={width - paddingX}
            y2={minThresholdY}
            stroke="#ef4444"
            strokeDasharray="4 4"
            strokeWidth="1.5"
          />
          <text
            x={paddingX - 6}
            y={minThresholdY + 4}
            textAnchor="end"
            fontSize="10"
            fill="#ef4444"
            fontWeight="600"
          >
            {tempMin}°C
          </text>

          {/* Baseline axis */}
          <line
            x1={paddingX}
            y1={height - paddingBottom}
            x2={width - paddingX}
            y2={height - paddingBottom}
            stroke="#cbd5e1"
            strokeWidth="1"
          />

          {/* Temperature trend line */}
          <polyline
            fill="none"
            stroke="#2563eb"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />

          {/* Data point dots */}
          {sorted.map((r, i) => {
            const cx = getX(i);
            const cy = getY(r.temperature);
            const isBreach = r.temperature > tempMax || r.temperature < tempMin;
            const timeLabel = new Date(r.recordedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <g key={r.id || i}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={isBreach ? 5 : 4}
                  fill={isBreach ? "#dc2626" : "#2563eb"}
                  stroke="#ffffff"
                  strokeWidth="2"
                />
                <text
                  x={cx}
                  y={cy - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="600"
                  fill={isBreach ? "#dc2626" : "#1e293b"}
                >
                  {r.temperature.toFixed(1)}°
                </text>
                {/* Time label below axis */}
                {(sorted.length <= 8 || i % Math.ceil(sorted.length / 6) === 0) && (
                  <text
                    x={cx}
                    y={height - paddingBottom + 16}
                    textAnchor="middle"
                    fontSize="9"
                    fill="#64748b"
                  >
                    {timeLabel}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Screen reader accessible tabular fallback */}
      <details className="mt-3">
        <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-800">
          View accessible telemetry tabular breakdown
        </summary>
        <table className="w-full text-xs mt-2 border border-slate-100">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="p-1.5 text-left">Time</th>
              <th className="p-1.5 text-right">Temperature</th>
              <th className="p-1.5 text-right">Humidity</th>
              <th className="p-1.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const isBreach = r.temperature > tempMax || r.temperature < tempMin;
              return (
                <tr key={i} className="border-t border-slate-100">
                  <td className="p-1.5">{new Date(r.recordedAt).toLocaleString()}</td>
                  <td className={`p-1.5 text-right font-medium ${isBreach ? "text-red-600" : "text-slate-900"}`}>
                    {r.temperature.toFixed(1)}°C
                  </td>
                  <td className="p-1.5 text-right">{r.humidity != null ? `${r.humidity}%` : "—"}</td>
                  <td className="p-1.5 text-center">
                    {isBreach ? (
                      <span className="text-red-700 bg-red-50 px-1.5 py-0.5 rounded text-[10px]">Breach</span>
                    ) : (
                      <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">Safe</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>
    </div>
  );
}
