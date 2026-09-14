# Name
test-runner

# Version
1.0.0

# Description
A skill that runs tests and generates reports

# Author
agi-os

# Category
automation

# Tags
- testing
- automation
- reports

# Dependencies
- vitest

# Capabilities
- run-tests
- generate-report
- analyze-coverage

# Instructions
Use this skill to run tests and generate reports.

## Input Parameters
- `action` (string, required): 'run', 'report', or 'coverage'
- `pattern` (string): Test file pattern
- `coverage` (boolean, optional): Generate coverage report

## Output
Returns test results or reports.

# Examples
```javascript
// Run tests
const results = await execute({ 
  action: 'run',
  pattern: '**/*.test.ts'
});

// Generate report
const report = await execute({ 
  action: 'report',
  results: testResults
});

// Analyze coverage
const coverage = await execute({ 
  action: 'coverage'
});
```
