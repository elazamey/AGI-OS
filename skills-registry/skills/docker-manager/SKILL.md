# docker-manager
description: Manage Docker containers, images, and compose stacks
triggers: docker, container, image, compose, run, build

## Instructions
Use this skill to manage Docker resources.

### Operations
- `list`: List containers or images
- `run`: Run a container
- `stop`: Stop a running container
- `start`: Start a stopped container
- `remove`: Remove a container
- `build`: Build an image from Dockerfile
- `compose-up`: Start services from docker-compose.yml
- `compose-down`: Stop and remove services

### Input Parameters
- `operation` (string, required): Docker operation to perform
- `name` (string): Container or image name
- `image` (string): Image name (for run)
- `ports` (string[]): Port mappings (for run)
- `volumes` (string[]): Volume mappings (for run)

### Safety Rules
- Never run containers with --privileged without approval
- Always use specific image tags, not latest
- Check for existing containers before creating new ones

### Examples
```javascript
// List running containers
const containers = await execute({ operation: 'list' });

// Run a container
const container = await execute({
  operation: 'run',
  image: 'node:18-alpine',
  name: 'my-app',
  ports: ['3000:3000']
});

// Compose up
const compose = await execute({
  operation: 'compose-up',
  path: './docker-compose.yml'
});
```
