# Security Policy

## Supported versions

UniOS has no published release yet. Only the latest commit on `master` gets security fixes.

## Report a vulnerability

Do not describe a vulnerability in a public issue, pull request or discussion.

**Owner action needed:** the project does not have a private reporting channel yet. GitHub private vulnerability reporting is off for this repository (checked 2026-10-17). The maintainer must turn it on (Settings → Code security → Private vulnerability reporting), or add a private contact here.

Until then:

1. Open a public issue titled "Security contact request". Put no details in it.
2. The maintainer will reply with a private way to send the details.

Include in the private report:

- What an attacker can do, and what they need first (for example, a crafted backup file or a link from another app).
- Steps to reproduce, or a proof of concept that runs only against your own test data.
- The commit you tested.

## What is in scope

| Area | Why it matters | Code |
| --- | --- | --- |
| Backup restore | Students share backup files. A crafted file must not reach other files or break the database. | `core/db/backup.ts`, `core/db/backupValidation.ts` |
| Deep links | Other apps can open UniOS links. | `isWebLink`, `isAppRoute`, `core/fs/names.ts` |
| Office, PDF and media files | Shared files are untrusted. | `domains/resource/office.ts`, `core/fs/xml.ts` |
| The Gemini API key | It is the student's own key. | `core/settings/aiProviders.ts` |
| Data sent to Gemini or Sentry | Must match the README privacy table. | `core/ai/`, `app/_layout.tsx`, `core/diagnostics/` |

## Rules for testing

- Test only on your own phone, emulator or development build, with test data.
- Do not test against Google, Sentry or the DCRUST portal.
- Never send real student data, portal passwords or API keys in a report.

