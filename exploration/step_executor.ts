/**
 * Step Executor
 * 
 * Executes exploration steps using hybrid MCP + deterministic crawler approach.
 * 
 * Responsibilities:
 * - Execute navigation and interaction steps
 * - Try MCP execution first, fallback to deterministic crawler
 * - Validate actions against safety constraints
 * - Prevent forbidden actions
 * - Maintain idempotency and statelessness
 * - Capture evidence for all actions
 * 
 * Supported Actions:
 * - goto: Navigate to URL
 * - click: Click an element
 * - fill: Fill an input field
 * - select: Select an option from dropdown
 * - check/uncheck: Toggle checkbox
 * - keyboard: Send keyboard input
 * - hover: Hover over element
 * - scroll: Scroll to element or position
 * - wait: Wait for condition
 * - screenshot: Capture screenshot
 */

import { Page, BrowserContext } from 'playwright';
import { ExplorationStep, SafetyConstraints, StepExecutionResult } from './types.js';
import { MCPClient } from './mcp_client.js';
import {
  executeClick as crawlerClick,
  executeFill as crawlerFill,
  executeHover as crawlerHover,
  executeScroll as crawlerScroll,
  executeWait as crawlerWait,
  executeScreenshot as crawlerScreenshot,
} from './crawler_executor.js';

/**
 * Execute a single exploration step using hybrid MCP + crawler approach.
 * 
 * @param page - Playwright page instance
 * @param context - Browser context
 * @param step - Step to execute
 * @param safety - Safety constraints to enforce
 * @param mcpClient - Optional MCP client
 * @param crawlerExecutor - Crawler executor (required for fallback)
 * @returns Execution result
 */
export async function executeStep(
  page: Page,
  context: BrowserContext,
  step: ExplorationStep,
  safety: SafetyConstraints,
  mcpClient?: MCPClient
): Promise<StepExecutionResult> {
  const startTime = new Date().toISOString();

  try {
    // Validate step against safety constraints
    validateStepSafety(step, safety);

    // Determine execution preference
    const preference = step.executionPreference || 'mcp-prefer';
    const shouldTryMCP = (preference === 'mcp-prefer' || preference === 'mcp-only') && mcpClient?.isConnected();
    const shouldUseCrawler = preference === 'crawler-only' || !shouldTryMCP;

    let result: StepExecutionResult;
    let mcpError: string | undefined;

    // Try MCP first if enabled and available
    if (shouldTryMCP && mcpClient) {
      try {
        const mcpResult = await executeWithMCP(mcpClient, step);
        
        if (mcpResult.success) {
          return {
            step,
            success: true,
            finalUrl: page.url(),
            pageTitle: await page.title().catch(() => undefined),
            executedAt: startTime,
            evidence: mcpResult.evidence,
            executionPath: 'mcp',
          };
        } else {
          mcpError = mcpResult.error;
          // Fall through to crawler if preference allows
          if (preference === 'mcp-only') {
            return {
              step,
              success: false,
              error: `MCP execution failed: ${mcpError}`,
              executedAt: startTime,
              evidence: mcpResult.evidence,
              executionPath: 'mcp',
              mcpError,
            };
          }
        }
      } catch (error) {
        mcpError = error instanceof Error ? error.message : String(error);
        if (preference === 'mcp-only') {
          return {
            step,
            success: false,
            error: `MCP execution error: ${mcpError}`,
            executedAt: startTime,
            executionPath: 'mcp',
            mcpError,
          };
        }
      }
    }

    // Fallback to crawler executor
    if (shouldUseCrawler) {
      result = await executeWithCrawler(page, context, step);
      result.executionPath = 'crawler';
      result.mcpError = mcpError;
      return result;
    }

    // Should not reach here, but handle gracefully
    return {
      step,
      success: false,
      error: 'No execution method available',
      executedAt: startTime,
    };
  } catch (error) {
    return {
      step,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      executedAt: startTime,
    };
  }
}

/**
 * Execute step using MCP client.
 */
