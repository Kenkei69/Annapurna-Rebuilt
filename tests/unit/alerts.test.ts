import test from "node:test";
import assert from "node:assert/strict";
import { canTransitionShipment } from "../../src/lib/shipments";
import { generateDeterministicIncidentAnalysis } from "../../src/lib/ai";
import { ShipmentStatus } from "@prisma/client";

test("Shipment State Machine - Enforces valid transitions", () => {
  // DRAFT can move to DISPATCHED or CANCELLED
  assert.equal(canTransitionShipment(ShipmentStatus.DRAFT, ShipmentStatus.DISPATCHED), true);
  assert.equal(canTransitionShipment(ShipmentStatus.DRAFT, ShipmentStatus.CANCELLED), true);
  // DRAFT cannot jump directly to DELIVERED
  assert.equal(canTransitionShipment(ShipmentStatus.DRAFT, ShipmentStatus.DELIVERED), false);

  // IN_TRANSIT can move to ALERTED, RESCUE_PENDING, DELIVERED
  assert.equal(canTransitionShipment(ShipmentStatus.IN_TRANSIT, ShipmentStatus.ALERTED), true);
  assert.equal(canTransitionShipment(ShipmentStatus.IN_TRANSIT, ShipmentStatus.DELIVERED), true);

  // DELIVERED is terminal
  assert.equal(canTransitionShipment(ShipmentStatus.DELIVERED, ShipmentStatus.IN_TRANSIT), false);
  assert.equal(canTransitionShipment(ShipmentStatus.DELIVERED, ShipmentStatus.DRAFT), false);
});

test("AI Heuristic Engine - Correctly computes warming gradient and action plan", () => {
  const now = Date.now();
  const context = {
    shipmentTitle: "Fresh Dairy",
    cargoType: "Butter",
    tempMin: 2.0,
    tempMax: 5.0,
    currentTemp: 9.0, // 4.0°C deviation
    readings: [
      { temperature: 9.0, recordedAt: new Date(now) },
      { temperature: 7.0, recordedAt: new Date(now - 10 * 60000) }, // +2°C in 10 minutes
    ],
    activeAlerts: [
      { ruleCode: "SUSTAINED_BREACH", summary: "High temp", severity: "CRITICAL" },
    ],
  };

  const analysis = generateDeterministicIncidentAnalysis(context);

  assert.equal(analysis.source, "DETERMINISTIC_EXPERT_SYSTEM");
  assert.equal(analysis.riskLevel, "HIGH"); // deviation is 4.0 (> 1.5)
  assert.ok(analysis.warmingVelocityPer10Min !== null && analysis.warmingVelocityPer10Min > 0);
  assert.ok(analysis.suggestedActions.length > 0);
  assert.ok(analysis.draftDriverUpdate.includes("OPERATOR NOTICE"));
  assert.ok(analysis.uncertaintyNotes.includes("Human operator review required"));
});
