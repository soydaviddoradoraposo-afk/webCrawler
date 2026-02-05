/**
 * Flow JSON → Playwright test code (post-processor).
 */

import type { FlowJSON, FlowStep } from './flow_types.js';

function escapeForCode(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function stepToCode(step: FlowStep): string | null {
  const { toolName, parameters } = step;
  const url = parameters.url as string | undefined;
  const selector = parameters.selector as string | undefined;
  const value = parameters.value as string | undefined;
  const waitUntil = parameters.waitUntil as string | undefined;

  switch (toolName) {
    case 'playwright_navigate':
      if (!url) return null;
      const navOpts = waitUntil ? `, { waitUntil: '${waitUntil}' }` : '';
      return `  // Navigate to URL\n  await page.goto('${escapeForCode(url)}'${navOpts});`;
    case 'playwright_click':
      if (!selector) return null;
      return `  // Click element\n  await page.locator('${escapeForCode(selector)}').click();`;
    case 'playwright_fill':
      if (!selector || value === undefined) return null;
      return `  // Fill input\n  await page.locator('${escapeForCode(selector)}').fill('${escapeForCode(String(value))}');`;
    case 'playwright_select':
      if (!selector || value === undefined) return null;
      return `  // Select option\n  await page.locator('${escapeForCode(selector)}').selectOption('${escapeForCode(String(value))}');`;
    case 'playwright_hover':
      if (!selector) return null;
      return `  // Hover\n  await page.locator('${escapeForCode(selector)}').hover();`;
    case 'playwright_screenshot':
      const name = (parameters.name as string) || 'screenshot';
      return `  // Screenshot\n  await page.screenshot({ path: '${escapeForCode(name)}.png' });`;
    default:
      return null;
  }
}

export interface FlowToPlaywrightOptions {
  testNamePrefix?: string;
  includeComments?: boolean;
}

/**
 * Generate Playwright test code from flow JSON.
 */
export function flowToPlaywrightTest(flow: FlowJSON, options: FlowToPlaywrightOptions = {}): string {
  const { testNamePrefix = 'GeneratedTest', includeComments = true } = options;
  const name = `${testNamePrefix}_${new Date(flow.startTime).toISOString().split('T')[0]}`;
  const steps: string[] = [];
  for (const step of flow.steps) {
    const code = stepToCode(step);
    if (code) steps.push(code);
  }
  const comment = includeComments ? `\n// Generated from flow ${flow.sessionId}\n` : '';
  return `import { test, expect } from '@playwright/test';${comment}

test('${name}', async ({ page }) => {
${steps.join('\n\n')}
});
`;
}
