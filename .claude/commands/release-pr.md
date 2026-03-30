# /release-pr

Create a versioned release branch, write the release log, update docs, and open a GitHub PR.

## Steps

### 1. Determine the version

Read `docs/releases/` to find the latest release file (e.g. `v1.2.md`). Increment the **patch** version by default (v1.2 → v1.3). If the user passed an argument (e.g. `/release-pr v2.0`), use that version instead.

Set `BRANCH=release/vX.Y` and `VERSION=vX.Y`.

### 2. Collect all unreleased changes

Run `git log <last-release-tag-or-commit>..HEAD --oneline` to list commits since the last release. If there is no tag, diff against the previous release commit referenced in the latest release file.

Also run `git diff <base>..HEAD --name-only` to list every changed file.

### 3. Review changed files and update docs

For each changed file, read it and determine whether it introduces a **specification change** worth recording (new model field, renamed field, changed API contract, new route, new env var, removed feature, behaviour change).

- If spec changes are found: append them to the **"Specification Corrections"** section in `docs/development-plan.md` (create the section if it doesn't exist).
- Also note them in the release file under a "Spec Changes" heading.

### 4. Create the release branch

```bash
git checkout -b release/vX.Y
```

### 5. Write the release log

Create `docs/releases/vX.Y.md` with this structure:

```markdown
# Release vX.Y — <short title>

**Date:** YYYY-MM-DD
**Branch:** release/vX.Y
**Base commit:** <hash>

## Summary
<2–4 sentence overview of what this release covers>

## New Files
| File | Description |
|---|---|

## Changed Files
| File | What changed |
|---|---|

## Bug Fixes
| Area | Fix |
|---|---|

## Spec Changes
Document any API contracts, model fields, or behaviour that changed from the previous documented spec.

## Upgrade Notes
Any steps needed when pulling this release (new env vars, migrations, etc.)
```

Populate every table from your analysis of the git diff.

### 6. Update README.md

Read the full `README.md` and compare it against the changes in this release. Update **every section** that is affected by the diff — not just the Releases table. Specifically check and amend:

- **"What it does"** — if a new feature was added, a feature was changed, or a capability was removed, update the relevant bullet or add a new one under the correct subsection. Do not add a subsection for trivial fixes.
- **"Screens" table** — if new routes/pages were added or existing routes changed, update the table.
- **"Repository layout"** — if new top-level directories, notable new files, or structural changes were introduced, reflect them in the tree.
- **"Tech stack" table** — if a new technology was introduced or an existing one was replaced/upgraded.
- **"Scheduled background jobs" table** — if jobs were added, removed, or their schedules changed.
- **"Supporting Tools"** — if new tools were added or existing ones got significant new capabilities.
- **"Malaysian compliance notes"** — if any tax, LHDN, or regulatory behaviour changed.
- **"Roadmap"** — if a previously listed roadmap item was completed in this release, check the box (`[x]`). If the release introduces a new known gap, add it.
- **"Releases" table** — add a row for the new version at the top of the table:

```markdown
| [vX.Y](docs/releases/vX.Y.md) | YYYY-MM-DD | <summary> |
```

Also fix any outdated information you noticed while reviewing the diff (e.g. wrong start command, stale counts like "24 tables" or "21 route files", incorrect descriptions).

### 7. Commit

Stage and commit **only** the docs changes on the release branch:

```
docs: release vX.Y — <short title>
```

Push the branch.

### 8. Create the PR via GitHub MCP

Use the `mcp__github__create_pull_request` tool with:
- `owner`: extract from `git remote get-url origin`
- `repo`: extract from the remote URL
- `head`: `release/vX.Y`
- `base`: `main`
- `title`: `release: vX.Y — <short title>`
- `body`: full PR description including Summary, New Files, Changed Files, Bug Fixes, Spec Changes, Upgrade Notes tables

The PR body must end with:
```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```
