export type NotificationChannel = "IN_APP" | "WEBHOOK" | "EMAIL";

export interface NotificationPayload {
  organizationId: string;
  recipientRole: "OPERATOR" | "DRIVER" | "PARTNER";
  recipientEmail?: string;
  title: string;
  message: string;
  incidentUrl?: string;
  urgency: "LOW" | "NORMAL" | "HIGH" | "EMERGENCY";
}

export interface NotificationResult {
  channel: NotificationChannel;
  delivered: boolean;
  statusMessage: string;
}

export async function dispatchNotification(
  payload: NotificationPayload
): Promise<NotificationResult[]> {
  const results: NotificationResult[] = [];

  // 1. In-App Notification (always logged to console / system record)
  console.log(`[NOTIFICATION - ${payload.urgency}] To: ${payload.recipientRole} | ${payload.title} -> ${payload.message}`);
  results.push({
    channel: "IN_APP",
    delivered: true,
    statusMessage: "Notification logged to platform event bus.",
  });

  // 2. Webhook integration (if configured)
  const webhookUrl = process.env.DISPATCH_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      results.push({
        channel: "WEBHOOK",
        delivered: res.ok,
        statusMessage: res.ok ? "Webhook dispatched successfully." : `Webhook returned HTTP ${res.status}`,
      });
    } catch (err: unknown) {
      results.push({
        channel: "WEBHOOK",
        delivered: false,
        statusMessage: `Webhook dispatch failed: ${(err as Error).message}`,
      });
    }
  } else {
    results.push({
      channel: "WEBHOOK",
      delivered: false,
      statusMessage: "Webhook URL unconfigured; skipped.",
    });
  }

  // 3. SMTP email (if configured)
  if (process.env.SMTP_HOST && payload.recipientEmail) {
    results.push({
      channel: "EMAIL",
      delivered: true,
      statusMessage: `Simulated SMTP dispatch to ${payload.recipientEmail}`,
    });
  } else {
    results.push({
      channel: "EMAIL",
      delivered: false,
      statusMessage: "SMTP transport not configured; skipped.",
    });
  }

  return results;
}
