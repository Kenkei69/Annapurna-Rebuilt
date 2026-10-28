import {
  PrismaClient,
  UserRole,
  OrgType,
  OrgMemberRole,
  VehicleStatus,
  DeviceStatus,
  ShipmentStatus,
  AlertSeverity,
  AlertStatus,
  FacilityType,
} from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
import { hashDeviceApiKey } from "../src/lib/fleet";
import { getDatabaseUrl } from "../src/lib/db";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: getDatabaseUrl(),
    },
  },
});

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "FATAL_SEED_GUARD: Demo fixture seeding is forbidden in production. Use scripts/provision-admin.ts for production setup."
    );
  }

  console.log("🌱 Running idempotent demo seed...");

  // Passwords
  const adminPass = await hashPassword("AdminPass123!");
  const operatorPass = await hashPassword("Operator123!");
  const driverPass = await hashPassword("Driver123!");
  const partnerPass = await hashPassword("Partner123!");

  // 1. Platform Admin
  const admin = await prisma.user.upsert({
    where: { email: "admin@annapurna.local" },
    update: {},
    create: {
      email: "admin@annapurna.local",
      name: "Platform Administrator",
      passwordHash: adminPass,
      role: UserRole.ADMIN,
    },
  });

  const adminOrg = await prisma.organization.upsert({
    where: { slug: "system-ops" },
    update: {},
    create: {
      name: "Annapurna System Operations",
      slug: "system-ops",
      type: OrgType.ADMINISTRATIVE,
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: admin.id,
        organizationId: adminOrg.id,
      },
    },
    update: {},
    create: {
      userId: admin.id,
      organizationId: adminOrg.id,
      orgRole: OrgMemberRole.OWNER,
    },
  });

  // 2. Primary Fleet Organization (TransCold Express)
  const operator = await prisma.user.upsert({
    where: { email: "operator@transcold.com" },
    update: {},
    create: {
      email: "operator@transcold.com",
      name: "Vikram Malhotra",
      passwordHash: operatorPass,
      role: UserRole.OPERATOR,
    },
  });

  const driver = await prisma.user.upsert({
    where: { email: "driver.raj@transcold.com" },
    update: {},
    create: {
      email: "driver.raj@transcold.com",
      name: "Rajesh Kumar",
      passwordHash: driverPass,
      role: UserRole.DRIVER,
    },
  });

  const fleetOrg = await prisma.organization.upsert({
    where: { slug: "transcold-express" },
    update: {},
    create: {
      name: "TransCold Express Logistics",
      slug: "transcold-express",
      type: OrgType.FLEET,
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: operator.id,
        organizationId: fleetOrg.id,
      },
    },
    update: {},
    create: {
      userId: operator.id,
      organizationId: fleetOrg.id,
      orgRole: OrgMemberRole.OWNER,
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: driver.id,
        organizationId: fleetOrg.id,
      },
    },
    update: {},
    create: {
      userId: driver.id,
      organizationId: fleetOrg.id,
      orgRole: OrgMemberRole.DRIVER,
    },
  });

  // 3. Fleet Vehicles
  const vehicle1 = await prisma.vehicle.upsert({
    where: {
      organizationId_licensePlate: {
        organizationId: fleetOrg.id,
        licensePlate: "MH-04-AB-1234",
      },
    },
    update: {},
    create: {
      organizationId: fleetOrg.id,
      licensePlate: "MH-04-AB-1234",
      makeModel: "Tata Prima 2830.K Reefer",
      reeferType: "Carrier Transicold Supra 850",
      tempCapabilityMin: -25.0,
      tempCapabilityMax: 15.0,
      status: VehicleStatus.ACTIVE,
    },
  });

  const vehicle2 = await prisma.vehicle.upsert({
    where: {
      organizationId_licensePlate: {
        organizationId: fleetOrg.id,
        licensePlate: "DL-01-XY-5678",
      },
    },
    update: {},
    create: {
      organizationId: fleetOrg.id,
      licensePlate: "DL-01-XY-5678",
      makeModel: "Ashok Leyland 1618 Reefer",
      reeferType: "Thermo King T-1000R",
      tempCapabilityMin: -20.0,
      tempCapabilityMax: 20.0,
      status: VehicleStatus.ACTIVE,
    },
  });

  // 4. Edge Devices
  const deviceKey1 = "dev_key_apn_secret_seed_key_001";
  const deviceKey2 = "dev_key_apn_secret_seed_key_002";

  const device1 = await prisma.device.upsert({
    where: { deviceIdentifier: "DEVICE-APN-001" },
    update: {},
    create: {
      organizationId: fleetOrg.id,
      deviceIdentifier: "DEVICE-APN-001",
      hardwareModel: "ANNAPURNA-EDGE-S3",
      apiKeyHash: hashDeviceApiKey(deviceKey1),
      status: DeviceStatus.ACTIVE,
      lastSeenAt: new Date(),
    },
  });

  const device2 = await prisma.device.upsert({
    where: { deviceIdentifier: "DEVICE-APN-002" },
    update: {},
    create: {
      organizationId: fleetOrg.id,
      deviceIdentifier: "DEVICE-APN-002",
      hardwareModel: "ANNAPURNA-EDGE-S3",
      apiKeyHash: hashDeviceApiKey(deviceKey2),
      status: DeviceStatus.ACTIVE,
      lastSeenAt: new Date(),
    },
  });

  // 5. Active Shipments
  const shipment1 = await prisma.shipment.upsert({
    where: { trackingNumber: "APN-202610-01" },
    update: {},
    create: {
      organizationId: fleetOrg.id,
      trackingNumber: "APN-202610-01",
      title: "Organic Butter & Artisanal Paneer",
      cargoType: "Dairy Products",
      tempMin: 2.0,
      tempMax: 5.5,
      humidityMin: 55.0,
      humidityMax: 75.0,
      originName: "Amul Dairy Plant, Anand",
      originLat: 22.5645,
      originLng: 72.9289,
      destName: "Cold Hub Distribution, Pune",
      destLat: 18.5204,
      destLng: 73.8567,
      status: ShipmentStatus.IN_TRANSIT,
      assignedVehicleId: vehicle1.id,
      assignedDeviceId: device1.id,
      assignedDriverId: driver.id,
      latestTemperature: 3.4,
      latestHumidity: 64.0,
      latestLat: 19.076,
      latestLng: 72.8777,
      latestRecordedAt: new Date(),
    },
  });

  // Ensure telemetry for Shipment 1 if not exists
  const existingReadings1 = await prisma.telemetryReading.count({
    where: { shipmentId: shipment1.id },
  });
  if (existingReadings1 === 0) {
    for (let i = 4; i >= 0; i--) {
      await prisma.telemetryReading.create({
        data: {
          shipmentId: shipment1.id,
          deviceId: device1.id,
          sequence: 100 - i,
          recordedAt: new Date(Date.now() - i * 5 * 60000),
          temperature: 3.2 + (i % 3) * 0.2,
          humidity: 63.0 + i,
          latitude: 19.076 + (4 - i) * 0.02,
          longitude: 72.8777 + (4 - i) * 0.02,
          batteryPct: 95.0,
          isSimulated: true,
        },
      });
    }
  }

  // Shipment 2: Distressed Strawberries with Sustained Thermal Breach
  const shipment2 = await prisma.shipment.upsert({
    where: { trackingNumber: "APN-202610-02" },
    update: {},
    create: {
      organizationId: fleetOrg.id,
      trackingNumber: "APN-202610-02",
      title: "Fresh Mahabaleshwar Grade-A Strawberries",
      cargoType: "Fresh Produce",
      tempMin: 1.0,
      tempMax: 4.0,
      humidityMin: 80.0,
      humidityMax: 90.0,
      originName: "Panchgani Farm Hub",
      originLat: 17.9237,
      originLng: 73.7997,
      destName: "APMC Wholesale Terminal, Navi Mumbai",
      destLat: 19.0728,
      destLng: 72.9984,
      status: ShipmentStatus.ALERTED,
      assignedVehicleId: vehicle2.id,
      assignedDeviceId: device2.id,
      latestTemperature: 8.8,
      latestHumidity: 84.0,
      latestLat: 18.754,
      latestLng: 73.407,
      latestRecordedAt: new Date(),
    },
  });

  const existingReadings2 = await prisma.telemetryReading.count({
    where: { shipmentId: shipment2.id },
  });
  if (existingReadings2 === 0) {
    const breachTemps = [3.8, 4.6, 6.1, 7.5, 8.8];
    for (let i = 4; i >= 0; i--) {
      await prisma.telemetryReading.create({
        data: {
          shipmentId: shipment2.id,
          deviceId: device2.id,
          sequence: 200 - i,
          recordedAt: new Date(Date.now() - i * 6 * 60000),
          temperature: breachTemps[4 - i],
          humidity: 84.0,
          latitude: 18.754 + (4 - i) * 0.01,
          longitude: 73.407 + (4 - i) * 0.01,
          batteryPct: 88.0,
          isSimulated: true,
        },
      });
    }
  }

  // Active Alert on Shipment 2
  const existingAlert = await prisma.alert.findFirst({
    where: { shipmentId: shipment2.id, ruleCode: "SUSTAINED_BREACH" },
  });
  if (!existingAlert) {
    await prisma.alert.create({
      data: {
        organizationId: fleetOrg.id,
        shipmentId: shipment2.id,
        ruleCode: "SUSTAINED_BREACH",
        severity: AlertSeverity.CRITICAL,
        status: AlertStatus.ACTIVE,
        summary:
          "CRITICAL SUSTAINED BREACH: Cargo temperature 8.8°C exceeds upper threshold (4.0°C) for 4 consecutive readings (+4.8°C deviation).",
        triggerReadingJson: JSON.stringify({
          temperature: 8.8,
          recordedAt: new Date(),
          limit: 4.0,
        }),
        recommendedAction:
          "Immediate reefer compressor check required. Rapid warming detected (+1.2°C / 10m). Initiate Cargo Rescue Opportunity to prevent catastrophic spoilage.",
      },
    });
  }

  // 6. Rescue Partner Organization & Profile
  const partnerUser = await prisma.user.upsert({
    where: { email: "director@sahyadricold.com" },
    update: {},
    create: {
      email: "director@sahyadricold.com",
      name: "Sanjay Deshmukh",
      passwordHash: partnerPass,
      role: UserRole.PARTNER,
    },
  });

  const partnerOrg = await prisma.organization.upsert({
    where: { slug: "sahyadri-cold" },
    update: {},
    create: {
      name: "Sahyadri Agro Cold Storage & Logistics Hub",
      slug: "sahyadri-cold",
      type: OrgType.RESCUE_PARTNER,
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: partnerUser.id,
        organizationId: partnerOrg.id,
      },
    },
    update: {},
    create: {
      userId: partnerUser.id,
      organizationId: partnerOrg.id,
      orgRole: OrgMemberRole.OWNER,
    },
  });

  await prisma.rescuePartnerProfile.upsert({
    where: { organizationId: partnerOrg.id },
    update: {},
    create: {
      organizationId: partnerOrg.id,
      facilityName: "Sahyadri Lonavala Cold Terminal",
      facilityType: FacilityType.COLD_STORAGE,
      address: "Old Mumbai-Pune Highway, Valvan, Lonavala 410401",
      latitude: 18.7557,
      longitude: 73.4091,
      capacityAvailableKg: 45000,
      tempRangeMin: -25.0,
      tempRangeMax: 10.0,
      contactEmail: "rescue@sahyadricold.com",
      contactPhone: "+91-2114-273000",
      isActive: true,
      onboardingComplete: true,
      verificationStatus: "SELF_REPORTED_VERIFIED_LOCATION",
    },
  });

  // 7. Separate Competitor Organization for Isolation Testing
  const competitorOperator = await prisma.user.upsert({
    where: { email: "operator@coastalreefer.com" },
    update: {},
    create: {
      email: "operator@coastalreefer.com",
      name: "Arjun Nair",
      passwordHash: operatorPass,
      role: UserRole.OPERATOR,
    },
  });

  const competitorOrg = await prisma.organization.upsert({
    where: { slug: "coastal-reefer" },
    update: {},
    create: {
      name: "Coastal Reefer Lines",
      slug: "coastal-reefer",
      type: OrgType.FLEET,
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: competitorOperator.id,
        organizationId: competitorOrg.id,
      },
    },
    update: {},
    create: {
      userId: competitorOperator.id,
      organizationId: competitorOrg.id,
      orgRole: OrgMemberRole.OWNER,
    },
  });

  await prisma.shipment.upsert({
    where: { trackingNumber: "COAST-2026-99" },
    update: {},
    create: {
      organizationId: competitorOrg.id,
      trackingNumber: "COAST-2026-99",
      title: "Confidential Deep Frozen Sea Bass",
      cargoType: "Seafood",
      tempMin: -20.0,
      tempMax: -16.0,
      originName: "Kochi Port",
      destName: "Goa Cold Depot",
      status: ShipmentStatus.IN_TRANSIT,
      latestTemperature: -18.2,
      latestRecordedAt: new Date(),
    },
  });

  console.log("✅ Idempotent seed completed successfully without destructive data wiping!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
