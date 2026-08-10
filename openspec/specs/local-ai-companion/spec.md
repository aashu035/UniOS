# local-ai-companion Specification

## Purpose
Provides an offline, private AI companion that runs exclusively on the user's paired laptop, ensuring data privacy and local-only AI interactions.
## Requirements
### Requirement: Local Pairing
The system SHALL allow users to pair their mobile application with a local laptop companion using an IP address.

#### Scenario: Successful pairing connection
- **WHEN** the user enters a valid local IP address and tests the connection
- **THEN** the system successfully connects to the laptop's health endpoint and records the pairing state

#### Scenario: Unsuccessful pairing connection
- **WHEN** the user enters an invalid IP address or the laptop companion is unreachable
- **THEN** the system displays a connection error and offers retry guidance

### Requirement: Private Chat Interface
The system SHALL provide a chat interface for the user to interact with the local AI tutor.

#### Scenario: Accessing chat without pairing
- **WHEN** the user navigates to the tutor screen without an active pairing
- **THEN** the system displays an empty state guiding the user to the pairing settings

#### Scenario: Sending a message to the paired tutor
- **WHEN** the user sends a message in the chat interface
- **THEN** the system transmits the message locally to the paired laptop and displays the response