async function executeWithMCP(
  mcpClient: MCPClient,
  step: ExplorationStep
): Promise<{ success: boolean; evidence?: any; error?: string }> {
  switch (step.action) {
    case 'goto':
      return await mcpClient.navigate(step.target, {
        waitUntil: step.waitFor === 'networkidle' ? 'networkidle' : 'domcontentloaded',
      });

    case 'click':
      return await mcpClient.click(step.target);

    case 'fill':
      if (!step.value) {
        return { success: false, error: 'Fill action requires a value' };
      }
      return await mcpClient.fill(step.target, step.value);

    case 'hover':
      return await mcpClient.hover(step.target);

    case 'scroll':
      // Parse coordinates if provided
      const scrollTarget = step.target.includes(',') 
        ? { x: parseInt(step.target.split(',')[0] || '0'), y: parseInt(step.target.split(',')[1] || '0') }
        : step.target;
      return await mcpClient.scroll(scrollTarget);

    case 'screenshot':
      return await mcpClient.screenshot(step.target || undefined);

    default:
      return { success: false, error: `MCP does not support action: ${step.action}` };
  }
}

/**
 * Execute step using crawler executor.
 */
async function executeWithCrawler(
  page: Page,
  context: BrowserContext,
  step: ExplorationStep
): Promise<StepExecutionResult> {
  const startTime = new Date().toISOString();

  try {
    let finalUrl: string | undefined;
    let pageTitle: string | undefined;

    switch (step.action) {
      case 'goto':
        await executeGoto(page, step);
        finalUrl = page.url();
        pageTitle = await page.title();
        break;

      case 'click':
        const clickResult = await crawlerClick(step.target, page, context);
        if (!clickResult.success) {
          throw new Error(clickResult.error);
        }
        finalUrl = page.url();
        pageTitle = await page.title();
        return {
          step,
          success: true,
          finalUrl,
          pageTitle,
          executedAt: startTime,
          evidence: clickResult.evidence,
        };

      case 'fill':
        if (!step.value) {
          throw new Error('Fill action requires a value');
        }
        const fillResult = await crawlerFill(step.target, step.value, page, context);
        if (!fillResult.success) {
          throw new Error(fillResult.error);
        }
        return {
          step,
          success: true,
          executedAt: startTime,
          evidence: fillResult.evidence,
        };

      case 'select':
        await executeSelect(page, step);
        break;

      case 'check':
        await executeCheck(page, step);
        break;

      case 'uncheck':
        await executeUncheck(page, step);
        break;

      case 'keyboard':
        await executeKeyboard(page, step);
        break;

      case 'hover':
        const hoverResult = await crawlerHover(step.target, page, context);
        if (!hoverResult.success) {
          throw new Error(hoverResult.error);
        }
        return {
          step,
          success: true,
          executedAt: startTime,
          evidence: hoverResult.evidence,
        };

      case 'scroll':
        const scrollTarget = step.target.includes(',')
          ? { x: parseInt(step.target.split(',')[0] || '0'), y: parseInt(step.target.split(',')[1] || '0') }
          : step.target;
        const scrollResult = await crawlerScroll(scrollTarget, page, context);
        if (!scrollResult.success) {
          throw new Error(scrollResult.error);
        }
        return {
          step,
          success: true,
          executedAt: startTime,
          evidence: scrollResult.evidence,
        };

      case 'wait':
        const waitResult = await crawlerWait(step.target, page, context);
        if (!waitResult.success) {
          throw new Error(waitResult.error);
        }
        return {
          step,
          success: true,
          executedAt: startTime,
          evidence: waitResult.evidence,
        };

      case 'screenshot':
        const screenshotPath = step.target || `screenshot-${Date.now()}.png`;
        const screenshotResult = await crawlerScreenshot(screenshotPath, page, context);
        if (!screenshotResult.success) {
          throw new Error(screenshotResult.error);
        }
        return {
          step,
          success: true,
          executedAt: startTime,
          evidence: screenshotResult.evidence,
        };

      default:
        throw new Error(`Unsupported action: ${step.action}`);
    }

    // Wait for specified condition
    if (step.waitFor) {
      await waitForCondition(page, step.waitFor);
    }

    return {
      step,
      success: true,
      finalUrl,
      pageTitle,
      executedAt: startTime,
    };
  } catch (error) {
    return {
      step,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      executedAt: startTime,
    };
  }
}

