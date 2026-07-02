Design the frontend for a "Mini Look-Ahead Planning Module" — a web app construction site engineers use to run their weekly look-ahead planning. Build it as a working prototype with realistic mock data matching the exact data model and API below, so the design is grounded in real functionality rather than a generic dashboard template.

## Who it's for
Site engineers on a construction project, often checking this on a tablet or laptop between site walks. They are not necessarily tech-savvy — the interface needs to be immediately understandable with zero onboarding, prioritizing clarity and speed over feature density. Their goal every week: see what's coming up in the next 14 days, spot what's falling behind, update progress on what they've done, and log/clear anything blocking their team (missing drawings, materials, approvals, etc.).

## Data model
**Activity**
- `id` (e.g. "A4380"), `activityName`, `wbsCode` (optional hierarchical work-package code)
- `plannedStart`, `plannedFinish` (dates)
- `actualStart`, `actualFinish` (dates, null until work happens)
- `originalDurationDays`, `actualDurationDays`
- `status`: NOT_STARTED | IN_PROGRESS | COMPLETED
- `progressPercent` (0-100, editable by the user)
- `responsibleEngineer` (text, often blank until manually assigned)

**Constraint** (something blocking an activity)
- `id`, linked `activityId`
- `constraintType`: DRAWING | MATERIAL | LABOUR | EQUIPMENT | APPROVAL | RFI | CLIENT_DECISION
- `description` (free text)
- `status`: OPEN | CLOSED
- `targetRemovalDate`, `actualRemovalDate` (set automatically when closed)

## Business logic (already implemented in the backend — reflect it accurately, don't reinvent it)
- **Upcoming / look-ahead window**: activities whose `plannedFinish` falls within the next 14 days from today.
- **Delayed**: `plannedFinish` is in the past and `progressPercent` < 100, OR `plannedStart` is in the past and `progressPercent` = 0.
- **PPC (Percent Plan Complete)**: of the activities in the current 14-day look-ahead window, the % that are at 100% progress. This is the headline KPI — it measures whether the plan for *this week* was actually delivered, not overall project completion.
- Data enters the system only via Excel import (two-file Primavera workflow: baseline then progress updates) — there's no manual "add activity" flow, only viewing/filtering/updating what was imported.

## API available to wire up
- `GET /api/dashboard` → `{ totalActivities, upcomingActivities, delayedActivities, openConstraints, ppc }`
- `GET /api/activities` and `GET /api/activities?window=upcoming` → activity list, each row also carries computed `delayed` and `upcoming` booleans
- `PATCH /api/activities/:id` → body `{ progressPercent?, responsibleEngineer? }`
- `GET /api/constraints` → list, each includes its linked `activity`
- `POST /api/constraints` → body `{ activityId, constraintType, description, targetRemovalDate }`
- `PATCH /api/constraints/:id` → body `{ status: "OPEN" | "CLOSED" }`
- `POST /api/import/baseline` and `POST /api/import/progress` → multipart file upload

## Screens needed
1. **Dashboard** — the 4 KPIs (Total / Upcoming / Delayed / Open Constraints) plus PPC as the hero metric, at-a-glance status.
2. **Activity table** — all activities, filterable to the 14-day look-ahead window, with inline progress % editing and a way to assign/edit Responsible Engineer. Delayed activities should be visually distinct (not just a text label — this is the thing an engineer needs to spot in half a second).
3. **Constraint register** — list of constraints (open and closed), grouped or filterable by status/type, with a way to add a new constraint against an activity and close one out (setting actual removal date).
4. **Import** — a simple upload flow for the two Excel files.

## Visual style
- Glassmorphism: frosted-glass translucent panels, subtle background blur, soft layered depth — not flat/plain.
- Rounded cards throughout, generous corner radii, soft shadows for elevation.
- Premium, modern typography — a refined sans-serif pairing (e.g. a distinct display weight for numbers/headings vs a clean body face), confident use of whitespace, not cramped or "enterprise software" dense.
- Overall feel: premium SaaS product, not a spreadsheet clone. Numbers (KPIs, PPC, progress %) should feel like the visual focal points.
- Despite the premium look, prioritize instant legibility: clear status color-coding (e.g. delayed vs on-track vs complete), large touch targets, minimal clicks to update progress or close a constraint.

Figure out the rest — navigation structure, specific component choices, responsive behavior, color palette, and micro-interactions are all yours to design. Use realistic mock data (sample activity names, WBS codes, dates, constraint descriptions) that looks like it came from a real industrial construction project.
