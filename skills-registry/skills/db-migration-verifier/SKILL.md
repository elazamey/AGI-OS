# Name
db-migration-verifier

# Version
1.0.0

# Description
Validates database migration scripts, generates rollback plans, and tests migrations in isolated SQLite/Postgres sandboxes.

# Author
agi-os

# Category
data

# Tags
- database
- migration
- sql
- schema
- rollback
- drizzle
- prisma

# Dependencies
- node

# Capabilities
- migration-validation
- rollback-plan-generation
- dry-run-testing
- data-integrity-check
- schema-diff

# Instructions
Use this skill to verify database migrations before production deployment.

## Input Parameters
- `migration_path` (string, required): Path to migration files or schema definition
- `framework` (string, optional): 'drizzle' | 'prisma' | 'raw-sql' (default: 'raw-sql')
- `test_database` (string, optional): 'sqlite' | 'postgres' (default: 'sqlite')
- `dry_run` (boolean, optional): Run migration without applying (default: true)
- `generate_rollback` (boolean, optional): Generate rollback script (default: true)

## Workflow
1. Parse migration files and extract schema changes
2. Validate SQL syntax and schema compatibility
3. Detect potential data loss operations:
   - DROP TABLE/COLUMN without backup
   - TYPE changes that may lose data
   - NOT NULL constraints on existing data
4. Generate rollback script for each migration step
5. Create temporary test database (SQLite or Postgres)
6. Apply migration to test database
7. Verify:
   - All tables created correctly
   - Indexes applied
   - Constraints enforced
   - Data integrity maintained
8. Run rollback script to verify reversibility
9. Generate migration report with risk assessment

## Risk Levels
- LOW: Additive changes (new tables, columns with defaults)
- MEDIUM: Column type changes, index modifications
- HIGH: Drop operations, NOT NULL on existing data
- CRITICAL: Schema rewrite, data transformation

## Output
Returns structured report with:
- migration_valid: boolean
- risk_level: LOW | MEDIUM | HIGH | CRITICAL
- rollback_available: boolean
- data_loss_risk: boolean
- test_results: database test output

# Examples
```markdown
# Validate migration
db-migration-verifier validate --path ./migrations/001_add_users.sql

# Dry run with rollback generation
db-migration-verifier test --path ./migrations --dry-run --generate-rollback

# Drizzle schema migration
db-migration-verifier validate --path ./schema.ts --framework drizzle
```
