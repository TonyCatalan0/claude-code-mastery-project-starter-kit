---
description: "MDD workflow — Document → Audit → Fix → Verify. Build features or audit existing code using Manual-First Development."
scope: project
argument-hint: "<feature-description> or audit [section]"
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, AskUserQuestion
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
- If arguments are empty → ask the user what they want to do
- Otherwise → **Build Mode** (the default — jump to Phase 1)

---

## BUILD MODE — New Feature Development

### Phase 1 — Understand the Feature

Read the user's description: **$ARGUMENTS**

Before writing anything, gather context:

1. **Read `CLAUDE.md`** — understand project rules and architecture
2. **Read `project-docs/ARCHITECTURE.md`** — understand system structure
3. **Scan `.mdd/docs/`** — see what features already exist
4. **Scan `src/`** — understand current codebase structure

Then ask the user targeted questions using AskUserQuestion. Ask ALL relevant questions upfront in a single interaction — don't spread them across multiple turns:

**Always ask:**
- "Does this feature need database storage? If so, what data does it store?"
- "Does this feature have API endpoints? What operations (create, read, update, delete)?"
- "Does this feature depend on any existing features?" (list the ones from `documentation/`)
- "Are there any edge cases or error scenarios you already know about?"

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

**After writing the feature doc**, trigger the `.mdd/.startup.md` rebuild (same logic as in Status Mode — rebuild auto-generated zone, preserve Notes zone) so the Features list stays current.

Show the completed doc to the user and ask: **"Does this accurately describe what you want to build? Anything to add or change?"**

Wait for confirmation before proceeding.

### Phase 4 — Generate Test Skeletons

Read the documentation file created in Phase 3. From the endpoints, business rules, and edge cases documented, generate test skeletons.

**Create test file at:** `tests/unit/<feature-name>.test.ts`

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

**If E2E tests are needed** (the feature has UI): also create `tests/e2e/<feature-name>.spec.ts` with Playwright skeletons following the same pattern.

Tell the user:
```
📋 Test skeletons created:
   - tests/unit/<feature-name>.test.ts (<N> test cases)
   - tests/e2e/<feature-name>.spec.ts (<N> test cases) [if applicable]

These tests will FAIL until implementation is complete.
That's the point — they're the finish line.
```

### Phase 5 — Present the Build Plan

Before writing any implementation code, present a clear plan:

```
🔨 MDD Build Plan for: <Feature Name>

Documentation: .mdd/docs/<NN>-<feature-name>.md ✅
Test skeletons: <N> tests across <N> files ✅

Implementation steps:
  Step 1 (<name>): <what will be created> — est. <time>
  Step 2 (<name>): <what will be created> — est. <time>
  Step 3 (<name>): <what will be created> — est. <time>
  ...

Total files to create: <N>
Total estimated time: <N> minutes
Tests to satisfy: <N>

Ready to build? (yes / modify plan / stop here)
```

**Step naming is MANDATORY** — every step has a unique name so the user can reference it.

**Estimation rules:**
- Types file: ~2 min
- Handler with 5 CRUD ops: ~5 min
- Route file (thin): ~3 min
- Wiring into server: ~1 min
- Test implementation: ~5 min per 10 tests
- Complex business logic: ~10 min per function

Wait for user confirmation.

### Phase 6 — Implement (Test-Driven)

For each step in the plan:

1. **Read the MDD doc** — refresh context on what this step needs
2. **Read the test skeleton** for the relevant tests
3. **Implement the code** that makes the tests pass
4. **Run tests** after each step: `pnpm test:unit -- --grep "<feature>"`
5. **Report progress:**
   ```
   Step 1 (Types): ✅ — src/types/<feature>.ts created
   Step 2 (Handler): ✅ — 4/5 tests passing, fixing edge case...
   Step 2 (Handler): ✅ — 5/5 tests passing
   Step 3 (Routes): 🔄 in progress...
   ```

**CRITICAL:** If a test fails, fix the implementation — NOT the test. The tests were generated from the documentation. If the test seems wrong, re-read the doc. If the doc is wrong, ask the user.

After all steps complete:

```bash
pnpm typecheck     # Must pass
pnpm test:unit     # All tests must pass (including pre-existing)
```

### Phase 7 — Verify + Report

After implementation is complete:

1. **Run full test suite:** `pnpm test:unit`
2. **Run typecheck:** `pnpm typecheck`
3. **Update documentation** — add any `known_issues` discovered during implementation
4. **Update CLAUDE.md** if new patterns were established

Present the final report:

```
✅ MDD Complete: <Feature Name>

Documentation: .mdd/docs/<NN>-<feature-name>.md
Data flow doc: .mdd/audits/flow-<feature-slug>-<date>.md (or "greenfield")
Files created: <list>
Tests: <N>/<N> passing
Typecheck: Clean

New patterns established: <any new rules worth adding to CLAUDE.md>

Branch: feat/<feature-name>
Ready for review — run `git diff main...HEAD` to see all changes.
```

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

### Phase A2 — Read + Notes

For each feature (or the specified section):

1. Read ALL source files listed in the documentation's `source_files` frontmatter
2. Write notes to `.mdd/audits/notes-<date>.md`
3. **CRITICAL: Write every 2 features** — do not accumulate in memory

Note format per feature:
```markdown
### [<NN>] <Feature Name>
**Files read:** <list>
**Findings:**
- <severity emoji> <finding description>
**Test coverage:** <existing test count> / <endpoint count>
**Doc accuracy:** <any discrepancies between docs and code>
```

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

Feature docs:     <N> files in documentation/
Last audit:       <date> (<N> findings, <N> fixed, <N> open)
Test coverage:    <N> unit tests, <N> E2E tests
Known issues:     <N> tracked across <N> features
Quality gates:    <N> files over 300 lines

Run `/mdd audit` to refresh or `/mdd <feature>` to build something new.
```

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
