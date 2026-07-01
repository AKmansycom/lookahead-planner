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