/**
 * Validate step against safety constraints.
 * 
 * @throws Error if step violates safety constraints
 */
function validateStepSafety(step: ExplorationStep, safety: SafetyConstraints): void {
  // Check forbidden actions
  if (safety.forbiddenActions.includes(step.action)) {
    throw new Error(
      `Action "${step.action}" is forbidden by safety constraints`
    );
  }

  // Check forbidden selectors
  for (const forbiddenSelector of safety.forbiddenSelectors) {
    if (step.target.includes(forbiddenSelector)) {
      throw new Error(
        `Target "${step.target}" matches forbidden selector pattern: ${forbiddenSelector}`
      );
    }
  }

  // Check for destructive actions
  if (step.action === 'click') {
    const targetLower = step.target.toLowerCase();
    
    // Check for delete buttons
    if (!safety.allowDeleteButtons) {
      if (
        targetLower.includes('delete') ||
        targetLower.includes('remove') ||
        targetLower.includes('destroy')
      ) {
        throw new Error(
          'Clicking delete/remove buttons is forbidden by safety constraints'
        );
      }
    }

    // Check for destructive form submissions
    if (!safety.allowDestructiveForms) {
      if (
        targetLower.includes('submit') &&
        (targetLower.includes('delete') || targetLower.includes('remove'))
      ) {
        throw new Error(
          'Submitting destructive forms is forbidden by safety constraints'
        );
      }
    }
  }
}

/**
 * Execute goto action.
 */
