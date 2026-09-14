# Name
file-reader

# Version
1.0.0

# Description
A skill that reads files from the filesystem with support for various formats

# Author
agi-os

# Category
utility

# Tags
- file
- read
- filesystem
- io

# Dependencies
- none

# Capabilities
- read-file
- list-directory
- get-file-info

# Instructions
Use this skill to read files from the filesystem.

## Input Parameters
- `path` (string, required): Path to the file or directory
- `encoding` (string, optional): File encoding (default: 'utf8')
- `recursive` (boolean, optional): For directories, list recursively

## Output
Returns file contents or directory listing.

# Examples
```javascript
// Read a file
const content = await execute({ 
  path: '/home/user/document.txt' 
});

// List directory
const files = await execute({ 
  path: '/home/user/documents',
  recursive: true 
});
```
