/**
 * Test parser: Playwright spec file (.spec.ts) → ExplorationStep[].
 * Extracts page.goto, page.click, page.fill, page.selectOption, etc. as steps.
 */

import { readFile } from 'fs/promises';
import type { ExplorationStep, ActionType } from './types.js';

/** Minimal step shape for exploration-from-test (action, target, value, id). */
export interface ParsedTestStep {
  id: string;
  action: ActionType;
  target: string;
  value?: string;
}

const STEP_ID_PREFIX = 'parsed-step';

/**
 * Extract a single-quoted or double-quoted string from content starting at index.
 * Returns { value, endIndex } or null.
 */
function extractString(content: string, start: number): { value: string; endIndex: number } | null {
  const quote = content[start];
  if (quote !== "'" && quote !== '"') return null;
  let i = start + 1;
  let value = '';
  while (i < content.length) {
    const ch = content[i];
    if (ch === '\\') {
      i++;
      if (i < content.length) {
        value += content[i];
        i++;
      }
      continue;
    }
    if (ch === quote) {
      return { value, endIndex: i + 1 };
    }
    value += ch;
    i++;
  }
  return null;
}

/**
 * Parse Playwright test file content and return exploration steps.
 */
export function parsePlaywrightTestContent(content: string): ParsedTestStep[] {
  const steps: ParsedTestStep[] = [];
  let stepCounter = 0;

  // page.goto('url') or page.goto("url") or page.goto(`url`)
  const gotoRe = /page\.goto\s*\(\s*['"`]/g;
  let m: RegExpExecArray | null;
  while ((m = gotoRe.exec(content)) !== null) {
    const quoteIndex = m.index + m[0].length - 1;
    const str = extractString(content, quoteIndex);
    if (str) {
      steps.push({
        id: `${STEP_ID_PREFIX}-${++stepCounter}`,
        action: 'goto',
        target: str.value,
      });
    }
  }

  // page.click('selector') or page.locator('sel').click()
  const clickRe = /page\.click\s*\(\s*['"`]([^'"`]*)['"`]\s*\)|page\.locator\s*\(\s*['"`]([^'"`]*)['"`]\s*\)\s*\.click\s*\(\s*\)/g;
  while ((m = clickRe.exec(content)) !== null) {
    const selector = m[1] ?? m[2];
    if (selector !== undefined) {
      steps.push({
        id: `${STEP_ID_PREFIX}-${++stepCounter}`,
        action: 'click',
        target: selector,
      });
    }
  }

  // page.fill('selector', 'value') or page.locator('sel').fill('value')
  const fillRe = /page\.fill\s*\(\s*['"`]([^'"`]*)['"`]\s*,\s*['"`]([^'"`]*)['"`]\s*\)|page\.locator\s*\(\s*['"`]([^'"`]*)['"`]\s*\)\s*\.fill\s*\(\s*['"`]([^'"`]*)['"`]\s*\)/g;
  while ((m = fillRe.exec(content)) !== null) {
    const selector = m[1] ?? m[3];
    const value = m[2] ?? m[4];
    if (selector !== undefined && value !== undefined) {
      steps.push({
        id: `${STEP_ID_PREFIX}-${++stepCounter}`,
        action: 'fill',
        target: selector,
        value,
      });
    }
  }

  // page.selectOption('selector', 'value') or page.locator('sel').selectOption('value')
  const selectRe = /page\.selectOption\s*\(\s*['"`]([^'"`]*)['"`]\s*,\s*['"`]([^'"`]*)['"`]\s*\)|page\.locator\s*\(\s*['"`]([^'"`]*)['"`]\s*\)\s*\.selectOption\s*\(\s*['"`]([^'"`]*)['"`]\s*\)/g;
  while ((m = selectRe.exec(content)) !== null) {
    const selector = m[1] ?? m[3];
    const value = m[2] ?? m[4];
    if (selector !== undefined && value !== undefined) {
      steps.push({
        id: `${STEP_ID_PREFIX}-${++stepCounter}`,
        action: 'select',
        target: selector,
        value,
      });
    }
  }

  // page.hover('selector') or page.locator('sel').hover()
  const hoverRe = /page\.hover\s*\(\s*['"`]([^'"`]*)['"`]\s*\)|page\.locator\s*\(\s*['"`]([^'"`]*)['"`]\s*\)\s*\.hover\s*\(\s*\)/g;
  while ((m = hoverRe.exec(content)) !== null) {
    const selector = m[1] ?? m[2];
    if (selector !== undefined) {
      steps.push({
        id: `${STEP_ID_PREFIX}-${++stepCounter}`,
        action: 'hover',
        target: selector,
      });
    }
  }

  return steps;
}

/**
 * Parse a Playwright test file and return exploration steps.
 */
export async function parsePlaywrightTestFile(filePath: string): Promise<ParsedTestStep[]> {
  const content = await readFile(filePath, 'utf-8');
  return parsePlaywrightTestContent(content);
}

/**
 * Convert parsed steps to ExplorationStep[] (full shape for step_executor).
 */
export function parsedStepsToExplorationSteps(parsed: ParsedTestStep[]): ExplorationStep[] {
  return parsed.map((p) => ({
    id: p.id,
    action: p.action,
    target: p.target,
    value: p.value,
  }));
}
