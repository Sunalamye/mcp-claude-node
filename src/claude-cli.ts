import { spawn } from 'node:child_process';
import type { ClaudeModel, ClaudeCliOptions, ClaudeExecutionResult } from './types.js';
import { log, sleep } from './utils.js';

// Model name mapping (Updated: 2025-11)
const MODEL_MAP: Record<string, string> = {
  haiku: 'claude-haiku-4-5-20251001',
  Haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-5-20250929',
  Sonnet: 'claude-sonnet-4-5-20250929',
  opus: 'claude-opus-4-5-20251101',
  Opus: 'claude-opus-4-5-20251101',
  'Opus 4.5': 'claude-opus-4-5-20251101',
};

/**
 * Default disallowed tools for parallel task execution
 * These commands block other parallel tasks and should use single-file alternatives
 *
 * Disallowed:                    Use instead:
 * - npm run build               → npx tsc --noEmit [file]
 * - npm run dev                 → (not needed for testing)
 * - npm test                    → npx vitest run [test-file]
 * - npm run test:run            → npx vitest run [test-file]
 * - npm run lint                → npx eslint [file]
 * - npx tsc -b                  → npx tsc --noEmit [file]
 * - npx eslint .                → npx eslint [file]
 */
const DEFAULT_DISALLOWED_TOOLS: string[] = [
  'Bash(npm run build:*)',
  'Bash(npm run dev:*)',
  'Bash(npm test:*)',
  'Bash(npm run test:run:*)',
  'Bash(npm run lint:*)',
  'Bash(npx tsc -b:*)',
  'Bash(npx eslint .:*)',
];

/**
 * Map model name to Claude CLI format
 */
export function mapModelName(model: ClaudeModel | string): string {
  const mapped = MODEL_MAP[model];
  if (!mapped) {
    log(`WARNING: Unknown model '${model}', using haiku as default`);
    return MODEL_MAP.haiku;
  }
  return mapped;
}

/**
 * Build Claude CLI arguments
 */
export function buildClaudeArgs(options: ClaudeCliOptions): string[] {
  const args: string[] = [
    '--model',
    mapModelName(options.model),
    '--dangerously-skip-permissions',
    '-p',
  ];

  // Output format (default: json)
  args.push('--output-format', options.outputFormat || 'json');

  // Max turns
  if (options.maxTurns !== undefined && options.maxTurns !== null) {
    args.push('--max-turns', String(options.maxTurns));
  }

  // JSON Schema
  if (options.jsonSchema) {
    args.push('--json-schema', options.jsonSchema);
  }

  // System prompt (replace default)
  if (options.systemPrompt) {
    args.push('--system-prompt', options.systemPrompt);
  }

  // Append system prompt
  if (options.appendSystemPrompt) {
    args.push('--append-system-prompt', options.appendSystemPrompt);
  }

  // Allowed tools
  if (options.allowedTools?.length) {
    for (const tool of options.allowedTools) {
      args.push('--allowedTools', tool);
    }
  }

  // Disallowed tools (merge with defaults)
  const allDisallowedTools = new Set([
    ...DEFAULT_DISALLOWED_TOOLS,
    ...(options.disallowedTools || []),
  ]);
  for (const tool of allDisallowedTools) {
    args.push('--disallowedTools', tool);
  }

  // Additional directories
  if (options.addDirs?.length) {
    for (const dir of options.addDirs) {
      args.push('--add-dir', dir);
    }
  }

  // Verbose mode
  if (options.verbose) {
    args.push('--verbose');
  }

  return args;
}

/**
 * Execute Claude CLI command
 */
export function executeClaudeCli(
  prompt: string,
  args: string[],
  timeoutMs: number
): Promise<ClaudeExecutionResult> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    const errorChunks: Buffer[] = [];
    let killed = false;

    log(`Executing: claude ${args.join(' ')}`);
    log(`Prompt preview: ${prompt.substring(0, 100)}...`);

    const proc = spawn('claude', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Set timeout
    const timer = setTimeout(() => {
      killed = true;
      proc.kill('SIGKILL');
      log(`Process killed due to timeout (${timeoutMs}ms)`);
    }, timeoutMs);

    proc.stdout.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      errorChunks.push(chunk);
    });

    // Write prompt to stdin
    proc.stdin.write(prompt);
    proc.stdin.end();

    proc.on('close', (code) => {
      clearTimeout(timer);
      const output = Buffer.concat(chunks).toString('utf-8');
      const errorOutput = Buffer.concat(errorChunks).toString('utf-8');

      if (killed) {
        resolve({
          success: false,
          output: 'Command timeout',
          exitCode: 124,
        });
      } else if (code === 0) {
        resolve({
          success: true,
          output,
          exitCode: 0,
        });
      } else {
        resolve({
          success: false,
          output: errorOutput || output || `Exit code: ${code}`,
          exitCode: code ?? 1,
        });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        success: false,
        output: `Spawn error: ${err.message}`,
        exitCode: 1,
      });
    });
  });
}

