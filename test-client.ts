#!/usr/bin/env npx tsx

/**
 * MCP Client Test - Tests the claude-shell MCP server
 */

import { spawn, ChildProcess } from 'node:child_process';
import * as readline from 'node:readline';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

class McpClient {
  private process: ChildProcess;
  private rl: readline.Interface;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: JsonRpcResponse) => void;
    reject: (error: Error) => void;
  }>();

  constructor() {
    console.log('🚀 Starting MCP server...');

    this.process = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: '/home/user/kali-Library-react/mcp/mcp-claude-node',
    });

    this.rl = readline.createInterface({
      input: this.process.stdout!,
      terminal: false,
    });

    // Handle responses
    this.rl.on('line', (line) => {
      try {
        const response: JsonRpcResponse = JSON.parse(line);
        const pending = this.pendingRequests.get(response.id);
        if (pending) {
          this.pendingRequests.delete(response.id);
          pending.resolve(response);
        }
      } catch (e) {
        console.error('Failed to parse response:', line);
      }
    });

    // Log stderr
    this.process.stderr?.on('data', (data) => {
      console.log('📝 Server log:', data.toString().trim());
    });

    this.process.on('error', (err) => {
      console.error('❌ Process error:', err);
    });

    this.process.on('exit', (code) => {
      console.log(`👋 Server exited with code ${code}`);
    });
  }

  async send(method: string, params?: Record<string, unknown>): Promise<JsonRpcResponse> {
    const id = ++this.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      const data = JSON.stringify(request) + '\n';
      console.log(`\n📤 Sending: ${method} (id=${id})`);

      this.process.stdin!.write(data, (err) => {
        if (err) {
          this.pendingRequests.delete(id);
          reject(err);
        }
      });

      // Timeout after 120 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request ${id} timed out`));
        }
      }, 120000);
    });
  }

  close() {
    this.process.stdin!.end();
    this.process.kill();
  }
}

async function runTests() {
  const client = new McpClient();

  try {
    // Test 1: Initialize
    console.log('\n' + '='.repeat(50));
    console.log('📋 Test 1: Initialize');
    console.log('='.repeat(50));

    const initResponse = await client.send('initialize');
    console.log('✅ Initialize response:', JSON.stringify(initResponse.result, null, 2));

    // Send initialized notification (no response expected, but we send it)
    client.send('initialized').catch(() => {});
    await sleep(100);

    // Test 2: List tools
    console.log('\n' + '='.repeat(50));
    console.log('📋 Test 2: List Tools');
    console.log('='.repeat(50));

    const toolsResponse = await client.send('tools/list');
    const tools = (toolsResponse.result as { tools: Array<{ name: string; description: string }> }).tools;
    console.log('✅ Available tools:');
    tools.forEach((t) => {
      console.log(`   - ${t.name}: ${t.description.substring(0, 50)}...`);
    });

    // Test 3: Call claude_generate with a simple prompt
    console.log('\n' + '='.repeat(50));
    console.log('📋 Test 3: Call claude_generate');
    console.log('='.repeat(50));

    const generateResponse = await client.send('tools/call', {
      name: 'claude_generate',
      arguments: {
        prompt: 'Say "Hello from MCP!" and nothing else. Do not use any tools.',
        model: 'haiku',
        maxTurns: 1,
        timeout: 60,
      },
    });

    if (generateResponse.error) {
      console.log('❌ Error:', generateResponse.error);
    } else {
      const content = (generateResponse.result as { content: Array<{ text: string }> }).content;
      console.log('✅ Response:', content[0]?.text?.substring(0, 200) || 'No content');
    }

    // Test 4: Parallel requests
    console.log('\n' + '='.repeat(50));
    console.log('📋 Test 4: Parallel Requests (2 concurrent)');
    console.log('='.repeat(50));

    const startTime = Date.now();

    const [response1, response2] = await Promise.all([
      client.send('tools/call', {
        name: 'claude_generate',
        arguments: {
          prompt: 'What is 2+2? Answer with just the number.',
          model: 'haiku',
          maxTurns: 1,
          timeout: 60,
        },
      }),
      client.send('tools/call', {
        name: 'claude_generate',
        arguments: {
          prompt: 'What is 3+3? Answer with just the number.',
          model: 'haiku',
          maxTurns: 1,
          timeout: 60,
        },
      }),
    ]);

    const elapsed = Date.now() - startTime;
    console.log(`⏱️  Parallel requests completed in ${elapsed}ms`);

    if (response1.result) {
      const content1 = (response1.result as { content: Array<{ text: string }> }).content;
      console.log('✅ Response 1:', content1[0]?.text?.substring(0, 100) || 'No content');
    }
    if (response2.result) {
      const content2 = (response2.result as { content: Array<{ text: string }> }).content;
      console.log('✅ Response 2:', content2[0]?.text?.substring(0, 100) || 'No content');
    }

    console.log('\n' + '='.repeat(50));
    console.log('🎉 All tests completed!');
    console.log('='.repeat(50));

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    console.log('\n👋 Closing client...');
    client.close();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run tests
runTests();
