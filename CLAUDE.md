# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## Project Context

**Project:** Mini Look-Ahead Planning Module for construction site engineers (take-home assignment, 3-day scope).

**Problem statement:** Construction projects are planned in Primavera/MS Project. Site engineers need a weekly look-ahead view. Build a web app where users can import activities from Excel, view them in a table, filter to the upcoming 14 days, update progress %, add/track constraints, and view PPC (Percent Plan Complete).

**Functional scope:**
- Activity Master: Activity ID, Activity Name, Start Date, Finish Date, Duration, Progress %, Responsible Engineer.
- Constraint Register: linked to an Activity, Constraint Type (Drawing/Material/Labour/Equipment/Approval/RFI/Client Decision), Description, Status (Open/Closed), Target Removal Date.
- Look-Ahead Dashboard: Total Activities, Upcoming Activities, Delayed Activities, Open Constraints.
- PPC = Completed Activities / Planned Activities × 100, shown as a KPI.

**Technical constraints (assignment-mandated):**
- Frontend: React or Next.js
- Backend: Node.js/Express or Next.js API routes
- Database: PostgreSQL (or Supabase)
- Deployment: Vercel or Render

**Confirmed stack decisions:**
- Single Next.js app (App Router) — API routes serve as the backend, one deployable unit.
- Supabase for hosted Postgres.
- Deployment target: Vercel (pairs naturally with Next.js).
- Frontend UI is designed/iterated in a separate Claude "Artifacts" design surface first; implementation here follows the approved design — don't build frontend screens ahead of that.

**Deliverables:** GitHub repo, architecture diagram, DB schema/ER diagram, setup guide, documented business assumptions.

**Working style:** Building iteratively — business logic and data model first, then backend, then frontend.

**Status:** Backend + frontend are both built, integrated, and verified end-to-end against live Supabase data. The Claude Design mockup (`docs/frontend-design-prompt.md` → `LookAhead.dc.html`) was translated into real React components wired to the live API. All four screens (Dashboard, Activities, Constraints, Import) + the add-constraint modal + toast render correctly with real data and working mutations (verified via headless-browser screenshots). Next: documentation deliverables (architecture diagram, ER diagram, setup guide, assumptions) and deployment to Vercel.

**Frontend architecture:** Single client component `src/components/LookAheadApp.tsx` (rendered by `src/app/page.tsx`) holds all state, fetches from the API on mount, and renders the four state-switched screens (no routing — nav toggles `screen` state). Supporting libs: `src/lib/api.ts` (fetch wrappers), `src/lib/types.ts` (shared types + constants + status helpers), `src/lib/format.ts` (date/label helpers), `src/lib/derive.ts` (client-side mirror of the look-ahead rules for instant badge updates), `src/lib/style.ts` (`css()` parses the design's inline-CSS strings into React style objects), `src/components/HoverCard.tsx` (the design's `style` + `style-hover` pattern). Fonts (Manrope, Space Grotesk) loaded via `@import` in `globals.css`; the design's global CSS (range inputs, scrollbars, keyframes) also lives there. Progress slider + engineer field commit is debounced/on-blur; other edits PATCH immediately.

**Design-vs-backend reconciliation (added during integration):**
- `varianceReason` column added to Activity (nullable) — powers the design's "Why is it late?" dropdown on delayed rows (a Last Planner System variance-reason concept). Document as an assumption; not in the original assignment field list.
- `PATCH /api/activities/:id` extended to also accept `actualStart`, `actualFinish`, `varianceReason`, and to keep `status` in sync with `progressPercent` (>=100 COMPLETED, >0 IN_PROGRESS, else NOT_STARTED) so manual progress edits update the status badge.
- Constraint IDs are integers server-side; the UI displays them as `C-00N`.
- Blocked/Ready activity badges are derived client-side by joining open constraints to activities (no backend change).

