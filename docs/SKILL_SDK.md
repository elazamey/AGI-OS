# AGI-OS Community Skill SDK

A comprehensive guide for external developers to create, test, and publish skills for the AGI-OS ecosystem.

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Skill Structure](#skill-structure)
- [SKILL.md Format](#skillmd-format)
- [Development Workflow](#development-workflow)
- [Testing Skills](#testing-skills)
- [Publishing Skills](#publishing-skills)
- [Best Practices](#best-practices)

---

## Overview

AGI-OS uses a dynamic skill discovery system where skills are defined in `SKILL.md` files. The agent discovers and loads skills at runtime from the GitHub Skills Registry.

### What is a Skill?

A skill is a self-contained capability that:
- Has a clear purpose and description
- Defines triggers for automatic discovery
- Provides instructions for the LLM
- Can be tested independently
- Is version-controlled

### Why Create Skills?

- **Extend AGI-OS capabilities** without modifying core code
- **Share with the community** via the Skills Registry
- **Monetize** premium skills (coming soon)
- **Build a reputation** as a contributor

---

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Git installed
- GitHub account
- Basic understanding of markdown

### Quick Start

1. **Fork the Skills Registry**
   ```bash
   # Fork https://github.com/elazamey/skills-registry
   git clone https://github.com/YOUR_USERNAME/skills-registry.git
   cd skills-registry
   ```

2. **Create your skill directory**
   ```bash
   mkdir skills/my-awesome-skill
   cd skills/my-awesome-skill
   ```

3. **Create SKILL.md**
   ```markdown
   # my-awesome-skill
   description: Does something amazing
   triggers: amazing, awesome, cool

   ## Instructions
   Use this skill to do amazing things.
   ```

4. **Test locally**
   ```bash
   cd ../../
   pnpm test
   ```

5. **Submit PR**
   ```bash
   git add .
   git commit -m "feat: add my-awesome-skill"
   git push
   # Create PR on GitHub
   ```

---

## Skill Structure

### Directory Layout

```
skills/
├── my-skill/
│   ├── SKILL.md           # Required: Skill definition
│   ├── README.md          # Optional: Documentation
│   ├── index.js           # Optional: Implementation
│   ├── package.json       # Optional: Dependencies
│   └── tests/
│       └── test.js        # Optional: Tests
```

### Required Files

| File | Purpose | Required |
|------|---------|----------|
| `SKILL.md` | Skill definition and instructions | Yes |

### Optional Files

| File | Purpose | Required |
|------|---------|----------|
| `README.md` | Human-readable documentation | No |
| `index.js` | JavaScript implementation | No |
| `package.json` | Node.js dependencies | No |
| `tests/` | Test files | No |

---

## SKILL.md Format

### Template

```markdown
# skill-name
description: Brief description of what the skill does
triggers: trigger1, trigger2, trigger3

## Instructions

Detailed instructions for the LLM on how to use this skill.

### Input Parameters

- `param1` (type, required/optional): Description
- `param2` (type, required/optional): Description

### Output

Description of what the skill returns.

### Safety Rules

- Rule 1
- Rule 2

### Examples

\`\`\`javascript
// Example usage
const result = await execute({ param1: 'value' });
\`\`\`
```

### Required Fields

| Field | Format | Description |
|-------|--------|-------------|
| Name | `# skill-name` | Unique identifier (kebab-case) |
| Description | `description: text` | Brief description |
| Triggers | `triggers: list` | Comma-separated keywords |
| Instructions | `## Instructions` | LLM instructions |

### Optional Fields

| Field | Format | Description |
|-------|--------|-------------|
| Input Parameters | `### Input Parameters` | Parameter documentation |
| Output | `### Output` | Return value documentation |
| Safety Rules | `### Safety Rules` | Security guidelines |
| Examples | `### Examples` | Code examples |
