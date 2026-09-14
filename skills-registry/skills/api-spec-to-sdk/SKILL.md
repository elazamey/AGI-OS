# Name
api-spec-to-sdk

# Version
1.0.0

# Description
Generates typed Client SDKs from OpenAPI/Swagger specifications with built-in unit tests and documentation.

# Author
agi-os

# Category
automation

# Tags
- api
- openapi
- swagger
- sdk
- code-generation
- typescript
- python

# Dependencies
- node

# Capabilities
- openapi-parsing
- sdk-generation
- type-inference
- test-generation
- documentation-generation

# Instructions
Use this skill to auto-generate typed API clients from OpenAPI specifications.

## Input Parameters
- `spec_url` (string, required): URL or path to OpenAPI/Swagger spec
- `language` (string, optional): 'typescript' | 'python' (default: 'typescript')
- `output_dir` (string, optional): Output directory for generated SDK
- `generate_tests` (boolean, optional): Generate unit tests (default: true)
- `generate_docs` (boolean, optional): Generate API documentation (default: true)

## Workflow
1. Fetch and parse OpenAPI/Swagger specification
2. Extract:
   - All endpoints with methods and paths
   - Request/response schemas
   - Authentication schemes
   - Error responses
3. Generate TypeScript/Python client:
   - Typed interfaces for all schemas
   - HTTP client with proper serialization
   - Authentication handlers (Bearer, API Key, OAuth)
   - Error handling with typed errors
   - Retry logic with exponential backoff
4. Generate unit tests:
   - Mock server setup
   - Test for each endpoint
   - Edge case coverage
   - Error scenario tests
5. Generate documentation:
   - API reference with examples
   - Authentication guide
   - Error code reference

## Output Structure
```
sdk/
├── src/
│   ├── client.ts          # Main client class
│   ├── types.ts           # Generated interfaces
│   ├── endpoints/         # Endpoint implementations
│   └── auth/              # Authentication handlers
├── tests/
│   ├── client.test.ts     # Client tests
│   └── mocks/             # Mock data
├── docs/
│   └── api-reference.md   # Generated docs
└── package.json           # SDK package config
```

# Examples
```markdown
# Generate TypeScript SDK
api-spec-to-sdk generate --spec https://petstore3.swagger.io/api/v3/openapi.json --language typescript

# Generate with tests
api-spec-to-sdk generate --spec ./openapi.yaml --generate-tests --output-dir ./my-sdk

# Generate Python SDK
api-spec-to-sdk generate --spec ./api-spec.json --language python
```
