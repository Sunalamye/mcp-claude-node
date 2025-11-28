// JSON-RPC 2.0 Types
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

// MCP Protocol Types
export interface McpInitializeResult {
  protocolVersion: string;
  capabilities: {
    tools: Record<string, unknown>;
  };
  serverInfo: {
    name: string;
    version: string;
  };
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

export interface McpToolsListResult {
  tools: McpToolDefinition[];
}

export interface McpToolCallParams {
  name: string;
  arguments: ClaudeToolArguments;
}

export interface McpToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
}

// Claude CLI Types
export type ClaudeModel = 'haiku' | 'sonnet' | 'opus' | 'Haiku' | 'Sonnet' | 'Opus' | 'Opus 4.5';

export interface ClaudeToolArguments {
  prompt: string;
  model?: ClaudeModel;
  timeout?: number;
  maxRetries?: number;
  maxTurns?: number;
  outputFormat?: 'text' | 'json' | 'stream-json';
  jsonSchema?: string;
  systemPrompt?: string;
  appendSystemPrompt?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  addDirs?: string[];
  verbose?: boolean;
  /** Enable MCP servers in subprocess (passes --mcp-config) */
  enableMcp?: boolean;
  /** Custom MCP config path (default: auto-detect project .mcp.json) */
  mcpConfigPath?: string;
}

export interface ClaudeCliOptions {
  model: string;
  timeout: number;
  maxRetries: number;
  maxTurns?: number;
  outputFormat: string;
  jsonSchema?: string;
  systemPrompt?: string;
  appendSystemPrompt?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  addDirs?: string[];
  verbose: boolean;
  /** Enable MCP servers in subprocess */
  enableMcp?: boolean;
  /** Custom MCP config path */
  mcpConfigPath?: string;
}

export interface ClaudeExecutionResult {
  success: boolean;
  output: string;
  exitCode: number;
}
