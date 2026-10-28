import { prisma } from "../db";
import {
  AlertSeverity,
  AlertStatus,
  Prisma,
  ShipmentStatus,
  TelemetryReading,
} from "@prisma/client";
import { recordAuditEvent } from "../audit";

export async function evaluateTelemetryAlerts(
  shipmentId: string,
  reading: TelemetryReading,
  externalTx?: Prisma.TransactionClient
) {
  const db = externalTx ?? prisma;

  const shipment = await db.shipment.findUnique({
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

  // 1. High Temperature Breach & Sustained Breach Escalation
  if (reading.temperature > shipment.tempMax) {
    const deviation = (reading.temperature - shipment.tempMax).toFixed(1);

    // Check if sustained (past 3 readings all above max, including current)
    const readings = shipment.telemetryReadings;
    const isSustained =
      readings.length >= 3 &&
      readings.slice(0, 3).every((r) => r.temperature > shipment.tempMax);

    const existingHighBreach = shipment.alerts.find(
      (a) => a.ruleCode === "TEMP_HIGH_BREACH"
    );
    const existingSustainedBreach = shipment.alerts.find(
      (a) => a.ruleCode === "SUSTAINED_BREACH"
    );

    if (isSustained) {
      // If sustained breach alert already active, do not duplicate
      if (!existingSustainedBreach) {
        const alert = await db.alert.create({
          data: {
            organizationId: shipment.organizationId,
            shipmentId: shipment.id,
            ruleCode: "SUSTAINED_BREACH",
            severity: AlertSeverity.CRITICAL,
            summary: `CRITICAL SUSTAINED BREACH: Cargo temperature ${reading.temperature}°C exceeds upper threshold (${shipment.tempMax}°C) for 3 consecutive readings (+${deviation}°C deviation).`,
            triggerReadingJson: JSON.stringify({
              temperature: reading.temperature,
              recordedAt: reading.recordedAt,
              limit: shipment.tempMax,
            }),
            recommendedAction:
              "Immediately notify driver to inspect reefer power/compressor. If temperature fails to stabilize within 15 minutes, initiate Cargo Rescue Opportunity.",
            escalatedFromId: existingHighBreach ? existingHighBreach.id : null,
          },
        });

        // If prior high breach exists, supersede it with acknowledgment linking to escalation
        if (existingHighBreach) {
          await db.alert.update({
            where: { id: existingHighBreach.id },
            data: {
              status: AlertStatus.ACKNOWLEDGED,
              ackNotes: `Automatically escalated to CRITICAL SUSTAINED_BREACH (Alert ID ${alert.id}).`,
              acknowledgedAt: new Date(),
            },
          });
        }

        // Update shipment status to ALERTED if currently IN_TRANSIT
        if (shipment.status === ShipmentStatus.IN_TRANSIT) {
          await db.shipment.update({
            where: { id: shipment.id },
            data: { status: ShipmentStatus.ALERTED },
          });
        }

        await recordAuditEvent(
          {
            organizationId: shipment.organizationId,
            action: "ALERT_GENERATED",
            entityType: "Alert",
            entityId: alert.id,
            details: {
              ruleCode: "SUSTAINED_BREACH",
              severity: AlertSeverity.CRITICAL,
              temperature: reading.temperature,
              shipmentTrackingNumber: shipment.trackingNumber,
              escalatedFromAlertId: existingHighBreach?.id,
            },
          },
          externalTx
        );

        createdAlerts.push(alert);
      }
    } else {
      // Single reading breach: only create if neither high breach nor sustained breach already exists
      if (!existingHighBreach && !existingSustainedBreach) {
        const alert = await db.alert.create({
          data: {
            organizationId: shipment.organizationId,
            shipmentId: shipment.id,
            ruleCode: "TEMP_HIGH_BREACH",
            severity: AlertSeverity.HIGH,
            summary: `High Temperature Breach: Reading ${reading.temperature}°C exceeds upper allowed limit (${shipment.tempMax}°C) by +${deviation}°C.`,
            triggerReadingJson: JSON.stringify({
              temperature: reading.temperature,
              recordedAt: reading.recordedAt,
              limit: shipment.tempMax,
            }),
            recommendedAction:
              "Verify reefer thermostat setting and check for door seal breach or temporary defrost cycle.",
          },
        });

        if (shipment.status === ShipmentStatus.IN_TRANSIT) {
          await db.shipment.update({
            where: { id: shipment.id },
            data: { status: ShipmentStatus.ALERTED },
          });
        }

        await recordAuditEvent(
          {
            organizationId: shipment.organizationId,
            action: "ALERT_GENERATED",
            entityType: "Alert",
            entityId: alert.id,
            details: {
              ruleCode: "TEMP_HIGH_BREACH",
              severity: AlertSeverity.HIGH,
              temperature: reading.temperature,
              shipmentTrackingNumber: shipment.trackingNumber,
            },
          },
          externalTx
        );

        createdAlerts.push(alert);
      }
    }
  }

  // 2. Low Temperature Breach (Freezing risk)
  if (reading.temperature < shipment.tempMin) {
    const deviation = (shipment.tempMin - reading.temperature).toFixed(1);
    const existing = shipment.alerts.find((a) => a.ruleCode === "TEMP_LOW_BREACH");

    if (!existing) {
      const alert = await db.alert.create({
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
        await db.shipment.update({
          where: { id: shipment.id },
          data: { status: ShipmentStatus.ALERTED },
        });
      }

      await recordAuditEvent(
        {
          organizationId: shipment.organizationId,
          action: "ALERT_GENERATED",
          entityType: "Alert",
          entityId: alert.id,
          details: {
            ruleCode: "TEMP_LOW_BREACH",
            severity: AlertSeverity.HIGH,
            temperature: reading.temperature,
            shipmentTrackingNumber: shipment.trackingNumber,
          },
        },
        externalTx
      );

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
      const alert = await db.alert.create({
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

      await recordAuditEvent(
        {
          organizationId: shipment.organizationId,
          action: "ALERT_GENERATED",
          entityType: "Alert",
          entityId: alert.id,
          details: {
            ruleCode: "HUMIDITY_BREACH",
            severity: AlertSeverity.MEDIUM,
            humidity: reading.humidity,
            shipmentTrackingNumber: shipment.trackingNumber,
          },
        },
        externalTx
      );

      createdAlerts.push(alert);
    }
  }

  return createdAlerts;
}

export async function detectMissingTelemetry(heartbeatWindowMinutes: number = 30) {
  const cutoff = new Date(Date.now() - heartbeatWindowMinutes * 60 * 1000);
  const shipments = await prisma.shipment.findMany({
    where: {
      status: { in: [ShipmentStatus.IN_TRANSIT, ShipmentStatus.ALERTED] },
      assignedDeviceId: { not: null },
      OR: [
        { latestRecordedAt: { lt: cutoff } },
        { latestRecordedAt: null, createdAt: { lt: cutoff } },
      ],
    },
    include: {
      alerts: {
        where: {
          ruleCode: "MISSING_TELEMETRY",
          status: { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] },
        },
      },
    },
  });

  const createdAlerts = [];
  for (const shipment of shipments) {
    if (shipment.alerts.length === 0) {
      const alert = await prisma.alert.create({
        data: {
          organizationId: shipment.organizationId,
          shipmentId: shipment.id,
          ruleCode: "MISSING_TELEMETRY",
          severity: AlertSeverity.HIGH,
          summary: `Missing Telemetry: No sensor heartbeat received for over ${heartbeatWindowMinutes} minutes. Reefer monitoring stream offline.`,
          triggerReadingJson: JSON.stringify({
            lastSeenAt: shipment.latestRecordedAt,
            heartbeatWindowMinutes,
          }),
          recommendedAction:
            "Contact vehicle driver immediately to verify edge hardware power and cellular connectivity.",
        },
      });

      if (shipment.status === ShipmentStatus.IN_TRANSIT) {
        await prisma.shipment.update({
          where: { id: shipment.id },
          data: { status: ShipmentStatus.ALERTED },
        });
      }

      await recordAuditEvent({
        organizationId: shipment.organizationId,
        action: "ALERT_GENERATED",
        entityType: "Alert",
        entityId: alert.id,
        details: {
          ruleCode: "MISSING_TELEMETRY",
          heartbeatWindowMinutes,
          trackingNumber: shipment.trackingNumber,
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
  overrideReason?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const alert = await tx.alert.findUnique({
      where: { id: params.alertId },
      include: { shipment: true },
    });
    if (!alert) throw new Error("ALERT_NOT_FOUND");

    // Invariant check: Verify current temperature has returned to safe band or explicit override provided
    const shipment = alert.shipment;
    if (
      alert.ruleCode === "TEMP_HIGH_BREACH" ||
      alert.ruleCode === "SUSTAINED_BREACH"
    ) {
      if (
        shipment.latestTemperature !== null &&
        shipment.latestTemperature > shipment.tempMax
      ) {
        if (!params.overrideReason || params.overrideReason.trim().length < 5) {
          throw new Error(
            `UNSAFE_RESOLUTION_REJECTED: Latest cargo temperature (${shipment.latestTemperature}°C) still exceeds threshold (${shipment.tempMax}°C). An explicit overrideReason of at least 5 characters is required to resolve without returning to the safe band.`
          );
        }
      }
    } else if (alert.ruleCode === "TEMP_LOW_BREACH") {
      if (
        shipment.latestTemperature !== null &&
        shipment.latestTemperature < shipment.tempMin
      ) {
        if (!params.overrideReason || params.overrideReason.trim().length < 5) {
          throw new Error(
            `UNSAFE_RESOLUTION_REJECTED: Latest cargo temperature (${shipment.latestTemperature}°C) is below minimum threshold (${shipment.tempMin}°C). An explicit overrideReason of at least 5 characters is required to resolve without returning to the safe band.`
          );
        }
      }
    }

    const updated = await tx.alert.update({
      where: { id: params.alertId },
      data: {
        status: AlertStatus.RESOLVED,
        resolvedById: params.actorId,
        resolvedAt: new Date(),
        resolutionNotes: params.overrideReason
          ? `${params.resolutionNotes} [OVERRIDE: ${params.overrideReason}]`
          : params.resolutionNotes,
      },
    });

    // Check if any other active or acknowledged alerts remain on this shipment
    const remainingActive = await tx.alert.count({
      where: {
        shipmentId: alert.shipmentId,
        id: { not: alert.id },
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
        details: {
          resolutionNotes: params.resolutionNotes,
          overrideReason: params.overrideReason,
        },
      },
      tx
    );

    return updated;
  });
}
