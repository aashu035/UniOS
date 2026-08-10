## Context

See `proposal.md` for the motivation and capabilities. This document outlines the offline SQLite database architecture and the React Native UI implementations.

## Goals / Non-Goals

**Goals:**
- Add Drizzle schema for AI connection properties.
- Add UI for local-only pairing configuration.
- Add UI foundation for the chat experience.

**Non-Goals:**
- Actual implementation of the laptop AI server.
- Execution of AI inference or LLM processing on the mobile device itself.

## Decisions

- **Isolating Domain Models**: The AI tables will be defined in a dedicated `domains/ai/model.ts` instead of mingling them with core academic models. This keeps the AI features opt-in and cleanly separated.
- **Local SQLite Storage**: We will use the existing Drizzle ORM setup over `expo-sqlite` to store pairing settings and conversational history locally on the device.
- **Health Check Mechanism**: The pairing UI will validate the connection by attempting an HTTP GET request to `http://<ip>/v1/health`. If it fails, the connection state is marked as unreachable.

## Risks / Trade-offs

- [Risk] Local network configurations might prevent the phone from reaching the laptop. -> Mitigation: Clear error states in the UI to guide the user to check their WiFi network, USB tethering, or firewall rules.
