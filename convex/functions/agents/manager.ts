import { v } from "convex/values";
import { action } from "convex/server";

// Manager Agent - Orchestrates subagents and manages user interactions
export const chat = action({
  args: {
    message: v.string(),
    userId: v.id("users"),
    conversationId: v.optional(v.id("conversations")),
  },
  handler: async (ctx, args) => {
    const { message, userId, conversationId } = args;

    // Step 1: Get or create conversation
    let convId = conversationId;
    if (!convId) {
      convId = await ctx.runMutation("conversations/create", {
        userId,
        platform: "cli",
        platformChannelId: `cli-${Date.now()}`,
      });
    }

    // Store user message
    await ctx.runMutation("messages/store", {
      conversationId: convId,
      role: "user",
      content: message,
      metadata: {},
    });

    // Step 2: Retrieve conversation history
    const history = await ctx.runQuery("messages/listByConversation", {
      conversationId: convId,
      limit: 20,
    });

    // Step 3: Retrieve relevant memories
    const memories = await ctx.runQuery("memories/searchByUser", {
      userId,
      limit: 10,
    });

    // Step 4: Analyze intent and determine if PARA context is needed
    const intent = await analyzeIntent(message, history, memories);

    // Step 5: Gather PARA context if needed
    let paraContext = null;
    if (intent.requiresPARAContext) {
      paraContext = await ctx.runAction("context/para/gather", {
        query: message,
        userId,
      });
    }

    // Step 6: Check for code change requests
    const codeChangeCheck = await detectCodeChangeRequest(message, history);
    if (codeChangeCheck.detected) {
      await ctx.runMutation("codeChangeRequests/create", {
        userId,
        request: codeChangeCheck.request,
        context: JSON.stringify(history.slice(-3)),
        priority: codeChangeCheck.priority,
        category: codeChangeCheck.category,
      });

      return {
        type: "code_change_request",
        message: `I've captured your request for: "${codeChangeCheck.request}". This has been queued for future implementation.`,
        requestId: codeChangeCheck.request,
      };
    }

    // Step 7: Plan and execute subagent tasks with fault tolerance
    const agentResponse = await executeWithFaultTolerance(
      async () => {
        return await generateResponse({
          userMessage: message,
          history: history.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          memories: memories.map((m) => m.content),
          paraContext,
        });
      },
      {
        operation: "generate_response",
        userId,
        conversationId: convId,
      }
    );

    // Step 8: Extract and store memories from this interaction
    const extractedMemories = await extractMemories({
      userMessage: message,
      assistantResponse: agentResponse.content,
      paraContext,
    });

    for (const memory of extractedMemories) {
      await ctx.runMutation("memories/store", {
        userId,
        ...memory,
      });
    }

    // Step 9: Store assistant message
    await ctx.runMutation("messages/store", {
      conversationId: convId,
      role: "assistant",
      content: agentResponse.content,
      metadata: {
        agentType: "manager",
        paraContextUsed: paraContext !== null,
        memoryExtracted: extractedMemories.length > 0,
      },
    });

    // Update conversation activity
    await ctx.runMutation("conversations/updateActivity", {
      conversationId: convId,
    });

    return {
      type: "response",
      content: agentResponse.content,
      memoriesExtracted: extractedMemories.length,
    };
  },
});

// Analyze user intent to determine next steps
async function analyzeIntent(
  message: string,
  history: any[],
  memories: any[]
): Promise<{ requiresPARAContext: boolean; intent: string }> {
  // Simple intent detection - can be enhanced with AI
  const lowerMessage = message.toLowerCase();

  const requiresPARA =
    lowerMessage.includes("project") ||
    lowerMessage.includes("area") ||
    lowerMessage.includes("resource") ||
    lowerMessage.includes("task") ||
    lowerMessage.includes("goal") ||
    lowerMessage.includes("what") ||
    lowerMessage.includes("show") ||
    lowerMessage.includes("list");

  return {
    requiresPARA,
    intent: requiresPARA ? "query" : "general",
  };
}

