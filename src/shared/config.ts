import dotenv from "dotenv";

dotenv.config();

export const config = {
  convex: {
    deployment: process.env.CONVEX_DEPLOYMENT || "",
    url: process.env.CONVEX_URL || "",
  },
  discord: {
    token: process.env.DISCORD_TOKEN || "",
    clientId: process.env.DISCORD_CLIENT_ID || "",
    guildId: process.env.DISCORD_GUILD_ID || "",
  },
  zai: {
    apiKey: process.env.ZAI_API_KEY || process.env.Z_AI_API_KEY || "",
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
  },
  notion: {
    clientSecret: process.env.NOTION_CLIENT_SECRET || "",
    clientId: process.env.NOTION_CLIENT_ID || "",
  },
  fastmail: {
    apiKey: process.env.FASTMAIL_API_KEY || "",
  },
} as const;

export function validateConfig() {
  const required = [
    "convex.url",
    "zai.apiKey",  // Z.AI is now required
  ] as const;

  const optional = [
    "openai.apiKey",  // OpenAI is now optional/fallback
  ] as const;

  const missing: string[] = [];
  for (const key of required) {
    const value = key.split(".").reduce((obj: any, k) => obj?.[k], config);
    if (!value) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
