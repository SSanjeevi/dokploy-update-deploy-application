const {
	run,
	DokployClient,
	parseIntInput,
	parseBooleanInput,
	parseOptionalStringInput,
	parseCpuLimit,
	buildApplicationConfig,
	buildDomainConfig,
	parseEnvironmentVariables
} = require("./index.v2")

// Mock dependencies
jest.mock("@actions/core")
jest.mock("@actions/github")
jest.mock("@actions/http-client")

const core = require("@actions/core")
const httpm = require("@actions/http-client")

describe("Dokploy Deploy Application v2.0", () => {
	describe("Utility Functions", () => {
		describe("parseIntInput", () => {
			test("should parse valid integer", () => {
				expect(parseIntInput("123", "test")).toBe(123)
			})

			test("should return undefined for empty string", () => {
				expect(parseIntInput("", "test")).toBeUndefined()
			})

			test("should return undefined for null", () => {
				expect(parseIntInput(null, "test")).toBeUndefined()
			})

			test("should throw error for invalid number", () => {
				expect(() => parseIntInput("abc", "test")).toThrow("test must be a valid number")
			})
		})

		describe("parseBooleanInput", () => {
			test("should parse 'true' as true", () => {
				expect(parseBooleanInput("true")).toBe(true)
			})

			test("should parse 'false' as false", () => {
				expect(parseBooleanInput("false")).toBe(false)
			})

			test("should be case insensitive", () => {
				expect(parseBooleanInput("TRUE")).toBe(true)
				expect(parseBooleanInput("FALSE")).toBe(false)
			})

			test("should return undefined for empty string", () => {
				expect(parseBooleanInput("")).toBeUndefined()
			})

			test("should throw error for invalid boolean", () => {
				expect(() => parseBooleanInput("yes")).toThrow("Expected 'true' or 'false'")
			})
		})

		describe("parseCpuLimit", () => {
			test("should parse number without suffix", () => {
				expect(parseCpuLimit("500")).toBe(500)
			})

			test("should parse number with 'm' suffix", () => {
				expect(parseCpuLimit("500m")).toBe(500)
			})

			test("should be case insensitive for suffix", () => {
				expect(parseCpuLimit("500M")).toBe(500)
			})

			test("should return undefined for empty string", () => {
				expect(parseCpuLimit("")).toBeUndefined()
			})

			test("should throw error for invalid number", () => {
				expect(() => parseCpuLimit("abc")).toThrow("CPU limit must be a valid number")
			})
		})

		describe("parseEnvironmentVariables", () => {
			test("should parse JSON format", () => {
				const inputs = {
					envFromJson: '{"VAR1":"value1","VAR2":"value2"}'
				}
				const result = parseEnvironmentVariables(inputs)
				expect(result).toContain("VAR1=value1")
				expect(result).toContain("VAR2=value2")
			})

			test("should parse direct string format", () => {
				const inputs = {
					env: "VAR1=value1\nVAR2=value2"
				}
				const result = parseEnvironmentVariables(inputs)
				expect(result).toBe("VAR1=value1\nVAR2=value2")
			})

			test("should prioritize JSON over string", () => {
				const inputs = {
					envFromJson: '{"VAR1":"json"}',
					env: "VAR1=string"
				}
				const result = parseEnvironmentVariables(inputs)
				expect(result).toContain("VAR1=json")
			})

			test("should return empty string when no env vars provided", () => {
				const inputs = {}
				const result = parseEnvironmentVariables(inputs)
				expect(result).toBe("")
			})

			test("should throw error for invalid JSON", () => {
				const inputs = {
					envFromJson: '{invalid json}'
				}
				expect(() => parseEnvironmentVariables(inputs)).toThrow("Failed to parse env-from-json")
			})
		})

		describe("buildApplicationConfig", () => {
			test("should build basic config", () => {
				const inputs = {}
				const config = buildApplicationConfig("test-app", "proj-1", "env-1", "srv-1", inputs)

				expect(config.name).toBe("test-app")
				expect(config.projectId).toBe("proj-1")
				expect(config.environmentId).toBe("env-1")
				expect(config.serverId).toBe("srv-1")
				expect(config.applicationStatus).toBe("idle")
				expect(config.port).toBe(8080)
				expect(config.targetPort).toBe(8080)
			})

			test("should include resource limits when provided", () => {
				const inputs = {
					memoryLimit: "1024",
					cpuLimit: "500",
					replicas: "3"
				}
				const config = buildApplicationConfig("test-app", "proj-1", "env-1", "srv-1", inputs)

				expect(config.memoryLimit).toBe(1024)
				expect(config.cpuLimit).toBe(500)
				expect(config.replicas).toBe(3)
			})

			test("should include container name when provided", () => {
				const inputs = {
					containerName: "custom-container"
				}
				const config = buildApplicationConfig("test-app", "proj-1", "env-1", "srv-1", inputs)

				expect(config.appName).toBe("custom-container")
			})

			test("should include scaling configuration", () => {
				const inputs = {
					minReplicas: "1",
					maxReplicas: "10"
				}
				const config = buildApplicationConfig("test-app", "proj-1", "env-1", "srv-1", inputs)

				expect(config.minReplicas).toBe(1)
				expect(config.maxReplicas).toBe(10)
			})
		})

		describe("buildDomainConfig", () => {
			test("should return null when no domain host provided", () => {
				const inputs = {}
				const config = buildDomainConfig(inputs)
				expect(config).toBeNull()
			})

			test("should build basic domain config", () => {
				const inputs = {
					domainHost: "api.example.com"
				}
				const config = buildDomainConfig(inputs)

				expect(config.host).toBe("api.example.com")
				expect(config.path).toBe("/")
				expect(config.https).toBe(true)
				expect(config.certificateType).toBe("letsencrypt")
			})

			test("should use custom path and port", () => {
				const inputs = {
					domainHost: "api.example.com",
					domainPath: "/api",
					domainPort: "3000"
				}
				const config = buildDomainConfig(inputs)

				expect(config.path).toBe("/api")
				expect(config.port).toBe(3000)
			})

			test("should disable HTTPS when specified", () => {
				const inputs = {
					domainHost: "api.example.com",
					domainHttps: "false"
				}
				const config = buildDomainConfig(inputs)

				expect(config.https).toBe(false)
			})

			test("should use custom SSL certificate type", () => {
				const inputs = {
					domainHost: "api.example.com",
					sslCertificateType: "custom"
				}
				const config = buildDomainConfig(inputs)

				expect(config.certificateType).toBe("custom")
			})
		})
	})

	describe("DokployClient", () => {
		let client
		let mockHttpClient
		let mockGetJson
		let mockPostJson

		beforeEach(() => {
			jest.clearAllMocks()

			mockGetJson = jest.fn()
			mockPostJson = jest.fn()

			mockHttpClient = {
				getJson: mockGetJson,
				postJson: mockPostJson
			}

			httpm.HttpClient = jest.fn().mockReturnValue(mockHttpClient)

			client = new DokployClient("https://test.dokploy.com", "test-api-key")
		})

		describe("Project Management", () => {
			test("should get all projects", async () => {
				mockGetJson.mockResolvedValue({
					statusCode: 200,
					result: [{ projectId: "proj-1", name: "Project 1" }]
				})

				const projects = await client.getAllProjects()

				expect(mockGetJson).toHaveBeenCalledWith("https://test.dokploy.com/api/project.all")
				expect(projects).toHaveLength(1)
				expect(projects[0].name).toBe("Project 1")
			})

			test("should find project by name", async () => {
				mockGetJson.mockResolvedValue({
					statusCode: 200,
					result: [
						{ projectId: "proj-1", name: "Project 1" },
						{ projectId: "proj-2", name: "Project 2" }
					]
				})

				const project = await client.findProjectByName("Project 2")

				expect(project.projectId).toBe("proj-2")
			})

			test("should create project", async () => {
				mockPostJson.mockResolvedValue({
					statusCode: 200,
					result: { projectId: "new-proj" }
				})

				const projectId = await client.createProject("New Project", "Description")

				expect(mockPostJson).toHaveBeenCalledWith(
					"https://test.dokploy.com/api/project.create",
					{
						name: "New Project",
						description: "Description"
					}
				)
				expect(projectId).toBe("new-proj")
			})
		})

		describe("Server Management", () => {
			test("should get all servers", async () => {
				mockGetJson.mockResolvedValue({
					statusCode: 200,
					result: [{ serverId: "srv-1", name: "Server 1" }]
				})

				const servers = await client.getAllServers()

				expect(mockGetJson).toHaveBeenCalledWith("https://test.dokploy.com/api/server.all")
				expect(servers).toHaveLength(1)
			})

			test("should find server by name", async () => {
				mockGetJson.mockResolvedValue({
					statusCode: 200,
					result: [
						{ serverId: "srv-1", name: "Server 1" },
						{ serverId: "srv-2", name: "Server 2" }
					]
				})

				const server = await client.findServerByName("Server 2")

				expect(server.serverId).toBe("srv-2")
			})

			test("should resolve server ID from name", async () => {
				mockGetJson.mockResolvedValue({
					statusCode: 200,
					result: [{ serverId: "srv-1", name: "My Server" }]
				})

				const serverId = await client.resolveServerId(null, "My Server")

				expect(serverId).toBe("srv-1")
			})

			test("should throw error when server not found", async () => {
				mockGetJson.mockResolvedValue({
					statusCode: 200,
					result: []
				})

				await expect(client.resolveServerId(null, "NonExistent")).rejects.toThrow(
					'Server "NonExistent" not found'
				)
			})
		})

		describe("Application Management", () => {
			test("should get application", async () => {
				mockGetJson.mockResolvedValue({
					statusCode: 200,
					result: { applicationId: "app-1", name: "App 1" }
				})

				const app = await client.getApplication("app-1")

				expect(mockGetJson).toHaveBeenCalledWith(
					"https://test.dokploy.com/api/application.one?applicationId=app-1"
				)
				expect(app.name).toBe("App 1")
			})

			test("should create application", async () => {
				mockPostJson.mockResolvedValue({
					statusCode: 200,
					result: { applicationId: "new-app" }
				})

				const config = {
					name: "New App",
					projectId: "proj-1",
					environmentId: "env-1",
					serverId: "srv-1"
				}

				const appId = await client.createApplication(config)

				expect(mockPostJson).toHaveBeenCalledWith(
					"https://test.dokploy.com/api/application.create",
					config
				)
				expect(appId).toBe("new-app")
			})

			test("should update application", async () => {
				mockPostJson.mockResolvedValue({
					statusCode: 200,
					result: {}
				})

				await client.updateApplication("app-1", { name: "Updated App" })

				expect(mockPostJson).toHaveBeenCalledWith(
					"https://test.dokploy.com/api/application.update",
					{
						applicationId: "app-1",
						name: "Updated App"
					}
				)
			})
		})

		describe("Docker Provider", () => {
			test("should save Docker provider configuration", async () => {
				mockPostJson.mockResolvedValue({
					statusCode: 200,
					result: {}
				})

				await client.saveDockerProvider(
					"app-1",
					"ghcr.io/user/app:latest",
					"ghcr.io",
					"username",
					"password"
				)

				expect(mockPostJson).toHaveBeenCalledWith(
					"https://test.dokploy.com/api/application.saveDockerProvider",
					{
						applicationId: "app-1",
						dockerImage: "ghcr.io/user/app:latest",
						registryUrl: "ghcr.io",
						username: "username",
						password: "password"
					}
				)
			})
		})

		describe("Environment Variables", () => {
			test("should save environment variables", async () => {
				mockPostJson.mockResolvedValue({
					statusCode: 200,
					result: {}
				})

				const envString = "VAR1=value1\nVAR2=value2"
				await client.saveEnvironment("app-1", envString)

				expect(mockPostJson).toHaveBeenCalledWith(
					"https://test.dokploy.com/api/application.saveEnvironment",
					{
						applicationId: "app-1",
						env: envString
					}
				)
			})
		})

		describe("Domain Management", () => {
			test("should create domain", async () => {
				mockPostJson.mockResolvedValue({
					statusCode: 200,
					result: { domainId: "dom-1" }
				})

				const domainConfig = {
					host: "api.example.com",
					path: "/",
					https: true,
					certificateType: "letsencrypt"
				}

				await client.createDomain("app-1", domainConfig)

				expect(mockPostJson).toHaveBeenCalledWith(
					"https://test.dokploy.com/api/domain.create",
					{
						applicationId: "app-1",
						...domainConfig
					}
				)
			})

			test("should remove domain", async () => {
				mockPostJson.mockResolvedValue({
					statusCode: 200,
					result: {}
				})

				await client.removeDomain("dom-1")

				expect(mockPostJson).toHaveBeenCalledWith(
					"https://test.dokploy.com/api/domain.remove",
					{ domainId: "dom-1" }
				)
			})
		})

		describe("Deployment", () => {
			test("should deploy application", async () => {
				mockPostJson.mockResolvedValue({
					statusCode: 200,
					result: {}
				})

				await client.deployApplication("app-1", "Deploy Title", "Deploy Description")

				expect(mockPostJson).toHaveBeenCalledWith(
					"https://test.dokploy.com/api/application.deploy",
					{
						applicationId: "app-1",
						title: "Deploy Title",
						description: "Deploy Description"
					}
				)
			})

			test("should stop application", async () => {
				mockPostJson.mockResolvedValue({
					statusCode: 200,
					result: {}
				})

				await client.stopApplication("app-1")

				expect(mockPostJson).toHaveBeenCalledWith(
					"https://test.dokploy.com/api/application.stop",
					{ applicationId: "app-1" }
				)
			})
		})

		describe("Error Handling", () => {
			test("should throw error on failed GET request", async () => {
				mockGetJson.mockResolvedValue({
					statusCode: 404,
					result: null
				})

				await expect(client.get("/api/test")).rejects.toThrow(
					"GET /api/test failed with status 404"
				)
			})

			test("should throw error on failed POST request", async () => {
				mockPostJson.mockResolvedValue({
					statusCode: 500,
					result: { message: "Internal Server Error" }
				})

				await expect(client.post("/api/test", {})).rejects.toThrow(
					"POST /api/test failed with status 500"
				)
			})
		})
	})

	describe("Integration Tests - run()", () => {
		let mockHttpClient
		let mockGetJson
		let mockPostJson
		let mockGet

		beforeEach(() => {
			jest.clearAllMocks()

			mockGetJson = jest.fn()
			mockPostJson = jest.fn()
			mockGet = jest.fn()

			mockHttpClient = {
				getJson: mockGetJson,
				postJson: mockPostJson,
				get: mockGet
			}

			httpm.HttpClient = jest.fn().mockReturnValue(mockHttpClient)

			// Mock core functions
			core.getInput = jest.fn()
			core.setSecret = jest.fn()
			core.info = jest.fn()
			core.debug = jest.fn()
			core.setOutput = jest.fn()
			core.setFailed = jest.fn()
			core.startGroup = jest.fn()
			core.endGroup = jest.fn()
			core.warning = jest.fn()
			core.error = jest.fn()
		})

		test("should complete full deployment workflow with minimal config", async () => {
			// Setup inputs
			core.getInput.mockImplementation((key, options) => {
				const inputs = {
					"dokploy-url": "https://test.dokploy.com",
					"api-key": "test-api-key",
					"docker-image": "ghcr.io/user/app:latest",
					"project-name": "test-project",
					"environment-name": "production",
					"application-name": "test-app",
					"server-name": "Test-Server",
					"auto-create-resources": "true",
					"wait-for-deployment": "false",
					"health-check-enabled": "false"
				}
				return inputs[key] || ""
			})

			// Mock API responses
			mockGetJson.mockImplementation((url) => {
				if (url.includes("/api/project.all")) {
					return Promise.resolve({
						statusCode: 200,
						result: []
					})
				}
				if (url.includes("/api/server.all")) {
					return Promise.resolve({
						statusCode: 200,
						result: [{ serverId: "srv-1", name: "Test-Server" }]
					})
				}
				if (url.includes("/api/project.one")) {
					return Promise.resolve({
						statusCode: 200,
						result: {
							projectId: "proj-1",
							environments: []
						}
					})
				}
				return Promise.resolve({ statusCode: 200, result: {} })
			})

			mockPostJson.mockResolvedValue({
				statusCode: 200,
				result: {
					projectId: "proj-1",
					environmentId: "env-1",
					applicationId: "app-1"
				}
			})

			await run()

			// Verify outputs were set
			expect(core.setOutput).toHaveBeenCalledWith("project-id", expect.any(String))
			expect(core.setOutput).toHaveBeenCalledWith("environment-id", expect.any(String))
			expect(core.setOutput).toHaveBeenCalledWith("server-id", "srv-1")
			expect(core.setOutput).toHaveBeenCalledWith("application-id", expect.any(String))
			expect(core.setOutput).toHaveBeenCalledWith("deployment-status", "success")

			// Verify no failures
			expect(core.setFailed).not.toHaveBeenCalled()
		})

		test("should handle deployment with domain configuration", async () => {
			core.getInput.mockImplementation((key, options) => {
				const inputs = {
					"dokploy-url": "https://test.dokploy.com",
					"api-key": "test-api-key",
					"docker-image": "ghcr.io/user/app:latest",
					"project-id": "proj-1",
					"environment-id": "env-1",
					"application-id": "app-1",
					"server-id": "srv-1",
					"domain-host": "api.example.com",
					"domain-https": "true",
					"ssl-certificate-type": "letsencrypt",
					"wait-for-deployment": "false",
					"health-check-enabled": "false"
				}
				return inputs[key] || ""
			})

			mockGetJson.mockImplementation((url) => {
				if (url.includes("/api/project.one")) {
					return Promise.resolve({
						statusCode: 200,
						result: { projectId: "proj-1" }
					})
				}
				if (url.includes("/api/application.one")) {
					return Promise.resolve({
						statusCode: 200,
						result: {
							applicationId: "app-1",
							domains: []
						}
					})
				}
				return Promise.resolve({ statusCode: 200, result: {} })
			})

			mockPostJson.mockResolvedValue({
				statusCode: 200,
				result: {}
			})

			await run()

			// Verify domain was created
			expect(mockPostJson).toHaveBeenCalledWith(
				"https://test.dokploy.com/api/domain.create",
				expect.objectContaining({
					applicationId: "app-1",
					host: "api.example.com",
					https: true,
					certificateType: "letsencrypt"
				})
			)

			// Verify deployment URL was set
			expect(core.setOutput).toHaveBeenCalledWith("deployment-url", "https://api.example.com")
		})

		test("should handle deployment with environment variables", async () => {
			core.getInput.mockImplementation((key, options) => {
				const inputs = {
					"dokploy-url": "https://test.dokploy.com",
					"api-key": "test-api-key",
					"docker-image": "ghcr.io/user/app:latest",
					"project-id": "proj-1",
					"environment-id": "env-1",
					"application-id": "app-1",
					"server-id": "srv-1",
					"env": "NODE_ENV=production\nPORT=8080",
					"wait-for-deployment": "false",
					"health-check-enabled": "false"
				}
				return inputs[key] || ""
			})

			mockGetJson.mockResolvedValue({
				statusCode: 200,
				result: { applicationId: "app-1" }
			})

			mockPostJson.mockResolvedValue({
				statusCode: 200,
				result: {}
			})

			await run()

			// Verify environment variables were saved
			expect(mockPostJson).toHaveBeenCalledWith(
				"https://test.dokploy.com/api/application.saveEnvironment",
				expect.objectContaining({
					applicationId: "app-1",
					env: "NODE_ENV=production\nPORT=8080"
				})
			)
		})

		test("should handle errors gracefully", async () => {
			core.getInput.mockImplementation((key, options) => {
				const inputs = {
					"dokploy-url": "https://test.dokploy.com",
					"api-key": "test-api-key",
					"docker-image": "ghcr.io/user/app:latest",
					"project-name": "test-project",
					"environment-name": "production",
					"application-name": "test-app",
					"server-name": "Test-Server",
					"auto-create-resources": "true",
					"wait-for-deployment": "false",
					"health-check-enabled": "false"
				}
				return inputs[key] || ""
			})

			// Mock API to fail on project.all call
			mockGetJson.mockRejectedValue(new Error("Network error"))

			try {
				await run()
			} catch (error) {
				// Expected to throw
			}

			// Verify failure was reported
			expect(core.setFailed).toHaveBeenCalledWith(
				expect.stringContaining("Deployment failed")
			)
		})

		test("should validate required inputs", async () => {
			// Mock getInput to throw on required inputs
			const originalGetInput = core.getInput
			core.getInput = jest.fn().mockImplementation((key, options) => {
				if (options?.required) {
					throw new Error(`Input required and not supplied: ${key}`)
				}
				return ""
			})

			try {
				await run()
			} catch (error) {
				// Expected to throw
			}

			expect(core.setFailed).toHaveBeenCalled()
		})
	})
})

