# MCP Claude Shell Server (Node.js)

A Node.js implementation of an MCP (Model Context Protocol) server that wraps the Claude Code CLI, enabling parallel execution of Claude AI requests.

## Features

- **Parallel Execution**: Multiple requests are processed concurrently using Promise-based async handling
- **Retry Logic**: Automatic retry with configurable attempts and timeouts
- **Model Selection**: Support for Haiku, Sonnet, and Opus models
- **JSON Validation**: Built-in JSON response validation for structured outputs
- **Full Claude CLI Options**: Support for all Claude CLI parameters including system prompts, tool permissions, and more

## Installation

```bash
npm install
npm run build
```

## Usage

### As MCP Server

Add to your Claude Code configuration:

```bash
claude mcp add --transport stdio claude-shell -- node /path/to/mcp-claude-node/dist/index.js
```

Or manually add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "claude-shell": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/mcp-claude-node/dist/index.js"]
    }
  }
}
```

### Development

```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Run tests
npx tsx test-client.ts
```

## Available Tools

| Tool | Description |
|------|-------------|
| `claude_generate` | Generate code or text with retry and model selection |
| `claude_edit` | Edit files with retry and model selection |
| `claude_refactor` | Refactor code with retry and model selection |
| `claude_generate_json` | Generate JSON response with validation |
| `claude_edit_json` | Edit with JSON response validation |

## Tool Parameters

All tools support these parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prompt` | string | required | The prompt to send to Claude |
| `model` | string | "haiku" | Model: haiku, sonnet, opus |
| `timeout` | number | 660 | Timeout in seconds |
| `maxRetries` | number | 3 | Maximum retry attempts |
| `maxTurns` | number | - | Maximum agent turns |
| `outputFormat` | string | "json" | Output format: text, json, stream-json |
| `systemPrompt` | string | - | Replace default system prompt |
| `appendSystemPrompt` | string | - | Append to default system prompt |
| `allowedTools` | string[] | - | Additional tools to allow |
| `disallowedTools` | string[] | - | Tools to disallow |
| `addDirs` | string[] | - | Additional directories to access |
| `verbose` | boolean | false | Enable verbose logging |

## Architecture

```
src/
├── index.ts          # Entry point
├── server.ts         # MCP Server main logic
├── claude-cli.ts     # Claude CLI wrapper with retry
├── tools.ts          # Tool definitions
├── types.ts          # TypeScript types
└── utils.ts          # Utility functions
```

## License

MIT
