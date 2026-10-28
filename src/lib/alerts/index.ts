import { prisma } from "../db";
import { AlertSeverity, AlertStatus, ShipmentStatus, TelemetryReading } from "@prisma/client";
import { recordAuditEvent } from "../audit";

export async function evaluateTelemetryAlerts(
  shipmentId: string,
  reading: TelemetryReading
) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      alerts: {
        where: {
          status: { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] },
        },
      },
      telemetryReadings: {
        orderBy: { recordedAt: "desc" },
        take: 5,
      },
    },
  });

  if (!shipment) return [];

  const createdAlerts = [];

  // 1. High Temperature Breach
  if (reading.temperature > shipment.tempMax) {
    const deviation = (reading.temperature - shipment.tempMax).toFixed(1);
    const existing = shipment.alerts.find((a) => a.ruleCode === "TEMP_HIGH_BREACH");

    // Check if sustained (past 3 readings all above max)
    const isSustained =
      shipment.telemetryReadings.length >= 3 &&
      shipment.telemetryReadings.slice(0, 3).every((r) => r.temperature > shipment.tempMax);

    const severity = isSustained ? AlertSeverity.CRITICAL : AlertSeverity.HIGH;
    const ruleCode = isSustained ? "SUSTAINED_BREACH" : "TEMP_HIGH_BREACH";

    if (!existing) {
      const alert = await prisma.$transaction(async (tx) => {
        const created = await tx.alert.create({
          data: {
            organizationId: shipment.organizationId,
            shipmentId: shipment.id,
            ruleCode,
            severity,
            summary: isSustained
              ? `CRITICAL SUSTAINED BREACH: Cargo temperature ${reading.temperature}°C exceeds upper threshold (${shipment.tempMax}°C) for 3 consecutive readings (+${deviation}°C deviation).`
              : `High Temperature Breach: Reading ${reading.temperature}°C exceeds upper allowed limit (${shipment.tempMax}°C) by +${deviation}°C.`,
            triggerReadingJson: JSON.stringify({
              temperature: reading.temperature,
              recordedAt: reading.recordedAt,
              limit: shipment.tempMax,
            }),
            recommendedAction: isSustained
              ? "Immediately notify driver to inspect reefer power/compressor. If temperature fails to stabilize within 15 minutes, initiate Cargo Rescue Opportunity."
              : "Verify reefer thermostat setting and check for door seal breach or temporary defrost cycle.",
          },
        });

        // Update shipment status to ALERTED if currently IN_TRANSIT
        if (shipment.status === ShipmentStatus.IN_TRANSIT) {
          await tx.shipment.update({
            where: { id: shipment.id },
            data: { status: ShipmentStatus.ALERTED },
          });
        }

        await recordAuditEvent(
          {
            organizationId: shipment.organizationId,
            action: "ALERT_GENERATED",
            entityType: "Alert",
            entityId: created.id,
            details: {
              ruleCode,
              severity,
              temperature: reading.temperature,
              shipmentTrackingNumber: shipment.trackingNumber,
            },
          },
          tx
        );

        return created;
      });

      createdAlerts.push(alert);
    }
  }

  // 2. Low Temperature Breach (Freezing risk)
  if (reading.temperature < shipment.tempMin) {
    const deviation = (shipment.tempMin - reading.temperature).toFixed(1);
    const existing = shipment.alerts.find((a) => a.ruleCode === "TEMP_LOW_BREACH");

    if (!existing) {
      const alert = await prisma.$transaction(async (tx) => {
        const created = await tx.alert.create({
          data: {
            organizationId: shipment.organizationId,
            shipmentId: shipment.id,
            ruleCode: "TEMP_LOW_BREACH",
            severity: AlertSeverity.HIGH,
            summary: `Sub-Cooling / Freezing Risk: Reading ${reading.temperature}°C is below lower allowed limit (${shipment.tempMin}°C) by -${deviation}°C.`,
            triggerReadingJson: JSON.stringify({
              temperature: reading.temperature,
              recordedAt: reading.recordedAt,
              limit: shipment.tempMin,
            }),
            recommendedAction:
              "Adjust reefer set-point upward to prevent freeze damage or crystallization to perishable cargo.",
          },
        });

        if (shipment.status === ShipmentStatus.IN_TRANSIT) {
          await tx.shipment.update({
            where: { id: shipment.id },
            data: { status: ShipmentStatus.ALERTED },
          });
        }

        return created;
      });

      createdAlerts.push(alert);
    }
  }

  // 3. Humidity Breach
  if (
    shipment.humidityMax !== null &&
    reading.humidity !== null &&
    reading.humidity > shipment.humidityMax
  ) {
    const existing = shipment.alerts.find((a) => a.ruleCode === "HUMIDITY_BREACH");
    if (!existing) {
      const alert = await prisma.alert.create({
        data: {
          organizationId: shipment.organizationId,
          shipmentId: shipment.id,
          ruleCode: "HUMIDITY_BREACH",
          severity: AlertSeverity.MEDIUM,
          summary: `Excess Humidity Detected: Relative humidity ${reading.humidity}% exceeds threshold ${shipment.humidityMax}%.`,
          triggerReadingJson: JSON.stringify({
            humidity: reading.humidity,
            limit: shipment.humidityMax,
          }),
          recommendedAction:
            "Inspect cargo bay condensation drain and confirm air circulation fans are operating.",
        },
      });
      createdAlerts.push(alert);
    }
  }

  return createdAlerts;
}

