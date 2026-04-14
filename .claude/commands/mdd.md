---
description: "MDD workflow — Document → Audit → Fix → Verify. Build features or audit existing code using Manual-First Development."
scope: project
argument-hint: "<feature-description> or audit [section]"
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, AskUserQuestion, Agent
---

# MDD — Manual-First Development Workflow

**$ARGUMENTS**

MDD is the core development workflow. Every feature starts with documentation, every fix starts with an audit. No exceptions.

## Step 0 — Worktree Check (before everything else)

Before any other work, offer worktree isolation for parallel `/mdd` sessions:

1. Check current branch: `git branch --show-current`
2. Ask the user via AskUserQuestion:
   - **Question:** "Do you want to work in an isolated worktree? This lets you run multiple `/mdd` sessions in parallel."
   - **Options:**
     - **"No, continue here" (Recommended)** — proceed in current directory with auto-branch as usual
     - **"Yes, create a worktree"** — create an isolated worktree, then the user re-runs `/mdd` there
3. If the user selects **"Yes, create a worktree"**:
   - Derive a slug from `$ARGUMENTS` (e.g., `add-auth` from "add auth system"). If no arguments, ask for a name.
   - Run: `/worktree mdd-<feature-slug>` (this creates a sibling directory with its own branch)
   - Tell the user: "Worktree created. Open a new Claude Code session in the worktree directory and run `/mdd $ARGUMENTS` there."
   - **STOP here** — do not continue in the current session (the working directory hasn't changed)
4. If the user selects **"No, continue here"** — proceed to Step 0b below.

## Step 0b — Detect Mode

Parse `$ARGUMENTS` to determine the mode:

- If arguments start with `audit` → **Audit Mode** (jump to Phase A)
- If arguments start with `status` → **Status Mode** (jump to Phase S)
- If arguments start with `note` → **Note Mode** (jump to Phase N)
- If arguments start with `scan` → **Scan Mode** (jump to Phase SC)
- If arguments start with `update` → **Update Mode** (jump to Phase U)
- If arguments start with `deprecate` → **Deprecate Mode** (jump to Phase D)
- If arguments start with `reverse-engineer` or `reverse` → **Reverse-Engineer Mode** (jump to Phase R)
- If arguments start with `graph` → **Graph Mode** (jump to Phase G)
- If arguments are empty → ask the user what they want to do
- Otherwise → **Build Mode** (the default — jump to Phase 1)

---

## BUILD MODE — New Feature Development

### Phase 1 — Understand the Feature

Read the user's description: **$ARGUMENTS**

Before writing anything, gather context using **3 parallel Explore agents**. Launch all three simultaneously — do not wait for one before starting the others:

**Agent A (Rules):** Read `CLAUDE.md` and `project-docs/ARCHITECTURE.md`. Return: key coding rules, quality gates, port assignments, architecture summary, any project-specific conventions relevant to this feature.

**Agent B (Features):** Glob `.mdd/docs/*.md` and read each. Return: list of existing feature IDs + titles + status + `depends_on` chains. Flag any features that might relate to `$ARGUMENTS`.

**Agent C (Codebase):** Glob `src/**/*` and list files. Return: directory structure, key files per subdirectory, detected tech stack (framework, DB, test runner).

**Agent prompt requirements (each must be self-contained):** Include the feature description (`$ARGUMENTS`), the project working directory, and an explicit instruction to return a concise summary — not raw file contents. This prevents context explosion.

**After all 3 return:** synthesize into a working context in the main conversation. If any agent fails, silently fall back to direct `Read`/`Glob` for that agent's data — never surface agent failures to the user unless all 3 fail.

**Detect task type before asking questions.** If `src/` has fewer than 3 TypeScript/source files AND the feature description contains words like `workflow`, `command`, `config`, `docs`, `tooling`, `hook`, `script`, or `prompt` — mark as a **tooling task** and skip the database and API questions entirely.

Then ask the user targeted questions using AskUserQuestion. Ask ALL relevant questions upfront in a single interaction — don't spread them across multiple turns:

**Always ask:**
- "Does this feature depend on any existing features?" (list the ones from `.mdd/docs/`)
- "Are there any edge cases or error scenarios you already know about?"

**Ask only for non-tooling tasks:**
- "Does this feature need database storage? If so, what data does it store?"
- "Does this feature have API endpoints? What operations (create, read, update, delete)?"

**Ask if relevant:**
- "Does this need authentication/authorization?"
- "Does this need real-time updates (WebSocket)?"
- "Does this need background processing (queues, cron)?"
- "Does this integrate with any external services?"

Wait for all answers before proceeding.

### Phase 2 — Data Flow & Impact Analysis

**Skip condition:** If `.mdd/docs/` has no existing files AND `src/` has fewer than 5 source files, skip this phase entirely and note: "Greenfield detected — skipping data flow analysis." Then jump to Phase 3.

Otherwise, use the answers from Phase 1 (depends_on, endpoints, models) to identify which existing files to read. Do NOT scan blindly — read only what the feature will touch or extend.

#### Step 2a — Identify Touched Files

From Phase 1 answers:
- Which existing features does this depend on? → Read their `source_files` from `.mdd/docs/`
- Which endpoints or models does this extend? → Grep `src/` for those names
- Which TypeScript types does this use? → Read `src/types/`

Read each identified file. The goal is to **understand data flows**, not audit code quality.

#### Step 2b — Trace Each Data Value

For every piece of data the new feature will **consume, transform, or display**, document the full chain:

1. **Backend origin** — where is this value computed? What formula or logic? Note the file and line number.
2. **API transport** — what is the exact shape in the API response? Is it typed correctly?
3. **Frontend consumption** — how does the UI receive and use this value? Is there any transformation between the API response and what is displayed?
4. **Parallel computations** — is this same concept computed anywhere else in the codebase? Does it use the same logic?

Write findings to `.mdd/audits/flow-<feature-slug>-<date>.md` as you go. Do not accumulate in memory.

#### Step 2c — Impact Analysis

For each endpoint or function the feature will **modify**, grep for all existing usages:

```bash
grep -r "<endpoint-or-function-name>" src/ --include="*.ts" --include="*.tsx" -l
```

List every file that also consumes what this feature changes. These files may break silently after the change.

#### Step 2d — Gate

Present findings to the user before writing any documentation:

```
🔍 Data Flow Analysis — <feature-name>

Values this feature touches:
  <field-name>
    Computed:  <file>:<line> — <brief description of logic>
    Transport: <HTTP method> <route> → <TypeScript type>.<field>
    Consumed:  <component/file> (<transformation if any>)

Consistency issues:
  ✅ None found
  — OR —
  ⚠️  HIGH: <description of divergence between parallel computations>

Impact:
  Endpoints/functions modified: <list>
  Also consumed by: <list of other files/views>

Data flow doc: .mdd/audits/flow-<feature-slug>-<date>.md
```

Ask the user: **"Proceed with documentation? (yes / adjust scope based on findings / stop)"**

**This gate is mandatory.** Do not proceed to Phase 3 until the user confirms. If consistency issues were found, discuss whether to fix them as part of this feature or track them as pre-existing known issues first.

### Phase 3 — Write the MDD Documentation

Create the feature documentation file at `.mdd/docs/<NN>-<feature-name>.md`.

**Auto-number:** Read `.mdd/docs/` directory, find the highest existing number, increment by 1.

The doc MUST follow this exact structure:

```markdown
---
id: <NN>-<feature-name>
title: <Feature Title>
edition: <project name or "Both">
depends_on: [<list of documentation IDs this feature depends on>]
source_files:
  - <files that will be created>
routes:
  - <API routes if applicable>
models:
  - <database collections if applicable>
test_files:
  - <test files that will be created>
data_flow: <path to .mdd/audits/flow-*.md, or "greenfield" if skipped>
last_synced: <YYYY-MM-DD>
status: draft
phase: <last completed phase name, or "all" when fully built>
known_issues: []
---

# <NN> — <Feature Title>

## Purpose

<2-3 sentences explaining what this feature does and why it exists>

## Architecture

<How this feature fits into the system. Include a simple diagram if helpful.>

## Data Model

<Collection/table schema if applicable. Field names, types, constraints, indexes.>

## API Endpoints

<For each endpoint: method, path, auth required, request body, response shape, error cases.>

## Business Rules

<Validation rules, state machines, invariants, edge cases.>

## Data Flow

<For each value this feature consumes or displays: backend computation → API transport → frontend consumption → any UI transformation. "Greenfield" if no existing code was analyzed.>

## Dependencies

<What this feature requires from other features. List by documentation ID.>

## Known Issues

<Empty for new features. Will be populated by future audits.>
```

**CRITICAL:** This documentation is the source of truth. Everything that follows is generated FROM this doc. Take time to make it complete and accurate.

**Always set `last_synced` to today's date** when writing or updating a feature doc. This is what SCAN MODE uses to detect drift. Set `status: draft` for new docs; update to `in_progress` when implementation begins, `complete` when Phase 7 is done.

**After writing the feature doc**, trigger the `.mdd/.startup.md` rebuild (same logic as in Status Mode — rebuild auto-generated zone, preserve Notes zone) so the Features list stays current.

Show the completed doc to the user and ask: **"Does this accurately describe what you want to build? Anything to add or change?"**

Wait for confirmation before proceeding.

### Phase 4 — Generate Test Skeletons

Read the documentation file created in Phase 3. From the endpoints, business rules, and edge cases documented, generate test skeletons.

**Skeleton template (unit):**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('<Feature Name>', () => {
  // For each endpoint documented:
  describe('<operation>', () => {
    it('should <expected behavior from docs>', async () => {
      // Arrange
      // Act
      // Assert — minimum 3 assertions based on documented response shape
      expect.fail('Not implemented — MDD skeleton');
    });

    it('should return <error> when <edge case from docs>', async () => {
      expect.fail('Not implemented — MDD skeleton');
    });
  });
});
```

**Rules for skeleton generation:**
- One `describe` block per endpoint or business rule
- One `it` block per documented behavior (happy path + each error case)
- Every `it` block has `expect.fail('Not implemented — MDD skeleton')` as placeholder
- NO implementation yet — just the structure from the docs
- Include the exact response shapes and status codes from the documentation

**Parallelization rule:**
- If BOTH unit AND E2E tests are needed → launch 2 parallel `general-purpose` agents. Each receives: the full MDD doc content, the skeleton template above, project testing conventions, and the exact output file path. Agent A writes `tests/unit/<feature-name>.test.ts`, Agent B writes `tests/e2e/<feature-name>.spec.ts`. These are different files — no write conflict is possible.
- If only unit tests needed → generate directly in the main conversation (no agent overhead for a single file).

**E2E skeleton template (if applicable):**
```typescript
import { test, expect } from '@playwright/test';

test.describe('<Feature Name>', () => {
  test('should <expected user flow from docs>', async ({ page }) => {
    // Navigate
    // Interact
    // Assert
    test.fail(); // Not implemented — MDD skeleton
  });
});
```

Tell the user:
```
📋 Test skeletons created:
   - tests/unit/<feature-name>.test.ts (<N> test cases)
   - tests/e2e/<feature-name>.spec.ts (<N> test cases) [if applicable]

These tests will FAIL until implementation is complete.
That's the point — they're the finish line.
```

---

### Phase 4b — Red Gate (mandatory)

**No skip condition.** This phase runs after every skeleton generation, every time.

Run ONLY the new test file(s) — not the full suite:

```bash
pnpm test:unit -- <path/to/new-test-file>
```

If E2E skeletons were generated, also run:
```bash
pnpm test:e2e:chromium -- <path/to/new-e2e-file>
```

**For each test result:**

- **FAIL (expected):** ✓ — skeleton confirmed red
- **PASS (unexpected):** investigate immediately before proceeding
  - No real assertion (empty `it` body, or `expect.fail` was removed)? Fix the skeleton to add proper assertion — do NOT adjust the test to pass, write the assertion correctly.
  - Pre-existing code already satisfies the test? Adjust the skeleton to test the new behavior specifically, and document the overlap in the MDD doc's `known_issues`.
  - Test file itself has a syntax error that's causing a false skip? Fix the syntax.

**Gate:** ALL tests must fail before proceeding to Phase 5. Block until confirmed red.

Report to the user:
```
🔴 Red Gate: <N>/<N> failing (expected)
   All skeletons confirmed RED — ready to implement.
```

If any test passes unexpectedly and the fix isn't trivial, ask the user:
```
⚠️  Red Gate: <N>/<N> failing, <N> passing unexpectedly.
   Test(s) passing: <test name(s)>
   Diagnosis: <what's happening>
   Proposed fix: <skeleton adjustment>
   Proceed with fix? (yes / adjust differently / stop)
```

### Phase 5 — Present the Build Plan

**Auto-detect feature size** before choosing plan format:

- **Simple** — fewer than 3 new files, no API routes, no database: use flat steps (block overhead not warranted)
- **Medium or Large** — anything else: use block structure

#### Block structure (medium/large features)

Each block is a unit of work that satisfies three criteria:
1. **Runnable end-state** — after the block completes, code compiles, tests pass, no half-open interfaces
2. **Commit-worthy scope** — the block has a clear "why" that justifies a standalone conventional commit
3. **Own verification** — a concrete command that proves the block is done

**Block template:**
```
Block N (Name) [small | medium | large]
  End-state:    <what is compilable and runnable when this block finishes>
  Commit scope: <conventional commit one-liner, e.g. "feat: add order types and DB schema">
  Verify:       <exact command — e.g. pnpm typecheck or pnpm test:unit -- --grep "orders">
  Handoff:      <what the next block expects to exist when this one finishes>
  Runs in:      main conversation | parallel agents (N)

  Steps:
    1. <specific file action — e.g. Create src/types/orders.ts — Order, OrderStatus, OrderLine>
    2. <specific file action>
```

**Large block rule:** Must include `Justification: <why this block cannot be split>`. A valid justification is a shared type contract that forces backend + frontend into one atomic change. If the justification doesn't hold, auto-suggest the split before the user confirms.

**Parallelization annotation:**
Before assigning `Runs in: parallel agents`, verify both gates:
1. **File declaration gate:** List every file each parallel agent will write. If any file appears in more than one agent's list → mark as `Runs in: main conversation`. No exceptions.
2. **Type dependency gate:** If Block X creates types that Block Y's code imports → Block X must run first (Block Y gets `Depends on Block X`, sequential).

If both gates pass and the blocks are in the same dependency layer → mark as `Runs in: parallel agents (2)`.

**Dependency layers** (used to sequence blocks):
```
Layer 1 (no dependencies):      Types, shared interfaces
Layer 2 (depends on Layer 1):   Services, components, handlers
Layer 3 (depends on Layer 2):   Route wiring, integration points
Layer 4 (depends on all):       Test implementation, final wiring
```

**Build plan display:**
```
🔨 MDD Build Plan for: <Feature Name>

Documentation: .mdd/docs/<NN>-<feature-name>.md ✅
Test skeletons: <N> tests across <N> files ✅
Red Gate: <N>/<N> confirmed red ✅

Block 1 (Foundation) [small]  →  main conversation
  End-state:    Shared types compile clean
  Commit scope: feat: add <feature> types and interfaces
  Verify:       pnpm typecheck
  Handoff:      User, Order, OrderStatus exported from src/types/orders.ts

Block 2 (Services) [medium]  →  parallel agents (2)
  Backend sub-block:   src/handlers/orders.ts, src/adapters/orders.ts
  Frontend sub-block:  src/components/OrderList.tsx, src/hooks/useOrders.ts
  File overlap:        NONE — safe to parallelize
  Each agent receives: Block 1 output + full MDD doc + project conventions

Block 3 (Wiring) [small]  →  main conversation
  End-state:    Route registered, feature reachable at /api/v1/orders
  Commit scope: feat: wire orders route into server
  Verify:       pnpm test:unit -- --grep "orders"
  Handoff:      POST /api/v1/orders returns 201

Block 4 (Tests) [small]  →  main conversation
  End-state:    All <N> skeletons passing, no regressions
  Commit scope: test: implement orders feature test suite
  Verify:       pnpm test:unit

Total blocks: <N> (<N> sequential, <N> parallel batch)
Total new files: <N>
Tests to satisfy: <N>

Ready to build? (yes / modify plan / stop here)
```

**Step naming is MANDATORY** — every block has a unique name the user can reference when asking for changes.

**Flat step format (simple features only):**
```
🔨 MDD Build Plan for: <Feature Name>

Documentation: .mdd/docs/<NN>-<feature-name>.md ✅
Test skeletons: <N> tests ✅  Red Gate: <N>/<N> red ✅

Steps:
  Step 1 (<name>): <what will be created>
  Step 2 (<name>): <what will be created>

Tests to satisfy: <N>

Ready to build? (yes / modify plan / stop here)
```

Wait for user confirmation.

### Phase 6 — Implement (Test-Driven)

#### Step 6a — Layered execution

Execute blocks in dependency layer order (Layer 1 → 2 → 3 → 4). Within the same layer, blocks marked `Runs in: parallel agents (2)` run simultaneously. Blocks marked `Runs in: main conversation` run sequentially.

**For parallel blocks:**

1. Verify file declaration gate one final time (list every file each agent writes — any overlap → fall back to sequential)
2. Launch both agents simultaneously. Each agent prompt must be **completely self-contained** and include:
   - The full MDD doc content (embedded, not referenced by path)
   - The specific block description and steps
   - ALL output from Layer 1 (types files — embed the file contents, do not reference paths)
   - Project coding conventions from CLAUDE.md
   - Exact output file paths
   - Explicit instruction: write the implementation only, do not run tests or typecheck
3. Collect both outputs
4. Run `pnpm typecheck` before proceeding to the next layer
5. If typecheck fails after a parallel batch: diagnose which agent's output is the cause before retrying. Fix in main conversation — do not re-launch agents blindly.

**For sequential blocks:** read the MDD doc, read the relevant test skeletons, implement, run the Green Gate loop below.

#### Step 6b — Green Gate loop (per block)

After each block's implementation (sequential or parallel), run the Green Gate:

```
Green Gate — Block N (Name)

Iteration 1–5:
  Run: pnpm test:unit -- --grep "<feature>" AND pnpm typecheck

  If ALL green:
    → proceed to regression check

  If failing:
    DIAGNOSE (required before any fix):
      - What is the exact error message, file, and line?
      - Which implementation assumption was wrong?
      - Is this a known pattern? (check CLAUDE.md, project conventions)
      - What is the ONE targeted fix?
    
    FIX — implementation only:
      - Tests are NEVER modified.
      - If a test seems wrong → re-read the MDD doc first.
      - If the doc seems wrong → STOP and ask the user before changing anything.
    
    REPORT ONE LINE per iteration:
      "Iteration N — Root cause: <X> / Fix applied: <Y>"

Iteration 5 exhausted, still failing:
  STOP immediately. Do not attempt iteration 6.
  Report to user:
    "5 iterations reached. Still failing:
       - <test name>: <diagnosis summary>
       - <test name>: <diagnosis summary>
     Options:
       (a) continue debugging — I'll keep trying
       (b) narrow scope — remove or defer these cases
       (c) pause and review together"
  Wait for user input.
```

**Regression check (after each block goes green):**

```bash
pnpm test:unit  # full suite, including pre-existing tests
```

Any regression failure is treated as a new failure for the SAME block — it counts against the remaining iteration budget. This prevents regressions from being silently deprioritized.

**Progress reporting:**
```
Block 1 (Foundation): ✅ — src/types/orders.ts created, typecheck clean
Block 2 (Services):   🔄 parallel agents running...
Block 2 (Services):   ✅ — 8/8 tests passing, no regressions
Block 3 (Wiring):     🔄 in progress...
```

### Phase 7 — Verify + Report

#### Phase 7a — Quality Gates

```bash
pnpm typecheck   # must pass — no errors
pnpm test:unit   # all tests must pass (pre-existing + new)
```

These must both pass before proceeding to Phase 7b. If either fails here, return to Phase 6 (Green Gate) to fix.

#### Phase 7b — Integration Verification

Quality gates passing does not mean the feature works. This phase verifies actual behavior against the real runtime environment.

**Detect feature type** from MDD doc frontmatter (`routes`, `models`, source file paths, feature description):

**Backend feature** (has routes or handler files):
```
□ Start the server if not running
□ Trigger the full happy-path request — real HTTP call, real DB, not mocked
□ Watch backend logs during the run:
    Any unexpected error, warning, or rate anomaly → investigate immediately
□ Verify: response shape matches documented response shape
□ Verify: response status code matches documented status code
□ Verify: DB state changed as expected (run a direct query to confirm)
□ Test at least one documented error case (bad input, missing auth, etc.)
□ Verify: error response matches documented error response
```

**Frontend feature** (has component or UI files):
```
□ Open the target page in the browser
□ Verify expected data is visible — "page loaded" is NOT sufficient
□ Click through the documented user flow step by step
□ Open network tab: confirm expected API calls are made
□ Open network tab: confirm expected responses are received
□ Check browser console: no errors or warnings from this feature's code
□ Test an error state (bad input, empty state, etc.) — verify it renders correctly
```

**Database feature** (has schema or model changes):
```
□ Write: verify rows/documents actually written — direct DB query, not insert return value
□ Read: verify reads return the expected data shape
□ Constraints: test invalid data produces the documented error (not a silent failure)
□ Performance: run EXPLAIN on primary query patterns — no full-table scans on large collections
```

**Tooling feature** (command, script, hook, or workflow):
```
□ Run against a real scenario — not contrived minimal input
□ Verify output exactly matches documented behavior (check actual output against doc)
□ Test documented error cases — verify each produces the documented error message
□ Confirm no unintended side effects on unrelated files or state
```

**Ownership Default — applies to ALL feature types:**

```
Any external failure (API unreachable, DB missing test data, service slow, key not set)
is a HYPOTHESIS — not an accepted fact — until empirically disproven.

Required procedure before accepting any external blocker as real:
  Step 1: Read backend logs in full — what did the server actually receive and return?
  Step 2: Run a minimal probe — the smallest possible request or script targeting the real interface
  Step 3: Form a specific, falsifiable hypothesis — "The failure is at X because Y shows Z"

Default stance: "My code is wrong until proven otherwise."
This takes ~1 minute and eliminates the entire class of wrong-attribution bugs
where the agent patches the wrong thing because it accepted an external excuse too quickly.
```

#### Phase 7c — Completion Signal

**If integration verified:**
```
✅ MDD Complete: <Feature Name>

Documentation: .mdd/docs/<NN>-<feature-name>.md
Data flow doc: .mdd/audits/flow-<feature-slug>-<date>.md (or "greenfield")
Files created: <list>
Blocks: <N>/<N> complete
Tests: <N>/<N> passing
Integration: verified (<feature type> — real environment)
Typecheck: clean

Update doc: status → complete, phase → all, last_synced → <today>

New patterns established: <any new rules worth adding to CLAUDE.md>

Branch: feat/<feature-name>
Ready for review — run `git diff main...HEAD` to see all changes.
```

**If integration NOT verified (external condition blocked it):**
```
⏸️  MDD Blocked: <Feature Name>

Blocked on:  <exact condition — e.g. "STRIPE_API_KEY not set in .env">
Evidence:    <what was run and what it returned>
Diagnosis:   <specific hypothesis about the cause>
Next step:   <concrete action to unblock — e.g. "Add STRIPE_API_KEY to .env, then re-run Phase 7b">

Code is complete. All <N> tests pass. Typecheck clean.
Feature is NOT marked done until Phase 7b passes.
Update doc: status → in_progress, phase → integration-pending

When unblocked: resume at Phase 7b only. No re-implementation needed.
```

3. **Update documentation** — add any `known_issues` discovered during implementation
4. **Update CLAUDE.md** if new patterns were established

---

## AUDIT MODE — `/mdd audit [section]`

Triggered when arguments start with `audit`.

### Phase A1 — Scope

If a section is specified (e.g., `/mdd audit database`), audit only that feature.
If no section, audit the entire project.

1. **Read all `.mdd/docs/*.md` files** — build the feature map
2. **If no `.mdd/` directory exists:** Create it with `docs/` and `audits/` subdirectories. Then tell the user: "No MDD documentation found. Run `/mdd` for each feature to create docs first, or I can scan the codebase and create them now. Which do you prefer?"
   - If "scan": read all source files and generate documentation files (Phase 0)
   - If "manual": exit and let the user create docs per feature

### Phase A2 — Read + Notes (parallelized)

**Single-feature audit** (`/mdd audit <section>`): read source files directly in the main conversation, write notes immediately — no agent overhead for one feature.

**Full audit** (no section specified): use batched parallel Explore agents to read source files for all features simultaneously.

#### Batch sizing

Divide all features into batches based on count:
- 1–3 features: 1 agent (or main conversation if ≤ 2)
- 4–6 features: 2 agents, batches of 2–3
- 7+ features: 3 agents (max), batches of ~equal size

#### Agent instructions (each must be self-contained)

Each agent receives:
- Its assigned feature docs (full frontmatter + all sections)
- The exact `source_files` list to read
- The note format template (below)
- Explicit instruction: **read the source files and return structured notes — do NOT write any files**

#### What each agent returns

One block per assigned feature:
```
### [<NN>] <Feature Name>
**Files read:** <list of files actually read>
**Findings:**
- 🔴 CRITICAL: <description>
- 🟠 HIGH: <description>
- 🟡 MEDIUM: <description>
- 🔵 LOW: <description>
**Test coverage:** <existing test count> / <endpoint count>
**Doc accuracy:** <discrepancies between doc and code, or "accurate">
```

#### Main conversation: write notes file

After ALL agents return, write their output to `.mdd/audits/notes-<date>.md` in one pass — the main conversation is the single writer. Do not write partial notes; wait for all agents first.

**Fallback:** If any agent fails, process that batch sequentially in the main conversation using the same note format. Never surface agent failures to the user unless all batches fail.

### Phase A3 — Analyze

Read ONLY the notes file (NOT source code again). Produce findings report at `.mdd/audits/report-<date>.md`:

1. Executive summary
2. Feature completeness matrix
3. Findings by severity (CRITICAL / HIGH / MEDIUM / LOW)
4. Test coverage summary
5. Fix plan with effort estimates

### Phase A4 — Present Findings

Show the user:
```
🔍 MDD Audit Complete

Findings: <N> total (<N> Critical, <N> High, <N> Medium, <N> Low)
Report: .mdd/audits/report-<date>.md

Top issues:
  1. <most critical finding>
  2. <second most critical>
  3. <third most critical>

Estimated fix time: <N> hours (traditional) → <N> minutes (MDD)

Fix all now? (yes / review report first / fix only critical+high)
```

**After the report is written**, trigger the `.mdd/.startup.md` rebuild (same logic as in Status Mode — rebuild auto-generated zone, preserve Notes zone) so the Last Audit block reflects the new findings regardless of whether the user proceeds with fixes.

If user says yes (or selects a subset):

### Phase A5 — Fix

Read the findings report. For each finding to fix:
1. Read the specific source files
2. Apply the fix
3. Write or update tests
4. Run tests after each fix group

Report progress per finding. Update documentation `known_issues` to remove fixed items.

**After fixes are complete and results are written to `.mdd/audits/results-*.md`**, trigger the `.mdd/.startup.md` rebuild (same logic as in Status Mode — rebuild auto-generated zone, preserve Notes zone) so the Last Audit block reflects the new numbers.

---

## STATUS MODE — `/mdd status`

Quick overview of MDD state for the project:

1. **Scan `.mdd/docs/`** — count feature docs
2. **Scan `.mdd/audits/`** — find latest audit report
3. **Count tests** — `pnpm test:unit --reporter=json 2>/dev/null | jq '.numTotalTests'`
4. **Count known issues** — grep `known_issues` across all docs

Present:
```
📊 MDD Status

Feature docs:     <N> files in .mdd/docs/
Last audit:       <date> (<N> findings, <N> fixed, <N> open)
Test coverage:    <N> unit tests, <N> E2E tests
Known issues:     <N> tracked across <N> features
Quality gates:    <N> files over 300 lines

Drift check:
  <N> features in sync
  <N> features possibly drifted  ← run /mdd scan for details
  <N> features untracked         ← no last_synced field yet

Run `/mdd audit` to refresh, `/mdd scan` to see drift details, or `/mdd <feature>` to build something new.
```

**Drift check logic** (lightweight — no full git log, just a quick presence check):
1. For each `.mdd/docs/*.md`, read `last_synced` from frontmatter.
2. If `last_synced` is missing → untracked.
3. If `last_synced` exists: run `git log --oneline --after="<last_synced>" -- <source_files>` for the first source file only (quick check). If output is non-empty → possibly drifted.
4. Count each category and show totals. Full details go in SCAN MODE.

### Rebuild `.mdd/.startup.md`

After collecting status, rebuild the auto-generated zone of `.mdd/.startup.md`:

1. Read the current `.mdd/.startup.md` (if it exists) and extract the **Notes section** — everything after the `---` divider line. This is the user's append-only zone and must be preserved exactly.
2. Rebuild the **auto-generated section** (everything above `---`) with fresh data:
   - `Generated: <YYYY-MM-DD>` (date only, no time)
   - `Branch:` from `git branch --show-current`
   - `Stack:` from `CLAUDE.md` or `claude-mastery-project.conf` if detectable, otherwise `(unknown)`
   - `Features Documented:` sorted list of `.mdd/docs/*.md` filenames with status if detectable from frontmatter
   - `Last Audit:` from the most recent `.mdd/audits/report-*.md` — extract findings/fixed/open counts
   - `Rules Summary:` static block (does not change)
3. Write the rebuilt auto-generated section + `---` divider + preserved Notes section back to `.mdd/.startup.md`
4. If no `.mdd/.startup.md` exists yet, create it fresh using the template with an empty Notes section

---

## NOTE MODE — `/mdd note`

Triggered when arguments start with `note`. Three subcommands:

```
/mdd note "your note here"    -- append a timestamped note to .startup.md
/mdd note list                -- print only the Notes section
/mdd note clear               -- wipe the Notes section (asks for confirmation)
```

### `/mdd note "your note here"` — Append

1. Read `.mdd/.startup.md`. If it does not exist, create it first using the startup template (same as generated by `/mdd status` with placeholder values), then continue.
2. Find the `---` divider line.
3. Append below the divider: `- [YYYY-MM-DD] your note here` (use today's date).
4. Write the file back.
5. Print: `Note added to .mdd/.startup.md`

### `/mdd note list` — List Notes

1. Read `.mdd/.startup.md`.
2. Print everything after the `---` divider (the Notes section).
3. If the Notes section is empty or contains only the placeholder text, print: `(no notes yet)`

### `/mdd note clear` — Clear Notes

1. Ask the user: `Clear all notes in .mdd/.startup.md? This cannot be undone. (yes/no)`
2. If yes: rewrite the Notes section (everything after `---`) as `(no notes)`
3. If no: abort with `Cancelled.`

---

---

## SCAN MODE — `/mdd scan`

Triggered when arguments start with `scan`. Detects features whose source files have changed since the last MDD session.

### Phase SC1 — Read all feature docs

Read every `.mdd/docs/*.md` (excluding `archive/`). For each, extract:
- `last_synced` from frontmatter
- `source_files` list from frontmatter

### Phase SC2 — Check each feature for drift (parallelized)

After Phase SC1 has the full feature list (IDs, `last_synced`, `source_files`), delegate all git log checks to a **single Explore agent** rather than running them sequentially in the main conversation.

**Why a single agent (not multiple):** `git log` commands are individually fast — the bottleneck is issuing them one at a time in the main conversation. One agent can run all of them in quick succession and return a complete classification table.

#### Agent instructions (self-contained)

The agent receives:
- Complete feature list: each feature's ID, `last_synced` date, and `source_files`
- Classification rules (below)
- Explicit instruction: run the git checks and return a structured table — do NOT write any files

For each feature, the agent runs:
```bash
# Check file existence
ls <source_file> 2>/dev/null

# Check for commits after last_synced (only if files exist)
git log --oneline --after="<last_synced>" -- <source_file>
```

#### What the agent returns

A classification table — one row per feature:

```
| Feature ID | Classification | Detail |
|---|---|---|
| 01-project-scaffolding | in_sync | last synced: 2026-03-15, no commits after |
| 04-content-builder | drifted | 3 commits since 2026-03-01, latest: "fix: heading parser" |
| 07-github-pages | broken | docs/index.html not found on disk |
| 09-integrations | untracked | no last_synced field |
```

**Classifications:**
- **untracked** — `last_synced` missing from frontmatter
- **broken** — one or more `source_files` not found on disk
- **drifted** — `last_synced` exists, files exist, commits found after `last_synced`
- **in_sync** — `last_synced` exists, all files exist, no commits after `last_synced`

#### Main conversation: build drift report

After the agent returns its table, the main conversation writes the drift report. No file writes happen inside the agent.

**Fallback:** If the agent fails, run git checks sequentially in the main conversation using the same logic.

### Phase SC3 — Present drift report

```
🔍 MDD Scan — Drift Report
Generated: <YYYY-MM-DD>

  ✅ 01-project-scaffolding   — in sync (last synced: 2026-03-15)
  ⚠️  04-content-builder       — DRIFTED (3 commits since 2026-03-01)
                                  Latest: "fix: markdown heading parser"
  ❌  07-github-pages           — broken reference (docs/index.html not found)
  ❓  09-integrations           — untracked (no last_synced field)

Summary: 1 in sync · 1 drifted · 1 broken · 1 untracked

Recommended actions:
  /mdd update 04   — re-sync content-builder doc with code
  /mdd update 07   — fix broken file reference
  /mdd update 09   — add last_synced by running update mode
```

Save the full report to `.mdd/audits/scan-<date>.md`.

---

## UPDATE MODE — `/mdd update <feature-id>`

Triggered when arguments start with `update`. Updates an existing feature doc to reflect code that has changed since the last MDD session.

### Phase U1 — Load the feature

Parse `<feature-id>` from arguments (e.g., `04` or `04-content-builder`). Find the matching `.mdd/docs/*.md` file. Read it fully.

If the feature-id is not found, list all available docs and ask the user to pick one.

### Phase U2 — Read current source files

Read every file listed in `source_files` frontmatter. If a file is missing, note it as a broken reference — ask the user for the new path before continuing.

### Phase U3 — Diff doc vs code

Compare what the doc says against what the code actually does:
- New functions, endpoints, or exports not in the doc
- Removed or renamed functions that the doc still mentions
- Data model fields that changed
- Business rules that changed (different validation, new states)
- New edge cases visible in error handling

Write findings to `.mdd/audits/update-notes-<feature-id>-<date>.md`.

### Phase U4 — Present changes

```
📝 Update Review: <NN>-<feature-name>

Changes detected since <last_synced>:
  + Added:   <new thing>
  - Removed: <removed thing>
  ~ Changed: <changed thing>

Doc sections needing update:
  - API Endpoints (new route: POST /api/v1/...)
  - Business Rules (validation logic changed)

Proceed with doc update? (yes / review findings first / cancel)
```

Wait for user confirmation.

### Phase U5 — Rewrite affected sections

Rewrite ONLY the sections that changed. Preserve:
- `known_issues` section (don't remove existing issues)
- `depends_on` list (only add, never remove without asking)
- Any manually written prose that is still accurate

After rewriting, update frontmatter:
- `last_synced: <today's date>`
- `status:` — ask the user if they want to update the status (e.g., draft → complete)
- `phase:` — update to reflect current state

### Phase U6 — Regenerate test skeletons for new behaviors

For any NEW documented behaviors (not previously in the doc), generate test skeleton entries and append them to the existing test file. Do NOT modify existing test implementations.

Report:
```
✅ Update Complete: <NN>-<feature-name>

Doc updated: .mdd/docs/<NN>-<feature-name>.md
last_synced: <today>
Sections rewritten: <list>
New test skeletons: <N> appended to tests/unit/<feature-name>.test.ts

Branch: <current branch>
```

---

## DEPRECATE MODE — `/mdd deprecate <feature-id>`

Triggered when arguments start with `deprecate`. Archives a feature cleanly.

### Phase D1 — Load + impact check

Find and read the target feature doc. Then scan all other `.mdd/docs/*.md` for any that list this feature in `depends_on`. Build the impact list.

### Phase D2 — Present impact

```
🗑️  Deprecate: <NN>-<feature-name>

This will:
  - Set status: deprecated in the doc frontmatter
  - Move doc to .mdd/docs/archive/<NN>-<feature-name>.md

Dependents (docs that depend on this feature):
  - 05-testing-framework (depends_on includes this)
  - 09-integrations (depends_on includes this)

Source files registered:
  - src/handlers/content.ts
  - scripts/build-content.ts

Test files registered:
  - tests/unit/content-builder.test.ts

Deprecate? (yes / review dependents first / cancel)
```

If user says yes:

### Phase D3 — Archive

1. Set `status: deprecated` and `last_synced: <today>` in the doc frontmatter.
2. Create `.mdd/docs/archive/` directory if it doesn't exist.
3. Move the doc file to `.mdd/docs/archive/`.
4. For each dependent doc, add an entry to its `known_issues`: `<NN>-<feature-name> has been deprecated — review this feature's dependency.`
5. Ask the user separately: "Delete source files? (yes / no)" and "Delete test files? (yes / no)" — never auto-delete.
6. Rebuild `.mdd/.startup.md`.

Report:
```
✅ Deprecated: <NN>-<feature-name>

Doc archived: .mdd/docs/archive/<NN>-<feature-name>.md
Dependents flagged: <N> docs updated with known_issues warning
Source files: <kept/deleted per user choice>
Test files: <kept/deleted per user choice>
```

---

## REVERSE-ENGINEER MODE — `/mdd reverse-engineer [path or feature-id]`

Triggered when arguments start with `reverse-engineer` or `reverse`. Generates or regenerates MDD documentation from existing source code.

### Phase R1 — Determine scope

**If a path or feature-id is given:**
- If it matches an existing `.mdd/docs/*.md` — load that doc as the "existing doc" for comparison (regenerate mode).
- If it's a file path — read that file as the only source (new doc mode).

**If no argument is given:**
- Scan `src/` for all TypeScript/source files.
- Cross-reference against `source_files` fields in all `.mdd/docs/*.md`.
- List files not registered in any doc. Ask the user which ones to document.

### Phase R2 — Read source files (parallelized for multi-file scope)

**Threshold rule:**
- ≤ 3 source files: read directly in the main conversation — no agent overhead
- 4+ source files: batch into parallel Explore agents (max 3), each reading a subset

**When parallelism applies:** Primarily the no-argument case — scanning `src/` for undocumented files can surface many files at once. A single feature with many source files (e.g., a large module) also qualifies.

#### Agent instructions (self-contained)

Each agent receives:
- Its assigned file paths
- The inference checklist below
- Explicit instruction: read the files and return structured inference output — do NOT write any files

For each assigned file, infer:
- **Purpose:** What does this file do? What problem does it solve?
- **Data models:** TypeScript interfaces, types, Zod schemas
- **API routes:** Express/Fastify/etc. route definitions and their handlers
- **Business rules:** Conditional logic, validation, state transitions
- **Dependencies:** What other modules does it import?
- **Edge cases:** Error handling patterns, guard clauses

#### What each agent returns

One block per assigned file:
```
File: <path>
Purpose: <1–2 sentences>
Data models: <list of types/interfaces with key fields>
API routes: <list of routes with method + path>
Business rules: <key validation, state logic>
Dependencies: <imports from other project modules>
Edge cases: <error handlers, guard clauses>
```

#### Main conversation: synthesize

After all agents return, synthesize their output into Phase R3 (draft the doc). The main conversation is the only one that writes files.

**Fallback:** If any agent fails, read that batch of files directly in the main conversation.

### Phase R3 — Draft the doc

Draft a complete feature doc following the Phase 3 template. Set:
- `last_synced: <today>`
- `status: draft` (since business intent may be incomplete)
- `phase: reverse-engineered`

**In regenerate mode:** Show the existing doc alongside the new draft:
```
📋 Regeneration Comparison: <NN>-<feature-name>

Existing doc sections:     New draft sections:
  Purpose: ...               Purpose: ... (updated)
  Architecture: ...          Architecture: ... (same)
  API Endpoints: ...         API Endpoints: ... (3 new routes found)
  Business Rules: ...        Business Rules: ... (changed)

Changes: 2 sections updated, 1 section unchanged, 1 section added
```

Ask: "Merge new draft into existing doc? (yes / keep existing / show full diff)"

**In new doc mode:** Show the full draft and ask: "Does this accurately describe the feature? Anything to add or change?"

### Phase R4 — Save and optionally generate test skeletons

After user confirmation, write the doc. Then ask:
"Generate test skeletons from the inferred endpoints and business rules? (yes / no)"

If yes, follow Phase 4 logic using the newly written doc.

**Always disclose limitations before saving:**
```
⚠️  Reverse-engineer limitations:
   - "Purpose" section is inferred — review business intent carefully
   - Implicit constraints (SLAs, compliance, product decisions) are not captured
   - Confirm accuracy before treating this doc as the source of truth
```

---

## GRAPH MODE — `/mdd graph`

Triggered when arguments start with `graph`. Shows the cross-feature dependency map.

### Phase G1 — Build dependency graph

Read all `.mdd/docs/*.md` (including `archive/`). For each doc, extract `id`, `title`, `status`, and `depends_on`.

Build a directed graph: edge A → B means "A depends on B" (B must exist for A to work).

### Phase G2 — Detect issues

**Broken dependency:** A doc lists a deprecated or archived feature in `depends_on`.

**Risky dependency:** A `status: complete` feature depends on a `status: in_progress` or `status: draft` feature.

**Orphan:** A feature with no `depends_on` and no other feature depending on it.

### Phase G3 — Render

```
📊 MDD Dependency Graph

Dependencies (A depends on → B):

  06-command-system ──────────────────► 01-project-scaffolding
  09-integrations ────────────────────► 06-command-system
  04-content-builder ─────────────────► 03-database-layer
  05-testing-framework ───────────────► 03-database-layer

Orphans (no dependencies, no dependents):
  07-github-pages
  08-quality-gates

Issues:
  ⚠️  09-integrations depends on 06-command-system (status: in_progress) — risky
  ❌  05-testing-framework depends on 10-mdd-refinements (deprecated) — broken
```

Save the graph to `.mdd/audits/graph-<date>.md`.

---

## Auto-Branch (All Modes)

**If the user already chose a worktree in Step 0, skip auto-branch entirely** — the worktree was created with its own dedicated branch.

Otherwise, before creating or modifying any files, check the current branch:

```bash
git branch --show-current
```

**Default behavior** (`auto_branch = true` in `claude-mastery-project.conf`):
- If on `main` or `master`:
  - Build mode: `git checkout -b feat/<feature-name>`
  - Audit mode: `git checkout -b fix/mdd-audit-<date>`
- If already on a feature branch: proceed

---

## CLAUDE.md Update Trigger

After ANY MDD operation that changes code, check if new patterns were established that should be added to CLAUDE.md. If so, suggest the addition:

```
💡 New pattern detected: <description>
Add to CLAUDE.md? (yes / no)
```

This is the MDD feedback loop — every project interaction improves future interactions.
