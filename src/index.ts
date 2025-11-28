#!/usr/bin/env node

/**
 * MCP Shell Server for Claude Code CLI (Node.js Version v2.0)
 *
 * This server implements the MCP protocol to call Claude Code CLI locally.
 *
 * Supports:
 *   - claude_generate: Generate code or text
 *   - claude_edit: Edit files
 *   - claude_refactor: Refactor code
 *   - claude_generate_json: Generate with JSON validation
 *   - claude_edit_json: Edit with JSON validation
 *
 * Features:
 *   - Parallel execution of tools/call requests
 *   - JSON output format (default)
 *   - JSON Schema validation
 *   - Max turns control
 *   - System prompt customization
 *   - Tool permission control
 *   - Retry with timeout
 */

import { startServer } from './server.js';

startServer();
