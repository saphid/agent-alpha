import { v } from "convex/values";
import { mutation, query } from "../../_generated/server";

/**
 * Store MCP diagnostic results for monitoring and analytics
 */
export const storeDiagnosticResult = mutation({
  args: {
    userId: v.id("users"),
    diagnostic: v.object({
      timestamp: v.string(),
      overallStatus: v.string(),
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
    }),
  },
  handler: async (ctx, args) => {
    const { userId, diagnostic } = args;

    // Store diagnostic result
    const diagnosticId = await ctx.db.insert("mcpDiagnostics", {
      userId,
      timestamp: diagnostic.timestamp,
      overallStatus: diagnostic.overallStatus as any,
      mcpServers: diagnostic.mcpServers,
      summary: diagnostic.summary,
    });

    return { success: true, diagnosticId };
  },
});

/**
 * Get recent MCP diagnostic results for a user
 */
export const getRecentDiagnostics = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, limit = 10 } = args;

    const diagnostics = await ctx.db
      .query("mcpDiagnostics")
      .withIndex("byUserId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    return diagnostics;
  },
});
