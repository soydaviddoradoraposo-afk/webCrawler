/**
 * Evidence Capture Module
 * 
 * Unified evidence capture for both MCP and crawler execution paths.
 * 
 * Responsibilities:
 * - Screenshot management (base64 or file)
 * - HTML snapshot extraction
 * - Console log collection
 * - Network log collection (optional)
 * - Accessibility tree extraction
 * - Evidence persistence
 */

import { Page, BrowserContext } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { Evidence, ConsoleLogEntry, NetworkLogEntry } from './types.js';

/**
 * Capture screenshot from page.
 * 
 * @param page - Playwright page instance
 * @param format - Output format: 'base64' or 'file'
 * @param path - File path (required if format is 'file')
 * @returns Screenshot as base64 string or file path
 */
export async function captureScreenshot(
  page: Page,
  format: 'base64' | 'file' = 'base64',
  path?: string
): Promise<string> {
  try {
    if (format === 'base64') {
      const buffer = await page.screenshot({ fullPage: true });
      return buffer.toString('base64');
    } else {
      if (!path) {
        throw new Error('File path is required for file format');
      }
      // Ensure directory exists
      await mkdir(dirname(path), { recursive: true });
      await page.screenshot({ path, fullPage: true });
      return path;
    }
  } catch (error) {
    throw new Error(`Failed to capture screenshot: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Capture HTML snapshot from page.
 * 
 * @param page - Playwright page instance
 * @returns HTML content as string
 */
export async function captureHTML(page: Page): Promise<string> {
  try {
    return await page.content();
  } catch (error) {
    throw new Error(`Failed to capture HTML: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Capture console logs from page.
 * 
 * @param page - Playwright page instance
 * @returns Array of console log entries
 */
export async function captureConsoleLogs(page: Page): Promise<ConsoleLogEntry[]> {
  const logs: ConsoleLogEntry[] = [];

  // Listen to console events
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    const location = msg.location();

    logs.push({
      level: type as ConsoleLogEntry['level'],
      text,
      timestamp: new Date().toISOString(),
      location: location ? {
        url: location.url,
        lineNumber: location.lineNumber,
        columnNumber: location.columnNumber,
      } : undefined,
    });
  });

  // Return logs collected so far
  // Note: In practice, you might want to collect logs over time
  // This implementation captures logs as they occur
  return logs;
}

/**
 * Capture accessibility tree from page.
 * 
 * @param page - Playwright page instance
 * @returns Accessibility tree as JSON object
 */
export async function captureAccessibilityTree(page: Page): Promise<any> {
  try {
    return await page.accessibility.snapshot();
  } catch (error) {
    throw new Error(`Failed to capture accessibility tree: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Capture network logs from browser context.
 * 
 * @param context - Playwright browser context
 * @returns Array of network log entries
 */
export async function captureNetworkLogs(context: BrowserContext): Promise<NetworkLogEntry[]> {
  const logs: NetworkLogEntry[] = [];

  // Listen to request/response events
  context.on('request', (request) => {
    logs.push({
      url: request.url(),
      method: request.method(),
      timestamp: new Date().toISOString(),
      requestHeaders: request.headers(),
    });
  });

  context.on('response', (response) => {
    const request = response.request();
    const logIndex = logs.findIndex(log => log.url === request.url() && !log.status);
    
    if (logIndex >= 0) {
      logs[logIndex].status = response.status();
      logs[logIndex].responseHeaders = response.headers();
    } else {
      logs.push({
        url: response.url(),
        method: request.method(),
        status: response.status(),
        timestamp: new Date().toISOString(),
        requestHeaders: request.headers(),
        responseHeaders: response.headers(),
      });
    }
  });

  return logs;
}

/**
 * Capture complete evidence for a step.
 * 
 * @param page - Playwright page instance
 * @param context - Playwright browser context
 * @param action - Action name for evidence
 * @param success - Whether action succeeded
 * @param format - Screenshot format
 * @param screenshotPath - Optional screenshot file path
 * @returns Complete evidence object
 */
export async function captureEvidence(
  page: Page,
  context: BrowserContext,
  action: string,
  success: boolean,
  format: 'base64' | 'file' = 'base64',
  screenshotPath?: string
): Promise<Evidence> {
  const timestamp = new Date().toISOString();
  
  // Capture all evidence types
  const [screenshot, html, consoleLogs, accessibilityTree] = await Promise.all([
    captureScreenshot(page, format, screenshotPath).catch(() => undefined),
    captureHTML(page).catch(() => undefined),
    captureConsoleLogs(page).catch(() => []),
    captureAccessibilityTree(page).catch(() => undefined),
  ]);

  // Network logs are captured over time, so we get them separately
  // In practice, you might want to collect these over the session
  const networkLogs: NetworkLogEntry[] = [];

  return {
    screenshot,
    html,
    consoleLogs,
    accessibilityTree,
    networkLogs,
    timestamp,
    action,
    success,
  };
}

/**
 * Save evidence to disk.
 * 
 * @param evidence - Evidence to save
 * @param outputDir - Output directory
 * @param stepId - Step identifier for organization
 * @returns Array of file paths where evidence was saved
 */
export async function saveEvidence(
  evidence: Evidence,
  outputDir: string,
  stepId: string
): Promise<string[]> {
  const savedPaths: string[] = [];
  const stepDir = join(outputDir, 'evidence', stepId);
  
  // Ensure directory exists
  await mkdir(stepDir, { recursive: true });

  // Save screenshot if present
  if (evidence.screenshot) {
    if (evidence.screenshot.startsWith('data:') || evidence.screenshot.length > 200) {
      // Assume base64, save as file
      const screenshotPath = join(stepDir, 'screenshot.png');
      const buffer = Buffer.from(evidence.screenshot, 'base64');
      await writeFile(screenshotPath, buffer);
      savedPaths.push(screenshotPath);
    } else {
      // Already a file path
      savedPaths.push(evidence.screenshot);
    }
  }

  // Save HTML snapshot
  if (evidence.html) {
    const htmlPath = join(stepDir, 'html-snapshot.html');
    await writeFile(htmlPath, evidence.html, 'utf-8');
    savedPaths.push(htmlPath);
  }

  // Save console logs
  if (evidence.consoleLogs && evidence.consoleLogs.length > 0) {
    const consoleLogsPath = join(stepDir, 'console-logs.json');
    await writeFile(consoleLogsPath, JSON.stringify(evidence.consoleLogs, null, 2), 'utf-8');
    savedPaths.push(consoleLogsPath);
  }

  // Save accessibility tree
  if (evidence.accessibilityTree) {
    const accessibilityPath = join(stepDir, 'accessibility-tree.json');
    await writeFile(accessibilityPath, JSON.stringify(evidence.accessibilityTree, null, 2), 'utf-8');
    savedPaths.push(accessibilityPath);
  }

  // Save network logs
  if (evidence.networkLogs && evidence.networkLogs.length > 0) {
    const networkLogsPath = join(stepDir, 'network-logs.json');
    await writeFile(networkLogsPath, JSON.stringify(evidence.networkLogs, null, 2), 'utf-8');
    savedPaths.push(networkLogsPath);
  }

  // Save execution log
  const executionLogPath = join(stepDir, 'execution-log.json');
  await writeFile(executionLogPath, JSON.stringify(evidence, null, 2), 'utf-8');
  savedPaths.push(executionLogPath);

  return savedPaths;
}
