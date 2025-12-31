# Convex Functions

This is the Convex backend for the Managua personal assistant.

## Initial Deployment

Run: `bunx convex dev`

This will:
1. Generate the `convex/_generated` files
2. Deploy the schema to your Convex deployment
3. Start watching for changes

## Function Structure

- `schema.ts` - Database schema
- `functions/agents/` - Agent implementations
- `functions/mcp/` - MCP client wrappers
- `functions/context/` - Context gathering
- `functions/memory/` - Memory management
- `functions/api/` - HTTP endpoints

After initial deployment, all files should import from `./_generated/server` instead of `convex/server`.
