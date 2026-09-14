# file-writer
description: Write files to the filesystem with atomic operations
triggers: write, create, save, store

## Instructions
Use this skill to write content to files on the filesystem.

### Input Parameters
- `path` (string, required): Path to the file to write
- `content` (string, required): Content to write
- `mode` (string, optional): Write mode - 'overwrite' (default), 'append', 'atomic'

### Output
Returns operation status with file path and bytes written.

### Safety Rules
- Creates backup before overwriting existing files
- Uses atomic writes for critical operations
- Validates path to prevent directory traversal

### Examples
```javascript
// Write file
const result = await execute({ 
  path: '/home/user/file.txt',
  content: 'Hello World',
  mode: 'overwrite'
});

// Atomic write with backup
const result = await execute({ 
  path: '/home/user/config.json',
  content: JSON.stringify(config),
  mode: 'atomic'
});
```
