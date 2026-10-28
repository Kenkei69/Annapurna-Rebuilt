# Licensing Decision Brief for Kenkei69

Per instructions, **no open-source license has been attached on your behalf**. As the author and maintainer of **Annapurna Rebuilt**, this decision is reserved exclusively for you.

This document reviews third-party dependency obligations and provides concrete licensing recommendations to help you make an informed choice before publishing.

---

## 1. Upstream Dependency Obligation Analysis

All runtime dependencies and development tools used in **Annapurna Rebuilt** were audited for license compatibility and copyleft obligations:

| Dependency | License | Copyleft Obligation? | Commercial Use Permitted? | Attribution Requirement |
| :--- | :--- | :--- | :--- | :--- |
| `next` | MIT | No (Permissive) | Yes | Retain copyright notice |
| `react` & `react-dom` | MIT | No (Permissive) | Yes | Retain copyright notice |
| `@prisma/client` & `prisma` | Apache-2.0 | No (Permissive) | Yes | Retain NOTICE & Apache notice |
| `zod` | MIT | No (Permissive) | Yes | Retain copyright notice |
| `bcryptjs` | MIT / BSD | No (Permissive) | Yes | Retain copyright notice |
| `lucide-react` | ISC | No (Permissive) | Yes | Retain copyright notice |
| `tailwindcss` | MIT | No (Permissive) | Yes | Retain copyright notice |
| `clsx` & `tailwind-merge` | MIT | No (Permissive) | Yes | Retain copyright notice |
| `tsx` & `typescript` | MIT / Apache-2.0 | No (Permissive) | Yes | Retain copyright notice |

### Summary of Obligations:
- **Zero Viral Copyleft:** None of the dependencies use GPL, AGPL, or SSPL. There is no legal obligation to open-source your custom business logic, database schemas, or algorithms.
- **Attribution:** Any binary or source redistribution only requires preserving standard copyright notices of third-party libraries (satisfied via standard `package.json` and dependency manifests).

---

## 2. Licensing Options for Your Selection

Depending on your strategic goals for Annapurna Rebuilt, choose one of the following four options:

### Option A: MIT License (Recommended for Public Open-Source)
- **Summary:** Highly permissive. Grants anyone the right to use, modify, distribute, and even commercialize the code, provided they keep your copyright notice (`Copyright (c) 2026 Kenkei69`).
- **Best if:** You want maximum community visibility, developer contributions, or to showcase this platform as an open portfolio piece.
- **Action:** If selected, create a `LICENSE` file containing the standard MIT text with `Copyright (c) 2026 Kenkei69`.

### Option B: Apache License 2.0 (Recommended for Enterprise Open-Source)
- **Summary:** Permissive like MIT, but includes explicit patent grants and protects against trademark misuse.
- **Best if:** You want open collaboration while explicitly protecting against patent assertion and protecting the "Annapurna" name.
- **Action:** If selected, add the standard Apache 2.0 license file and `NOTICE`.

### Option C: Business Source License 1.1 (BSL) or PolyForm Noncommercial
- **Summary:** Source code is publicly visible and free for non-commercial and testing use, but commercial deployment or SaaS hosting requires a commercial license from you.
- **Best if:** You want code transparency (for portfolio or evaluation) while reserving commercial rights to monetize Annapurna as a SaaS platform.

### Option D: All Rights Reserved (Proprietary / Private)
- **Summary:** No open-source rights are granted. You retain 100% proprietary copyright and exclusivity.
- **Best if:** You plan to commercialize Annapurna Rebuilt as a proprietary product or private enterprise logistics platform.
- **Action:** Keep the repository private or publish with `Copyright (c) 2026 Kenkei69. All rights reserved.`

---

## 3. How to Apply Your Decision

Once you have decided, you can apply your choice in one command:
- **For MIT:** Add standard `LICENSE` file.
- **For Apache 2.0:** Add Apache 2.0 `LICENSE`.
- **For Proprietary:** Keep `LICENSE` omitted or add `All rights reserved`.
