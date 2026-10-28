import { z } from "zod";

export const AIAssistanceResponseSchema = z.object({
  summary: z.string(),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  warmingVelocityPer10Min: z.number().nullable(),
  estimatedMinutesToSpoilage: z.number().nullable(),
  suggestedActions: z.array(z.string()),
  draftDriverUpdate: z.string(),
  uncertaintyNotes: z.string(),
  source: z.enum(["GEMINI_AI", "DETERMINISTIC_EXPERT_SYSTEM"]),
});

export type AIAssistanceResponse = z.infer<typeof AIAssistanceResponseSchema>;

export interface IncidentContext {
  shipmentTitle: string;
  cargoType: string;
  tempMin: number;
  tempMax: number;
  currentTemp: number;
  readings: Array<{ temperature: number; recordedAt: string | Date }>;
  activeAlerts: Array<{ ruleCode: string; summary: string; severity: string }>;
}

export async function analyzeIncidentWithAI(
  context: IncidentContext
): Promise<AIAssistanceResponse> {
  const geminiKey = process.env.GEMINI_API_KEY;

  if (geminiKey && geminiKey.trim().length > 0) {
    try {
      const response = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `You are an AI cold-chain logistics assistant for Annapurna.
Analyze the following cold-chain incident and return ONLY valid JSON matching this schema:
{
  "summary": "concise description of what is happening",
  "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "warmingVelocityPer10Min": float_number_or_null,
  "estimatedMinutesToSpoilage": integer_number_or_null,
  "suggestedActions": ["action 1", "action 2"],
  "draftDriverUpdate": "message to driver",
  "uncertaintyNotes": "limits of this estimate"
}

Incident Details:
Cargo: ${context.cargoType} (${context.shipmentTitle})
Allowed Range: ${context.tempMin}°C to ${context.tempMax}°C
Current Temperature: ${context.currentTemp}°C
Recent Readings: ${JSON.stringify(context.readings.slice(0, 5))}
Active Alerts: ${JSON.stringify(context.activeAlerts)}
`,
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
            },
          }),
        },
        5000 // 5 second timeout
      );

      if (response.ok) {
        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const parsed = JSON.parse(rawText);
          const validated = AIAssistanceResponseSchema.safeParse({
            ...parsed,
            source: "GEMINI_AI",
          });
          if (validated.success) {
            return validated.data;
          }
        }
      }
    } catch (err) {
      console.warn("AI provider call failed or timed out, using deterministic fallback:", err);
    }
  }

  // Deterministic Expert System Fallback
  return generateDeterministicIncidentAnalysis(context);
}

export function generateDeterministicIncidentAnalysis(
  context: IncidentContext
): AIAssistanceResponse {
  const sorted = [...context.readings].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
  );

  let warmingVelocity: number | null = null;
  let estimatedMinutes: number | null = null;

  if (sorted.length >= 2) {
    const latest = sorted[0].temperature;
    const previous = sorted[sorted.length - 1].temperature;
    const timeDiffMs =
      new Date(sorted[0].recordedAt).getTime() -
      new Date(sorted[sorted.length - 1].recordedAt).getTime();

    if (timeDiffMs > 0) {
      const minutes = timeDiffMs / (60 * 1000);
      const deltaTemp = latest - previous;
      warmingVelocity = parseFloat(((deltaTemp / minutes) * 10).toFixed(2));

      if (warmingVelocity > 0 && latest > context.tempMax) {
        // Assume critical degradation threshold is tempMax + 6°C
        const criticalTemp = context.tempMax + 6.0;
        const remainingRise = Math.max(0, criticalTemp - latest);
        estimatedMinutes = Math.round((remainingRise / (warmingVelocity / 10)));
      }
    }
  }

  const deviation = context.currentTemp - context.tempMax;
  const isHigh = deviation > 0;

  const riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" =
    deviation > 4
      ? "CRITICAL"
      : deviation > 1.5
      ? "HIGH"
      : deviation > 0
      ? "MEDIUM"
      : "LOW";

  const suggestedActions = isHigh
    ? [
        "Instruct driver to halt safely at next bay and verify reefer auxiliary power.",
        "Check cargo compartment physical door seals and thermostat readouts.",
        "Query eligible regional cold-storage rescue facilities within a 35 km radius.",
        "Draft and review a Cargo Rescue Opportunity if thermal recovery is not observed within 15 minutes.",
      ]
    : [
        "Normal operational parameters maintained. Continue real-time monitoring.",
        "Ensure scheduled waypoint check-ins are logged by driver.",
      ];

  const draftDriverUpdate = isHigh
    ? `URGENT OPERATOR NOTICE: Cargo temperature is currently ${context.currentTemp}°C (+${deviation.toFixed(
        1
      )}°C above ${context.tempMax}°C limit). Please inspect reefer display and confirm unit is powered on. Acknowledge this notification via app.`
    : `Status Update: Cold-chain temperature is stable at ${context.currentTemp}°C. Maintain current scheduled route.`;

  return {
    summary: isHigh
      ? `Thermal deviation detected on ${context.cargoType}. Temperature is currently ${context.currentTemp}°C, exceeding max allowable limit of ${context.tempMax}°C by +${deviation.toFixed(1)}°C.`
      : `Cargo conditions are within acceptable parameters (${context.currentTemp}°C inside ${context.tempMin}°C - ${context.tempMax}°C threshold).`,
    riskLevel,
    warmingVelocityPer10Min: warmingVelocity,
    estimatedMinutesToSpoilage: estimatedMinutes,
    suggestedActions,
    draftDriverUpdate,
    uncertaintyNotes:
      "Deterministic calculation based on recent sensor gradient. Actual spoilage rate varies with cargo thermal mass, packaging insulation, and external ambient temperature. Human operator review required before executing rescue operations.",
    source: "DETERMINISTIC_EXPERT_SYSTEM",
  };
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}
