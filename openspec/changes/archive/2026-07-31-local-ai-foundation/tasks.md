## 1. Database Schema

- [x] 1.1 Create `domains/ai/model.ts` with `ai_connections`, `learning_profiles`, `material_index_permissions`, `tutor_conversations`, and `tutor_messages` tables.
- [x] 1.2 Update `core/db/schema.ts` to export the new AI domain models.
- [x] 1.3 Run `npx drizzle-kit generate` to generate migrations.

## 2. Settings UI

- [x] 2.1 Create `app/settings/pairing.tsx` for the laptop IP connection form.
- [x] 2.2 Implement a health check utility to ping `http://<ip>/v1/health`.
- [x] 2.3 Add navigation link in `app/(main)/profile.tsx` to the pairing settings.

## 3. Tutor UI

- [x] 3.1 Create `app/tutor/index.tsx` for the main chat interface.
- [x] 3.2 Implement empty state logic to redirect to pairing settings if no AI companion is paired.
