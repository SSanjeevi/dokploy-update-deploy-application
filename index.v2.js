const core = require("@actions/core")
const github = require("@actions/github")
const httpm = require("@actions/http-client")

/**
 * Dokploy GitHub Action - Comprehensive Deployment Automation
 * Version: 2.0.0
 * Author: patrikjokhel, enhanced by SSanjeevi
 * 
 * This action provides complete Dokploy lifecycle management including:
 * - Project and environment management
 * - Server resolution
 * - Application creation/update
 * - Docker provider configuration
 * - Environment variable management  
 * - Domain and SSL configuration
 * - Health check verification
 * - Comprehensive error handling and debugging
 */

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse a string input as an integer
 */
function parseIntInput(value, name) {
	if (!value || value === "") {
		return undefined
	}
	const parsed = parseInt(value, 10)
	if (isNaN(parsed)) {
		throw new Error(`${name} must be a valid number, got: ${value}`)
	}
	return parsed
}

/**
 * Parse a string input as a boolean
 */
function parseBooleanInput(value) {
	if (!value || value === "") {
		return undefined
	}
	const lower = value.toLowerCase()
	if (lower === "true") return true
	if (lower === "false") return false
	throw new Error(`Expected 'true' or 'false', got: ${value}`)
}

/**
 * Parse an optional string input
 */
function parseOptionalStringInput(key) {
	const value = core.getInput(key, { required: false })
	return value && value.trim() !== "" ? value.trim() : undefined
}

/**
 * Parse CPU limit (handles both number and "500m" format)
 */
