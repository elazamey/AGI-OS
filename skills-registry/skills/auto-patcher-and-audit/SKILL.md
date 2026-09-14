# Name
auto-patcher-and-audit

# Version
1.0.0

# Description
Scans package dependencies for vulnerabilities and automatically applies non-breaking security updates with full test verification.

# Author
agi-os

# Category
security

# Tags
- security
- audit
- patch
- dependencies
- npm
- vulnerabilities

# Dependencies
- npm
- node

# Capabilities
- dependency-scan
- vulnerability-detection
- auto-patch
- test-verification
- rollback-support

# Instructions
Use this skill to scan and patch security vulnerabilities in project dependencies.

## Input Parameters
- `project_path` (string, required): Path to the project root containing package.json
- `package_manager` (string, optional): 'npm' | 'yarn' | 'pnpm' (default: 'npm')
- `dry_run` (boolean, optional): If true, only report vulnerabilities without patching
- `scope` (string, optional): 'production' | 'all' (default: 'all')

## Workflow
1. Run `npm audit --json` to scan for vulnerabilities
2. Classify vulnerabilities by severity: critical, high, moderate, low
3. For non-breaking updates (patch/minor): auto-apply via `npm audit fix`
4. For breaking updates (major): report only, require manual approval
5. Run full test suite after patching to verify no regressions
6. Record all changes in Rollback Ledger with .bak files
7. Generate audit report with before/after dependency tree

## Output
Returns structured report with:
- vulnerabilities_found: count by severity
- patches_applied: list of updated packages
- test_results: pass/fail status
- rollback_available: boolean

# Examples
```markdown
# Scan only (no changes)
auto-patcher scan --project ./my-app

# Auto-patch with verification
auto-patcher patch --project ./my-app --dry-run false

# Scan production dependencies only
auto-patcher scan --scope production
```
