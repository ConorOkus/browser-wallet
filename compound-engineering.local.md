---
review_agents:
  - kieran-typescript-reviewer
  - security-sentinel
  - code-simplicity-reviewer
  - architecture-strategist
---

# Zinqq compound-engineering conventions

## Todo lifecycle: `cancelled` is a Zinqq-local terminal status

The canonical `file-todos` skill defines `pending → ready → complete`. Zinqq adds a fourth, terminal status — `cancelled` — for todos that became moot before being worked (e.g. tied to an integration we removed before completion). Treat `cancelled` as a synonym of `complete` for listing/triage purposes:

- Filename pattern: `{id}-cancelled-{priority}-{slug}.md`, frontmatter `status: cancelled`.
- `/triage` and `/resolve_todo_parallel` should ignore `*-cancelled-*` files (same as `*-complete-*`).
- The body of a cancelled todo retains its full context plus a trailing `## Cancelled` section explaining what made it moot. Re-opening means renaming back to `pending` and clearing that section.
