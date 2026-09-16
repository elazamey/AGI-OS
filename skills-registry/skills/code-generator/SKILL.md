# Name
code-generator

# Version
1.0.0

# Description
A skill that generates code in various programming languages

# Author
agi-os

# Category
automation

# Tags
- code
- generation
- programming

# Dependencies
- none

# Capabilities
- generate-code
- refactor-code
- explain-code

# Instructions
Use this skill to generate, refactor, or explain code.

## Input Parameters
- `action` (string, required): 'generate', 'refactor', or 'explain'
- `language` (string): Programming language (for generate)
- `description` (string): Code description (for generate)
- `code` (string): Code to refactor or explain

## Output
Returns generated, refactored, or explained code.

# Examples
```javascript
// Generate code
const code = await execute({ 
  action: 'generate',
  language: 'typescript',
  description: 'function to sort array'
});

// Refactor code
const refactored = await execute({ 
  action: 'refactor',
  code: 'old code here'
});

// Explain code
const explanation = await execute({ 
  action: 'explain',
  code: 'code to explain'
});
```
