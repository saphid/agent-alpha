import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users: Discord user IDs and linked accounts
  users: defineTable({
    discordId: v.string(),
    notionOAuthToken: v.optional(v.string()),
    notionDatabaseId: v.optional(v.string()),
    fastmailUsername: v.optional(v.string()),
    fastmailApiKey: v.optional(v.string()),
    preferences: v.optional(
      v.object({
        defaultContextDepth: v.number(),
        enablePARAGathering: v.boolean(),
        notificationLevel: v.string(),
      })
    ),
  })
    .index("by_discord", ["discordId"])
    .index("by_notion", ["notionOAuthToken"]),

  // Conversations: Threaded conversations across CLI/Discord
  conversations: defineTable({
    userId: v.id("users"),
    platform: v.string(), // "cli" or "discord"
    platformChannelId: v.string(), // CLI session ID or Discord DM channel ID
    startedAt: v.number(),
    lastActivityAt: v.number(),
    status: v.string(), // "active", "paused", "archived"
  })
    .index("by_user", ["userId"])
    .index("by_platform", ["platform", "platformChannelId"]),

  // Messages: Individual messages in conversations
  messages: defineTable({
    conversationId: v.id("conversations"),
    role: v.string(), // "user" or "assistant"
    content: v.string(),
    metadata: v.optional(
      v.object({
        agentType: v.optional(v.string()), // "manager", "notion", "fastmail", "troubleshooting"
        mcpToolUsed: v.optional(v.string()),
        paraContextUsed: v.optional(v.boolean()),
        memoryExtracted: v.optional(v.boolean()),
      })
    ),
    createdAt: v.number(),
  }).index("by_conversation", ["conversationId"]),

  // Memories: Long-term memories for personalization
  memories: defineTable({
    userId: v.id("users"),
    type: v.string(), // "preference" | "fact" | "pattern" | "goal"
    content: v.string(),
    paraContext: v.optional(v.id("users")), // Linked to project/area reference
    importance: v.number(), // 0-1
    accessedCount: v.number(),
    lastAccessed: v.number(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_type", ["userId", "type"])
    .index("by_importance", ["userId", "importance"]),

  // Code Change Requests: Feature requests and code improvements
  codeChangeRequests: defineTable({
    userId: v.id("users"),
    request: v.string(),
    context: v.string(), // Conversation context
    priority: v.string(), // "low" | "medium" | "high"
    category: v.string(), // "feature" | "bugfix" | "refactor" | "integration"
    status: v.string(), // "pending" | "approved" | "implemented" | "declined"
    createdAt: v.number(),
    implementedAt: v.optional(v.number()),
    implementationNotes: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_priority", ["priority"]),

  // PARA Context Cache: Cached PARA context
  paraContextCache: defineTable({
    userId: v.id("users"),
    contextType: v.string(), // "projects", "areas", "resources", "archive"
    data: v.any(), // Cached PARA data
    retrievedAt: v.number(),
    expiresAt: v.number(),
  }).index("by_user_type", ["userId", "contextType"]),

  // Agent Tasks: Individual agent tasks with fault tolerance
  agentTasks: defineTable({
    conversationId: v.id("conversations"),
    agentType: v.string(), // "manager", "notion", "fastmail", "troubleshooting"
    taskType: v.string(), // "query_notion", "send_email", etc.
    input: v.any(),
    status: v.string(), // "pending", "running", "completed", "failed", "escalated"
    output: v.optional(v.any()),
    error: v.optional(v.string()),
    retryCount: v.number(),
    escalatedToTroubleshooter: v.boolean(),
    troubleshootingResult: v.optional(v.any()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_status", ["status"]),

  // Incidents: Troubleshooting incidents for learning
  incidents: defineTable({
    taskId: v.id("agentTasks"),
    errorType: v.string(),
    diagnosis: v.string(),
    resolution: v.optional(v.string()),
    severity: v.string(), // "low", "medium", "high"
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_severity", ["severity"])
    .index("by_date", ["createdAt"]),

  // MCP Connections: MCP server connection status
  mcpConnections: defineTable({
    serverName: v.string(), // "notion", "fastmail"
    status: v.string(), // "connected", "disconnected", "error"
    lastHealthCheck: v.number(),
    errorCount: v.number(),
    lastError: v.optional(v.string()),
  }).index("by_server", ["serverName"]),

  // MCP Diagnostics: Diagnostic test results
  mcpDiagnostics: defineTable({
    userId: v.id("users"),
    timestamp: v.string(),
    overallStatus: v.string(), // "healthy", "degraded", "unhealthy"
    mcpServers: v.array(
      v.object({
        name: v.string(),
        status: v.string(),
        configured: v.boolean(),
        testData: v.optional(v.any()),
        error: v.optional(v.string()),
        latency: v.optional(v.number()),
      })
    ),
    summary: v.object({
      total: v.number(),
      connected: v.number(),
      disconnected: v.number(),
      errors: v.number(),
    }),
  })
    .index("byUserId", ["userId"])
    .index("by_status", ["overallStatus"])
    .index("by_timestamp", ["timestamp"]),
});
