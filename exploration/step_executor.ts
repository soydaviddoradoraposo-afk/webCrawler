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
  resolveSelector,
} from './crawler_executor.js';
import { captureEvidence } from './evidence_capture.js';

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
      return await mcpClient.screenshot(step.target ? { name: step.target, path: step.target } : undefined);

    case 'select':
      if (!step.value) return { success: false, error: 'Select action requires a value' };
      return await mcpClient.select(step.target, step.value);

    case 'check':
      return await mcpClient.click(step.target); // MCP may not have check; use click as fallback for checkbox
    case 'uncheck':
      return await mcpClient.executeJS(`document.querySelector('${step.target.replace(/'/g, "\\'")}')?.click();` as string); // fallback: toggle

    case 'keyboard':
    case 'press_key': {
      const key = step.key ?? step.value ?? 'Enter';
      return await mcpClient.pressKey(key, step.target || undefined);
    }

    case 'drag': {
      const [source, targetSel] = step.value ? [step.target, step.value] : step.target.includes(',') ? step.target.split(',').map(s => s.trim()) : [step.target, step.target];
      if (!source || !targetSel) return { success: false, error: 'Drag action requires source and target selectors' };
      return await mcpClient.drag(source, targetSel);
    }

    case 'upload_file':
      if (!step.filePath) return { success: false, error: 'Upload action requires filePath' };
      return await mcpClient.uploadFile(step.target, step.filePath);

    case 'get_visible_text':
      return await mcpClient.getVisibleText();
    case 'get_visible_html':
      return await mcpClient.getVisibleHtml(step.target ? { selector: step.target } : undefined);

    case 'go_back':
      return await mcpClient.goBack();
    case 'go_forward':
      return await mcpClient.goForward();

    case 'resize':
      if (step.resizeOptions) return await mcpClient.resize(step.resizeOptions);
      if (step.target && step.value) {
        const w = parseInt(step.target, 10);
        const h = parseInt(step.value, 10);
        if (!Number.isNaN(w) && !Number.isNaN(h)) return await mcpClient.resize({ width: w, height: h });
      }
      return { success: false, error: 'Resize action requires resizeOptions or width,height in target/value' };

    case 'save_as_pdf':
      if (!step.pdfOptions?.outputPath) return { success: false, error: 'Save_as_pdf requires pdfOptions.outputPath' };
      return await mcpClient.saveAsPdf(step.pdfOptions);

    case 'click_and_switch_tab':
      return await mcpClient.clickAndSwitchTab(step.target);

    case 'iframe_click':
      if (!step.value) return { success: false, error: 'iframe_click requires selector (value) for inner element' };
      return await mcpClient.iframeClick(step.target, step.value);
    case 'iframe_fill':
      if (!step.value) return { success: false, error: 'iframe_fill requires inner selector (value); use description for fill value' };
      return await mcpClient.iframeFill(step.target, step.value, step.description ?? '');
    case 'expect_response':
      if (!step.responseId || !step.target) return { success: false, error: 'expect_response requires responseId and url (target)' };
      return await mcpClient.expectResponse(step.responseId, step.target);
    case 'assert_response':
      if (!step.responseId) return { success: false, error: 'assert_response requires responseId' };
      return await mcpClient.assertResponse(step.responseId, step.value);

    case 'custom_user_agent':
      return await mcpClient.setCustomUserAgent(step.target);

    case 'console_logs':
      return await mcpClient.getConsoleLogs(
        step.consoleLogOptions as { type?: 'all' | 'error' | 'warning' | 'log' | 'info' | 'debug' | 'exception'; search?: string; limit?: number; clear?: boolean } | undefined
      );

    case 'api_get':
      if (step.apiOptions) return await mcpClient.apiGet(step.apiOptions.url, { token: step.apiOptions.token, headers: step.apiOptions.headers });
      return await mcpClient.apiGet(step.target, { token: step.value ? undefined : undefined, headers: undefined });
    case 'api_post':
      if (step.apiOptions) return await mcpClient.apiPost(step.apiOptions.url, step.apiOptions.value ?? '', { token: step.apiOptions.token, headers: step.apiOptions.headers });
      if (!step.value) return { success: false, error: 'api_post requires body (value)' };
      return await mcpClient.apiPost(step.target, step.value);
    case 'api_put':
      if (step.apiOptions) return await mcpClient.apiPut(step.apiOptions.url, step.apiOptions.value ?? '', { token: step.apiOptions.token, headers: step.apiOptions.headers });
      if (!step.value) return { success: false, error: 'api_put requires body (value)' };
      return await mcpClient.apiPut(step.target, step.value);
    case 'api_patch':
      if (step.apiOptions) return await mcpClient.apiPatch(step.apiOptions.url, step.apiOptions.value ?? '', { token: step.apiOptions.token, headers: step.apiOptions.headers });
      if (!step.value) return { success: false, error: 'api_patch requires body (value)' };
      return await mcpClient.apiPatch(step.target, step.value);
    case 'api_delete':
      if (step.apiOptions) return await mcpClient.apiDelete(step.apiOptions.url, { token: step.apiOptions.token, headers: step.apiOptions.headers });
      return await mcpClient.apiDelete(step.target);

    case 'start_codegen':
      if (!step.codegenOptions?.outputPath) return { success: false, error: 'start_codegen requires codegenOptions.outputPath' };
      return await mcpClient.startCodegenSession(step.codegenOptions);
    case 'end_codegen':
    case 'get_codegen':
    case 'clear_codegen':
      if (!step.sessionId) return { success: false, error: `${step.action} requires sessionId` };
      if (step.action === 'end_codegen') return await mcpClient.endCodegenSession(step.sessionId);
      if (step.action === 'get_codegen') return await mcpClient.getCodegenSession(step.sessionId);
      return await mcpClient.clearCodegenSession(step.sessionId);

    case 'evaluate':
      if (!step.value) return { success: false, error: 'evaluate requires script (value)' };
      return await mcpClient.executeJS(step.value);

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

      case 'press_key':
        if (!step.key && !step.value) throw new Error('press_key requires key or value');
        await page.keyboard.press(step.key ?? step.value ?? 'Enter');
        return { step, success: true, executedAt: startTime };

      case 'drag': {
        const [src, tgt] = step.value ? [step.target, step.value] : step.target.includes(',') ? step.target.split(',').map(s => s.trim()) : [step.target, step.target];
        if (!src || !tgt) throw new Error('Drag action requires source and target selectors');
        const srcLoc = await resolveSelector(src, page);
        const tgtLoc = await resolveSelector(tgt, page);
        if (!srcLoc || !tgtLoc) throw new Error('Could not resolve drag source or target');
        await srcLoc.dragTo(tgtLoc);
        const evidence = await captureEvidence(page, context, 'drag', true);
        return { step, success: true, executedAt: startTime, evidence };
      }

      case 'upload_file':
        if (!step.filePath) throw new Error('upload_file requires filePath');
        const uploadLoc = await resolveSelector(step.target, page);
        if (!uploadLoc) throw new Error(`Could not resolve upload target: ${step.target}`);
        await uploadLoc.setInputFiles(step.filePath);
        const uploadEvidence = await captureEvidence(page, context, 'upload_file', true);
        return { step, success: true, executedAt: startTime, evidence: uploadEvidence };

      case 'go_back':
        await page.goBack();
        finalUrl = page.url();
        pageTitle = await page.title();
        return { step, success: true, finalUrl, pageTitle, executedAt: startTime };

      case 'go_forward':
        await page.goForward();
        finalUrl = page.url();
        pageTitle = await page.title();
        return { step, success: true, finalUrl, pageTitle, executedAt: startTime };

      case 'get_visible_text': {
        const text = await page.evaluate(() => ((globalThis as unknown as { document?: { body?: { innerText?: string } } }).document?.body?.innerText) ?? '');
        return { step, success: true, executedAt: startTime, evidence: { timestamp: new Date().toISOString(), action: 'get_visible_text', success: true, data: text } as any };
      }
      case 'get_visible_html': {
        const html = await page.content();
        const selector = step.target ? await page.locator(step.target).evaluate(el => el?.outerHTML).catch(() => html) : html;
        const content = typeof selector === 'string' ? selector : html;
        return { step, success: true, executedAt: startTime, evidence: { timestamp: new Date().toISOString(), action: 'get_visible_html', success: true, data: content } as any };
      }

      case 'resize': {
        if (step.resizeOptions?.width != null && step.resizeOptions?.height != null) {
          await page.setViewportSize({ width: step.resizeOptions.width, height: step.resizeOptions.height });
        } else if (step.target && step.value) {
          const w = parseInt(step.target, 10);
          const h = parseInt(step.value, 10);
          if (!Number.isNaN(w) && !Number.isNaN(h)) await page.setViewportSize({ width: w, height: h });
        } else throw new Error('resize requires resizeOptions (width/height) or target,value as dimensions');
        const resizeEvidence = await captureEvidence(page, context, 'resize', true);
        return { step, success: true, executedAt: startTime, evidence: resizeEvidence };
      }

      case 'save_as_pdf': {
        const outPath = step.pdfOptions?.outputPath ?? step.target;
        const filename = step.pdfOptions?.filename ?? 'page.pdf';
        const fullPath = `${outPath}/${filename}`.replace(/\/+/g, '/');
        await page.pdf({ path: fullPath, format: step.pdfOptions?.format as 'A4' | 'Letter' | undefined, printBackground: step.pdfOptions?.printBackground });
        return { step, success: true, executedAt: startTime };
      }

      case 'click_and_switch_tab': {
        const loc = await resolveSelector(step.target, page);
        if (!loc) throw new Error(`Could not resolve selector for: ${step.target}`);
        const [popup] = await Promise.all([page.waitForEvent('popup'), loc.click()]);
        if (popup) await popup.bringToFront();
        finalUrl = page.url();
        pageTitle = await page.title();
        return { step, success: true, finalUrl, pageTitle, executedAt: startTime };
      }

      case 'iframe_click': {
        const frame = page.frameLocator(step.target);
        const inner = step.value ? frame.locator(step.value) : frame.locator('body');
        await inner.click();
        return { step, success: true, executedAt: startTime };
      }
      case 'iframe_fill': {
        if (!step.value) throw new Error('iframe_fill requires inner selector (value)');
        const frameFill = page.frameLocator(step.target);
        await frameFill.locator(step.value).fill(step.description ?? '');
        return { step, success: true, executedAt: startTime };
      }

      case 'evaluate':
        if (!step.value) throw new Error('evaluate requires script (value)');
        await page.evaluate(step.value);
        return { step, success: true, executedAt: startTime };

      case 'custom_user_agent':
      case 'console_logs':
      case 'expect_response':
      case 'assert_response':
      case 'api_get':
      case 'api_post':
      case 'api_put':
      case 'api_patch':
      case 'api_delete':
      case 'start_codegen':
      case 'end_codegen':
      case 'get_codegen':
      case 'clear_codegen':
        throw new Error(`Action "${step.action}" has no crawler fallback; use MCP or omit this step.`);

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