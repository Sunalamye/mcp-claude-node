import * as readline from 'node:readline';
import { TOOLS, VALID_TOOL_NAMES } from './tools.js';
import { runWithRetry, runJsonWithRetry, extractResultText } from './claude-cli.js';
import { log } from './utils.js';
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  McpToolCallParams,
  ClaudeToolArguments,
  ClaudeCliOptions,
} from './types.js';

// Mutex for atomic output (using Promise chain)
let outputQueue: Promise<void> = Promise.resolve();

/**
 * Atomic output to stdout (ensures parallel responses don't interleave)
 */
function atomicOutput(data: string): void {
  outputQueue = outputQueue.then(() => {
    return new Promise<void>((resolve) => {
      process.stdout.write(data + '\n', () => resolve());
    });
  });
}

/**
 * Send JSON-RPC response
 */
function sendResponse(response: JsonRpcResponse): void {
  atomicOutput(JSON.stringify(response));
}

/**
 * Send JSON-RPC error response
 */
function sendError(id: number | string | null, code: number, message: string, data?: unknown): void {
  sendResponse({
    jsonrpc: '2.0',
    id,
    error: { code, message, data },
  });
}

/**
 * Send JSON-RPC success response
 */
function sendResult(id: number | string, result: unknown): void {
  sendResponse({
    jsonrpc: '2.0',
    id,
    result,
  });
}

/**
 * Handle initialize request
 */
function handleInitialize(id: number | string): void {
  log('Handling initialize request');
  sendResult(id, {
    protocolVersion: '2024-11-05',
    capabilities: { tools: {} },
    serverInfo: { name: 'claude-shell', version: '2.0.0' },
  });
}

/**
 * Handle tools/list request
 */
function handleToolsList(id: number | string): void {
  log('Listing available tools');
  sendResult(id, { tools: TOOLS });
}

/**
 * Parse tool arguments with defaults
 */
function parseToolArguments(args: ClaudeToolArguments): ClaudeCliOptions {
  return {
    model: args.model || 'haiku',
    timeout: args.timeout ?? 660,
    maxRetries: args.maxRetries ?? 3,
    maxTurns: args.maxTurns,
    outputFormat: args.outputFormat || 'json',
    jsonSchema: args.jsonSchema,
    systemPrompt: args.systemPrompt,
    appendSystemPrompt: args.appendSystemPrompt,
    allowedTools: args.allowedTools,
    disallowedTools: args.disallowedTools,
    addDirs: args.addDirs,
    verbose: args.verbose ?? false,
    enableMcp: args.enableMcp ?? false,
    mcpConfigPath: args.mcpConfigPath,
  };
}

/**
 * Handle tools/call request (parallel execution)
 */
async function handleToolCall(id: number | string, params: McpToolCallParams): Promise<void> {
  const { name: toolName, arguments: args } = params;

  log(`Tool: ${toolName} (id=${id})`);
  log(`Model: ${args.model || 'haiku'}, Timeout: ${args.timeout ?? 660}s, Max retries: ${args.maxRetries ?? 3}`);
  log(`Prompt: ${args.prompt?.substring(0, 50)}...`);

  // Validate tool name
  if (!VALID_TOOL_NAMES.has(toolName)) {
    log(`ERROR: Unknown tool: ${toolName}`);
    sendError(id, -32601, `Unknown tool: ${toolName}`);
    return;
  }

  // Parse options
  const options = parseToolArguments(args);

  try {
    let result;

    // Execute based on tool type
    switch (toolName) {
      case 'claude_generate':
      case 'claude_edit':
      case 'claude_refactor': {
        result = await runWithRetry(args.prompt, options);

        if (!result.success) {
          log(`[${id}] ERROR: AI execution failed`);
          sendError(id, -32603, 'Claude CLI error', result.output);
        } else {
          log(`[${id}] Success: Response received`);
          const resultText = extractResultText(result.output);
          sendResult(id, {
            content: [{ type: 'text', text: resultText }],
          });
        }
        break;
      }

      case 'claude_generate_json':
      case 'claude_edit_json': {
        result = await runJsonWithRetry(args.prompt, options);

        if (!result.success) {
          log(`[${id}] ERROR: JSON generation/validation failed`);
          sendError(id, -32603, 'JSON validation error', result.output);
        } else {
          log(`[${id}] Success: Valid JSON response received`);
          sendResult(id, {
            content: [{ type: 'text', text: result.output }],
          });
        }
        break;
      }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log(`[${id}] ERROR: Unexpected error: ${errorMessage}`);
    sendError(id, -32603, 'Internal error', errorMessage);
  }

  log(`[${id}] Response sent`);
}

/**
 * Process a single JSON-RPC request
 */
function processRequest(line: string): void {
  if (!line.trim()) return;

  log(`Received: ${line.substring(0, 100)}...`);

  let request: JsonRpcRequest;
  try {
    request = JSON.parse(line);
  } catch {
    log('ERROR: Invalid JSON');
    sendError(null, -32700, 'Parse error');
    return;
  }

  const { id, method, params } = request;

  switch (method) {
    case 'initialize':
      handleInitialize(id);
      break;

    case 'initialized':
      log('Received initialized notification');
      // No response needed for notifications
      break;

    case 'tools/list':
      handleToolsList(id);
      break;

    case 'tools/call':
      // Execute in parallel (don't await - fire and forget)
      handleToolCall(id, params as unknown as McpToolCallParams).catch((err) => {
        log(`ERROR: Unhandled error in tool call: ${err}`);
      });
      log(`Spawned async task for id=${id}`);
      break;

    default:
      log(`ERROR: Unsupported method: ${method}`);
      sendError(id, -32601, `Method not found: ${method}`);
  }
}

/**
 * Start the MCP server
 */
export function startServer(): void {
  log('Starting Claude Code MCP server (Node.js v2.0)...');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on('line', (line) => {
    processRequest(line);
  });

  rl.on('close', () => {
    log('stdin closed, shutting down...');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    log('Received SIGINT, shutting down...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    log('Received SIGTERM, shutting down...');
    process.exit(0);
  });
}
