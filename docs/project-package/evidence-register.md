# UniOS evidence register

**Purpose:** Source-backed claims for the feasibility study, problem statement, requirements matrix, and product decisions. This is a working research record, not user-facing marketing copy.

## Rules for using this register

- Cite the linked source beside every factual claim in the final document.
- Treat the student's reports of broken workflows and unwanted demo data as **product-discovery evidence**, not as population statistics.
- Do not turn association or design guidance into a promise of grade improvement.
- Where evidence is international, label it as general evidence and avoid presenting it as India-specific.

## Evidence-to-decision matrix

| ID | Source and publication | Supported statement (paraphrased) | UniOS decision it informs | Appropriate document use |
| --- | --- | --- | --- | --- |
| E1 | Government of India, Ministry of Education, [AISHE 2022–23 provisional release](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2219936&lang=1&reg=1), 2026 | The release reports higher-education enrolment rising from 4.33 crore in 2021–22 to 4.46 crore in 2022–23 (provisional). | The problem matters at national scale; UniOS is designed for an individual student rather than claiming to solve a system-wide issue. | Context in Executive Summary or Problem Statement. |
| E2 | Government of India, Ministry of Education, [AISHE 2021–22 release](https://www.pib.gov.in/PressReleasePage.aspx?PRID=1999713&lang=2&reg=3), 2024 | The official release records 4.33 crore enrolments in 2021–22, 28.4 GER, and 2.07 crore female enrolments. | Require inclusive, offline-capable core planning features; avoid assumptions that every student has a constant high-bandwidth cloud connection. | National context; do not claim a direct causal link to UniOS. |
| E3 | UGC, [National Credit Framework](https://www.ugc.gov.in/pdfnews/9028476_Report-of-National-Credit-Framework.pdf), 2023 | The framework supports credit accumulation, transfer, and multiple entry/exit pathways. | Semester, course, credits, and academic-record views must be editable, explicit, and user-controlled. | Need for the proposed system / scope. |
| E4 | Prasse et al., [umbrella review of computer-assisted self-regulated learning supports](https://doi.org/10.1007/s10758-024-09772-z), *Technology, Knowledge and Learning*, 2024 | The review synthesised 31 systematic reviews/meta-analyses; it argues for support across planning, performance, and reflection, and notes that effects depend on design and learner context. | Progress logging, realistic study planning, reflection, and adaptive explanation preferences; no claim that an AI chat response alone improves learning. | Evidence-based root-cause analysis and evaluation design. |
| E5 | OECD, [PISA 2022 Results, Volume V: self-directed learning](https://www.oecd.org/en/publications/pisa-2022-results-volume-v_c2e44201-en/full-report/component-17.html), 2024 | The report discusses confidence in self-directed learning and cautions that learner self-reports carry measurement limits. | Make study progress and confidence private, editable, and descriptive—not a high-stakes score or prediction. | Evaluation and ethical design limitations. |
| E6 | UNESCO, [Guidance for Generative AI in Education and Research](https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research), 2023; page updated 2026 | UNESCO warns that rapid GenAI adoption can leave user data privacy unprotected and calls for human-centred, safe, ethical use. | No cloud API; explicit material selection; human confirmation before creating events/tasks; transparent source citations and delete/export controls. | Privacy, ethics, and operational feasibility. |
| E7 | NIST, [AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework), 2023; [Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf), 2024 | The framework describes risk management for trustworthy AI; the GenAI profile identifies data privacy, information integrity, security, and intellectual-property concerns. | Model output is advisory; show source material and uncertainty; obtain permission before indexing material; test extraction and planning features against known cases. | Risk matrix and AI-governance controls. |
| E8 | Ministry of Electronics and Information Technology, [Digital Personal Data Protection Rules, 2025](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa), 2025 | The Ministry publishes the rules and enforcement timeline for India’s data-protection framework. | Build consent, deletion, export, data minimisation, and retention controls into the local-AI design from the start. | Legal/ethical feasibility; verify current applicability before formal submission. |

## Product-discovery inputs (not general research claims)

| ID | Observed input | Consequence for the build |
| --- | --- | --- |
| D1 | The project owner reports a prototype with unclickable/crashing actions and a debug build that tried to load Metro. | Treat functional interaction, release startup, and explicit error states as non-negotiable acceptance criteria. |
| D2 | The project owner reports unwanted seeded courses, attendance, timelines, tasks, and resources that cannot all be deleted. | Fresh installs must be empty apart from immutable grading rules; every user-created academic record requires edit and delete paths. |
| D3 | The project owner needs a timetable class to occur only on selected weekdays. | Recurring classes must be a schedule group with explicit, independently selected weekdays; no default recurrence. |
| D4 | The project owner requires local-first, personalised academic help and rejects cloud APIs. | A paired laptop companion is optional; the phone remains fully useful offline; material indexing and calendar/task suggestions require explicit consent and confirmation. |

## Gaps to close before final feasibility claims

1. Collect a small, consent-based pilot with real students before asserting usability, time saved, retention, or academic outcomes.
2. Benchmark the selected local model on the actual laptop before stating response-time, concurrency, or hardware guarantees.
3. Confirm the project’s target institution, programme, cohort, and submission standards to calibrate the India-specific scope.
4. Re-check legal/technical references immediately before the final submission because implementation rules and model software change quickly.

