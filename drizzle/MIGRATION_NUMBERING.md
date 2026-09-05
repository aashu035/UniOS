# Migration Numbering Notes

The Drizzle migration journal (`drizzle/meta/_journal.json`) and SQL filenames
contain a few cosmetic inconsistencies that predate this fix. They are **not**
runtime bugs — `drizzle/migrations.js` aliases every imported SQL to a sequential
`mNNNN` variable, so the SQLite migrator applies them in the correct order on
fresh installs and existing DBs alike.

## Known inconsistencies

1. **0009 gap**: the journal jumps from `idx:8` (`0008_academic_refactor`) to
   `idx:9` (tag `0010_abandoned_spencer_smythe`). The file `0010_abandoned_spencer_smythe.sql`
   is what the runtime imports as `m0009` (see `drizzle/migrations.js:10`).
   Renaming the file to `0009_…` would require also updating the import alias
   and the journal tag, and would change the value seen by the
   `__drizzle_migrations` table on existing installs. The current alias
   approach is the safe equivalent.

2. **Duplicate `0012_…` filenames**: two different migrations are both named
   `0012_…` (`0012_add_workspace_icon.sql` and `0012_orange_fat_cobra.sql`).
   The runtime imports them as `m0011` and `m0012` respectively
   (`drizzle/migrations.js:12-13`), so the order is preserved. The
   `0012_orange_fat_cobra.sql` migration should arguably be `0014_…` to
   match the next numeric id, but the next actual migration in the journal
   is `0013_fix_initial_assignment_dates`. Renaming `0012_orange_fat_cobra.sql`
   to `0014_…` is the cleanest fix but requires a follow-up regeneration
   by `drizzle-kit` to keep the journal in sync.

3. **Missing 0012 snapshot variants**: `drizzle/meta/` contains only one
   `0012_snapshot.json`. This snapshot corresponds to the
   `0012_orange_fat_cobra` state (it captures the `attendance.occurrence_id`
   and `identity_status` columns it adds). The intermediate state after
   `0012_add_workspace_icon` is recoverable from `0011_snapshot.json` +
   `0012_add_workspace_icon.sql`.

## Why we did not "fix" the renumbering

- Existing installs on a device have a `__drizzle_migrations` row keyed by
  the **tag in the journal** (e.g. `0010_abandoned_spencer_smythe`), not by
  the filename. Renaming the file while leaving the tag would leave
  `m0009` importing a non-existent path. Renaming the tag would mark the
  migration as unapplied and re-run it on existing installs, which could
  fail with "duplicate column" errors.
- The runtime is correct (see `drizzle/migrations.js` aliases). The audit
  flagged this as a P3 cosmetic issue and we agree — fixing it cleanly
  requires a coordinated `drizzle-kit generate` run plus a real
  migration-of-migrations plan, which is out of scope for the current
  cleanup batch.

## Follow-up (when someone is ready)

1. Run `npx drizzle-kit generate` after fixing the duplicate `0012` filename
   (rename `0012_orange_fat_cobra.sql` to `0014_orange_fat_cobra.sql` and
   manually re-order the journal entries: 0008 → 0009 → 0010 → 0011 → 0012 →
   0013 → 0014).
2. Write a one-shot migration script that detects existing installs and
   no-ops the renumbering.
3. Re-run `drizzle-kit generate` to clean up the snapshots directory.
