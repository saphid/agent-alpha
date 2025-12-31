#!/usr/bin/env bun
import { Command } from "commander";
import ora, { Ora } from "ora";
import { ConvexClient } from "convex/dev";
import { config, validateConfig } from "../shared/config.js";
import { logger } from "../shared/logger.js";

const program = new Command();

program
  .name("managua")
  .description("Intelligent Personal Assistant with MCP Integration")
  .version("0.1.0");

// Validate config
try {
  validateConfig();
} catch (error) {
  logger.error((error as Error).message);
  process.exit(1);
}

// Chat command - Interactive chat session
program
  .command("chat")
  .description("Start interactive chat session")
  .action(async () => {
    const spinner = ora("Initializing Managua...").start();

    try {
      // Initialize Convex client
      const convex = new ConvexClient(config.convex.url, {
        // @ts-ignore - ConvexClient accepts this format
        unpublishDeprecated: true,
      });

      spinner.succeed("Connected to Convex");

      // Get or create user (for CLI, use a default user ID)
      // TODO: Implement proper user authentication
      const userId = "cli_user" as any;

      logger.info("Starting interactive chat session...");
      logger.info("Type 'exit' or press Ctrl+C to quit\n");

      // Start interactive loop
      await startInteractiveLoop(convex, userId);
    } catch (error) {
      spinner.fail("Failed to initialize");
      logger.error(error);
      process.exit(1);
    }
  });

// Task command - Execute a single task
program
  .command("task <description>")
  .description("Execute a single task")
  .action(async (description: string) => {
    const spinner = ora("Processing your request...").start();

    try {
      const convex = new ConvexClient(config.convex.url);
      const userId = "cli_user" as any;

      spinner.text = "Sending to manager agent...";

      // Call manager agent
      const response = await convex.mutation("agents/chat", {
        message: description,
        userId,
      });

      spinner.stop();

      if (response.type === "response") {
        console.log("\n" + "─".repeat(60));
        console.log(response.content);
        console.log("─".repeat(60));

        if (response.memoriesExtracted > 0) {
          console.log(`\n✓ Extracted ${response.memoriesExtracted} memories from this interaction`);
        }
      } else if (response.type === "code_change_request") {
        console.log("\n" + "─".repeat(60));
        console.log(response.message);
        console.log("─".repeat(60));
      }
    } catch (error) {
      spinner.fail("Task execution failed");
      logger.error(error);
      process.exit(1);
    }
  });

// Interactive chat loop
async function startInteractiveLoop(convex: ConvexClient, userId: any) {
  const readline = await import("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let conversationId: string | undefined;
  let spinner: Ora | null = null;

  const askQuestion = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };

  while (true) {
    try {
      const input = await askQuestion("\n🤖 You: ");

      if (!input.trim() || input.toLowerCase() === "exit") {
        console.log("\n👋 Goodbye!");
        rl.close();
        break;
      }

      spinner = ora("Thinking...").start();

      const response = await convex.mutation("agents/chat", {
        message: input.trim(),
        userId,
        conversationId: conversationId as any,
      });

      spinner.stop();

      if (response.type === "response") {
        console.log("\n🤖 Assistant:", response.content);

        if (response.memoriesExtracted > 0) {
          console.log(`\n  ✓ Learned ${response.memoriesExtracted} new things`);
        }
      } else if (response.type === "code_change_request") {
        console.log("\n📝", response.message);
      }

      // Keep track of conversation ID for context
      // Note: In a real implementation, this would come from the response
    } catch (error) {
      if (spinner) spinner.fail("Request failed");
      logger.error(error);
      console.log("\n❌ Something went wrong. Please try again.");
    }
  }
}

program.parse();
