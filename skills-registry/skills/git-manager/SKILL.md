# git-manager
description: Manage git repositories with common operations
triggers: git, commit, push, pull, branch, merge, status

## Instructions
Use this skill to manage git repositories.

### Operations
- `status`: Show working tree status
- `commit`: Record changes to the repository
- `push`: Update remote refs along with associated objects
- `pull`: Fetch from and integrate with another repository
- `branch`: List, create, or delete branches
- `merge`: Join two or more development histories together
- `log`: Show commit logs
- `diff`: Show changes between commits

### Input Parameters
- `operation` (string, required): Git operation to perform
- `message` (string): Commit message (for commit)
- `branch` (string): Branch name (for branch operations)
- `remote` (string, optional): Remote name (default: origin)

### Safety Rules
- Never force push without explicit approval
- Always check status before commit
- Create backup branches before destructive operations

### Examples
```javascript
// Check status
const status = await execute({ operation: 'status' });

// Commit changes
const commit = await execute({ 
  operation: 'commit',
  message: 'feat: add new feature'
});

// Push to remote
const push = await execute({ 
  operation: 'push',
  remote: 'origin'
});
```