**Bugs found and fixed during local testing:**
- The design's `style` (base) + `style-hover` pattern used a shorthand `border` in base and longhand `border-color` in hover. React 19 warns when shorthand and longhand for the same CSS property are mixed across renders of an inline `style` object (and it renders as a full-screen blocking error overlay in Next.js dev mode — this made the UI *look* unresponsive, including blocking file-upload clicks). Fixed centrally in `src/lib/style.ts`'s `css()`: border shorthands (`border`, `border-top/right/bottom/left`) are now always expanded into `*Width`/`*Style`/`*Color` longhands, so no shorthand/longhand collision can occur anywhere in the app.
- Import (`src/lib/import.ts`) was upserting 861 rows one at a time, fully sequentially awaited — over 2 minutes per file against the Supabase pooler, with zero loading indicator in the UI, making it look broken/frozen. Fixed by running upserts with bounded concurrency (10, matching the pg pool's default max connections) via a small `mapWithConcurrency` helper — cut it to ~14s. Also added an explicit spinner + toast while an import is in flight so it's never ambiguous whether something is happening.
- **Production (Vercel):** the concurrency fix above caused `(EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15` once deployed. Supabase's session pooler caps this project at 15 total connections *shared across every concurrent serverless instance plus local dev* — each instance was defaulting to node-postgres's own max of 10, so just two concurrent requests could exhaust it. Fixed in `src/lib/prisma.ts` by capping the pool to `max: 3` with `idleTimeoutMillis: 10_000`.
- **Import is now batched raw SQL, not per-row upserts** (`src/lib/import.ts`): the real fix for import speed was reducing round-trips, not raising concurrency (which trades directly against the connection-count problem above). Rows are chunked into batches of 200 and each batch is one multi-row `INSERT ... ON CONFLICT DO UPDATE` via `prisma.$executeRaw` + `Prisma.sql`/`Prisma.join`, run 3-at-a-time (matching the pool's `max`). Cut 861-row imports from ~43s to ~1s. Considered switching to Supabase's transaction-mode pooler instead (to allow higher concurrency) but skipped it — Prisma's driver-adapter client's prepared-statement/transaction-pooler compatibility isn't something we could verify confidently from docs alone, and batching solved the problem without that risk. `export const maxDuration = 60` is still set on both import routes as a safety margin but is no longer load-bearing at this row count.
  - One deliberate behavior simplification vs. the old per-row code: a progress row with no recognized status now defaults to `NOT_STARTED` on both create *and* update (old code left status/progress untouched on update if status was unparseable). Real Primavera exports always carry a valid status, so this never triggers in practice — documented here in case it ever does.
  - **Known limitation, not yet hit by real data:** the batched multi-row `INSERT ... ON CONFLICT` will error if the *same* Activity ID appears twice within one 200-row batch (Postgres rejects updating the same conflict target twice in one statement). Real P6 exports don't have duplicate IDs, so this is a theoretical risk, not an active bug — worth knowing before ever relaxing that assumption.

**Synthetic edge-case test files:** `sample-data/edge-case-baseline.xlsx` + `edge-case-progress.xlsx` (generated by `scripts/gen-test-data.js`, re-runnable) — 29 hand-designed rows covering every business rule combination (delayed via past-finish-incomplete, delayed via past-start-unstarted, upcoming, PPC numerator/denominator, both milestone shapes) plus Excel-parsing edge cases: alternating true-Excel-date cells vs. raw serial numbers, missing WBS code, missing name / missing duration (should be skipped), unrecognized/wrong-case status text (falls back to Not Started — this is real, verified behavior, not a hypothetical), an activity that only exists because Progress Update created it standalone (baseline's version was malformed and skipped), very long names, and special characters (em dash, ampersand, parentheses, slash). Dates are anchored around 2026-07-03 with a several-day buffer, so the upcoming/delayed classifications stay meaningful for about 1-2 weeks before drifting — regenerate via the script (edit the `ROWS` array's dates) if testing much later. Fully verified end-to-end against the real API: 27 baseline / 28 progress (one extra from the standalone-create case), 8 upcoming, 6 delayed, PPC 13% — all match the design intent exactly.
- Also hit, in order, while getting Vercel working: (1) missing `DATABASE_URL` → `Can't reach database server at 127.0.0.1:5432` (P1001) — env var wasn't set before first deploy; (2) wrong connection-string variant → `Authentication failed... for 'postgres'` (P1000) — pasted Supabase's "direct connection" string (bare `postgres` username) instead of the session-pooler one (`postgres.<project-ref>` username) we use everywhere else. Both are worth checking first if a fresh deployment shows DB errors.
- The Activities screen defaulted to the "All" filter, rendering all 861 rows (thousands of DOM nodes — sliders, date pickers, badges per row) on every visit, causing a visible lag switching into that screen. Defaulted to the "upcoming" (14-day window) filter instead — matches what a site engineer actually needs first anyway, and cut navigation to ~200ms (from ~1.8s for the full 861-row render, confirmed via timing). "All" is still available but is inherently slower at this data volume; pagination/virtualization would be the next step if that needs to be fast too, not implemented since it's not the default path.
- Constraints are never bulk-imported from Excel (only Activities are) — this is by design, matching the assignment's "Constraint ID: Auto" (app-generated, not spreadsheet-sourced). Worth remembering this isn't a bug if the constraint register looks empty after import.

**Infra:** Supabase project "lookahead-planner" (region ap-northeast-1/Tokyo), org "arjun.khanna@mansycom.com's Org", project ref `fsyieeocenwsmiptllfj`. Connecting via the session-mode pooler host (`aws-0-ap-northeast-1.pooler.supabase.com:5432`), not the transaction-mode pooler (6543) — the transaction pooler isn't safe for Prisma's new driver-adapter client (`@prisma/adapter-pg`), which uses prepared statements. `DATABASE_URL` lives in the git-ignored `.env`.

**Business rules (confirmed with user):**
- Single project, no auth — one shared dataset, no login. Multi-project/auth noted as future-scope in docs, not built.
- Data only enters the system via Excel import; there is no separate manual "planning" input — the look-ahead window and PPC are always derived from whatever activities currently exist in the imported dataset.
- Delayed activity = Finish Date < today AND Progress % < 100, OR Start Date < today AND Progress % = 0 (either condition triggers "delayed").
- Upcoming (look-ahead) activities = activities whose Finish Date falls within the next 14 days from today.
- PPC = (activities in the current 14-day look-ahead window with Progress % = 100) / (total activities in that window) × 100. Recalculates as the window rolls forward — it is NOT a whole-project completion ratio.
- Constraint removal: Status (Open/Closed) plus an Actual Removal Date, set when Status flips to Closed. Lets planned vs. actual removal timing be compared.

**Excel import format (confirmed from real sample files `BSL-Baseline.xlsx` / `BSL-Progress-Update.xlsx`, both Primavera P6 exports, 861 activities):**
- Row 1 = internal Primavera field codes, Row 2 = human-readable headers, data from row 3. Columns: `task_code`/Activity ID, `status_code`/Activity Status (Not Started | In Progress | Completed), `wbs_id`/WBS Code, `task_name`/Activity Name, `target_start_date`/(*)Planned Start, `target_end_date`/(*)Planned Finish, `act_start_date`/Actual Start, `act_end_date`/Actual Finish, `target_drtn_hr_cnt`/Original Duration(d), `act_drtn_hr_cnt`/(*)Actual Duration(d), `delete_record_flag`/Delete This Row. Dates are Excel serial numbers (base 1899-12-30).
- Two-file workflow: a **Baseline** file (defines the plan: ID, Name, WBS, Planned Start/Finish, Duration) is imported first; a **Progress Update** file (same Activity IDs, adds Status + Actual Start/Finish) is imported periodically after. Both files share identical Activity ID sets in the sample data.
- Import behavior is **upsert by Activity ID**: re-importing a Progress Update matches existing activities by ID and updates Status/Actual dates/Progress %, without clobbering fields like Responsible Engineer that were set manually in the app.
- Progress % is not present in the source data — derived from Status on import: Not Started → 0%, Completed → 100%, In Progress → 50% placeholder (correctable via the app's manual "Update progress %" feature).
- Responsible Engineer does not exist in the source data at all — left blank on import, assigned manually in the app afterward. Document as a business assumption.
- WBS Code is real source data not in the assignment's literal field list — kept as an extra optional column on Activity, useful for grouping/filtering.
- Milestones (0-duration activities with only a Planned Start OR only a Planned Finish, e.g. "Signing of Contract", "Commissioning" — 2 of 861 rows in the samples) have the single available date copied into both Start and Finish on import, rather than being dropped, so they still appear in the look-ahead window and dashboard.
