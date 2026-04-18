---
description: Install global Claude config — merges into existing ~/.claude/ without overwriting
scope: starter-kit
argument-hint: "[mdd]"
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, AskUserQuestion
---

# Install Global Config

**$ARGUMENTS**

Install the starter kit's global Claude configuration into `~/.claude/`. This is a one-time setup that gives you security rules, hooks, and settings across ALL projects.

**Smart merge:** If you already have a global config, this merges new content — it never overwrites your existing rules.

## Step 0 — Check for Targeted Install

If `$ARGUMENTS` is `mdd` (i.e. the user ran `/install-global mdd`):

- **Skip Steps 1–3 entirely** — do not touch CLAUDE.md, settings.json, or hooks
- Jump directly to **MDD-Only Install** below, then stop

---

## MDD-Only Install — `/install-global mdd`

Update the globally installed MDD commands in `~/.claude/commands/` without touching any other global config. Use this whenever the `/mdd` command has been updated in the starter kit and you want to push the new version to your global install.

```bash
mkdir -p ~/.claude/commands

[ -f ~/.claude/commands/mdd.md ] && echo "MDD_EXISTS" || echo "MDD_CLEAN"
[ -f ~/.claude/commands/install-mdd.md ] && echo "INSTALL_MDD_EXISTS" || echo "INSTALL_MDD_CLEAN"
```

For each file (`mdd.md`, `install-mdd.md`):

Read `mdd_version` from source and installed (treat missing as 0):
```bash
SOURCE_VERSION=$(grep "^mdd_version:" .claude/commands/mdd.md | awk '{print $2}')
SOURCE_VERSION=${SOURCE_VERSION:-0}
INSTALLED_VERSION=$(grep "^mdd_version:" ~/.claude/commands/mdd.md 2>/dev/null | awk '{print $2}')
INSTALLED_VERSION=${INSTALLED_VERSION:-0}
```

- If the file **already exists** and versions differ → overwrite (explicit update, no prompt needed)
- If the file **already exists** and versions match → skip, report "already up to date"
- If the file **does NOT exist** → copy it

**After handling each file** (whether copied or skipped), always ensure the `(global)` prefix is present in the installed copy's `description` field. Run the sed unconditionally — it is idempotent and safe to run even if `(global)` is already present (the pattern only matches when `(global)` is absent):

```bash
# Ensure (global) prefix — idempotent: only adds if not already present
sed -i 's/^description: "\([^(]\)/description: "(global) \1/' ~/.claude/commands/mdd.md
sed -i 's/^description: "\([^(]\)/description: "(global) \1/' ~/.claude/commands/install-mdd.md
```

This only modifies the installed copy at `~/.claude/commands/` — the source files in `.claude/commands/` are never touched.

Report:
```
Global MDD Update
==================
  ✓ mdd.md — v<INSTALLED> → v<SOURCE> (updated) [labelled "global"]
  ✓ install-mdd.md — updated [labelled "global"]
  — OR —
  ✓ mdd.md — v<VERSION> already up to date [labelled "global"]
  ✓ install-mdd.md — already up to date [labelled "global"]

/mdd is now current in every project on this machine.
```

**Stop here** — no further steps.

---

## Step 1 — Check What Exists

```bash
# Check if global claude directory exists
ls -la ~/.claude/ 2>/dev/null || echo "NO_GLOBAL_DIR"

# Check for existing files
[ -f ~/.claude/CLAUDE.md ] && echo "EXISTING_CLAUDE_MD" || echo "NO_CLAUDE_MD"
[ -f ~/.claude/settings.json ] && echo "EXISTING_SETTINGS" || echo "NO_SETTINGS"
[ -d ~/.claude/hooks ] && echo "EXISTING_HOOKS" || echo "NO_HOOKS"
```

## Step 2 — Handle Each File

### 2A. ~/.claude/CLAUDE.md

**If NO existing file:**
- Copy `global-claude-md/CLAUDE.md` directly to `~/.claude/CLAUDE.md`
- Report: "Installed global CLAUDE.md (fresh install)"

**If existing file found:**
1. Read BOTH files:
   - The existing `~/.claude/CLAUDE.md`
   - The starter kit's `global-claude-md/CLAUDE.md`
2. Compare section by section. The starter kit has these sections:
   - `## Identity`
   - `## NEVER EVER DO`
   - `## New Project Setup`
   - `## Coding Standards (All Projects)`
   - `## Workflow`
3. For each section:
   - If the section header **already exists** in the user's file → **SKIP** (don't overwrite their version)
   - If the section header **does NOT exist** → **APPEND** it to the end of the user's file
4. Report exactly what was added and what was skipped:
   ```
   Global CLAUDE.md merge:
     ✓ Identity — already exists, skipped
     ✓ NEVER EVER DO — already exists, skipped
     + New Project Setup — added
     + Coding Standards — added
     ✓ Workflow — already exists, skipped
   ```

