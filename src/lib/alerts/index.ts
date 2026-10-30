import { prisma } from "../db";
import {
  AlertSeverity,
  AlertStatus,
  DeviceStatus,
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

  // Lock shipment row to serialize concurrent evaluations and avoid race conditions
  await db.$queryRaw`
    SELECT "id" FROM "Shipment" WHERE "id" = ${shipmentId} FOR UPDATE
  `;

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

  // Terminal lifecycle guard: do not evaluate alerts or mutate status for completed or cancelled shipments
  const isTerminal =
    shipment.status === ShipmentStatus.DELIVERED ||
    shipment.status === ShipmentStatus.CANCELLED ||
    shipment.status === ShipmentStatus.RESCUED;
  if (isTerminal) return [];

  const createdAlerts = [];

  // 0. Sensor Heartbeat Recovery:
  // If an operational (non-simulated) reading resumes for a shipment that had a MISSING_TELEMETRY alert,
  // auto-resolve the missing heartbeat alert.
  if (!reading.isSimulated) {
    const activeMissingHeartbeats = shipment.alerts.filter(
      (a) =>
        a.ruleCode === "MISSING_TELEMETRY" &&
        (a.status === AlertStatus.ACTIVE || a.status === AlertStatus.ACKNOWLEDGED)
    );

    for (const alert of activeMissingHeartbeats) {
      await db.alert.update({
        where: { id: alert.id },
        data: {
          status: AlertStatus.RESOLVED,
          resolvedAt: new Date(),
          resolutionNotes: `Auto-resolved: Operational sensor heartbeat restored with reading sequence ${reading.sequence} recorded at ${reading.recordedAt.toISOString()}.`,
        },
      });

      await recordAuditEvent(
        {
          organizationId: shipment.organizationId,
          action: "ALERT_RESOLVED",
          entityType: "Alert",
          entityId: alert.id,
          details: {
            ruleCode: "MISSING_TELEMETRY",
            sequence: reading.sequence,
            autoResolved: true,
            recordedAt: reading.recordedAt,
          },
        },
        externalTx
      );
    }

    if (activeMissingHeartbeats.length > 0) {
      const remainingAlerts = await db.alert.count({
        where: {
          shipmentId: shipment.id,
          status: { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] },
        },
      });
      // Invariant: Other active alerts prevent inappropriate shipment-state recovery.
      // Invariant: Terminal states remain terminal.
      if (remainingAlerts === 0 && shipment.status === ShipmentStatus.ALERTED) {
        await db.shipment.updateMany({
          where: { id: shipment.id, status: ShipmentStatus.ALERTED },
          data: { status: ShipmentStatus.IN_TRANSIT },
        });
      }
    }
  }

  // Recovery Criteria with Hysteresis:
  // If temperature returns within safe operating thresholds with an explicit 0.5°C hysteresis margin,
  // active/acknowledged thermal breach alerts auto-resolve.
  const HYSTERESIS = 0.5;
  const isSafelyWithinBand =
    reading.temperature <= (shipment.tempMax - HYSTERESIS) &&
    reading.temperature >= (shipment.tempMin + HYSTERESIS);

  if (isSafelyWithinBand) {
    const activeBreaches = shipment.alerts.filter(
      (a) =>
        (a.ruleCode === "TEMP_HIGH_BREACH" ||
         a.ruleCode === "SUSTAINED_BREACH" ||
         a.ruleCode === "TEMP_LOW_BREACH") &&
        (a.status === AlertStatus.ACTIVE || a.status === AlertStatus.ACKNOWLEDGED)
    );

    for (const breach of activeBreaches) {
      await db.alert.update({
        where: { id: breach.id },
        data: {
          status: AlertStatus.RESOLVED,
          resolvedAt: new Date(),
          resolutionNotes: `Auto-resolved: Temperature stabilized safely within operating band at ${reading.temperature}°C (0.5°C hysteresis margin satisfied).`,
        },
      });

      await recordAuditEvent(
        {
          organizationId: shipment.organizationId,
          action: "ALERT_RESOLVED",
          entityType: "Alert",
          entityId: breach.id,
          details: {
            ruleCode: breach.ruleCode,
            temperature: reading.temperature,
            autoResolved: true,
            hysteresisMargin: HYSTERESIS,
          },
        },
        externalTx
      );
    }

    if (activeBreaches.length > 0) {
      const remaining = await db.alert.count({
        where: {
          shipmentId: shipment.id,
          status: { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] },
        },
      });
      if (remaining === 0 && shipment.status === ShipmentStatus.ALERTED) {
        await db.shipment.updateMany({
          where: { id: shipment.id, status: ShipmentStatus.ALERTED },
          data: { status: ShipmentStatus.IN_TRANSIT },
        });
      }
    }
  }

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

        // If prior high breach exists, supersede it with acknowledgment linking to escalation while preserving prior notes
        if (existingHighBreach) {
          const priorNotes = existingHighBreach.ackNotes
            ? `${existingHighBreach.ackNotes} | Escalated to CRITICAL SUSTAINED_BREACH (Alert ID ${alert.id})`
            : `Automatically escalated to CRITICAL SUSTAINED_BREACH (Alert ID ${alert.id}).`;

          await db.alert.update({
            where: { id: existingHighBreach.id },
            data: {
              status: AlertStatus.ACKNOWLEDGED,
              ackNotes: priorNotes,
              acknowledgedAt: existingHighBreach.acknowledgedAt || new Date(),
            },
          });
        }

        // Update shipment status to ALERTED if currently IN_TRANSIT
        await db.shipment.updateMany({
          where: { id: shipment.id, status: ShipmentStatus.IN_TRANSIT },
          data: { status: ShipmentStatus.ALERTED },
        });

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

        await db.shipment.updateMany({
          where: { id: shipment.id, status: ShipmentStatus.IN_TRANSIT },
          data: { status: ShipmentStatus.ALERTED },
        });

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

