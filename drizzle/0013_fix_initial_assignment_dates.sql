-- Fix venue assignments: Only correct the first assignment of a component if its effective_from matches the creation date
UPDATE component_venue_assignments
SET effective_from = (
    SELECT s.start_date
    FROM course_components c
    JOIN workspaces w ON c.workspace_id = w.id
    JOIN semesters s ON w.semester_id = s.id
    WHERE c.id = component_venue_assignments.component_id
)
WHERE id IN (
    SELECT MIN(id) FROM component_venue_assignments GROUP BY component_id
)
AND date(effective_from) = (
    SELECT date(created_at) FROM course_components WHERE id = component_venue_assignments.component_id
)
AND date(effective_from) > (
    SELECT s.start_date
    FROM course_components c
    JOIN workspaces w ON c.workspace_id = w.id
    JOIN semesters s ON w.semester_id = s.id
    WHERE c.id = component_venue_assignments.component_id
);

-- Fix faculty assignments: Identical logic
UPDATE component_faculty_assignments
SET effective_from = (
    SELECT s.start_date
    FROM course_components c
    JOIN workspaces w ON c.workspace_id = w.id
    JOIN semesters s ON w.semester_id = s.id
    WHERE c.id = component_faculty_assignments.component_id
)
WHERE id IN (
    SELECT MIN(id) FROM component_faculty_assignments GROUP BY component_id
)
AND date(effective_from) = (
    SELECT date(created_at) FROM course_components WHERE id = component_faculty_assignments.component_id
)
AND date(effective_from) > (
    SELECT s.start_date
    FROM course_components c
    JOIN workspaces w ON c.workspace_id = w.id
    JOIN semesters s ON w.semester_id = s.id
    WHERE c.id = component_faculty_assignments.component_id
);
