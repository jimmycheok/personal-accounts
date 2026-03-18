# /sonarqube-review

Analyse the project with SonarQube MCP, fix code quality issues in `apps/`, and update `docs/sonarqube.md` with a full review summary.

## Steps

### 1. Discover the SonarQube project key

Use `mcp__sonarqube__search_my_sonarqube_projects` to list all projects.
Identify the project key that corresponds to this repository (personal-accountant).

### 2. Fetch quality gate status

Use `mcp__sonarqube__get_project_quality_gate_status` with the project key.
Record overall pass/fail and any failed conditions.

### 3. Fetch all open issues

Use `mcp__sonarqube__search_sonar_issues_in_projects` with the project key.
Request all severities: BLOCKER, CRITICAL, MAJOR, MINOR, INFO.
Paginate until all issues are collected.

For each issue record:
- `key`, `rule`, `severity`, `component` (file path), `line`, `message`, `type` (BUG / VULNERABILITY / CODE_SMELL)

### 4. Fetch security hotspots

Use `mcp__sonarqube__search_security_hotspots` with the project key.
For each hotspot use `mcp__sonarqube__show_security_hotspot` to get full details.

### 5. Fetch component measures

Use `mcp__sonarqube__get_component_measures` to retrieve:
- `bugs`, `vulnerabilities`, `code_smells`
- `coverage`, `duplicated_lines_density`
- `reliability_rating`, `security_rating`, `sqale_rating`

### 6. Check for duplications

Use `mcp__sonarqube__search_duplicated_files` to find files with significant duplication.

### 7. Read and fix issues in `apps/`

For each issue or hotspot located inside `apps/api/` or `apps/web/`:

1. Read the file at the reported path and line.
2. Understand the rule — use `mcp__sonarqube__show_rule` if the fix is non-obvious.
3. Apply the minimal correct fix using the Edit tool.
4. Do NOT refactor beyond what the issue requires.
5. Skip issues in `node_modules/`, `dist/`, or generated files.
6. Skip issues you cannot safely fix (e.g. require architectural decisions) — note them as "Manual review required" in the summary.

Fix priority order: BLOCKER → CRITICAL → MAJOR → MINOR.

### 8. Write / update `docs/sonarqube.md`

Create or overwrite `docs/sonarqube.md` with the structure below.
Use the actual data collected in steps 2–6 and the fixes applied in step 7.

```markdown
# SonarQube Code Quality Review

**Project:** <project key>
**Reviewed:** YYYY-MM-DD
**Quality Gate:** PASSED / FAILED

## Metrics Snapshot

| Metric | Value |
|---|---|
| Bugs | N |
| Vulnerabilities | N |
| Code Smells | N |
| Coverage | N% |
| Duplication | N% |
| Reliability Rating | A–E |
| Security Rating | A–E |
| Maintainability Rating | A–E |

## Quality Gate Conditions

List each condition, its threshold, and whether it passed or failed.

## Issues Fixed

| Severity | File | Line | Rule | Description | Fix Applied |
|---|---|---|---|---|---|
| BLOCKER | path/to/file.js | 42 | squid:S2077 | SQL injection risk | Parameterised query |
| ... | | | | | |

## Security Hotspots

| Status | File | Line | Category | Description |
|---|---|---|---|---|

## Issues Requiring Manual Review

| Severity | File | Line | Rule | Reason not auto-fixed |
|---|---|---|---|---|

## Duplicated Files

| File | Duplicated Lines (%) |
|---|---|

## Recommendations

Bullet-point list of systemic improvements suggested by the findings (e.g. "Add unit tests to reach coverage threshold", "Extract duplicated validation logic into a shared utility").
```

### 9. Commit the changes

Stage all modified source files and `docs/sonarqube.md`.
Commit with:

```
fix: sonarqube code quality review — <date>
```

Do NOT push unless the user asks.
