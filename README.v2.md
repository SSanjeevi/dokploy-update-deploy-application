# Dokploy Deploy Application - GitHub Action

**Version**: 2.0.0  
**Comprehensive Dokploy deployment automation with full lifecycle management**

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-Dokploy%20Deploy-blue?logo=github)](https://github.com/marketplace/actions/dokploy-deploy-application)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Overview

This GitHub Action provides **complete Dokploy deployment lifecycle management**, eliminating the need for complex, multi-step deployment workflows. It handles everything from project creation to health checks in a single action call.

### What's New in v2.0

- ✅ **Automatic Resource Management**: Auto-create projects, environments, and applications
- ✅ **Server Resolution**: Find servers by name or ID
- ✅ **Domain & SSL**: Automatic Let's Encrypt SSL certificate generation
- ✅ **Environment Variables**: Multiple input formats (multiline, JSON, file)
- ✅ **Health Checks**: Configurable health verification after deployment
- ✅ **Scaling Support**: Auto-scaling with min/max replicas
- ✅ **Debug Mode**: Comprehensive logging for troubleshooting
- ✅ **Error Handling**: Detailed error messages and validation

### Workflow Simplification

**Before v2.0**: 3000+ lines of complex deployment logic  
**After v2.0**: ~50 lines using this action  
**Maintenance**: Centralized logic, version updates in one place

---

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Inputs Reference](#inputs-reference)
- [Outputs](#outputs)
- [Usage Examples](#usage-examples)
  - [Minimal Configuration](#minimal-configuration)
  - [Full Production Configuration](#full-production-configuration)
- [Migration Guide](#migration-guide)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## 🎯 Quick Start

### Minimal Configuration

```yaml
- name: Deploy to Dokploy
  uses: patrikjokhel/dokploy-update-deploy-application@v2
  with:
    dokploy-url: ${{ secrets.DOKPLOY_URL }}
    api-key: ${{ secrets.DOKPLOY_API_TOKEN }}
    docker-image: 'ghcr.io/myuser/myapp:latest'
    environment-name: 'production'
```

That's it! The action will automatically:
- Create/find the project
- Create/find the environment
- Create/find the application
- Configure Docker image
- Deploy the application
- Verify health

---

## 📚 Inputs Reference

### Core Configuration (Required)

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `dokploy-url` | ✅ | - | URL of your Dokploy instance (e.g., `https://dokploy.example.com`) |
| `api-key` | ✅ | - | Dokploy API authentication key |
| `docker-image` | ✅ | - | Docker image to deploy (e.g., `ghcr.io/user/app:v1.0.0`) |

### Project & Environment

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `project-id` | ❌ | - | Existing project ID (will create/find if not provided) |
| `project-name` | ❌ | - | Project name for creation or lookup |
| `project-description` | ❌ | "Automated deployment project" | Project description |
| `environment-id` | ❌ | - | Existing environment ID |
| `environment-name` | ❌ | `production` | Environment name (staging/production/development) |
| `auto-create-resources` | ❌ | `true` | Auto-create project/environment if not found |

### Application

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `application-id` | ❌ | - | Existing application ID |
| `application-name` | ❌ | - | Application name (required if creating new) |
| `application-title` | ❌ | - | Human-readable title |
| `application-description` | ❌ | - | Application description |
| `container-name` | ❌ | - | Custom container name (e.g., `v1-0-0-stg-api`) |

### Server

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `server-id` | ❌ | - | Server ID for deployment |
| `server-name` | ❌ | - | Server name (will lookup ID automatically) |

### Container Resources

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `memory-limit` | ❌ | `512` | Memory limit in MB |
| `memory-reservation` | ❌ | - | Memory reservation in MB |
| `cpu-limit` | ❌ | `500` | CPU limit in millicores (500 = 0.5 CPU) |
| `cpu-reservation` | ❌ | - | CPU reservation in millicores |
| `port` | ❌ | `8080` | Internal container port |
| `target-port` | ❌ | `8080` | External exposed port |
| `restart-policy` | ❌ | `unless-stopped` | Container restart policy |

### Scaling

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `replicas` | ❌ | `1` | Number of replicas |
| `min-replicas` | ❌ | - | Minimum replicas for auto-scaling |
| `max-replicas` | ❌ | - | Maximum replicas for auto-scaling |
| `enable-auto-scaling` | ❌ | `false` | Enable auto-scaling |

### Docker Registry

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `registry-url` | ❌ | `ghcr.io` | Docker registry URL |
| `registry-username` | ❌ | - | Registry authentication username |
| `registry-password` | ❌ | - | Registry authentication password/token |

### Environment Variables

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `env` | ❌ | - | Multiline environment variables (`VAR1=value1\nVAR2=value2`) |
| `env-file` | ❌ | - | Path to .env file |
| `env-from-json` | ❌ | - | Environment variables as JSON object |

### Domain & SSL

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `domain-host` | ❌ | - | Domain host (e.g., `api.example.com`) |
| `domain-path` | ❌ | `/` | Domain path prefix |
| `domain-port` | ❌ | - | Domain port (defaults to target-port) |
| `domain-https` | ❌ | `true` | Enable HTTPS |
| `ssl-certificate-type` | ❌ | `letsencrypt` | SSL certificate type (letsencrypt/custom/none) |
| `domain-strip-path` | ❌ | `false` | Strip path prefix when forwarding |
| `force-domain-recreation` | ❌ | `false` | Force recreate domain |

### Deployment Control

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `deployment-title` | ❌ | - | Deployment title |
| `deployment-description` | ❌ | - | Deployment description |
| `rollback-active` | ❌ | `false` | Enable rollback functionality |
| `wait-for-deployment` | ❌ | `true` | Wait for deployment to complete |
| `deployment-timeout` | ❌ | `300` | Deployment timeout in seconds |
| `cleanup-old-containers` | ❌ | `false` | Stop old containers before deployment |

### Health Check

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `health-check-enabled` | ❌ | `true` | Enable health check verification |
| `health-check-url` | ❌ | `/health` | Health check endpoint path |
| `health-check-timeout` | ❌ | `60` | Health check timeout in seconds |
| `health-check-retries` | ❌ | `3` | Number of retries |
| `health-check-interval` | ❌ | `10` | Interval between retries in seconds |

### Debug & Logging

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `debug-mode` | ❌ | `false` | Enable debug logging |
| `log-api-requests` | ❌ | `false` | Log all API requests (requires debug-mode) |
| `log-api-responses` | ❌ | `false` | Log all API responses (requires debug-mode) |

---

## 📤 Outputs

| Output | Description |
|--------|-------------|
| `application-id` | The ID of the deployed application |
| `project-id` | The ID of the Dokploy project |
| `environment-id` | The ID of the environment |
| `server-id` | The ID of the deployment server |
| `deployment-url` | The URL of the deployed application (if domain configured) |
| `deployment-status` | The status of the deployment (success/failed/pending) |
| `health-check-status` | Health check status (healthy/unhealthy/skipped) |

---

## 💡 Usage Examples

### 1. Minimal Configuration

Perfect for simple deployments with default settings:

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy Application
        uses: patrikjokhel/dokploy-update-deploy-application@v2
        with:
          dokploy-url: ${{ secrets.DOKPLOY_URL }}
          api-key: ${{ secrets.DOKPLOY_API_TOKEN }}
          docker-image: 'ghcr.io/myorg/myapp:latest'
          environment-name: 'production'
```

### 2. Backend API Deployment (Full Configuration)

Complete example with all features enabled:

```yaml
jobs:
  deploy-api:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Deploy API to Staging
        uses: patrikjokhel/dokploy-update-deploy-application@v2
        with:
          # Core Configuration
          dokploy-url: ${{ secrets.DOKPLOY_STAGING_URL }}
          api-key: ${{ secrets.DOKPLOY_STAGING_API_TOKEN }}
          docker-image: 'ghcr.io/myorg/api:v1.0.0'
          
          # Project & Environment
          project-name: 'myapp-staging'
          environment-name: 'staging'
          auto-create-resources: 'true'
          
          # Application
          application-name: 'api-staging'
          container-name: 'v1-0-0-staging-api'
          
          # Server
          server-name: 'production-server-1'
          
          # Container Resources
          memory-limit: '1024'
          cpu-limit: '500'
          port: '8080'
          target-port: '8080'
          
          # Scaling
          replicas: '1'
          min-replicas: '1'
          max-replicas: '5'
          
          # Docker Registry (GitHub Container Registry)
          registry-url: 'ghcr.io'
          registry-username: ${{ github.repository_owner }}
          registry-password: ${{ secrets.GHCR_TOKEN }}
          
          # Environment Variables
          env: |
            APP_ENV=staging
            VERSION=v1.0.0
            DATABASE_URL=${{ secrets.DATABASE_URL }}
            API_KEY=${{ secrets.API_KEY }}
            JWT_SECRET=${{ secrets.JWT_SECRET }}
            REDIS_URL=${{ secrets.REDIS_URL }}
            STORAGE_BUCKET=${{ secrets.STORAGE_BUCKET }}
          
          # Domain & SSL
          domain-host: 'staging-api.example.com'
          domain-https: 'true'
          ssl-certificate-type: 'letsencrypt'
          
          # Deployment Control
          cleanup-old-containers: 'true'
          wait-for-deployment: 'true'
          deployment-timeout: '300'
          
          # Health Check
          health-check-enabled: 'true'
          health-check-url: '/health'
          health-check-timeout: '60'
          health-check-retries: '3'
```

### 3. Frontend Deployment (Static Site)

Example for frontend/static site deployment:

```yaml
jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy Frontend
        uses: patrikjokhel/dokploy-update-deploy-application@v2
        with:
          dokploy-url: ${{ secrets.DOKPLOY_PRODUCTION_URL }}
          api-key: ${{ secrets.DOKPLOY_PRODUCTION_API_TOKEN }}
          docker-image: 'ghcr.io/myorg/frontend:v1.0.0'
          
          # Project & Environment
          project-name: 'myapp-production'
          environment-name: 'production'
          
          # Application
          application-name: 'frontend-production'
          
          # Server
          server-name: 'production-server-1'
          
          # Container Resources (Lower for static sites)
          memory-limit: '256'
          cpu-limit: '150'
          port: '80'
          target-port: '8080'
          
          # Scaling
          replicas: '2'
          min-replicas: '1'
          max-replicas: '8'
          enable-auto-scaling: 'true'
          
          # Docker Registry
          registry-url: 'ghcr.io'
          registry-username: ${{ github.repository_owner }}
          registry-password: ${{ secrets.GHCR_TOKEN }}
          
          # Environment Variables (Minimal for pre-built static site)
          env: |
            NODE_ENV=production
            VERSION=v1.0.0
          
          # Domain & SSL
          domain-host: 'app.example.com'
          domain-https: 'true'
          ssl-certificate-type: 'letsencrypt'
          
          # Health Check
          health-check-enabled: 'true'
          health-check-url: '/'
          health-check-retries: '5'
```

### 4. Multi-Environment Deployment

Deploy to staging first, then production with approval:

```yaml
jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Deploy to Staging
        id: deploy-staging
        uses: patrikjokhel/dokploy-update-deploy-application@v2
        with:
          dokploy-url: ${{ secrets.DOKPLOY_STAGING_URL }}
          api-key: ${{ secrets.DOKPLOY_STAGING_API_TOKEN }}
          docker-image: ${{ needs.build.outputs.image }}
          project-name: 'myapp-staging'
          environment-name: 'staging'
          domain-host: 'staging.example.com'

  approve-production:
    runs-on: ubuntu-latest
    needs: deploy-staging
    environment: production-approval
    steps:
      - name: Manual Approval Gate
        run: echo "Staging deployment successful. Ready for production."

  deploy-production:
    runs-on: ubuntu-latest
    needs: approve-production
    environment: production
    steps:
      - name: Deploy to Production
        uses: patrikjokhel/dokploy-update-deploy-application@v2
        with:
          dokploy-url: ${{ secrets.DOKPLOY_PRODUCTION_URL }}
          api-key: ${{ secrets.DOKPLOY_PRODUCTION_API_TOKEN }}
          docker-image: ${{ needs.build.outputs.image }}
          project-name: 'myapp-production'
          environment-name: 'production'
          domain-host: 'example.com'
          memory-limit: '2048'
          cpu-limit: '1000'
          replicas: '3'
          min-replicas: '2'
          max-replicas: '10'
          enable-auto-scaling: 'true'
```

### 5. Using JSON Environment Variables

```yaml
- name: Deploy with JSON env vars
  uses: patrikjokhel/dokploy-update-deploy-application@v2
  with:
    dokploy-url: ${{ secrets.DOKPLOY_URL }}
    api-key: ${{ secrets.DOKPLOY_API_TOKEN }}
    docker-image: 'ghcr.io/myorg/myapp:latest'
    environment-name: 'production'
    
    # JSON format for environment variables
    env-from-json: |
      {
        "DATABASE_URL": "${{ secrets.DATABASE_URL }}",
        "API_KEY": "${{ secrets.API_KEY }}",
        "NODE_ENV": "production",
        "PORT": "8080"
      }
```

### 6. Debug Mode Enabled

Enable comprehensive logging for troubleshooting:

```yaml
- name: Deploy with Debug Logging
  uses: patrikjokhel/dokploy-update-deploy-application@v2
  with:
    dokploy-url: ${{ secrets.DOKPLOY_URL }}
    api-key: ${{ secrets.DOKPLOY_API_TOKEN }}
    docker-image: 'ghcr.io/myorg/myapp:latest'
    environment-name: 'development'
    
    # Debug configuration
    debug-mode: 'true'
    log-api-requests: 'true'
    log-api-responses: 'true'
```

---

## 🔄 Migration Guide

### From v1.0 to v2.0

**Before (v1.0)**: Required pre-existing application ID

```yaml
- uses: dokploy-update-deploy-application@v1
  with:
    dokploy-url: ${{ secrets.DOKPLOY_URL }}
    api-key: ${{ secrets.DOKPLOY_API_TOKEN }}
    application-id: 'abc123'  # ❌ Must exist beforehand
    docker-image: 'myimage:latest'
    env: 'VAR1=value1'
```

**After (v2.0)**: Automatically creates/finds all resources

```yaml
- uses: patrikjokhel/dokploy-update-deploy-application@v2
  with:
    dokploy-url: ${{ secrets.DOKPLOY_URL }}
    api-key: ${{ secrets.DOKPLOY_API_TOKEN }}
    docker-image: 'myimage:latest'
    project-name: 'my-project'      # ✅ Auto-created
    environment-name: 'production'  # ✅ Auto-created
    application-name: 'my-app'      # ✅ Auto-created
    env: 'VAR1=value1'
    domain-host: 'app.example.com'  # ✅ New: Auto SSL
```

### From Manual Workflows

**Before**: 3000+ lines of workflow logic

```yaml
# Complex multi-step workflow with manual API calls
jobs:
  setup-project:
    # 100+ lines of project management
  setup-environment:
    # 100+ lines of environment creation
  create-application:
    # 200+ lines of application configuration
  configure-docker:
    # 150+ lines of Docker provider setup
  configure-env-vars:
    # 100+ lines of environment variable handling
  configure-domain:
    # 200+ lines of domain and SSL setup
  deploy:
    # 100+ lines of deployment logic
  verify:
    # 100+ lines of health check verification
```

**After**: Single action call (~50 lines)

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: patrikjokhel/dokploy-update-deploy-application@v2
        with:
          dokploy-url: ${{ secrets.DOKPLOY_URL }}
          api-key: ${{ secrets.DOKPLOY_API_TOKEN }}
          docker-image: ${{ needs.build.outputs.image }}
          project-name: 'my-project'
          environment-name: 'production'
          application-name: 'my-app'
          server-name: 'my-server'
          domain-host: 'app.example.com'
          memory-limit: '1024'
          cpu-limit: '500'
          env: ${{ secrets.APP_ENV_VARS }}
```

**Benefits**:
- ✅ 98% reduction in workflow code
- ✅ Centralized logic and updates
- ✅ Better error handling
- ✅ Consistent behavior across projects
- ✅ Easier maintenance

---

## 🔧 Troubleshooting

### Common Issues

#### 1. Authentication Failed

```
Error: POST /api/project.all failed with status 401
```

**Solution**: Verify your Dokploy API key is correct and has sufficient permissions.

```yaml
# Ensure secret is set correctly
api-key: ${{ secrets.DOKPLOY_API_TOKEN }}
```

#### 2. Server Not Found

```
Error: Server "MyServer" not found
```

**Solution**: Check the exact server name in Dokploy dashboard.

```yaml
# Enable debug mode to see all available servers
debug-mode: 'true'
server-name: 'Exact-Server-Name'  # Case-sensitive!
```

#### 3. Domain Already Exists

```
Error: Domain creation failed with status 409
```

**Solution**: This is usually normal on subsequent deployments. Use force-domain-recreation if needed.

```yaml
domain-host: 'api.example.com'
force-domain-recreation: 'false'  # Keep existing domain
```

#### 4. Health Check Failing

```
Health check failed after 3 attempts
```

**Solution**: Adjust health check parameters or verify your application exposes the health endpoint.

```yaml
health-check-url: '/health'  # Make sure this endpoint exists
health-check-timeout: '120'  # Increase timeout
health-check-retries: '5'    # More retries
health-check-interval: '15'  # Longer wait between retries
```

#### 5. Memory/CPU Limits

```
Error: memory-limit must be a valid number
```

**Solution**: Use numbers only (no units) for memory (MB) and CPU (millicores).

```yaml
memory-limit: '1024'  # ✅ Correct (1024 MB)
memory-limit: '1GB'   # ❌ Wrong (use number only)
cpu-limit: '500'      # ✅ Correct (500 millicores = 0.5 CPU)
cpu-limit: '500m'     # ✅ Also works (m suffix is handled)
```

### Debug Mode

Enable comprehensive logging to diagnose issues:

```yaml
- uses: patrikjokhel/dokploy-update-deploy-application@v2
  with:
    # ... your configuration ...
    debug-mode: 'true'
    log-api-requests: 'true'
    log-api-responses: 'true'
```

This will show:
- 🐛 Detailed debug messages
- 📤 All API requests (with sanitized secrets)
- 📥 All API responses
- ✅ Step-by-step progress

---

## 📊 Comparison: v1 vs v2

| Feature | v1.0 | v2.0 |
|---------|------|------|
| **Project Management** | ❌ | ✅ Auto-create/find |
| **Environment Management** | ❌ | ✅ Auto-create/find |
| **Server Selection** | ❌ | ✅ By name or ID |
| **Application Creation** | ❌ | ✅ Auto-create |
| **Docker Configuration** | ⚠️ Basic | ✅ Complete |
| **Environment Variables** | ✅ Basic | ✅ Multiple formats |
| **Domain & SSL** | ❌ | ✅ Auto Let's Encrypt |
| **Health Checks** | ❌ | ✅ Configurable |
| **Auto-scaling** | ⚠️ Basic | ✅ Advanced |
| **Cleanup** | ❌ | ✅ Optional |
| **Debug Mode** | ❌ | ✅ Comprehensive |
| **Error Handling** | ⚠️ Basic | ✅ Detailed |

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Make changes to `index.js`
4. Run tests: `npm test`
5. Build distribution: `npm run build`
6. Test locally before publishing

---

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙋 Support

- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Documentation**: [ANALYSIS.md](ANALYSIS.md) for detailed technical documentation

---

**Built for the Dokploy community**
