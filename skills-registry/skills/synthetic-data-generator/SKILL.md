# Name
synthetic-data-generator

# Version
1.0.0

# Description
Generates realistic synthetic datasets for testing, stress testing, and evaluation with configurable schemas and edge cases.

# Author
agi-os

# Category
data

# Tags
- data
- synthetic
- testing
- mock
- generators
- edge-cases

# Dependencies
- node

# Capabilities
- schema-based-generation
- edge-case-creation
- stress-test-data
- format-validation
- dataset-export

# Instructions
Use this skill to generate synthetic test data for evaluation and stress testing.

## Input Parameters
- `schema` (object, required): Data schema definition with field types and constraints
- `count` (number, optional): Number of records to generate (default: 100)
- `format` (string, optional): 'json' | 'csv' | 'sql' (default: 'json')
- `edge_cases` (boolean, optional): Include edge cases (default: true)
- `seed` (number, optional): Random seed for reproducibility

## Schema Format
```json
{
  "fields": [
    { "name": "id", "type": "uuid" },
    { "name": "name", "type": "string", "faker": "person.fullName" },
    { "name": "email", "type": "email" },
    { "name": "age", "type": "number", "min": 0, "max": 120 },
    { "name": "status", "type": "enum", "values": ["active", "inactive", "pending"] },
    { "name": "created_at", "type": "datetime", "past": true }
  ]
}
```

## Supported Types
- uuid: Random UUID v4
- string: Random string with length control
- email: Valid email addresses
- number: Integer or float with min/max
- boolean: Random true/false
- enum: Random from predefined values
- datetime: Random timestamps
- array: Random arrays with configurable length
- object: Nested objects

## Edge Cases Generated
- Empty strings and null values
- Boundary values (min/max numbers)
- Unicode and special characters
- Very long strings
- Duplicate values for uniqueness testing
- Invalid formats for error handling tests

## Workflow
1. Parse and validate schema definition
2. Generate base dataset according to types
3. Apply constraints and relationships
4. Inject edge cases at configurable percentage (10% default)
5. Validate all generated data against schema
6. Export in requested format
7. Generate dataset statistics

## Output
Returns:
- data: generated records
- metadata: generation statistics
- validation: schema compliance report
- statistics: field distributions and summaries

# Examples
```markdown
# Generate 1000 user records
synthetic-data-generator create --schema user-schema.json --count 1000

# Generate stress test data
synthetic-data-generator stress --schema api-schema.json --count 100000 --format csv

# Generate edge cases only
synthetic-data-generator edges --schema input-schema.json --count 50
```
