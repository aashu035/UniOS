-- 0014_fix_attendance_nulls
-- Upgraded Astra Version with Duplicate Archiving and Sequence Protection
-- Removed BEGIN/COMMIT because Drizzle wraps this in a transaction natively.
-- Injected statement-breakpoints for Drizzle parser compatibility.


CREATE TEMP TABLE _attendance_0014_assert (
    violations INTEGER NOT NULL CHECK (violations = 0)
);
--> statement-breakpoint

CREATE TEMP TABLE _attendance_0014_sequence (
    seq INTEGER NOT NULL
);
--> statement-breakpoint

INSERT INTO _attendance_0014_sequence (seq)
SELECT MAX(
    COALESCE(
        (SELECT MAX(seq)
         FROM sqlite_sequence
         WHERE name = 'attendance'),
        0
    ),
    COALESCE((SELECT MAX(id) FROM attendance), 0)
);
--> statement-breakpoint

CREATE TEMP TABLE _attendance_0014_resolution AS
SELECT
    a.id AS attendance_id,
    MIN(r.id) AS schedule_id
FROM attendance AS a
LEFT JOIN recurring_schedules AS r
    ON r.component_id = a.component_id
   AND r.day_of_week =
       CAST(strftime('%w', a."date") AS INTEGER)
   AND (
       r.effective_start_date IS NULL
       OR a."date" >= r.effective_start_date
   )
   AND (
       r.effective_end_date IS NULL
       OR a."date" <= r.effective_end_date
   )
WHERE a.occurrence_id IS NULL
GROUP BY a.id;
--> statement-breakpoint

CREATE TEMP TABLE _attendance_0014_rows AS
SELECT
    a.id,
    a.component_id,
    CASE
        WHEN a.occurrence_id IS NOT NULL
            THEN a.occurrence_id
        WHEN r.schedule_id IS NOT NULL
            THEN 'rec_'
                 || CAST(r.schedule_id AS TEXT)
                 || '_'
                 || a."date"
        ELSE 'legacy_orphaned_' || CAST(a.id AS TEXT)
    END AS occurrence_id,
    CASE
        WHEN a.occurrence_id IS NOT NULL THEN 'resolved'
        WHEN r.schedule_id IS NOT NULL THEN 'resolved'
        ELSE 'unresolved_legacy'
    END AS identity_status,
    a."date",
    a.source,
    a.status,
    a.marked_at,
    a.notes
FROM attendance AS a
LEFT JOIN _attendance_0014_resolution AS r
    ON r.attendance_id = a.id;
--> statement-breakpoint

INSERT INTO _attendance_0014_assert (violations)
SELECT COUNT(*)
FROM _attendance_0014_rows
WHERE occurrence_id IS NULL;
--> statement-breakpoint

INSERT INTO _attendance_0014_assert (violations)
SELECT CASE
    WHEN (SELECT COUNT(*) FROM _attendance_0014_rows)
       = (SELECT COUNT(*) FROM attendance)
    THEN 0
    ELSE 1
END;
--> statement-breakpoint

CREATE TEMP TABLE _attendance_0014_winners AS
SELECT
    occurrence_id,
    MAX(id) AS keep_id
FROM _attendance_0014_rows
GROUP BY occurrence_id;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS attendance_0014_duplicate_archive AS
SELECT
    a.id,
    a.component_id,
    a.occurrence_id,
    a.identity_status,
    a."date",
    a.source,
    a.status,
    a.marked_at,
    a.notes,
    staged.occurrence_id AS migration_occurrence_id,
    winners.keep_id AS retained_attendance_id
FROM attendance AS a
JOIN _attendance_0014_rows AS staged
    ON staged.id = a.id
JOIN _attendance_0014_winners AS winners
    ON winners.occurrence_id = staged.occurrence_id
WHERE staged.id <> winners.keep_id;
--> statement-breakpoint

DELETE FROM _attendance_0014_rows
WHERE id NOT IN (
    SELECT keep_id
    FROM _attendance_0014_winners
);
--> statement-breakpoint

INSERT INTO _attendance_0014_assert (violations)
SELECT CASE
    WHEN (SELECT COUNT(*) FROM attendance)
       = (
           (SELECT COUNT(*) FROM _attendance_0014_rows)
           +
           (SELECT COUNT(*) FROM attendance_0014_duplicate_archive)
         )
    THEN 0
    ELSE 1
END;
--> statement-breakpoint

INSERT INTO _attendance_0014_assert (violations)
SELECT COUNT(*)
FROM (
    SELECT occurrence_id
    FROM _attendance_0014_rows
    GROUP BY occurrence_id
    HAVING COUNT(*) > 1
);
--> statement-breakpoint

CREATE TABLE attendance_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    component_id INTEGER NOT NULL
        REFERENCES course_components(id) ON DELETE CASCADE,
    occurrence_id TEXT NOT NULL,
    identity_status TEXT NOT NULL DEFAULT 'unresolved_legacy',
    "date" TEXT NOT NULL,
    source TEXT DEFAULT 'local',
    status TEXT NOT NULL,
    marked_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    notes TEXT
);
--> statement-breakpoint

INSERT INTO attendance_new (
    id,
    component_id,
    occurrence_id,
    identity_status,
    "date",
    source,
    status,
    marked_at,
    notes
)
SELECT
    id,
    component_id,
    occurrence_id,
    identity_status,
    "date",
    source,
    status,
    marked_at,
    notes
FROM _attendance_0014_rows;
--> statement-breakpoint

INSERT INTO _attendance_0014_assert (violations)
SELECT CASE
    WHEN (SELECT COUNT(*) FROM attendance_new)
       = (SELECT COUNT(*) FROM _attendance_0014_rows)
    THEN 0
    ELSE 1
END;
--> statement-breakpoint

DROP TABLE attendance;
--> statement-breakpoint

ALTER TABLE attendance_new RENAME TO attendance;
--> statement-breakpoint

CREATE UNIQUE INDEX occurrence_idx
    ON attendance (occurrence_id);
--> statement-breakpoint

UPDATE sqlite_sequence
SET seq = MAX(
    COALESCE(seq, 0),
    (SELECT seq FROM _attendance_0014_sequence)
)
WHERE name = 'attendance';
--> statement-breakpoint

INSERT INTO sqlite_sequence (name, seq)
SELECT 'attendance', saved.seq
FROM _attendance_0014_sequence AS saved
WHERE NOT EXISTS (
    SELECT 1
    FROM sqlite_sequence
    WHERE name = 'attendance'
);
--> statement-breakpoint

INSERT INTO _attendance_0014_assert (violations)
SELECT COUNT(*)
FROM pragma_foreign_key_check('attendance');
--> statement-breakpoint

DROP TABLE _attendance_0014_winners;
--> statement-breakpoint
DROP TABLE _attendance_0014_rows;
--> statement-breakpoint
DROP TABLE _attendance_0014_resolution;
--> statement-breakpoint
DROP TABLE _attendance_0014_sequence;
--> statement-breakpoint
DROP TABLE _attendance_0014_assert;