export async function acknowledgeAlert(params: {
  alertId: string;
  actorId: string;
  actorEmail?: string;
  notes?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const alert = await tx.alert.findUnique({
      where: { id: params.alertId },
    });
    if (!alert) throw new Error("ALERT_NOT_FOUND");
    if (alert.status !== AlertStatus.ACTIVE) {
      throw new Error("Alert is already acknowledged or resolved");
    }

    const updated = await tx.alert.update({
      where: { id: params.alertId },
      data: {
        status: AlertStatus.ACKNOWLEDGED,
        acknowledgedById: params.actorId,
        acknowledgedAt: new Date(),
        ackNotes: params.notes,
      },
    });

    await recordAuditEvent(
      {
        organizationId: alert.organizationId,
        actorId: params.actorId,
        actorEmail: params.actorEmail,
        action: "ALERT_ACKNOWLEDGED",
        entityType: "Alert",
        entityId: alert.id,
        details: { notes: params.notes },
      },
      tx
    );

    return updated;
  });
}

export async function resolveAlert(params: {
  alertId: string;
  actorId: string;
  actorEmail?: string;
  resolutionNotes: string;
}) {
  return prisma.$transaction(async (tx) => {
    const alert = await tx.alert.findUnique({
      where: { id: params.alertId },
      include: { shipment: true },
    });
    if (!alert) throw new Error("ALERT_NOT_FOUND");

    const updated = await tx.alert.update({
      where: { id: params.alertId },
      data: {
        status: AlertStatus.RESOLVED,
        resolvedById: params.actorId,
        resolvedAt: new Date(),
        resolutionNotes: params.resolutionNotes,
      },
    });

    // Check if any other active alerts remain on this shipment
    const remainingActive = await tx.alert.count({
      where: {
        shipmentId: alert.shipmentId,
        status: { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] },
      },
    });

    if (remainingActive === 0 && alert.shipment.status === ShipmentStatus.ALERTED) {
      await tx.shipment.update({
        where: { id: alert.shipmentId },
        data: { status: ShipmentStatus.IN_TRANSIT },
      });
    }

    await recordAuditEvent(
      {
        organizationId: alert.organizationId,
        actorId: params.actorId,
        actorEmail: params.actorEmail,
        action: "ALERT_RESOLVED",
        entityType: "Alert",
        entityId: alert.id,
        details: { resolutionNotes: params.resolutionNotes },
      },
      tx
    );

    return updated;
  });
}
