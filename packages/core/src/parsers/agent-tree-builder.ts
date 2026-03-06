import type { JsonlLine, AssistantMessage, UserMessage, ToolUseBlock } from "../types/jsonl.js";
import type { AgentNode } from "../types/agent-tree.js";
import { createRootAgent, createEmptyTokenUsage } from "../types/agent-tree.js";
import { accumulateTokens } from "./token-aggregator.js";

/**
 * Stateful builder that processes JSONL lines and maintains an agent tree.
 * Detects Agent/Task tool_use blocks for subagent spawning, and correlates
 * tool results to track subagent completion.
 */
export class AgentTreeBuilder {
  private root: AgentNode;
  // Track pending subagents by tool_use_id -> AgentNode
  private pendingByToolUseId = new Map<string, AgentNode>();
  // Track agents by agentId -> AgentNode
  private agentById = new Map<string, AgentNode>();

  constructor(sessionId: string, startedAt: string) {
    this.root = createRootAgent(sessionId, startedAt);
    this.agentById.set("root", this.root);
  }

  getTree(): AgentNode {
    return this.root;
  }

  /**
   * Process a JSONL line and update the agent tree.
   */
  processLine(line: JsonlLine): void {
    switch (line.type) {
      case "assistant":
        this.processAssistantMessage(line);
        break;
      case "user":
        this.processUserMessage(line);
        break;
      case "system":
        if (line.subtype === "compact_boundary" || line.compactMetadata) {
          this.root.tokenUsage.compactionCount++;
        }
        break;
    }
  }

  private processAssistantMessage(msg: AssistantMessage): void {
    const model = msg.message.model;
    const usage = msg.message.usage;

    // Update root agent's token usage
    if (usage) {
      accumulateTokens(this.root.tokenUsage, usage, model);
    }

    if (!this.root.model && model) {
      this.root.model = model;
    }

    // Look for Agent/Task tool_use blocks (subagent spawning)
    for (const block of msg.message.content) {
      if (block.type !== "tool_use") continue;
      const toolBlock = block as ToolUseBlock;

      if (toolBlock.name === "Agent" || toolBlock.name === "Task") {
        const input = toolBlock.input as Record<string, unknown>;
        const child: AgentNode = {
          agentId: toolBlock.id, // Use tool_use_id until we get the real agentId
          sessionId: msg.sessionId,
          parentAgentId: "root",
          agentType: (input.subagent_type as string) ?? (input.description as string),
          model: input.model as string | undefined,
          prompt: input.prompt as string | undefined,
          status: "running",
          startedAt: msg.timestamp,
          tokenUsage: createEmptyTokenUsage(),
          toolUseCount: 0,
          children: [],
        };

        this.root.children.push(child);
        this.pendingByToolUseId.set(toolBlock.id, child);
        this.agentById.set(toolBlock.id, child);
      } else {
        // Regular tool use — increment count
        this.root.toolUseCount++;
        this.root.currentTool = toolBlock.name;
      }
    }
  }

  private processUserMessage(msg: UserMessage): void {
    // Check for subagent completion via toolUseResult
    if (msg.toolUseResult) {
      const result = msg.toolUseResult;
      const agentId = result.agentId;

      // Try to find the matching agent by iterating pending ones
      // The sourceToolAssistantUUID links back to the assistant message with the tool_use
      let agent: AgentNode | undefined;

      if (msg.sourceToolAssistantUUID) {
        // Find the pending agent whose tool_use_id matches
        for (const [toolUseId, node] of this.pendingByToolUseId) {
          // The agent was created with the tool_use_id as its agentId
          if (node.agentId === toolUseId) {
            agent = node;
            // Update the agentId to the real one from the result
            this.agentById.delete(toolUseId);
            node.agentId = agentId;
            this.agentById.set(agentId, node);
            this.pendingByToolUseId.delete(toolUseId);
            break;
          }
        }
      }

      // Fallback: try to match by agentId directly
      if (!agent) {
        agent = this.agentById.get(agentId);
      }

      if (agent) {
        if (result.status === "async_launched") {
          // Background agent — stays running until its subagent JSONL completes
          agent.status = "running";
        } else {
          agent.status = result.status === "completed" ? "completed" : "error";
          agent.completedAt = msg.timestamp;
          agent.durationMs = parseInt(result.totalDurationMs, 10) || undefined;
          agent.toolUseCount = parseInt(result.totalToolUseCount, 10) || 0;
          agent.currentTool = undefined;
          if (result.status === "error" && typeof result.content === "string") {
            agent.errorMessage = result.content.slice(0, 500);
          }
        }

        // Parse usage from the stringified JSON
        try {
          const usageStr = result.usage;
          if (usageStr) {
            const usage = JSON.parse(usageStr);
            if (typeof usage.input_tokens === "number") {
              accumulateTokens(agent.tokenUsage, usage, agent.model);
            }
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    // Clear currentTool on root when we get a user message (tool result returned)
    if (!msg.toolUseResult) {
      this.root.currentTool = undefined;
    }
  }

  /**
   * Process a subagent's JSONL line (from subagent file).
   * Updates the corresponding child node's token usage.
   */
  processSubagentLine(agentId: string, line: JsonlLine): void {
    const agent = this.agentById.get(agentId);
    if (!agent) return;

    if (line.type === "assistant" && line.message.usage) {
      accumulateTokens(agent.tokenUsage, line.message.usage, line.message.model);
      if (!agent.model && line.message.model) {
        agent.model = line.message.model;
      }
    }

    if (line.type === "assistant") {
      for (const block of line.message.content) {
        if (block.type === "tool_use") {
          agent.toolUseCount++;
          agent.currentTool = block.name;
        }
      }
    }
  }
}