async function executeGoto(page: Page, step: ExplorationStep): Promise<void> {
  if (!step.target.startsWith('http://') && !step.target.startsWith('https://')) {
    throw new Error(`Invalid URL: ${step.target}`);
  }

  await page.goto(step.target, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
}

/**
 * Execute click action using auto-playwright for selector resolution.
 * 
 * NOTE: This implementation uses a multi-strategy locator approach following
 * the locator priority rules. In production, auto-playwright should be integrated
 * here to resolve selectors using AI, but the actual interaction execution
 * should still use Playwright's native methods for determinism.
 * 
 * Example auto-playwright integration:
 * ```typescript
 * import { auto } from 'auto-playwright';
 * const resolvedLocator = await auto.resolveSelector(page, step.target);
 * await resolvedLocator.click();
 * ```
 */
async function executeClick(
  page: Page,
  step: ExplorationStep,
  safety: SafetyConstraints
): Promise<void> {
  // Multi-strategy locator resolution following priority rules:
  // 1. data-role, 2. data-testid, 3. role+name, 4. aria-label, 5. CSS fallback
  
  // Try multiple locator strategies
  const locators = [
    () => page.locator(`[data-role="${step.target}"]`),
    () => page.locator(`[data-testid="${step.target}"]`),
    () => page.getByRole('button', { name: step.target }),
    () => page.getByRole('link', { name: step.target }),
    () => page.getByLabel(step.target),
    () => page.locator(step.target), // CSS fallback
  ];

  let clicked = false;
  for (const locatorFn of locators) {
    try {
      const locator = locatorFn();
      const isVisible = await locator.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (isVisible) {
        await locator.click({ timeout: 5000 });
        clicked = true;
        break;
      }
    } catch (error) {
      // Try next locator strategy
      continue;
    }
  }

  if (!clicked) {
    throw new Error(
      `Could not find clickable element matching target: ${step.target}. ` +
      'Tried multiple locator strategies.'
    );
  }
}

/**
 * Execute fill action.
 */
async function executeFill(page: Page, step: ExplorationStep): Promise<void> {
  if (!step.value) {
    throw new Error('Fill action requires a value');
  }

  const locators = [
    () => page.locator(`[data-role="${step.target}"]`),
    () => page.locator(`[data-testid="${step.target}"]`),
    () => page.getByLabel(step.target),
    () => page.locator(`input[name="${step.target}"]`),
    () => page.locator(`textarea[name="${step.target}"]`),
    () => page.locator(step.target),
  ];

  let filled = false;
  for (const locatorFn of locators) {
    try {
      const locator = locatorFn();
      const isVisible = await locator.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (isVisible) {
        await locator.fill(step.value, { timeout: 5000 });
        filled = true;
        break;
      }
    } catch (error) {
      continue;
    }
  }

  if (!filled) {
    throw new Error(
      `Could not find fillable element matching target: ${step.target}`
    );
  }
}

/**
 * Execute select action.
 */
async function executeSelect(page: Page, step: ExplorationStep): Promise<void> {
  if (!step.value) {
    throw new Error('Select action requires a value');
  }

  const locators = [
    () => page.locator(`[data-role="${step.target}"]`),
    () => page.locator(`[data-testid="${step.target}"]`),
    () => page.getByLabel(step.target),
    () => page.locator(`select[name="${step.target}"]`),
    () => page.locator(step.target),
  ];

  let selected = false;
  for (const locatorFn of locators) {
    try {
      const locator = locatorFn();
      const isVisible = await locator.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (isVisible) {
        await locator.selectOption(step.value, { timeout: 5000 });
        selected = true;
        break;
      }
    } catch (error) {
      continue;
    }
  }

  if (!selected) {
    throw new Error(
      `Could not find select element matching target: ${step.target}`
    );
  }
}

/**
 * Execute check action.
 */
async function executeCheck(page: Page, step: ExplorationStep): Promise<void> {
  const locators = [
    () => page.locator(`[data-role="${step.target}"]`),
    () => page.locator(`[data-testid="${step.target}"]`),
    () => page.getByLabel(step.target),
    () => page.locator(`input[type="checkbox"][name="${step.target}"]`),
    () => page.locator(step.target),
  ];

  let checked = false;
  for (const locatorFn of locators) {
    try {
      const locator = locatorFn();
      const isVisible = await locator.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (isVisible) {
        await locator.check({ timeout: 5000 });
        checked = true;
        break;
      }
    } catch (error) {
      continue;
    }
  }

  if (!checked) {
    throw new Error(
      `Could not find checkbox matching target: ${step.target}`
    );
  }
}

/**
 * Execute uncheck action.
 */
async function executeUncheck(page: Page, step: ExplorationStep): Promise<void> {
  const locators = [
    () => page.locator(`[data-role="${step.target}"]`),
    () => page.locator(`[data-testid="${step.target}"]`),
    () => page.getByLabel(step.target),
    () => page.locator(`input[type="checkbox"][name="${step.target}"]`),
    () => page.locator(step.target),
  ];

  let unchecked = false;
  for (const locatorFn of locators) {
    try {
      const locator = locatorFn();
      const isVisible = await locator.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (isVisible) {
        await locator.uncheck({ timeout: 5000 });
        unchecked = true;
        break;
      }
    } catch (error) {
      continue;
    }
  }

  if (!unchecked) {
    throw new Error(
      `Could not find checkbox matching target: ${step.target}`
    );
  }
}

/**
 * Execute keyboard action.
 */
async function executeKeyboard(page: Page, step: ExplorationStep): Promise<void> {
  if (!step.key) {
    throw new Error('Keyboard action requires a key');
  }

  // Send key to focused element or page
  await page.keyboard.press(step.key);
}

/**
 * Wait for specified condition.
 */
async function waitForCondition(
  page: Page,
  condition: 'navigation' | 'networkidle' | 'load' | 'domcontentloaded'
): Promise<void> {
  switch (condition) {
    case 'navigation':
      await page.waitForLoadState('domcontentloaded');
      break;
    case 'networkidle':
      await page.waitForLoadState('networkidle');
      break;
    case 'load':
      await page.waitForLoadState('load');
      break;
    case 'domcontentloaded':
      await page.waitForLoadState('domcontentloaded');
      break;
  }
}