import { mutation, query } from "convex/server";
import { v } from "convex/values";

export const store = mutation({
  args: {
    userId: v.id("users"),
    type: v.string(),
    content: v.string(),
    paraContext: v.optional(v.id("users")),
    importance: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const memoryId = await ctx.db.insert("memories", {
      userId: args.userId,
      type: args.type,
      content: args.content,
      paraContext: args.paraContext,
      importance: args.importance || 0.5,
      accessedCount: 0,
      lastAccessed: Date.now(),
      createdAt: Date.now(),
    });

    return memoryId;
  },
});

export const searchByUser = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const memories = await ctx.db
      .query("memories")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit || 20);

    // Update access counts
    for (const memory of memories) {
      await ctx.db.patch(memory._id, {
        accessedCount: memory.accessedCount + 1,
        lastAccessed: Date.now(),
      });
    }

    return memories;
  },
});

export const listByType = query({
  args: {
    userId: v.id("users"),
    type: v.string(),
  },
  handler: async (ctx, args) => {
    const memories = await ctx.db
      .query("memories")
      .withIndex("by_type", (q) =>
        q.eq("userId", args.userId).eq("type", args.type)
      )
      .collect();

    return memories;
  },
});
