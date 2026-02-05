/**
 * MCP Markdown Runner
 * 
 * Executes E2E flows directly from Markdown files where each line is a prompt.
 * 
 * Responsibilities:
 * - Read Markdown flow files line by line
 * - Send prompts to MCP client for action resolution
 * - Execute actions via step_executor with fallback
 * - Capture evidence for each step
 * - Log all execution details for auditability
 */

import { readFile } from 'fs/promises';
import { Page, BrowserContext } from 'playwright';
import { MCPClient } from './mcp_client.js';
import { executeStep } from './step_executor.js';
import { saveEvidence } from './evidence_capture.js';
import {
  MarkdownFlowConfig,
  MarkdownFlowResult,
  MarkdownFlowStepResult,
  SafetyConstraints,
  ExplorationStep,
  ActionType,
} from './types.js';

/**
 * Default Markdown flow configuration.
 */
const DEFAULT_FLOW_CONFIG: Required<MarkdownFlowConfig> = {
  stepTimeout: 30000,
  retryCount: 1,
  reuseSession: true,
  captureEvidencePerStep: true,
  verbosity: 'normal',
  defaultExecutionPreference: 'mcp-prefer',
};

/**
 * Run a Markdown flow file.
 * 
 * @param flowPath - Path to Markdown flow file
 * @param page - Playwright page instance
 * @param context - Browser context
 * @param mcpClient - Optional MCP client
 * @param safety - Safety constraints
 * @param config - Markdown flow configuration
 * @returns Flow execution result
 */