/**
 * Execute Claude CLI with retry
 */
export async function runWithRetry(
  prompt: string,
  options: ClaudeCliOptions
): Promise<ClaudeExecutionResult> {
  const args = buildClaudeArgs(options);
  const timeoutMs = options.timeout * 1000;

  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    log(`Attempt ${attempt}/${options.maxRetries}`);

    const result = await executeClaudeCli(prompt, args, timeoutMs);

    if (result.success) {
      log(`Success on attempt ${attempt}`);
      return result;
    }

    // Check if timeout (exit code 124 or 137)
    if (result.exitCode === 124 || result.exitCode === 137) {
      log(`WARNING: Command timeout on attempt ${attempt}`);
      if (attempt < options.maxRetries) {
        log('Waiting 5 seconds before retry...');
        await sleep(5000);
      }
    } else {
      log(`ERROR: Command failed with exit code ${result.exitCode} on attempt ${attempt}`);
      log(`Error output: ${result.output.substring(0, 200)}`);
      if (attempt < options.maxRetries) {
        log('Waiting 2 seconds before retry...');
        await sleep(2000);
      } else {
        return result;
      }
    }
  }

  log(`ERROR: Max retries (${options.maxRetries}) reached`);
  return {
    success: false,
    output: `Max retries reached after ${options.maxRetries} attempts`,
    exitCode: 1,
  };
}

/**
 * Extract result text from JSON output
 */
export function extractResultText(jsonOutput: string): string {
  try {
    const parsed = JSON.parse(jsonOutput);
    if (parsed.result && typeof parsed.result === 'string') {
      return parsed.result;
    }
  } catch {
    // Not JSON or no result field
  }
  return jsonOutput;
}

/**
 * Extract JSON content from text (find first { to last })
 */
export function extractJsonContent(text: string): string | null {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
    return null;
  }

  const jsonCandidate = text.substring(firstBrace, lastBrace + 1);

  try {
    JSON.parse(jsonCandidate);
    return jsonCandidate;
  } catch {
    return null;
  }
}

/**
 * Execute Claude CLI with JSON validation and retry
 */
export async function runJsonWithRetry(
  prompt: string,
  options: ClaudeCliOptions
): Promise<ClaudeExecutionResult> {
  const errors: string[] = [];

  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    log(`JSON attempt ${attempt}/${options.maxRetries}`);

    // Force JSON output format
    const jsonOptions = { ...options, outputFormat: 'json' as const, maxRetries: 1 };
    const result = await runWithRetry(prompt, jsonOptions);

    if (!result.success) {
      const errorMsg = `AI execution failed: ${result.output}`;
      log(`ERROR: ${errorMsg}`);
      errors.push(`[${attempt}] ${errorMsg}`);
      continue;
    }

    // Extract result text
    const resultText = extractResultText(result.output);

    // Try to extract JSON content
    let jsonContent = extractJsonContent(resultText);
    if (!jsonContent) {
      jsonContent = extractJsonContent(result.output);
    }

    if (jsonContent) {
      log('JSON validation successful');
      return {
        success: true,
        output: jsonContent,
        exitCode: 0,
      };
    }

    const errorMsg = 'JSON parsing failed';
    log(`ERROR: ${errorMsg}`);
    errors.push(`[${attempt}] ${errorMsg}`);

    if (attempt < options.maxRetries) {
      log('Waiting 2 seconds before retry...');
      await sleep(2000);
    }
  }

  log(`ERROR: Max JSON retries (${options.maxRetries}) reached`);
  return {
    success: false,
    output: JSON.stringify({
      error: 'Max retries reached',
      attempts: options.maxRetries,
      errors: errors.join('\n'),
    }),
    exitCode: 1,
  };
}

