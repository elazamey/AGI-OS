# file-search
description: Search files by name pattern or content with regex support
triggers: find, search, grep, locate, lookup

## Instructions
Use this skill to search for files or search within files.

### Operations
- `find`: Find files by name pattern
- `grep`: Search within file contents
- `locate`: Find files by extension
- `tree`: Show directory structure

### Input Parameters
- `operation` (string, required): Search operation
- `pattern` (string, required): Search pattern (glob for find, regex for grep)
- `path` (string, optional): Directory to search in (default: current)
- `extension` (string, optional): Filter by file extension
- `recursive` (boolean, optional): Search recursively (default: true)

### Features
- Glob pattern matching for file names
- Regex support for content search
- Recursive directory traversal
- Results with line numbers

### Examples
```javascript
// Find files by pattern
const files = await execute({
  operation: 'find',
  pattern: '*.ts',
  path: './src'
});

// Search in file contents
const matches = await execute({
  operation: 'grep',
  pattern: 'TODO|FIXME',
  path: './src',
  extension: '.ts'
});

// Show directory tree
const tree = await execute({
  operation: 'tree',
  path: './src',
  depth: 3
});
```
