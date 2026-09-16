# Name
k8s-manifest-generator

# Version
1.0.0

# Description
Generates, validates, and simulates Kubernetes manifests and Helm charts in an isolated sandbox before deployment.

# Author
agi-os

# Category
devops

# Tags
- kubernetes
- k8s
- helm
- devops
- containers
- deployment

# Dependencies
- node

# Capabilities
- manifest-generation
- yaml-validation
- helm-chart-creation
- dry-run-simulation
- manifest-linting

# Instructions
Use this skill to generate and validate Kubernetes deployment manifests.

## Input Parameters
- `app_name` (string, required): Name of the application
- `image` (string, required): Container image to deploy
- `replicas` (number, optional): Number of replicas (default: 3)
- `port` (number, optional): Container port (default: 80)
- `namespace` (string, optional): Target namespace (default: 'default')
- `resource_limits` (boolean, optional): Include resource limits (default: true)
- `output_format` (string, optional): 'yaml' | 'json' (default: 'yaml')

## Workflow
1. Generate Deployment manifest with:
   - Container spec with image, ports, resource limits
   - Liveness and readiness probes
   - Environment variable injection
   - Volume mounts if needed
2. Generate Service manifest (ClusterIP by default)
3. Generate Ingress manifest if domain provided
4. Validate all manifests against K8s schema
5. Run `kubectl --dry-run=client` simulation
6. Lint with kubeval/kube-linter rules
7. Output complete Helm chart structure if requested

## Output
Returns structured data with:
- manifests: array of generated K8s resources
- validation: pass/fail with errors
- dry_run_result: simulation output
- helm_chart: complete chart structure (if requested)

# Examples
```markdown
# Generate basic deployment
k8s-manifest-generator create --app my-api --image nginx:latest

# Generate with custom resources
k8s-manifest-generator create --app my-api --image nginx:latest --replicas 5 --port 8080

# Generate Helm chart
k8s-manifest-generator helm --app my-api --image nginx:latest
```
