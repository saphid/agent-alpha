import { mutation, query } from "convex/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    userId: v.id("users"),
    platform: v.string(),
    platformChannelId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const conversationId = await ctx.db.insert("conversations", {
      userId: args.userId,
      platform: args.platform,
      platformChannelId: args.platformChannelId,
      startedAt: now,
      lastActivityAt: now,
      status: "active",
    });

    return conversationId;
  },
});

export const get = query({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const listByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return conversations;
  },
});

export const updateActivity = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.conversationId, {
      lastActivityAt: Date.now(),
    });
  },
});
