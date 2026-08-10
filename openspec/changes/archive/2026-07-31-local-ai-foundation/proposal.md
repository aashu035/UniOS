## Why

The local AI companion provides students with a private, personalized AI tutor that runs exclusively on their paired laptop. This ensures privacy, offline capability for the core app, and guarantees that study materials are never sent to a cloud server without explicit consent.

## What Changes

- Introduce database schema for tracking AI connections, learning profiles, and chat history.
- Introduce a pairing UI in the settings where users can connect their mobile app to their laptop via IP address.
- Introduce the foundational Chat UI screen where students can interact with the tutor and select explicitly permitted study materials.
- Establish the architecture where all AI inference happens locally via a `/v1/chat` endpoint on the laptop.

## Capabilities

### New Capabilities
- `local-ai-companion`: The offline, private AI companion running on the user's paired laptop, including pairing, chat UI, and material indexing permissions.

### Modified Capabilities
- (None)

## Impact

- **Database**: New tables added to `domains/ai/model.ts` (ai_connections, learning_profiles, material_index_permissions, tutor_conversations, tutor_messages).
- **UI**: New screens added to `app/settings/pairing.tsx` and `app/tutor/index.tsx`. Profile screen updated to link to pairing settings.
- **Network**: The mobile app will send requests to local network addresses (the laptop companion) instead of public cloud endpoints.
