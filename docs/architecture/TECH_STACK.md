# Technology Stack - UniOS

This document details the actual libraries, runtimes, and dependencies utilized in UniOS.

## Core Framework
- **React Native (Expo ~56.0.0)**: Cross-platform mobile framework.
- **Expo Router (~56.2.17)**: File-based routing navigation.
- **TypeScript**: Typed JavaScript for robust and predictable codebase.

## Local Data Storage
- **SQLite**: Local relational database (via `expo-sqlite`).
- **Drizzle ORM**: Lightweight, type-safe Object Relational Mapper for managing SQLite schemas and queries.

## Styling & UI Components
- **React Native Paper**: Material Design components (`react-native-paper`).
- **Lucide Icons**: Consistent, clean iconography (`lucide-react-native`).

## State Management & Utilities
- **TanStack React Query**: Asynchronous state management and data fetching.
- **React Context / Custom Hooks**: Lightweight local state management.
- **Expo File System / Document Picker / Image Picker / Linking**: Device integration for resources and files.

## Future AI Integration (Proposed / In-Progress)
- **Local Network Fetch**: Interfacing with the paired laptop server via standard HTTP/WebSocket over LAN.
- **Local LLM Server (Laptop)**: e.g., LM Studio, Ollama, or a custom Python FastAPI server running open-weight models (Llama 3, Mistral, etc.). No cloud API or hidden data transfer will be introduced.

## Build & Run Commands
- `npx expo start`: Start the Expo development server.
- `npx expo run:android`: Build and run the native Android app locally.
- `npx expo prebuild --clean`: Regenerate native `android` and `ios` folders.
- `npm run typecheck`: Verify TypeScript compliance.
