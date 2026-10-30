# Annapurna Rebuilt — Local Setup & Development Guide

## Prerequisites
- Node.js `v20.x` or `v22.x` (LTS recommended)
- PostgreSQL `15+` or `16+` database
- npm `v10+`

---

## 1. Environment Configuration
Copy the environment template:
```bash
cp .env.example .env
```

Configure your `.env` variables:
```ini
# PostgreSQL Connection URL (Managed or Local)
DATABASE_URL="postgresql://postgres:password@localhost:5432/annapurna_db?sslmode=disable"

# Cryptographic Session Token Secret (Min 32 characters)
SESSION_SECRET="annapurna_development_secret_min_32_characters_long!"

# Optional: Lab Simulator Toggle
ENABLE_SIMULATOR="true"

# Optional: Google Gemini API Key for AI Incident Decision Support
# If omitted, system seamlessly falls back to the deterministic heuristic engine
GEMINI_API_KEY=""

NODE_ENV="development"
```

---

## 2. Install Dependencies
```bash
npm install
```

---

## 3. Versioned Database Migrations
Deploy committed Prisma migrations to PostgreSQL:
```bash
npm run db:migrate:deploy
```
Check migration status:
```bash
npm run db:migrate:status
```
Generate the Prisma typed client:
```bash
npm run db:generate
```

---

## 4. Database Seeding & Initialization

### 4.1 Non-Destructive Essential Initialization (Safe for any environment)
To initialize required system structures and administrator tenant without erasing records:
```bash
npm run db:init:essential
```

### 4.2 Development Demo Seeding (Development only)
In isolated development environments, seed test personas, vehicles, and initial telemetry data idempotently using upserts:
```bash
npm run db:seed
```

> **Database Safety Notice:** Destructive reset (`npm run db:reset:demo`) requires `ALLOW_DESTRUCTIVE_RESET=true` and is strictly prohibited in production environments or against remote production hosts. Normal initialization is non-destructive and preserves existing users, shipments, telemetry, and audit history.

### Seed Personas Available:
| Role | Email | Password | Organization | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Fleet Operator** | `operator@transcold.com` | `Operator123!` | TransCold Express Logistics | Primary fleet management and dispatch |
| **Reefer Driver** | `driver.raj@transcold.com` | `Driver123!` | TransCold Express Logistics | Assigned driver for active reefer route |
| **Rescue Partner** | `director@sahyadricold.com` | `Partner123!` | Sahyadri Agro Cold Storage | Cold-storage facility providing rescue capacity |
| **Platform Admin** | `admin@annapurna.local` | `AdminPass123!` | System Operations | Platform governance and cross-tenant auditing |
| **Competitor Fleet**| `operator@coastalreefer.com` | `Operator123!` | Coastal Reefer Lines | Isolated competitor org for tenant boundary tests |

### Pre-Provisioned Edge Devices:
- `DEVICE-APN-001` (Key: `dev_key_apn_secret_seed_key_001`)
- `DEVICE-APN-002` (Key: `dev_key_apn_secret_seed_key_002`)

---

## 5. Running the Application
### Development Mode:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build & Launch:
```bash
npm run build
npm run start
```

---

## 6. Running Tests
Run the complete suite of unit and integration tests:
```bash
npm test
```