export interface EvaluateGapsOptions {
  heartbeatWindowMinutes?: number;
  neverReportedGraceMinutes?: number;
  batchSize?: number;
  workerId?: string;
}

export interface EvaluateGapsResult {
  success: boolean;
  evaluatedAt: string;
  heartbeatWindowMinutes: number;
  neverReportedGraceMinutes: number;
  batchSize: number;
  shipmentsEvaluated: number;
  alertsCreated: number;
  skipped: boolean;
  skipReason?: string;
  cursor: {
    previousLastShipmentId: string | null;
    currentLastShipmentId: string | null;
    wrapped: boolean;
  };
  alerts: Array<{
    id: string;
    shipmentId: string;
    ruleCode: string;
    severity: AlertSeverity;
    summary: string;
  }>;
}

export async function evaluateTelemetryGaps(
  options: EvaluateGapsOptions = {}
): Promise<EvaluateGapsResult> {
  const now = new Date();
  const heartbeatWindowMinutes = Math.max(0, options.heartbeatWindowMinutes ?? 30);
  const neverReportedGraceMinutes = Math.max(0, options.neverReportedGraceMinutes ?? 60);
  const batchSize = Math.min(100, Math.max(1, options.batchSize ?? 100));
  const workerId = options.workerId || `worker-${Math.random().toString(36).slice(2, 10)}`;
  const LOCK_LEASE_MS = 60 * 1000;
  const cursorId = "gap-evaluation";

  // 1. Durably initialize or fetch the scan cursor
  let cursor = await prisma.telemetryScanCursor.findUnique({
    where: { id: cursorId },
  });

  if (!cursor) {
    cursor = await prisma.telemetryScanCursor.create({
      data: {
        id: cursorId,
        lastShipmentId: null,
      },
    });
  }

  // 2. Database-backed overlap protection: verify if an active lease is held
  if (
    cursor.lockedUntil &&
    cursor.lockedUntil > now &&
    cursor.lockedBy &&
    cursor.lockedBy !== workerId
  ) {
    return {
      success: false,
      skipped: true,
      skipReason: "OVERLAPPING_SCAN_IN_PROGRESS",
      evaluatedAt: now.toISOString(),
      heartbeatWindowMinutes,
      neverReportedGraceMinutes,
      batchSize,
      shipmentsEvaluated: 0,
      alertsCreated: 0,
      cursor: {
        previousLastShipmentId: cursor.lastShipmentId,
        currentLastShipmentId: cursor.lastShipmentId,
        wrapped: false,
      },
      alerts: [],
    };
  }

  // Acquire database lease
  const leaseExpiry = new Date(now.getTime() + LOCK_LEASE_MS);
  await prisma.telemetryScanCursor.update({
    where: { id: cursorId },
    data: {
      lockedUntil: leaseExpiry,
      lockedBy: workerId,
      lastScanStartedAt: now,
    },
  });

  let wrapped = false;
  let nextLastId: string | null = cursor.lastShipmentId;
  const createdAlerts: Array<{
    id: string;
    shipmentId: string;
    ruleCode: string;
    severity: AlertSeverity;
    summary: string;
  }> = [];
  let evaluatedCount = 0;

  try {
    const previousLastId = cursor.lastShipmentId;

    // 3. Paginated candidate query bounded by batch size (max 100)
    let candidates = await prisma.shipment.findMany({
      where: {
        status: { in: [ShipmentStatus.IN_TRANSIT, ShipmentStatus.ALERTED] },
        assignedDeviceId: { not: null },
        ...(previousLastId ? { id: { gt: previousLastId } } : {}),
      },
      select: {
        id: true,
      },
      orderBy: { id: "asc" },
      take: batchSize,
    });

    // Handle cursor wraparound when reaching end of eligible records
    if (candidates.length === 0 && previousLastId) {
      candidates = await prisma.shipment.findMany({
        where: {
          status: { in: [ShipmentStatus.IN_TRANSIT, ShipmentStatus.ALERTED] },
          assignedDeviceId: { not: null },
        },
        select: {
          id: true,
        },
        orderBy: { id: "asc" },
        take: batchSize,
      });
      wrapped = true;
    }

    evaluatedCount = candidates.length;
    if (candidates.length > 0) {
      nextLastId = candidates[candidates.length - 1].id;
    }

    const cutoff = new Date(now.getTime() - heartbeatWindowMinutes * 60 * 1000);
    const graceCutoff = new Date(now.getTime() - neverReportedGraceMinutes * 60 * 1000);

    // 4. Transactional row-level evaluation with state and exclusion rechecks
    for (const candidate of candidates) {
      const alert = await prisma.$transaction(async (tx) => {
        // Enforce consistent row locking order: Shipment row locked first
        const [lockedShipment] = await tx.$queryRaw<
          Array<{
            id: string;
            organizationId: string;
            status: ShipmentStatus;
            assignedDeviceId: string | null;
            latestRecordedAt: Date | null;
            createdAt: Date;
          }>
        >`
          SELECT "id", "organizationId", "status", "assignedDeviceId", "latestRecordedAt", "createdAt"
          FROM "Shipment"
          WHERE "id" = ${candidate.id}
          FOR UPDATE
        `;

        if (!lockedShipment) return null;

        // Terminal exclusion: terminal states remain terminal and are never mutated
        if (
          lockedShipment.status !== ShipmentStatus.IN_TRANSIT &&
          lockedShipment.status !== ShipmentStatus.ALERTED
        ) {
          return null;
        }

        // Assignment check: shipment must have an actively bound device
        if (!lockedShipment.assignedDeviceId) {
          return null;
        }

        // Hardware status & simulation isolation check
        const device = await tx.device.findUnique({
          where: { id: lockedShipment.assignedDeviceId },
          select: {
            id: true,
            status: true,
            isSimulated: true,
            hardwareModel: true,
          },
        });

        if (!device) return null;

        // Inactive device exclusion: revoked, suspended, or decommissioned devices excluded
        if (device.status !== DeviceStatus.ACTIVE) {
          return null;
        }

        // Simulator isolation: simulator devices do not pollute operational gap monitoring
        const isDeviceSimulated =
          device.isSimulated || device.hardwareModel.toUpperCase().includes("SIMULATOR");
        if (isDeviceSimulated) {
          return null;
        }

        // Heartbeat timeout evaluation
        let isTimedOut = false;
        if (lockedShipment.latestRecordedAt !== null) {
          if (lockedShipment.latestRecordedAt < cutoff) {
            isTimedOut = true;
          }
        } else {
          // Never-reported device grace period
          if (lockedShipment.createdAt < graceCutoff) {
            isTimedOut = true;
          }
        }

        if (!isTimedOut) {
          return null;
        }

        // Overlap protection / Idempotency check: no duplicate active MISSING_TELEMETRY alerts
        const existingAlert = await tx.alert.findFirst({
          where: {
            shipmentId: lockedShipment.id,
            ruleCode: "MISSING_TELEMETRY",
            status: { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] },
          },
        });

        if (existingAlert) {
          return null;
        }

        // Atomically create alert and audit record
        const newAlert = await tx.alert.create({
          data: {
            organizationId: lockedShipment.organizationId,
            shipmentId: lockedShipment.id,
            ruleCode: "MISSING_TELEMETRY",
            severity: AlertSeverity.HIGH,
            status: AlertStatus.ACTIVE,
            summary: `Missing Telemetry: No sensor heartbeat received for over ${heartbeatWindowMinutes} minutes. Reefer monitoring stream offline.`,
            triggerReadingJson: JSON.stringify({
              lastSeenAt: lockedShipment.latestRecordedAt?.toISOString() ?? null,
              heartbeatWindowMinutes,
              neverReportedGraceMinutes,
              evaluatedAt: now.toISOString(),
            }),
            recommendedAction:
              "Contact vehicle driver immediately to verify edge hardware power and cellular connectivity.",
          },
        });

        if (lockedShipment.status === ShipmentStatus.IN_TRANSIT) {
          await tx.shipment.update({
            where: { id: lockedShipment.id },
            data: { status: ShipmentStatus.ALERTED },
          });
        }

        await recordAuditEvent(
          {
            organizationId: lockedShipment.organizationId,
            action: "ALERT_GENERATED",
            entityType: "Alert",
            entityId: newAlert.id,
            details: {
              ruleCode: "MISSING_TELEMETRY",
              heartbeatWindowMinutes,
              lastSeenAt: lockedShipment.latestRecordedAt,
              autoGenerated: true,
            },
          },
          tx
        );

        return newAlert;
      });

      if (alert) {
        createdAlerts.push({
          id: alert.id,
          shipmentId: alert.shipmentId,
          ruleCode: alert.ruleCode,
          severity: alert.severity,
          summary: alert.summary,
        });
      }
    }

    return {
      success: true,
      evaluatedAt: now.toISOString(),
      heartbeatWindowMinutes,
      neverReportedGraceMinutes,
      batchSize,
      shipmentsEvaluated: evaluatedCount,
      alertsCreated: createdAlerts.length,
      skipped: false,
      cursor: {
        previousLastShipmentId: previousLastId,
        currentLastShipmentId: nextLastId,
        wrapped,
      },
      alerts: createdAlerts,
    };
  } finally {
    // 5. Always release scan lease and persist cursor progress
    await prisma.telemetryScanCursor.update({
      where: { id: cursorId },
      data: {
        lastShipmentId: nextLastId,
        lockedUntil: null,
        lockedBy: null,
        lastScanCompletedAt: new Date(),
      },
    });
  }
}

export async function detectMissingTelemetry(heartbeatWindowMinutes: number = 30) {
  const result = await evaluateTelemetryGaps({ heartbeatWindowMinutes });
  return result.alerts;
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
      await tx.shipment.updateMany({
        where: { id: alert.shipmentId, status: ShipmentStatus.ALERTED },
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
