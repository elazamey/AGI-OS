# api-caller
description: Call REST APIs and handle responses with retry logic
triggers: api, http, request, rest, fetch, call

## Instructions
Use this skill to make HTTP requests to REST APIs.

### Operations
- `get`: GET request
- `post`: POST request
- `put`: PUT request
- `patch`: PATCH request
- `delete`: DELETE request

### Input Parameters
- `operation` (string, required): HTTP method
- `url` (string, required): Request URL
- `headers` (object, optional): Request headers
- `body` (object, optional): Request body (for POST/PUT/PATCH)
- `timeout` (number, optional): Request timeout in ms (default: 30000)
- `retries` (number, optional): Number of retries (default: 3)

### Features
- Automatic retry with exponential backoff
- Request/response logging
- Timeout handling
- JSON parsing

### Examples
```javascript
// GET request
const response = await execute({
  operation: 'get',
  url: 'https://api.example.com/data',
  headers: { 'Authorization': 'Bearer token' }
});

// POST request
const response = await execute({
  operation: 'post',
  url: 'https://api.example.com/data',
  body: { name: 'test' }
});
```
