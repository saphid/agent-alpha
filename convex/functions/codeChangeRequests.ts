import { mutation, query } from "convex/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    userId: v.id("users"),
    request: v.string(),
    context: v.string(),
    priority: v.string(),
    category: v.string(),
  },
  handler: async (ctx, args) => {
    const requestId = await ctx.db.insert("codeChangeRequests", {
      userId: args.userId,
      request: args.request,
      context: args.context,
      priority: args.priority,
      category: args.category,
      status: "pending",
      createdAt: Date.now(),
    });

    return requestId;
  },
});

export const listByUser = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const requests = await ctx.db
      .query("codeChangeRequests")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    return requests;
  },
});

export const updateStatus = mutation({
  args: {
    requestId: v.id("codeChangeRequests"),
    status: v.string(),
    implementationNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: any = {
      status: args.status,
    };

    if (args.status === "implemented") {
      updates.implementedAt = Date.now();
    }

    if (args.implementationNotes) {
      updates.implementationNotes = args.implementationNotes;
    }

    await ctx.db.patch(args.requestId, updates);
  },
});
