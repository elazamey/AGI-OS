# Name
playwright-browser-agent

# Version
1.0.0

# Description
Advanced browser automation with Playwright for complex form filling, dynamic DOM navigation, and structured data extraction.

# Author
agi-os

# Category
automation

# Tags
- browser
- playwright
- automation
- scraping
- forms
- data-extraction

# Dependencies
- node
- playwright

# Capabilities
- form-filling
- dynamic-navigation
- data-extraction
- screenshot-capture
- pdf-generation
- multi-tab-management

# Instructions
Use this skill for complex browser automation tasks beyond basic web browsing.

## Input Parameters
- `task` (string, required): Description of browser task
- `url` (string, required): Starting URL
- `selectors` (object, optional): CSS selectors for target elements
- `wait_for` (string, optional): Selector or event to wait for
- `extract` (boolean, optional): Extract data to JSON (default: false)
- `screenshot` (boolean, optional): Capture screenshot (default: false)

## Workflow
1. Launch Playwright browser (Chromium) in headless mode
2. Navigate to target URL with configurable wait strategies
3. Handle:
   - Dynamic content loading (infinite scroll, lazy loading)
   - Multi-step forms with validation
   - Shadow DOM elements
   - iframe content
   - Cookie/session management
4. For form filling:
   - Map form fields to input data
   - Handle file uploads
   - Process CAPTCHA challenges (manual intervention required)
   - Submit and verify success
5. For data extraction:
   - Parse DOM structure into JSON
   - Handle paginated content
   - Extract tables and lists
   - Clean and normalize data
6. Generate structured output with metadata

## Output Format
```json
{
  "success": true,
  "url": "https://example.com/result",
  "data": { ... },
  "screenshots": ["path/to/screenshot.png"],
  "duration_ms": 2340
}
```

## Safety Rules
- Respect robots.txt
- Rate limit requests (1 req/sec default)
- Never submit forms without explicit approval
- Log all actions for audit trail

# Examples
```markdown
# Extract data from table
playwright-browser-agent extract --url https://example.com/data --selector table#results

# Fill multi-step form
playwright-browser-agent fill --url https://example.com/checkout --form-data '{"name":"John","email":"john@example.com"}'

# Take screenshot of page
playwright-browser-agent screenshot --url https://example.com --wait-for ".loaded"
```
