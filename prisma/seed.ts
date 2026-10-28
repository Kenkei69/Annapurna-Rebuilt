import { PrismaClient, UserRole, OrgType, OrgMemberRole, VehicleStatus, DeviceStatus, ShipmentStatus, AlertSeverity, AlertStatus, FacilityType } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
import { hashDeviceApiKey } from "../src/lib/fleet";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.ANNAPURNA_DATABASE_URL || process.env.DATABASE_URL?.replace("/heliumdb", "/annapurna_db") || "postgresql://postgres:password@helium/annapurna_db?sslmode=disable",
    },
  },
});

async function main() {
  console.log("🌱 Starting Annapurna Rebuilt Seed...");

  // 1. Clean existing records in annapurna_db
  await prisma.auditEvent.deleteMany();
  await prisma.rescueMilestone.deleteMany();
  await prisma.rescueOffer.deleteMany();
  await prisma.rescueOpportunity.deleteMany();
  await prisma.rescuePartnerProfile.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.telemetryReading.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.device.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  // 2. Passwords
  const adminPass = await hashPassword("AdminPass123!");
  const operatorPass = await hashPassword("Operator123!");
  const driverPass = await hashPassword("Driver123!");
  const partnerPass = await hashPassword("Partner123!");

  // 3. Platform Admin
  const admin = await prisma.user.create({
    data: {
      email: "admin@annapurna.local",
      name: "Platform Administrator",
      passwordHash: adminPass,
      role: UserRole.ADMIN,
    },
  });

  const adminOrg = await prisma.organization.create({
    data: {
      name: "Annapurna System Operations",
      slug: "system-ops",
      type: OrgType.ADMINISTRATIVE,
      memberships: {
        create: {
          userId: admin.id,
          orgRole: OrgMemberRole.OWNER,
        },
      },
    },
  });

  // 4. Primary Fleet Organization (TransCold Express)
  const operator = await prisma.user.create({
    data: {
      email: "operator@transcold.com",
      name: "Vikram Malhotra",
      passwordHash: operatorPass,
      role: UserRole.OPERATOR,
    },
  });

  const driver = await prisma.user.create({
    data: {
      email: "driver.raj@transcold.com",
      name: "Rajesh Kumar",
      passwordHash: driverPass,
      role: UserRole.DRIVER,
    },
  });

  const fleetOrg = await prisma.organization.create({
    data: {
      name: "TransCold Express Logistics",
      slug: "transcold-express",
      type: OrgType.FLEET,
      memberships: {
        createMany: {
          data: [
            { userId: operator.id, orgRole: OrgMemberRole.OWNER },
            { userId: driver.id, orgRole: OrgMemberRole.DRIVER },
          ],
        },
      },
    },
  });

  // 5. Fleet Vehicles
  const vehicle1 = await prisma.vehicle.create({
    data: {
      organizationId: fleetOrg.id,
      licensePlate: "MH-04-AB-1234",
      makeModel: "Tata Prima 2830.K Reefer",
      reeferType: "Carrier Transicold Supra 850",
      tempCapabilityMin: -25.0,
      tempCapabilityMax: 15.0,
      status: VehicleStatus.ACTIVE,
    },
  });

  const vehicle2 = await prisma.vehicle.create({
    data: {
      organizationId: fleetOrg.id,
      licensePlate: "DL-01-XY-5678",
      makeModel: "Ashok Leyland 1618 Reefer",
      reeferType: "Thermo King T-1000R",
      tempCapabilityMin: -20.0,
      tempCapabilityMax: 20.0,
      status: VehicleStatus.ACTIVE,
    },
  });

  // 6. Edge Devices
  const deviceKey1 = "dev_key_apn_secret_seed_key_001";
  const deviceKey2 = "dev_key_apn_secret_seed_key_002";

  const device1 = await prisma.device.create({
    data: {
      organizationId: fleetOrg.id,
      deviceIdentifier: "DEVICE-APN-001",
      hardwareModel: "ANNAPURNA-EDGE-S3",
      apiKeyHash: hashDeviceApiKey(deviceKey1),
      status: DeviceStatus.ACTIVE,
      lastSeenAt: new Date(),
    },
  });

  const device2 = await prisma.device.create({
    data: {
      organizationId: fleetOrg.id,
      deviceIdentifier: "DEVICE-APN-002",
      hardwareModel: "ANNAPURNA-EDGE-S3",
      apiKeyHash: hashDeviceApiKey(deviceKey2),
      status: DeviceStatus.ACTIVE,
      lastSeenAt: new Date(),
    },
  });

  // 7. Active Shipments
  // Shipment 1: Healthy Butter & Paneer in transit
  const shipment1 = await prisma.shipment.create({
    data: {
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

  // Telemetry history for Shipment 1
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

  // Shipment 2: Distressed Strawberries with Sustained Thermal Breach
  const shipment2 = await prisma.shipment.create({
    data: {
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

  // Telemetry history showing rising breach
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

  // Active Critical Alert on Shipment 2
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

  // 8. Rescue Partner Organization & Profile
  const partnerUser = await prisma.user.create({
    data: {
      email: "director@sahyadricold.com",
      name: "Sanjay Deshmukh",
      passwordHash: partnerPass,
      role: UserRole.PARTNER,
    },
  });

  const partnerOrg = await prisma.organization.create({
    data: {
      name: "Sahyadri Agro Cold Storage & Logistics Hub",
      slug: "sahyadri-cold",
      type: OrgType.RESCUE_PARTNER,
      memberships: {
        create: {
          userId: partnerUser.id,
          orgRole: OrgMemberRole.OWNER,
        },
      },
    },
  });

  await prisma.rescuePartnerProfile.create({
    data: {
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
    },
  });

  // 9. Separate Organization for Tenant Isolation Verification
  const competitorOperator = await prisma.user.create({
    data: {
      email: "operator@coastalreefer.com",
      name: "Arjun Nair",
      passwordHash: operatorPass,
      role: UserRole.OPERATOR,
    },
  });

  const competitorOrg = await prisma.organization.create({
    data: {
      name: "Coastal Reefer Lines",
      slug: "coastal-reefer",
      type: OrgType.FLEET,
      memberships: {
        create: {
          userId: competitorOperator.id,
          orgRole: OrgMemberRole.OWNER,
        },
      },
    },
  });

  await prisma.shipment.create({
    data: {
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

  console.log("✅ Seed completed successfully!");
  console.log("----------------------------------------------------------------");
  console.log("Demo Credentials:");
  console.log("1. Admin:         admin@annapurna.local      / AdminPass123!");
  console.log("2. Operator:      operator@transcold.com     / Operator123!");
  console.log("3. Driver:        driver.raj@transcold.com   / Driver123!");
  console.log("4. Rescue Partner: director@sahyadricold.com  / Partner123!");
  console.log("5. Competitor:    operator@coastalreefer.com / Operator123!");
  console.log("Edge Device API Keys (provisioned):");
  console.log(`- DEVICE-APN-001: ${deviceKey1}`);
  console.log(`- DEVICE-APN-002: ${deviceKey2}`);
  console.log("----------------------------------------------------------------");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
