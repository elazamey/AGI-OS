# Name
secret-rotation-guard

# Version
1.0.0

# Description
Detects exposed, expired, or leaked API keys and secrets in codebases and automates secure rotation with encrypted storage.

# Author
agi-os

# Category
security

# Tags
- security
- secrets
- api-keys
- rotation
- encryption
- vault

# Dependencies
- node

# Capabilities
- secret-detection
- leak-scanning
- key-rotation
- encrypted-storage
- audit-logging

# Instructions
Use this skill to detect and rotate exposed secrets in development environments.

## Input Parameters
- `project_path` (string, required): Path to scan for secrets
- `scan_depth` (string, optional): 'shallow' | 'deep' (default: 'deep')
- `auto_rotate` (boolean, optional): Automatically rotate found secrets (default: false)
- `storage_backend` (string, optional): 'local-encrypted' | 'env-file' (default: 'local-encrypted')

## Workflow
1. Scan codebase for patterns: API keys, tokens, passwords, private keys
2. Check .gitignore for common secret files (.env, .pem, credentials.json)
3. Detect hardcoded secrets in source code via regex patterns
4. Check if secrets are in version control history
5. For each found secret:
   - Classify: active, expired, rotated, compromised
   - Generate new secret using crypto.randomBytes
   - Update all references in codebase
   - Store new secret in encrypted backend
   - Create backup of old configuration
6. Generate rotation report with affected files and timestamps

## Security Rules
- NEVER log or display secret values in output
- Always use encrypted storage, never plaintext
- Maintain audit trail of all rotations
- Support HashiCorp Vault integration (when available)

## Output
Returns structured report with:
- secrets_found: count and classification
- rotations_performed: list of rotated secrets
- files_modified: list of changed files
- backup_location: path to rollback data

# Examples
```markdown
# Scan for secrets (read-only)
secret-rotation-guard scan --project ./my-app

# Rotate with local encrypted storage
secret-rotation-guard rotate --project ./my-app --auto-rotate

# Scan deep (including git history)
secret-rotation-guard scan --scan-depth deep
```
