import type { McpToolDefinition } from './types.js';

const modelEnum = ['haiku', 'sonnet', 'opus', 'Haiku', 'Sonnet', 'Opus', 'Opus 4.5'];
const outputFormatEnum = ['text', 'json', 'stream-json'];

const commonProperties = {
  prompt: {
    type: 'string',
    description: 'Prompt to pass to Claude CLI',
  },
  model: {
    type: 'string',
    description: 'Model to use (haiku, sonnet, opus). Default: haiku',
    enum: modelEnum,
  },
  timeout: {
    type: 'number',
    description: 'Timeout in seconds. Default: 660',
  },
  maxRetries: {
    type: 'number',
    description: 'Maximum retry attempts. Default: 3',
  },
  maxTurns: {
    type: 'number',
    description: 'Maximum agent turns (iterations). Default: unlimited',
  },
  outputFormat: {
    type: 'string',
    description: 'Output format: text, json, stream-json. Default: json',
    enum: outputFormatEnum,
  },
  systemPrompt: {
    type: 'string',
    description: 'Replace default system prompt',
  },
  appendSystemPrompt: {
    type: 'string',
    description: 'Append to default system prompt',
  },
  allowedTools: {
    type: 'array',
    items: { type: 'string' },
    description: 'Additional tools to allow without asking',
  },
  disallowedTools: {
    type: 'array',
    items: { type: 'string' },
    description: 'Tools to disallow',
  },
  addDirs: {
    type: 'array',
    items: { type: 'string' },
    description: 'Additional directories to access',
  },
  verbose: {
    type: 'boolean',
    description: 'Enable verbose logging. Default: false',
  },
};

const jsonToolProperties = {
  prompt: commonProperties.prompt,
  model: commonProperties.model,
  maxRetries: {
    type: 'number',
    description: 'Maximum retry attempts for JSON validation. Default: 3',
  },
  jsonSchema: {
    type: 'string',
    description: 'JSON Schema to validate output against',
  },
  systemPrompt: commonProperties.systemPrompt,
  appendSystemPrompt: commonProperties.appendSystemPrompt,
};

export const TOOLS: McpToolDefinition[] = [
  {
    name: 'claude_generate',
    description: 'Generate code or text via Claude Code CLI with retry and model selection',
    inputSchema: {
      type: 'object',
      properties: commonProperties,
      required: ['prompt'],
    },
  },
  {
    name: 'claude_edit',
    description: 'Edit files via Claude Code CLI with retry and model selection',
    inputSchema: {
      type: 'object',
      properties: commonProperties,
      required: ['prompt'],
    },
  },
  {
    name: 'claude_refactor',
    description: 'Refactor code via Claude Code CLI with retry and model selection',
    inputSchema: {
      type: 'object',
      properties: commonProperties,
      required: ['prompt'],
    },
  },
  {
    name: 'claude_generate_json',
    description: 'Generate JSON response with validation and retry',
    inputSchema: {
      type: 'object',
      properties: jsonToolProperties,
      required: ['prompt'],
    },
  },
  {
    name: 'claude_edit_json',
    description: 'Edit with JSON response validation and retry',
    inputSchema: {
      type: 'object',
      properties: jsonToolProperties,
      required: ['prompt'],
    },
  },
];

export const VALID_TOOL_NAMES = new Set(TOOLS.map((t) => t.name));