**IMPORTANT:** NEVER delete or overwrite existing content. Only append missing sections.

### 2B. ~/.claude/settings.json

**If NO existing file:**
- Copy `global-claude-md/settings.json` directly to `~/.claude/settings.json`
- Report: "Installed global settings.json (fresh install)"

**If existing file found:**
1. Read both settings files as JSON
2. Merge the `permissions.deny` array — add any entries from the starter kit that aren't already present
3. Merge the `hooks` object:
   - For `PreToolUse`: add hooks that aren't already present (match by `command` string)
   - For `Stop`: add hooks that aren't already present (match by `command` string)
4. Write the merged result back
5. Report what was added:
   ```
   Global settings.json merge:
     + Added deny rule: Read(.env.production)
     ✓ Hook block-secrets.py — already present, skipped
     + Added Stop hook: verify-no-secrets.sh
   ```

**IMPORTANT:** NEVER remove existing permissions or hooks. Only add missing ones.

### 2C. ~/.claude/hooks/

1. Create `~/.claude/hooks/` if it doesn't exist:
   ```bash
   mkdir -p ~/.claude/hooks
   ```

2. Check if the project has hooks to install:
   ```bash
   ls .claude/hooks/ 2>/dev/null
   ```

3. For each hook file in the project's `.claude/hooks/`:
   - If the file **already exists** at `~/.claude/hooks/` → **SKIP** (don't overwrite)
   - If the file **does NOT exist** → **COPY** it
   - Make all hooks executable: `chmod +x ~/.claude/hooks/*`

4. Report:
   ```
   Global hooks:
     + block-secrets.py — installed
     ✓ verify-no-secrets.sh — already exists, skipped
     + lint-on-save.sh — installed
   ```

## Step 3B — Optional: Install MDD Globally

After hooks are installed, ask the user via AskUserQuestion:

**Question:** "Do you also want to install MDD globally? This copies `/mdd` and `/install-mdd` to `~/.claude/commands/` so they're available from every project without needing the starter kit open."

**Options:**
- **"Yes, install MDD globally"** — proceed below
- **"No, skip"** — skip to Step 4

**If yes:**

```bash
mkdir -p ~/.claude/commands

# Check current state
[ -f ~/.claude/commands/mdd.md ] && echo "MDD_EXISTS" || echo "MDD_CLEAN"
[ -f ~/.claude/commands/install-mdd.md ] && echo "INSTALL_MDD_EXISTS" || echo "INSTALL_MDD_CLEAN"
```

For each file (`mdd.md`, `install-mdd.md`):
- Read `mdd_version` from source and installed (treat missing as 0)
- If the file **already exists** at `~/.claude/commands/` → ask: "mdd.md already exists globally (installed: v<INSTALLED_VERSION>, available: v<SOURCE_VERSION>). Overwrite? (yes / keep existing)"
- If it **does NOT exist** → copy it from `.claude/commands/`

**After handling each file** (whether copied, updated, or skipped), always ensure the `(global)` prefix is present. Run the sed unconditionally — it is idempotent and only adds the prefix if absent:
```bash
sed -i 's/^description: "\([^(]\)/description: "(global) \1/' ~/.claude/commands/mdd.md
sed -i 's/^description: "\([^(]\)/description: "(global) \1/' ~/.claude/commands/install-mdd.md
```

Report:
```
Global MDD install:
  + mdd.md — installed [labelled "global"]
  + install-mdd.md — installed [labelled "global"]
```
or
```
Global MDD install:
  ✓ mdd.md — already up to date [labelled "global"]
  + install-mdd.md — installed [labelled "global"]
```

---

## Step 4 — Verify Installation

After all merges, verify:

```bash
echo "=== Global CLAUDE.md ==="
[ -f ~/.claude/CLAUDE.md ] && echo "✓ exists" || echo "✗ MISSING"

echo "=== Global settings.json ==="
[ -f ~/.claude/settings.json ] && echo "✓ exists" || echo "✗ MISSING"

echo "=== Global hooks ==="
ls ~/.claude/hooks/ 2>/dev/null || echo "✗ NO HOOKS"
```

## Step 5 — Report

```
Global Config Installation Complete
====================================

~/.claude/CLAUDE.md:
  [fresh install / merged X new sections / already up to date]

~/.claude/settings.json:
  [fresh install / merged X new rules / already up to date]

~/.claude/hooks/:
  [X hooks installed / X already existed]

Your existing rules were NOT overwritten.
New sections were appended. Review ~/.claude/CLAUDE.md to customize.

TIP: Update the Identity section with your GitHub username:
  ~/.claude/CLAUDE.md → ## Identity
```
