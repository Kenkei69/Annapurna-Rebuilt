# Third-Party Dependencies & Asset Licenses

Annapurna Rebuilt utilizes standard, audited open-source dependencies from the npm registry. No third-party binary blobs, proprietary drivers, or copyrighted graphic assets from the previous project are bundled.

## Runtime Dependencies

| Package | Version | License | Purpose |
| :--- | :--- | :--- | :--- |
| `next` | `^16.4.3` | MIT | React full-stack framework & App Router |
| `react` | `^19.0.0` | MIT | UI rendering component model |
| `react-dom` | `^19.0.0` | MIT | React DOM bindings |
| `@prisma/client` | `^6.4.0` | Apache-2.0 | Type-safe persistence ORM client |
| `zod` | `^3.24.2` | MIT | Schema validation at API trust boundaries |
| `bcryptjs` | `^2.4.3` | MIT | Constant-time password hashing |
| `lucide-react` | `^1.16.0` | ISC | Accessible, lightweight operational icons |
| `clsx` | `^2.1.1` | MIT | Conditional class string utility |
| `tailwind-merge` | `^3.0.1` | MIT | Utility class precedence merger |

## Build & Tooling Dependencies

| Package | Version | License | Purpose |
| :--- | :--- | :--- | :--- |
| `prisma` | `^6.4.0` | Apache-2.0 | Schema migration and Prisma engine generator |
| `typescript` | `^5.7.0` | Apache-2.0 | Static type safety and compilation |
| `@tailwindcss/postcss` | `^4.0.0` | MIT | Modern utility styling engine |
| `postcss` | `^8.5.0` | MIT | CSS transformations |
| `tsx` | `^4.19.2` | MIT | TypeScript node execution for testing and seeding |
| `eslint` | `^9.20.0` | MIT | Code hygiene and linting rules |

## Visual Assets & Fonts
- **Icons:** Standard icons provided by `lucide-react` under the ISC license.
- **Typography:** Native system font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`) with zero external web font network requests, guaranteeing offline capability and privacy compliance.
- **Charts:** Bespoke SVG chart implementations developed directly for this project with zero third-party telemetry or canvas rendering blobs.
