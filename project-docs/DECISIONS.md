# Architectural Decisions

> Record WHY you chose X over Y. Future-you (and future-Claude) will thank you.

---

## Decision Template

When adding a new decision, copy this template:

```markdown
## ADR-XXX: [Title]

**Date:** YYYY-MM-DD
**Status:** Accepted | Superseded by ADR-XXX | Deprecated

### Context
What is the issue or situation that motivated this decision?

### Decision
What is the change we're making?

### Alternatives Considered
| Option | Pros | Cons |
|--------|------|------|
| Option A | ... | ... |
| Option B | ... | ... |

### Consequences
What are the positive and negative results of this decision?
```

---

## ADR-001: TypeScript Over JavaScript

**Date:** (today)
**Status:** Accepted

### Context
AI-assisted development needs explicit type information to avoid guessing. JavaScript provides no type contracts, leading to runtime errors that are hard to trace.

### Decision
All new code MUST be TypeScript with strict mode. When editing existing JavaScript files, convert to TypeScript first.

### Alternatives Considered
| Option | Pros | Cons |
|--------|------|------|
| JavaScript + JSDoc | Less setup | AI still guesses, JSDoc can be wrong |
| TypeScript (strict) | Explicit contracts, better AI accuracy | Slightly more verbose |

### Consequences
- Claude can reason about types without guessing
- Refactoring is safer with compile-time checks
- New team members learn the codebase from type signatures

---

## ADR-002: Centralized Database Wrapper (StrictDB)

**Date:** (today)
**Status:** Accepted (updated: migrated from custom wrappers to StrictDB)

### Context
Without a centralized wrapper, each file creates its own database connection, leading to connection pool exhaustion. Originally solved with custom MongoDB + SQL wrappers (~1,170 lines combined). Migrated to StrictDB — a unified driver supporting MongoDB, PostgreSQL, MySQL, MSSQL, SQLite, and Elasticsearch through a single API.

### Decision
All database access goes through `src/core/db/index.ts`, a thin adapter around StrictDB. No other file may import `strictdb` or native database drivers directly.

### Consequences
- Single connection pool prevents exhaustion
- One place to add logging, metrics, retries
- Easy to mock for testing
- One API for all backends — switching databases requires only changing STRICTDB_URI
- Built-in sanitization, guardrails, and AI-first discovery (describe, validate, explain)
