# AGI-OS Skills Registry

A dynamic skill registry for AGI-OS agents. This repository contains SKILL.md files that define capabilities for the AGI-OS system.

## How It Works

1. **Dynamic Discovery**: Agents fetch skills from this registry at runtime
2. **SKILL.md Format**: Each skill is defined in a standardized markdown format
3. **Capability Index**: Skills are indexed by capabilities, categories, and tags
4. **Hot Loading**: Skills can be loaded and executed without restart

## Skill Structure

```
skills/
├── file-reader/
│   ├── SKILL.md
│   └── index.js
├── web-browser/
│   ├── SKILL.md
│   └── index.js
├── code-generator/
│   ├── SKILL.md
│   └── index.js
└── ...
```

## SKILL.md Format

```markdown
# Name
skill-name

# Version
1.0.0

# Description
A brief description of what this skill does

# Author
author-name

# Category
utility | automation | analysis | integration

# Tags
- tag1
- tag2

# Dependencies
- dependency1

# Capabilities
- capability1
- capability2

# Instructions
Detailed instructions on how to use this skill

# Examples
```javascript
const result = await execute({ input: 'value' });
```
```

## Available Skills

| Skill | Category | Capabilities |
|-------|----------|--------------|
| file-reader | utility | read-file, list-directory |
| web-browser | integration | search-web, browse-page |
| code-generator | automation | generate-code, refactor |
| test-runner | automation | run-tests, generate-report |
| database-query | integration | query-db, manage-data |

## Contributing

1. Create a new directory under `skills/`
2. Add a `SKILL.md` file following the format above
3. Optionally add implementation code in `index.js`
4. Submit a pull request

## License

MIT
