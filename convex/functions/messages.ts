import { mutation, query } from "convex/server";
import { v } from "convex/values";

export const store = mutation({
  args: {
    conversationId: v.id("conversations"),
    role: v.string(),
    content: v.string(),
    metadata: v.optional(
      v.object({
        agentType: v.optional(v.string()),
        mcpToolUsed: v.optional(v.string()),
        paraContextUsed: v.optional(v.boolean()),
        memoryExtracted: v.optional(v.boolean()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      role: args.role,
      content: args.content,
      metadata: args.metadata || {},
      createdAt: Date.now(),
    });

    return messageId;
  },
});

export const listByConversation = query({
  args: {
    conversationId: v.id("conversations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .take(args.limit || 50);

    return messages;
  },
});
