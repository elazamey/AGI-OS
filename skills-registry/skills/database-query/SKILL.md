# Name
database-query

# Version
1.0.0

# Description
A skill that queries and manages databases

# Author
agi-os

# Category
integration

# Tags
- database
- sql
- query
- data

# Dependencies
- sqlite3

# Capabilities
- query-database
- manage-schema
- export-data

# Instructions
Use this skill to query and manage databases.

## Input Parameters
- `action` (string, required): 'query', 'schema', or 'export'
- `database` (string, required): Database path or connection string
- `sql` (string): SQL query (for query action)
- `format` (string, optional): Export format (json, csv)

## Output
Returns query results or schema information.

# Examples
```javascript
// Query database
const results = await execute({ 
  action: 'query',
  database: '/path/to/db.sqlite',
  sql: 'SELECT * FROM users LIMIT 10'
});

// Get schema
const schema = await execute({ 
  action: 'schema',
  database: '/path/to/db.sqlite'
});

// Export data
const exported = await execute({ 
  action: 'export',
  database: '/path/to/db.sqlite',
  format: 'json'
});
```
