# Engineering Discipline — Hermes Rules

These rules exist because the codebase has been producing verified-architecture, unverified-behavior. The reviewer's "scolding you actually earned" landed because the same gap has been visible in the working tree for too long. The fix is not more abstraction. The fix is discipline at the commit boundary.

## Rule 1: No "done" without proof

No commit claims "done" unless one of the following is true:

1. **A real-device test exists** that exercises the claimed behavior on a physical Android or iOS device, and the test passes. The test artifact (Maestro, Detox, or equivalent) is committed alongside the change.
2. **An automated integration test exists** that exercises the claimed behavior against the real DB / file system, and the test passes. The test is committed and runnable via `npx jest <path>`.
3. **The claim is explicitly scoped** to "the unit/function works in isolation" and is **labeled as such in the commit message**, with the next layer of verification named.

### What does NOT count as proof

- "I tapped it once on my phone and it worked." Memory is not a test.
- "I ran it in Expo Go." Expo Go is not the target runtime. Native modules can fail silently in Expo Go.
- "The typecheck passes." Typecheck is a necessary floor, not proof of behavior.
- "The unit tests pass with mocks." Mocks hide native module failures — the reviewer's exact point.
- "The PDF preview looks right." Fable's preview is a visual mockup, not a real render.
- "A previous commit said this was done." Inherited claims are not evidence.
- "An agent told me it was done." Agent reports are not evidence.

## Rule 2: Unverified commits must self-identify

If a commit cannot meet one of the three conditions in Rule 1, the commit message body MUST include:

```
UNVERIFIED: <what specifically wasn't tested, and why>
NEXT: <concrete test to add in the next commit or PR>
```

This is not a stigma. It is a contract with the next person to read the commit. The alternative is silent overclaim, which is the failure mode the reviewer correctly named.

## Rule 3: One complete user journey before the next feature

Before adding a new feature, the most-recently-added feature must have a passing end-to-end test on the real target runtime. The shape:

```
Feature: <name>
Journey: <user action> → <system response> → <persisted state> → <relaunch behavior>
Test: <file path>
Device: <real or simulator; specific model/OS if relevant>
Result: <passes/known-failures>
```

The current state of this table is the source of truth for "is this app real."

## Rule 4: Threat model before security claim

No commit claims "offline-first", "private", "secure", or "encrypted" unless:

1. A `docs/THREAT_MODEL.md` entry exists for that claim, naming: asset, threat actor, attack path, defense, residual risk.
2. The defense is implemented (not "we'll add SQLCipher later").

The default threat model for this project: **a student on a personal device, with the OS screen lock enabled, the app not configured for backup extraction.** Anything outside that model is explicitly out of scope and labeled as such.

## Rule 5: Repository hygiene is not "later"

The repo root must not contain:

- Untracked Blender/3D files.
- Untracked Python scripts from prior projects.
- Untracked screenshots.
- Untracked scratch directories (unless explicitly named `archive/` with a README).

CI should reject commits that re-introduce any of these. The .gitignore must stay up to date.

## Rule 6: The auditor's discipline applies to me too

When the deep audit (or any external review) flags a finding:

1. I verify the finding against the actual code before acting on it.
2. I push back on findings whose evidence is overclaimed (e.g., "OBSERVED" used for what was actually `INFERRED`).
3. I do not soften my response to the reviewer's correct criticisms just because they were blunt.

The reviewer is not the enemy. The reviewer is the second pair of eyes the project needs. Treating their feedback as adversarial when it is engineering discipline is the same failure mode as treating my own agent reports as truth.

---

## How this changes the next commit

The next commit after this rule is written will be:

- Either a **test** for a previously unverified claim,
- Or a **fix to a test** (adding coverage that the prior tests did not have),
- Or a commit whose message includes the `UNVERIFIED:` and `NEXT:` markers from Rule 2.

I will not write a feature commit whose body does not include one of those three. If a feature commit is required, it goes in a separate commit and explicitly references this rule.