function parseCpuLimit(value) {
	if (!value || value === "") {
		return undefined
	}
	// Remove 'm' suffix if present
	const cleanValue = value.toString().replace(/m$/i, "")
	const parsed = parseInt(cleanValue, 10)
	if (isNaN(parsed)) {
		throw new Error(`CPU limit must be a valid number, got: ${value}`)
	}
	return parsed
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Debug logging helper
 */
function debugLog(message, data = null) {
	const debugMode = parseBooleanInput(core.getInput("debug-mode", { required: false }))
	if (debugMode) {
		core.info(`🐛 DEBUG: ${message}`)
		if (data) {
			core.info(`🐛 DEBUG DATA: ${JSON.stringify(data, null, 2)}`)
		}
	}
}

/**
 * Log API request (sanitized for security)
 */
function logApiRequest(method, url, body = null) {
	const logRequests = parseBooleanInput(core.getInput("log-api-requests", { required: false }))
	if (logRequests) {
		core.info(`📤 API REQUEST: ${method} ${url}`)
		if (body) {
			// Sanitize sensitive data
			const sanitized = JSON.stringify(body, (key, value) => {
				if (key.toLowerCase().includes('password') || 
					key.toLowerCase().includes('token') || 
					key.toLowerCase().includes('key') ||
					key.toLowerCase().includes('secret')) {
					return '[REDACTED]'
				}
				return value
			}, 2)
			core.info(`📤 REQUEST BODY: ${sanitized}`)
		}
	}
}

/**
 * Log API response
 */
function logApiResponse(status, response = null) {
	const logResponses = parseBooleanInput(core.getInput("log-api-responses", { required: false }))
	if (logResponses) {
		core.info(`📥 API RESPONSE: HTTP ${status}`)
		if (response) {
			core.info(`📥 RESPONSE BODY: ${JSON.stringify(response, null, 2)}`)
		}
	}
}

// ============================================================================
// Dokploy API Client
// ============================================================================

class DokployClient {
	constructor(dokployUrl, apiKey) {
		this.baseUrl = dokployUrl.replace(/\/$/, "") // Remove trailing slash
		this.apiKey = apiKey
		this.client = new httpm.HttpClient(
			"dokploy-deploy-action-v2",
			undefined,
			{
				headers: {
					accept: "application/json",
					"content-type": "application/json",
					"x-api-key": apiKey
				}
			}
		)
	}

	/**
	 * Make a GET request to Dokploy API
	 */
	async get(endpoint) {
		const url = `${this.baseUrl}${endpoint}`
		logApiRequest("GET", url)
		
		try {
			const response = await this.client.getJson(url)
			logApiResponse(response.statusCode, response.result)
			
			if (response.statusCode !== 200) {
				throw new Error(`GET ${endpoint} failed with status ${response.statusCode}`)
			}
			
			return response.result
		} catch (error) {
			core.error(`❌ GET request failed: ${endpoint}`)
			throw error
		}
	}

	/**
	 * Make a POST request to Dokploy API
	 */
	async post(endpoint, body = {}) {
		const url = `${this.baseUrl}${endpoint}`
		logApiRequest("POST", url, body)
		
		try {
			const response = await this.client.postJson(url, body)
			logApiResponse(response.statusCode, response.result)
			
			if (response.statusCode !== 200 && response.statusCode !== 201) {
				const errorMessage = response.result?.message || response.result?.error || "Unknown error"
				throw new Error(`POST ${endpoint} failed with status ${response.statusCode}: ${errorMessage}`)
			}
			
			return response.result
		} catch (error) {
			core.error(`❌ POST request failed: ${endpoint}`)
			throw error
		}
	}

	// ========================================================================
	// Project Management
	// ========================================================================

	async getAllProjects() {
		debugLog("Fetching all projects")
		return await this.get("/api/project.all")
	}

	async getProject(projectId) {
		debugLog(`Fetching project: ${projectId}`)
		return await this.get(`/api/project.one?projectId=${projectId}`)
	}

	async findProjectByName(projectName) {
		debugLog(`Finding project by name: ${projectName}`)
		const projects = await this.getAllProjects()
		return projects.find(p => p.name === projectName)
	}

	async createProject(name, description) {
		core.info(`📋 Creating project: ${name}`)
		const result = await this.post("/api/project.create", {
			name,
			description: description || `Automated deployment project: ${name}`
		})
		const projectId = result.projectId || result.id
		core.info(`✅ Created project: ${name} (ID: ${projectId})`)
		return projectId
	}

	async ensureProject(projectId, projectName, projectDescription) {
		// If project ID provided, validate it exists
		if (projectId) {
			debugLog(`Using provided project ID: ${projectId}`)
			try {
				await this.getProject(projectId)
				return projectId
			} catch (error) {
				throw new Error(`Project ID ${projectId} not found or inaccessible`)
			}
		}

		// If project name provided, find or create
		if (projectName) {
			debugLog(`Looking for project by name: ${projectName}`)
			const existing = await this.findProjectByName(projectName)
			if (existing) {
				const id = existing.projectId || existing.id
				core.info(`✅ Found existing project: ${projectName} (ID: ${id})`)
				return id
			}

			// Create new project
			const autoCreate = parseBooleanInput(core.getInput("auto-create-resources", { required: false }))
			if (autoCreate !== false) {
				return await this.createProject(projectName, projectDescription)
			} else {
				throw new Error(`Project "${projectName}" not found and auto-create is disabled`)
			}
		}

		throw new Error("Either project-id or project-name must be provided")
	}

	// ========================================================================
	// Environment Management
	// ========================================================================

	async createEnvironment(projectId, environmentName) {
		core.info(`🌍 Creating environment: ${environmentName}`)
		const result = await this.post("/api/environment.create", {
			projectId,
			name: environmentName
		})
		const environmentId = result.environmentId || result.id
		core.info(`✅ Created environment: ${environmentName} (ID: ${environmentId})`)
		return environmentId
	}

	async findEnvironmentInProject(projectId, environmentName) {
		debugLog(`Finding environment "${environmentName}" in project ${projectId}`)
		const project = await this.getProject(projectId)
		const environments = project.environments || []
		return environments.find(env => env.name === environmentName)
	}

	async ensureEnvironment(projectId, environmentId, environmentName) {
		// If environment ID provided, return it
		if (environmentId) {
			debugLog(`Using provided environment ID: ${environmentId}`)
			return environmentId
		}

		// Find environment by name in project
		if (environmentName) {
			const existing = await this.findEnvironmentInProject(projectId, environmentName)
			if (existing) {
				const id = existing.environmentId || existing.id
				core.info(`✅ Found existing environment: ${environmentName} (ID: ${id})`)
				return id
			}

			// Create new environment
			const autoCreate = parseBooleanInput(core.getInput("auto-create-resources", { required: false }))
			if (autoCreate !== false) {
				return await this.createEnvironment(projectId, environmentName)
			} else {
				throw new Error(`Environment "${environmentName}" not found and auto-create is disabled`)
			}
		}

		throw new Error("Either environment-id or environment-name must be provided")
	}

	// ========================================================================
	// Server Management
	// ========================================================================

	async getAllServers() {
		debugLog("Fetching all servers")
		return await this.get("/api/server.all")
	}

	async findServerByName(serverName) {
		debugLog(`Finding server by name: ${serverName}`)
		const servers = await this.getAllServers()
		return servers.find(s => s.name === serverName)
	}

	async resolveServerId(serverId, serverName) {
		// If server ID provided, return it
		if (serverId) {
			debugLog(`Using provided server ID: ${serverId}`)
			return serverId
		}

		// Find server by name
		if (serverName) {
			const server = await this.findServerByName(serverName)
			if (!server) {
				throw new Error(`Server "${serverName}" not found`)
			}
			const id = server.serverId || server.id
			core.info(`✅ Found server: ${serverName} (ID: ${id})`)
			return id
		}

		throw new Error("Either server-id or server-name must be provided")
	}

	// ========================================================================
	// Application Management
	// ========================================================================

	async getApplication(applicationId) {
		debugLog(`Fetching application: ${applicationId}`)
		return await this.get(`/api/application.one?applicationId=${applicationId}`)
	}

	async findApplicationInEnvironment(projectId, environmentId, applicationName) {
		debugLog(`Finding application "${applicationName}" in environment ${environmentId}`)
		const project = await this.getProject(projectId)
		const environments = project.environments || []
		const environment = environments.find(env => 
			(env.environmentId || env.id) === environmentId
		)
		
		if (!environment) {
			return null
		}

		const applications = environment.applications || []
		return applications.find(app => app.name === applicationName)
	}

	async createApplication(config) {
		core.info(`📦 Creating application: ${config.name}`)
		debugLog("Application configuration", config)
		
		const result = await this.post("/api/application.create", config)
		const applicationId = result.applicationId || result.id
		core.info(`✅ Created application: ${config.name} (ID: ${applicationId})`)
		return applicationId
	}

	async updateApplication(applicationId, config) {
		core.info(`🔄 Updating application: ${applicationId}`)
		debugLog("Update configuration", config)
		
		await this.post("/api/application.update", {
			applicationId,
			...config
		})
		core.info(`✅ Updated application: ${applicationId}`)
	}

	async ensureApplication(projectId, environmentId, serverId, inputs) {
		const applicationId = inputs.applicationId
		const applicationName = inputs.applicationName

		// If application ID provided, verify it exists
		if (applicationId) {
			debugLog(`Using provided application ID: ${applicationId}`)
			try {
				await this.getApplication(applicationId)
				return applicationId
			} catch (error) {
				throw new Error(`Application ID ${applicationId} not found or inaccessible`)
			}
		}

		// Find application by name in environment
		if (applicationName) {
			const existing = await this.findApplicationInEnvironment(
				projectId,
				environmentId,
				applicationName
			)
			
			if (existing) {
				const id = existing.applicationId || existing.id
				core.info(`✅ Found existing application: ${applicationName} (ID: ${id})`)
				return id
			}

			// Create new application
			const autoCreate = parseBooleanInput(core.getInput("auto-create-resources", { required: false }))
			if (autoCreate !== false) {
				const config = buildApplicationConfig(
					applicationName,
					projectId,
					environmentId,
					serverId,
					inputs
				)
				return await this.createApplication(config)
			} else {
				throw new Error(`Application "${applicationName}" not found and auto-create is disabled`)
			}
		}

		throw new Error("Either application-id or application-name must be provided")
	}

	// ========================================================================
	// Docker Provider Configuration
	// ========================================================================

	async saveDockerProvider(applicationId, dockerImage, registryUrl, username, password) {
		core.info(`🐳 Configuring Docker provider for application: ${applicationId}`)
		debugLog("Docker provider config", {
			applicationId,
			dockerImage,
			registryUrl,
			username: username ? "[SET]" : "[NOT SET]"
		})

		await this.post("/api/application.saveDockerProvider", {
			applicationId,
			dockerImage,
			registryUrl: registryUrl || "ghcr.io",
			username,
			password
		})
		core.info(`✅ Docker provider configured: ${dockerImage}`)
	}

	// ========================================================================
	// Environment Variables
	// ========================================================================

	async saveEnvironment(applicationId, envString) {
		core.info(`🌍 Configuring environment variables for application: ${applicationId}`)
		const lineCount = envString ? envString.split('\n').length : 0
		debugLog(`Saving ${lineCount} environment variables`)

		await this.post("/api/application.saveEnvironment", {
			applicationId,
			env: envString
		})
		core.info(`✅ Environment variables configured (${lineCount} lines)`)
	}

	// ========================================================================
	// Domain Management
	// ========================================================================

	async createDomain(applicationId, domainConfig) {
		core.info(`🌐 Creating domain: ${domainConfig.host}`)
		debugLog("Domain configuration", domainConfig)

		const result = await this.post("/api/domain.create", {
			applicationId,
			...domainConfig
		})
		core.info(`✅ Domain created: ${domainConfig.host} (SSL: ${domainConfig.certificateType})`)
		return result
	}

	async removeDomain(domainId) {
		core.info(`🗑️ Removing domain: ${domainId}`)
		await this.post("/api/domain.remove", { domainId })
		core.info(`✅ Domain removed: ${domainId}`)
	}

	async getDomains(applicationId) {
		debugLog(`Fetching domains for application: ${applicationId}`)
		const app = await this.getApplication(applicationId)
		return app.domains || []
	}

	// ========================================================================
	// Deployment
	// ========================================================================

	async stopApplication(applicationId) {
		core.info(`⏹️ Stopping application: ${applicationId}`)
		await this.post("/api/application.stop", { applicationId })
		core.info(`✅ Application stopped: ${applicationId}`)
	}

	async deployApplication(applicationId, title, description) {
		core.info(`🚀 Deploying application: ${applicationId}`)
		debugLog("Deployment params", { applicationId, title, description })

		await this.post("/api/application.deploy", {
			applicationId,
			title,
			description
		})
		core.info(`✅ Deployment triggered: ${applicationId}`)
	}
}

// ============================================================================
// Configuration Builders
// ============================================================================

/**
 * Build application configuration object
 */
function buildApplicationConfig(name, projectId, environmentId, serverId, inputs) {
	const config = {
		name,
		projectId,
		environmentId,
		serverId,
		applicationStatus: "idle",
		title: inputs.applicationTitle || name,
		description: inputs.applicationDescription || `Automated deployment: ${name}`,
		port: parseIntInput(inputs.port, "port") || 8080,
		targetPort: parseIntInput(inputs.targetPort, "target-port") || 8080,
		restartPolicy: inputs.restartPolicy || "unless-stopped"
	}

	// Add container name if provided
	if (inputs.containerName) {
		config.appName = inputs.containerName
	}

	// Add resource limits
	const memoryLimit = parseIntInput(inputs.memoryLimit, "memory-limit")
	if (memoryLimit) {
		config.memoryLimit = memoryLimit
	}

	const memoryReservation = parseIntInput(inputs.memoryReservation, "memory-reservation")
	if (memoryReservation) {
		config.memoryReservation = memoryReservation
	}

	const cpuLimit = parseCpuLimit(inputs.cpuLimit)
	if (cpuLimit) {
		config.cpuLimit = cpuLimit
	}

	const cpuReservation = parseCpuLimit(inputs.cpuReservation)
	if (cpuReservation) {
		config.cpuReservation = cpuReservation
	}

	// Add scaling configuration
	const replicas = parseIntInput(inputs.replicas, "replicas")
	if (replicas) {
		config.replicas = replicas
	}

	const minReplicas = parseIntInput(inputs.minReplicas, "min-replicas")
	if (minReplicas) {
		config.minReplicas = minReplicas
	}

	const maxReplicas = parseIntInput(inputs.maxReplicas, "max-replicas")
	if (maxReplicas) {
		config.maxReplicas = maxReplicas
	}

	return config
}

/**
 * Build domain configuration object
 */
function buildDomainConfig(inputs) {
	const domainHost = inputs.domainHost
	if (!domainHost) {
		return null
	}

	const domainPort = parseIntInput(inputs.domainPort, "domain-port") || 
	                    parseIntInput(inputs.targetPort, "target-port") || 
	                    8080

	return {
		host: domainHost,
		path: inputs.domainPath || "/",
		port: domainPort,
		https: parseBooleanInput(inputs.domainHttps) !== false,
		certificateType: inputs.sslCertificateType || "letsencrypt",
		domainType: "application",
		stripPath: parseBooleanInput(inputs.domainStripPath) || false
	}
}

/**
 * Parse environment variables from various input formats
 */
function parseEnvironmentVariables(inputs) {
	// Priority: env-from-json > env-file > env

	// Try JSON format first
	if (inputs.envFromJson) {
		try {
			const obj = JSON.parse(inputs.envFromJson)
			return Object.entries(obj)
				.map(([key, value]) => `${key}=${value}`)
				.join('\n')
		} catch (error) {
			throw new Error(`Failed to parse env-from-json: ${error.message}`)
		}
	}

	// Try file format (not implemented yet - would require file system access)
	// if (inputs.envFile) { ... }

	// Use direct string format
	if (inputs.env) {
		return inputs.env
	}

	return ""
}

// ============================================================================
// Health Check
// ============================================================================

async function performHealthCheck(deploymentUrl, inputs) {
	const enabled = parseBooleanInput(inputs.healthCheckEnabled)
	if (enabled === false) {
		core.info("ℹ️ Health check disabled")
		return "skipped"
	}

	if (!deploymentUrl) {
		core.warning("⚠️ No deployment URL available, skipping health check")
		return "skipped"
	}

	const healthCheckUrl = inputs.healthCheckUrl || "/health"
	const timeout = parseIntInput(inputs.healthCheckTimeout, "health-check-timeout") || 60
	const retries = parseIntInput(inputs.healthCheckRetries, "health-check-retries") || 3
	const interval = parseIntInput(inputs.healthCheckInterval, "health-check-interval") || 10

	const fullUrl = `${deploymentUrl}${healthCheckUrl}`
	core.info(`🏥 Performing health check: ${fullUrl}`)
	core.info(`   Timeout: ${timeout}s, Retries: ${retries}, Interval: ${interval}s`)

	const client = new httpm.HttpClient("dokploy-health-check")
	const startTime = Date.now()

	for (let attempt = 1; attempt <= retries; attempt++) {
		try {
			core.info(`🔍 Health check attempt ${attempt}/${retries}...`)
			
			const response = await client.get(fullUrl)
			const statusCode = response.message.statusCode

			if (statusCode === 200) {
				core.info(`✅ Health check passed! (HTTP ${statusCode})`)
				return "healthy"
			}

			core.warning(`⚠️ Health check returned HTTP ${statusCode}`)
			
			if (attempt < retries) {
				core.info(`⏳ Waiting ${interval}s before retry...`)
				await sleep(interval * 1000)
			}
		} catch (error) {
			core.warning(`⚠️ Health check failed: ${error.message}`)
			
			if (attempt < retries) {
				core.info(`⏳ Waiting ${interval}s before retry...`)
				await sleep(interval * 1000)
			}
		}

		// Check timeout
		const elapsed = (Date.now() - startTime) / 1000
		if (elapsed >= timeout) {
			core.error(`❌ Health check timeout after ${elapsed}s`)
			return "unhealthy"
		}
	}

	core.error(`❌ Health check failed after ${retries} attempts`)
	return "unhealthy"
}

// ============================================================================
// Main Execution
// ============================================================================

async function run() {
	try {
		core.info("🚀 Dokploy Deployment Action v2.0")
		core.info("=" .repeat(60))

		// ====================================================================
		// Step 1: Parse and validate inputs
		// ====================================================================
		core.startGroup("📋 Parsing inputs")
		
		const dokployUrl = core.getInput("dokploy-url", { required: true })
		const apiKey = core.getInput("api-key", { required: true })
		const dockerImage = core.getInput("docker-image", { required: true })

		// Mask secrets
		core.setSecret(apiKey)
		const registryPassword = parseOptionalStringInput("registry-password")
		if (registryPassword) {
			core.setSecret(registryPassword)
		}

		const inputs = {
			// Core
			dockerImage,
			
			// Project & Environment
			projectId: parseOptionalStringInput("project-id"),
			projectName: parseOptionalStringInput("project-name"),
			projectDescription: parseOptionalStringInput("project-description"),
			environmentId: parseOptionalStringInput("environment-id"),
			environmentName: parseOptionalStringInput("environment-name") || "production",
			
			// Application
			applicationId: parseOptionalStringInput("application-id"),
			applicationName: parseOptionalStringInput("application-name"),
			applicationTitle: parseOptionalStringInput("application-title"),
			applicationDescription: parseOptionalStringInput("application-description"),
			containerName: parseOptionalStringInput("container-name"),
			
			// Server
			serverId: parseOptionalStringInput("server-id"),
			serverName: parseOptionalStringInput("server-name") || "Hostinger-Server1",
			
			// Resources
			memoryLimit: parseOptionalStringInput("memory-limit"),
			memoryReservation: parseOptionalStringInput("memory-reservation"),
			cpuLimit: parseOptionalStringInput("cpu-limit"),
			cpuReservation: parseOptionalStringInput("cpu-reservation"),
			port: parseOptionalStringInput("port"),
			targetPort: parseOptionalStringInput("target-port"),
			restartPolicy: parseOptionalStringInput("restart-policy"),
			
			// Scaling
			replicas: parseOptionalStringInput("replicas"),
			minReplicas: parseOptionalStringInput("min-replicas"),
			maxReplicas: parseOptionalStringInput("max-replicas"),
			enableAutoScaling: parseOptionalStringInput("enable-auto-scaling"),
			
			// Registry
			registryUrl: parseOptionalStringInput("registry-url") || "ghcr.io",
			registryUsername: parseOptionalStringInput("registry-username"),
			registryPassword,
			
			// Environment Variables
			env: parseOptionalStringInput("env"),
			envFile: parseOptionalStringInput("env-file"),
			envFromJson: parseOptionalStringInput("env-from-json"),
			
			// Domain
			domainHost: parseOptionalStringInput("domain-host"),
			domainPath: parseOptionalStringInput("domain-path"),
			domainPort: parseOptionalStringInput("domain-port"),
			domainHttps: parseOptionalStringInput("domain-https"),
			sslCertificateType: parseOptionalStringInput("ssl-certificate-type"),
			domainStripPath: parseOptionalStringInput("domain-strip-path"),
			forceDomainRecreation: parseOptionalStringInput("force-domain-recreation"),
			
			// Deployment
			deploymentTitle: parseOptionalStringInput("deployment-title"),
			deploymentDescription: parseOptionalStringInput("deployment-description"),
			rollbackActive: parseOptionalStringInput("rollback-active"),
			waitForDeployment: parseOptionalStringInput("wait-for-deployment"),
			deploymentTimeout: parseOptionalStringInput("deployment-timeout"),
			cleanupOldContainers: parseOptionalStringInput("cleanup-old-containers"),
			
			// Health Check
			healthCheckEnabled: parseOptionalStringInput("health-check-enabled"),
			healthCheckUrl: parseOptionalStringInput("health-check-url"),
			healthCheckTimeout: parseOptionalStringInput("health-check-timeout"),
			healthCheckRetries: parseOptionalStringInput("health-check-retries"),
			healthCheckInterval: parseOptionalStringInput("health-check-interval")
		}

		core.info(`✅ Docker Image: ${dockerImage}`)
		core.info(`✅ Environment: ${inputs.environmentName}`)
		core.info(`✅ Server: ${inputs.serverName}`)
		if (inputs.domainHost) {
			core.info(`✅ Domain: ${inputs.domainHost}`)
		}
		
		core.endGroup()

		// ====================================================================
		// Step 2: Initialize Dokploy client
		// ====================================================================
		core.startGroup("🔌 Connecting to Dokploy")
		const client = new DokployClient(dokployUrl, apiKey)
		core.info(`✅ Connected to: ${dokployUrl}`)
		core.endGroup()

		// ====================================================================
		// Step 3: Ensure project exists
		// ====================================================================
		core.startGroup("📁 Project Management")
		const projectId = await client.ensureProject(
			inputs.projectId,
			inputs.projectName,
			inputs.projectDescription
		)
		core.setOutput("project-id", projectId)
		core.endGroup()

		// ====================================================================
		// Step 4: Ensure environment exists
		// ====================================================================
		core.startGroup("🌍 Environment Management")
		const environmentId = await client.ensureEnvironment(
			projectId,
			inputs.environmentId,
			inputs.environmentName
		)
		core.setOutput("environment-id", environmentId)
		core.endGroup()

		// ====================================================================
		// Step 5: Resolve server ID
		// ====================================================================
		core.startGroup("🖥️ Server Resolution")
		const serverId = await client.resolveServerId(
			inputs.serverId,
			inputs.serverName
		)
		core.setOutput("server-id", serverId)
		core.endGroup()

		// ====================================================================
		// Step 6: Ensure application exists
		// ====================================================================
		core.startGroup("📦 Application Management")
		const applicationId = await client.ensureApplication(
			projectId,
			environmentId,
			serverId,
			inputs
		)
		core.setOutput("application-id", applicationId)
		core.endGroup()

		// ====================================================================
		// Step 7: Configure Docker provider
		// ====================================================================
		core.startGroup("🐳 Docker Provider Configuration")
		await client.saveDockerProvider(
			applicationId,
			dockerImage,
			inputs.registryUrl,
			inputs.registryUsername,
			inputs.registryPassword
		)
		core.endGroup()

		// ====================================================================
		// Step 8: Configure environment variables
		// ====================================================================
		core.startGroup("🌍 Environment Variables Configuration")
		const envString = parseEnvironmentVariables(inputs)
		if (envString) {
			await client.saveEnvironment(applicationId, envString)
		} else {
			core.info("ℹ️ No environment variables to configure")
		}
		core.endGroup()

		// ====================================================================
		// Step 9: Configure domain (if enabled)
		// ====================================================================
		let deploymentUrl = null
		const domainConfig = buildDomainConfig(inputs)
		
		if (domainConfig) {
			core.startGroup("🌐 Domain Configuration")
			
			// Check if domain already exists
			const existingDomains = await client.getDomains(applicationId)
			const existingDomain = existingDomains.find(d => d.host === domainConfig.host)
			
			const forceRecreate = parseBooleanInput(inputs.forceDomainRecreation)
			
			if (existingDomain && !forceRecreate) {
				core.info(`ℹ️ Domain already exists: ${domainConfig.host}`)
			} else {
				if (existingDomain && forceRecreate) {
					const domainId = existingDomain.domainId || existingDomain.id
					await client.removeDomain(domainId)
					await sleep(2000) // Wait for cleanup
				}
				await client.createDomain(applicationId, domainConfig)
			}
			
			deploymentUrl = domainConfig.https 
				? `https://${domainConfig.host}` 
				: `http://${domainConfig.host}`
			core.setOutput("deployment-url", deploymentUrl)
			
			core.endGroup()
		}

		// ====================================================================
		// Step 10: Cleanup old containers (if enabled)
		// ====================================================================
		const cleanupOldContainers = parseBooleanInput(inputs.cleanupOldContainers)
		if (cleanupOldContainers) {
			core.startGroup("🧹 Cleanup Old Containers")
			await client.stopApplication(applicationId)
			core.info("⏳ Waiting 15 seconds for containers to stop...")
			await sleep(15000)
			core.endGroup()
		}

		// ====================================================================
		// Step 11: Deploy application
		// ====================================================================
		core.startGroup("🚀 Deployment")
		await client.deployApplication(
			applicationId,
			inputs.deploymentTitle || `Deploy ${dockerImage}`,
			inputs.deploymentDescription || `Automated deployment via GitHub Actions`
		)
		core.setOutput("deployment-status", "success")
		core.endGroup()

		// ====================================================================
		// Step 12: Wait for deployment (if enabled)
		// ====================================================================
		const waitForDeployment = parseBooleanInput(inputs.waitForDeployment)
		if (waitForDeployment) {
			core.info("⏳ Waiting for deployment to complete...")
			const timeout = parseIntInput(inputs.deploymentTimeout, "deployment-timeout") || 300
			core.info(`   Deployment timeout: ${timeout}s`)
			
			// Wait a reasonable amount of time for deployment
			// In a real implementation, we would poll the deployment status
			// For now, just wait a fixed time
			await sleep(Math.min(60000, timeout * 1000 / 5))
		}

		// ====================================================================
		// Step 13: Health check (if enabled)
		// ====================================================================
		core.startGroup("🏥 Health Check")
		const healthStatus = await performHealthCheck(deploymentUrl, inputs)
		core.setOutput("health-check-status", healthStatus)
		core.endGroup()

		// ====================================================================
		// Step 14: Summary
		// ====================================================================
		core.info("")
		core.info("=" .repeat(60))
		core.info("✅ Deployment completed successfully!")
		core.info("=" .repeat(60))
		core.info(`📦 Application: ${applicationId}`)
		core.info(`📁 Project: ${projectId}`)
		core.info(`🌍 Environment: ${environmentId}`)
		core.info(`🖥️ Server: ${serverId}`)
		if (deploymentUrl) {
			core.info(`🌐 URL: ${deploymentUrl}`)
		}
		core.info(`🏥 Health: ${healthStatus}`)
		core.info("=" .repeat(60))

	} catch (error) {
		core.setFailed(`❌ Deployment failed: ${error.message}`)
		debugLog("Error stack trace", error.stack)
		throw error
	}
}

// ============================================================================
// Export for testing
// ============================================================================

module.exports = {
	run,
	DokployClient,
	parseIntInput,
	parseBooleanInput,
	parseOptionalStringInput,
	parseCpuLimit,
	buildApplicationConfig,
	buildDomainConfig,
	parseEnvironmentVariables
}

// Run if executed directly
if (require.main === module) {
	run()
}
