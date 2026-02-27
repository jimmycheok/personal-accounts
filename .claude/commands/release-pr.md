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

Add or update a **Releases** table in `README.md` under the Documentation section:

```markdown
## Releases

| Version | Date | Summary |
|---|---|---|
| [v1.2](docs/releases/v1.2.md) | 2026-02-27 | Modal forms, detail pages, attachments & bug fixes |
| [vX.Y](docs/releases/vX.Y.md) | YYYY-MM-DD | <summary> |
```

Also fix any outdated information in the README that you noticed while reviewing the diff (e.g. wrong start command, stale routes table).

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