// Generate response using Z.AI (cheaper than OpenAI)
async function generateResponse({
  userMessage,
  history,
  memories = [],
  paraContext = null,
}: {
  userMessage: string;
  history: Array<{ role: string; content: string }>;
  memories?: string[];
  paraContext?: any;
}): Promise<{ content: string }> {
  const apiKey = process.env.ZAI_API_KEY || process.env.Z_AI_API_KEY;

  if (!apiKey) {
    throw new Error("Z.AI API key not found in environment variables");
  }

  const systemMessage = {
    role: "system" as const,
    content: `You are an intelligent personal assistant with access to the user's PARA (Projects, Areas, Resources, Archives) system.

Your role is to:
1. Help the user manage their projects and tasks
2. Provide context-aware suggestions based on their PARA data
3. Learn from interactions to provide better personalized assistance
4. Be concise, helpful, and proactive

${paraContext ? `\nRelevant PARA Context:\n${JSON.stringify(paraContext, null, 2)}` : ""}

${memories.length > 0 ? `\nRelevant Memories:\n${memories.join("\n- ")}` : ""}

Always base your responses on the provided context when available.`,
  };

  const messages: Array<typeof systemMessage | { role: string; content: string }> = [
    systemMessage,
    ...history.slice(-10), // Keep last 10 messages for context
    {
      role: "user",
      content: userMessage,
    },
  ];

  // Use Z.AI API (OpenAI-compatible, much cheaper)
  const response = await fetch("https://api.z.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini", // Cost-effective model via Z.AI
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Z.AI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  return {
    content: data.choices[0]?.message?.content || "I apologize, but I couldn't generate a response.",
  };
}

// Detect if user is requesting code changes
async function detectCodeChangeRequest(
  message: string,
  history: any[]
): Promise<{
  detected: boolean;
  request?: string;
  priority?: "low" | "medium" | "high";
  category?: "feature" | "bugfix" | "refactor" | "integration";
}> {
  const lowerMessage = message.toLowerCase();

  // Keywords that suggest code changes
  const codeChangeKeywords = [
    "add feature",
    "implement",
    "create functionality",
    "build",
    "integrate",
    "connect to",
    "make it",
    "can you",
    "update to",
    "change behavior",
    "fix code",
    "new capability",
  ];

  const detected = codeChangeKeywords.some((keyword) =>
    lowerMessage.includes(keyword)
  );

  if (!detected) {
    return { detected: false };
  }

  // Categorize the request
  let category: "feature" | "bugfix" | "refactor" | "integration" = "feature";
  if (lowerMessage.includes("fix") || lowerMessage.includes("broken")) {
    category = "bugfix";
  } else if (lowerMessage.includes("refactor") || lowerMessage.includes("clean")) {
    category = "refactor";
  } else if (lowerMessage.includes("integrate") || lowerMessage.includes("connect")) {
    category = "integration";
  }

  // Determine priority
  let priority: "low" | "medium" | "high" = "medium";
  if (lowerMessage.includes("urgent") || lowerMessage.includes("important")) {
    priority = "high";
  } else if (lowerMessage.includes("eventually") || lowerMessage.includes("someday")) {
    priority = "low";
  }

  return {
    detected: true,
    request: message,
    priority,
    category,
  };
}

// Extract memories from interaction
async function extractMemories({
  userMessage,
  assistantResponse,
  paraContext,
}: {
  userMessage: string;
  assistantResponse: string;
  paraContext?: any;
}): Promise<
  Array<{
    type: "preference" | "fact" | "pattern" | "goal";
    content: string;
    importance: number;
  }>
> {
  // Simple memory extraction - can be enhanced with AI
  const memories: Array<{
    type: "preference" | "fact" | "pattern" | "goal";
    content: string;
    importance: number;
  }> = [];

  const lowerMessage = userMessage.toLowerCase();

  // Extract preferences
  if (lowerMessage.includes("i prefer") || lowerMessage.includes("i like")) {
    memories.push({
      type: "preference",
      content: userMessage,
      importance: 0.8,
    });
  }

  // Extract goals
  if (lowerMessage.includes("my goal") || lowerMessage.includes("i want to")) {
    memories.push({
      type: "goal",
      content: userMessage,
      importance: 0.9,
    });
  }

  // Extract facts
  if (lowerMessage.includes("i am") || lowerMessage.includes("i have") || lowerMessage.includes("i work")) {
    memories.push({
      type: "fact",
      content: userMessage,
      importance: 0.7,
    });
  }

  return memories;
}

// Execute with fault tolerance
async function executeWithFaultTolerance<T>(
  operation: () => Promise<T>,
  context: { operation: string; userId: any; conversationId: any }
): Promise<T> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  // Layer 1: Retry with exponential backoff
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.error(`Attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed - for now, just throw
  // TODO: Layer 2 & 3 will be implemented in faultTolerance.ts
  throw lastError;
}
