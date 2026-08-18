# Reverse Forensic Audit Strategy

This document establishes the macro-strategy and operational rules for verifying the integrity of the UniOS application. We are discarding the forward-implementation model ("fix → build → test") in favor of a **Reverse Verification Methodology** that traces functionality backward from the final product.

## Execution Protocol

**ABSOLUTE RULE: No implementation during the forensic phase.**

If a bug or discrepancy is found, the agent must strictly follow this lifecycle:
1. **DISCOVER**: Identify the symptom.
2. **TRACE**: Follow the data lineage backward.
3. **CROSS-CHECK**: Verify against other layers (domain, DB, architecture).
4. **DOCUMENT**: Record the findings in the forensic report.
5. **CLASSIFY & PRIORITIZE**: Determine impact and severity.
6. **PROPOSE FIX**: Outline the exact changes needed in the codebase.
7. **STOP**: Halt all action.
8. **USER APPROVAL**: Wait for explicit sign-off from the Lead Engineer/Auditor.
9. **IMPLEMENT**: Apply the approved changes.
10. **VERIFY AGAIN**: Confirm the fix at the architectural, unit, and physical level.

## Verification Phases

We trace every feature backward:
`Physical UX → Feature Completeness → Data Lineage → Domain Integrity → Persistence Integrity → Foundation`

### R0 — Physical Product Reality
*What does a student actually experience?*
* The ultimate acceptance layer. We do not ask if `getEffectiveSchedule()` works; we ask "Do two classes appear on the home screen?"
* Every major workflow is tested on a physical device.

### R1 — Feature Contract
*What should every feature do?*
* Audit every feature (Course, Theory, Lab, Attendance, Tasks, etc.) for completeness.
* Check for C.R.U.D operations, persistence across restarts, and correct deletion behavior. No feature is marked complete just because the UI exists.

### R2 — Data Lineage
*Where does every piece of information originate and where does it go?*
* Map the complete lifecycle of data: `USER INPUT → State → Validation → Repository → Transaction → SQLite → Query → Domain Object → State → SCREEN`
* Identify orphaned reads, write-only fields, and disconnected architectural paths.

### R3 — Domain Integrity
*Repositories, services, hooks, business rules.*
* Verify single-responsibility repositories.
* Ensure screens do not bypass repositories.
* Identify duplicated business rules, fake implementations, or unreachable code.

### R4 — Persistence Integrity
*SQLite, schema, migrations, transactions.*
* Map the lineage of every DB field.
* Verify schema definition, historical migrations, writers, readers, foreign keys, indexes, and deletion behaviors (e.g., cascading vs orphaned).

### R5 — Architectural Foundation
*Expo/React Native/Drizzle/navigation/build architecture.*
* Evaluate module boundaries, singleton DB connections, state management, dependencies, and build configuration.

### R6 — Security
* To be evaluated only after R0–R5 functionality and integrity are definitively proven.