export async function runMarkdownFlow(
  flowPath: string,
  page: Page,
  context: BrowserContext,
  mcpClient: MCPClient | undefined,
  safety: SafetyConstraints,
  config: MarkdownFlowConfig = {}
): Promise<MarkdownFlowResult> {
  const startTime = Date.now();
  const flowConfig = { ...DEFAULT_FLOW_CONFIG, ...config };
  const stepResults: MarkdownFlowStepResult[] = [];
  const errors: string[] = [];

  try {
    // Read Markdown file
    const content = await readFile(flowPath, 'utf-8');
    const lines = content.split('\n');

    if (flowConfig.verbosity !== 'minimal') {
      console.log(`[MarkdownFlow] Reading flow from: ${flowPath}`);
      console.log(`[MarkdownFlow] Found ${lines.length} lines`);
    }

    // Process each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNumber = i + 1;

      // Skip empty lines and comments
      if (!line || line.startsWith('#') || line.startsWith('<!--')) {
        continue;
      }

      // Parse metadata if present
      const metadata = parseMetadata(line);
      const prompt = extractPrompt(line);

      if (flowConfig.verbosity === 'verbose') {
        console.log(`[MarkdownFlow] Line ${lineNumber}: ${prompt}`);
      }

      // Execute prompt
      const stepResult = await executePrompt(
        prompt,
        lineNumber,
        flowPath,
        page,
        context,
        mcpClient,
        safety,
        flowConfig,
        metadata
      );

      stepResults.push(stepResult);

      // Save evidence if captured
      if (flowConfig.captureEvidencePerStep && stepResult.evidence) {
        try {
          const evidencePaths = await saveEvidence(
            stepResult.evidence,
            './evidence',
            `markdown-flow-${lineNumber}`
          );
          stepResult.evidencePaths = evidencePaths;

          if (flowConfig.verbosity === 'verbose') {
            console.log(`[MarkdownFlow] Evidence saved: ${evidencePaths.length} files`);
          }
        } catch (error) {
          console.warn(`[MarkdownFlow] Failed to save evidence for line ${lineNumber}: ${error}`);
        }
      }

      // Log result
      if (stepResult.success) {
        if (flowConfig.verbosity !== 'minimal') {
          console.log(
            `[MarkdownFlow] ✓ Line ${lineNumber} succeeded via ${stepResult.executionPath} (${stepResult.duration}ms)`
          );
        }
      } else {
        const errorMsg = `Line ${lineNumber} failed: ${stepResult.error}`;
        console.error(`[MarkdownFlow] ✗ ${errorMsg}`);
        errors.push(errorMsg);

        // Continue with next step (non-blocking)
        continue;
      }
    }

    const totalDuration = Date.now() - startTime;
    const successfulSteps = stepResults.filter(r => r.success).length;
    const failedSteps = stepResults.filter(r => !r.success).length;

    if (flowConfig.verbosity !== 'minimal') {
      console.log(`[MarkdownFlow] Flow completed: ${successfulSteps}/${stepResults.length} steps succeeded`);
    }

    return {
      flowPath,
      totalSteps: stepResults.length,
      successfulSteps,
      failedSteps,
      stepResults,
      success: failedSteps === 0,
      errors,
      executedAt: new Date().toISOString(),
      totalDuration,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[MarkdownFlow] Fatal error: ${errorMsg}`);
    errors.push(errorMsg);

    return {
      flowPath,
      totalSteps: stepResults.length,
      successfulSteps: stepResults.filter(r => r.success).length,
      failedSteps: stepResults.filter(r => !r.success).length,
      stepResults,
      success: false,
      errors,
      executedAt: new Date().toISOString(),
      totalDuration: Date.now() - startTime,
    };
  }
}

/**
 * Execute a single prompt from Markdown flow.
 */
async function executePrompt(
  prompt: string,
  lineNumber: number,
  flowPath: string,
  page: Page,
  context: BrowserContext,
  mcpClient: MCPClient | undefined,
  safety: SafetyConstraints,
  config: Required<MarkdownFlowConfig>,
  metadata: Record<string, any>
): Promise<MarkdownFlowStepResult> {
  const startTime = Date.now();

  try {
    // Try to parse prompt into structured action
    let step: ExplorationStep | null = null;
    let executionPath: 'mcp' | 'crawler' = 'crawler';
    let mcpError: string | undefined;

    // Try MCP prompt execution first if available
    if (mcpClient?.isConnected() && config.defaultExecutionPreference !== 'crawler-only') {
      try {
        const mcpAction = await mcpClient.executePrompt(prompt, {
          timeout: config.stepTimeout,
          retryCount: config.retryCount,
        });

        if (mcpAction.success && mcpAction.parsedAction) {
          step = {
            id: `markdown-line-${lineNumber}`,
            action: mcpAction.parsedAction.action as ActionType,
            target: mcpAction.parsedAction.target,
            value: mcpAction.parsedAction.value,
            description: prompt,
            executionPreference: config.defaultExecutionPreference,
          };
          executionPath = 'mcp';
        } else {
          mcpError = mcpAction.error || 'MCP failed to parse prompt';
          if (config.defaultExecutionPreference === 'mcp-only') {
            throw new Error(mcpError);
          }
        }
      } catch (error) {
        mcpError = error instanceof Error ? error.message : String(error);
        if (config.defaultExecutionPreference === 'mcp-only') {
          throw error;
        }
      }
    }

    // Fallback to deterministic parsing if MCP failed or unavailable
    if (!step) {
      step = parsePromptToStep(prompt, lineNumber);
      executionPath = 'crawler';
    }

    // Execute step
    const stepResult = await executeStep(
      page,
      context,
      step,
      safety,
      mcpClient
    );

    const duration = Date.now() - startTime;

    return {
      lineNumber,
      prompt,
      success: stepResult.success,
      error: stepResult.error,
      executionPath: stepResult.executionPath || executionPath,
      evidence: stepResult.evidence,
      executedAt: stepResult.executedAt,
      duration,
      mcpError: stepResult.mcpError || mcpError,
      parsedAction: step ? {
        action: step.action,
        target: step.target,
        value: step.value,
      } : undefined,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      lineNumber,
      prompt,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      executionPath: 'crawler',
      executedAt: new Date().toISOString(),
      duration,
    };
  }
}

/**
 * Parse prompt text into structured ExplorationStep.
 * 
 * Uses simple heuristics to extract action, target, and value.
 */
function parsePromptToStep(prompt: string, lineNumber: number): ExplorationStep {
  const lowerPrompt = prompt.toLowerCase().trim();

  // Navigation
  if (lowerPrompt.startsWith('navigate to') || lowerPrompt.startsWith('go to')) {
    const url = prompt.match(/(https?:\/\/[^\s]+)/i)?.[1] || prompt.split(/\s+/).slice(-1)[0];
    return {
      id: `markdown-line-${lineNumber}`,
      action: 'goto',
      target: url,
      description: prompt,
    };
  }

  // Fill actions
  const fillMatch = prompt.match(/fill\s+(?:the\s+)?(.+?)\s+with\s+['"](.+?)['"]/i);
  if (fillMatch) {
    return {
      id: `markdown-line-${lineNumber}`,
      action: 'fill',
      target: fillMatch[1].trim(),
      value: fillMatch[2],
      description: prompt,
    };
  }

  // Click actions
  if (lowerPrompt.startsWith('click')) {
    const target = prompt.replace(/^click\s+(?:the\s+)?/i, '').replace(/['"]/g, '').trim();
    return {
      id: `markdown-line-${lineNumber}`,
      action: 'click',
      target,
      description: prompt,
    };
  }

  // Wait actions
  if (lowerPrompt.startsWith('wait for')) {
    const target = prompt.replace(/^wait for\s+/i, '').trim();
    return {
      id: `markdown-line-${lineNumber}`,
      action: 'wait',
      target,
      description: prompt,
    };
  }

  // Screenshot
  if (lowerPrompt.includes('screenshot') || lowerPrompt.includes('take a screenshot')) {
    return {
      id: `markdown-line-${lineNumber}`,
      action: 'screenshot',
      target: `screenshot-${Date.now()}.png`,
      description: prompt,
    };
  }

  // Hover
  if (lowerPrompt.startsWith('hover')) {
    const target = prompt.replace(/^hover\s+(?:over\s+)?(?:the\s+)?/i, '').trim();
    return {
      id: `markdown-line-${lineNumber}`,
      action: 'hover',
      target,
      description: prompt,
    };
  }

  // Scroll
  if (lowerPrompt.startsWith('scroll')) {
    const target = prompt.replace(/^scroll\s+(?:to\s+)?(?:the\s+)?/i, '').trim();
    return {
      id: `markdown-line-${lineNumber}`,
      action: 'scroll',
      target,
      description: prompt,
    };
  }

  // Default: try as click action
  return {
    id: `markdown-line-${lineNumber}`,
    action: 'click',
    target: prompt,
    description: prompt,
  };
}

/**
 * Extract prompt text from line, removing metadata.
 */
function extractPrompt(line: string): string {
  // Remove metadata syntax like #evidence: true
  return line.replace(/#\w+:\s*\w+/g, '').trim();
}

/**
 * Parse metadata from line.
 */
function parseMetadata(line: string): Record<string, any> {
  const metadata: Record<string, any> = {};
  const matches = line.matchAll(/#(\w+):\s*(\w+)/g);

  for (const match of matches) {
    const [, key, value] = match;
    metadata[key] = value === 'true' ? true : value === 'false' ? false : value;
  }

  return metadata;
}
