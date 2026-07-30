# UniOS Design Principles

This document acts as the core contract for the design and engineering of UniOS. Every new feature, screen, and component must adhere strictly to these rules.

## Core Design Rules

1. **Answer One Question:** Every screen must answer one primary question. Do not overload users with scattered information.
2. **Whitespace over Density:** Whitespace is preferred over more information. Allow the interface to breathe. It creates calm productivity.
3. **Typography Creates Hierarchy:** Rely on typography (size, weight, spacing) rather than borders and boxes to group related information.
4. **Purposeful Color:** Colors communicate state (success, warning, error) or brand, not mere decoration. Maintain a minimal palette.
5. **Component Reuse:** Always reuse existing components before creating new ones. No bespoke UI elements for a single screen.
6. **Strict Tokens:** No hardcoded spacing, colors, radius, or typography values. Everything must be sourced from the `tokens/` directory.
7. **Meaningful Motion:** Animations communicate state changes only. Do not use flashy or distracting animations.
8. **Workspace Concept:** Every academic entity (subject, internship, research project) belongs to a unified "Workspace" model.

## Engineering Rules

Before implementing any new feature, ask the following checklist:

1. Can an existing component be reused?
2. Does this belong to an existing domain?
3. Is the styling fully tokenized?
4. Is the data accessed *only* through repositories?
5. Does this screen answer a single user question?
6. Does this reduce context switching for the student?

**If any answer is "No", stop and refactor before continuing.**

## Product Vision
UniOS is not just an attendance app. It is a premium Academic Operating System designed to replace scattered tools (WhatsApp, Drive, PDF Readers, ERPs) into a unified, elegant, Apple/Notion-inspired workflow.
