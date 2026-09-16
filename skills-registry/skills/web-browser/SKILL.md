# Name
web-browser

# Version
1.0.0

# Description
A skill that searches the web and browses pages using Playwright

# Author
agi-os

# Category
integration

# Tags
- web
- browser
- search
- playwright

# Dependencies
- playwright

# Capabilities
- search-web
- browse-page
- extract-content

# Instructions
Use this skill to search the web and browse pages.

## Input Parameters
- `action` (string, required): 'search' or 'browse'
- `query` (string): Search query (for search action)
- `url` (string): URL to browse (for browse action)
- `extract` (boolean, optional): Extract main content

## Output
Returns search results or page content.

# Examples
```javascript
// Search the web
const results = await execute({ 
  action: 'search',
  query: 'AGI operating system' 
});

// Browse a page
const content = await execute({ 
  action: 'browse',
  url: 'https://example.com',
  extract: true 
});
```
