/**
 * Crawler Executor
 * 
 * Deterministic multi-strategy selector resolution and action execution.
 * Used as fallback when MCP execution fails or is unavailable.
 * 
 * Responsibilities:
 * - Deterministic multi-strategy selector resolution
 * - Automatic element discovery and interaction
 * - Robust fallback chaining
 * - Evidence capture matching MCP format
 * - Heuristic-based element matching
 */

import { Page, Locator, BrowserContext } from 'playwright';
import { CrawlerActionResult, RawElement } from './types.js';
import { captureEvidence } from './evidence_capture.js';
import { extractPageSnapshot } from './snapshot_extractor.js';

/**
 * Execute click action using deterministic selector resolution.
 * 
 * @param target - Target description or selector
 * @param page - Playwright page instance
 * @param context - Browser context for evidence capture
 * @returns Crawler action result
 */
export async function executeClick(
  target: string,
  page: Page,
  context: BrowserContext
): Promise<CrawlerActionResult> {
  try {
    const locator = await resolveSelector(target, page);
    
    if (!locator) {
      const evidence = await captureEvidence(page, context, 'click', false);
      return {
        success: false,
        error: `Could not resolve selector for target: ${target}`,
        evidence,
      };
    }

    await locator.click({ timeout: 5000 });
    const evidence = await captureEvidence(page, context, 'click', true);
    
    return {
      success: true,
      evidence,
      strategyUsed: 'multi-strategy',
    };
  } catch (error) {
    const evidence = await captureEvidence(page, context, 'click', false);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      evidence,
    };
  }
}

/**
 * Execute fill action using deterministic selector resolution.
 * 
 * @param target - Target description or selector
 * @param value - Value to fill
 * @param page - Playwright page instance
 * @param context - Browser context for evidence capture
 * @returns Crawler action result
 */
export async function executeFill(
  target: string,
  value: string,
  page: Page,
  context: BrowserContext
): Promise<CrawlerActionResult> {
  try {
    const locator = await resolveSelector(target, page);
    
    if (!locator) {
      const evidence = await captureEvidence(page, context, 'fill', false);
      return {
        success: false,
        error: `Could not resolve selector for target: ${target}`,
        evidence,
      };
    }

    await locator.fill(value, { timeout: 5000 });
    const evidence = await captureEvidence(page, context, 'fill', true);
    
    return {
      success: true,
      evidence,
      strategyUsed: 'multi-strategy',
    };
  } catch (error) {
    const evidence = await captureEvidence(page, context, 'fill', false);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      evidence,
    };
  }
}

/**
 * Execute hover action using deterministic selector resolution.
 * 
 * @param target - Target description or selector
 * @param page - Playwright page instance
 * @param context - Browser context for evidence capture
 * @returns Crawler action result
 */
export async function executeHover(
  target: string,
  page: Page,
  context: BrowserContext
): Promise<CrawlerActionResult> {
  try {
    const locator = await resolveSelector(target, page);
    
    if (!locator) {
      const evidence = await captureEvidence(page, context, 'hover', false);
      return {
        success: false,
        error: `Could not resolve selector for target: ${target}`,
        evidence,
      };
    }

    await locator.hover({ timeout: 5000 });
    const evidence = await captureEvidence(page, context, 'hover', true);
    
    return {
      success: true,
      evidence,
      strategyUsed: 'multi-strategy',
    };
  } catch (error) {
    const evidence = await captureEvidence(page, context, 'hover', false);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      evidence,
    };
  }
}

/**
 * Execute scroll action.
 * 
 * @param target - Target description, selector, or coordinates {x, y}
 * @param page - Playwright page instance
 * @param context - Browser context for evidence capture
 * @returns Crawler action result
 */
export async function executeScroll(
  target: string | { x: number; y: number },
  page: Page,
  context: BrowserContext
): Promise<CrawlerActionResult> {
  try {
    if (typeof target === 'object') {
      // Scroll to coordinates
      await page.evaluate(({ x, y }) => {
        window.scrollTo(x, y);
      }, target);
    } else {
      // Scroll to element
      const locator = await resolveSelector(target, page);
      if (!locator) {
        const evidence = await captureEvidence(page, context, 'scroll', false);
        return {
          success: false,
          error: `Could not resolve selector for target: ${target}`,
          evidence,
        };
      }
      await locator.scrollIntoViewIfNeeded({ timeout: 5000 });
    }

    const evidence = await captureEvidence(page, context, 'scroll', true);
    
    return {
      success: true,
      evidence,
      strategyUsed: 'multi-strategy',
    };
  } catch (error) {
    const evidence = await captureEvidence(page, context, 'scroll', false);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      evidence,
    };
  }
}

/**
 * Execute wait action.
 * 
 * @param condition - Wait condition (selector or description)
 * @param page - Playwright page instance
 * @param context - Browser context for evidence capture
 * @returns Crawler action result
 */
export async function executeWait(
  condition: string,
  page: Page,
  context: BrowserContext
): Promise<CrawlerActionResult> {
  try {
    // Try to resolve as selector first
    const locator = await resolveSelector(condition, page);
    
    if (locator) {
      await locator.waitFor({ state: 'visible', timeout: 10000 });
    } else {
      // Fallback to generic wait
      await page.waitForTimeout(2000);
    }

    const evidence = await captureEvidence(page, context, 'wait', true);
    
    return {
      success: true,
      evidence,
      strategyUsed: 'multi-strategy',
    };
  } catch (error) {
    const evidence = await captureEvidence(page, context, 'wait', false);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      evidence,
    };
  }
}

/**
 * Execute screenshot action.
 * 
 * @param path - Screenshot file path
 * @param page - Playwright page instance
 * @param context - Browser context for evidence capture
 * @returns Crawler action result
 */
export async function executeScreenshot(
  path: string,
  page: Page,
  context: BrowserContext
): Promise<CrawlerActionResult> {
  try {
    await page.screenshot({ path, fullPage: true });
    const evidence = await captureEvidence(page, context, 'screenshot', true, 'file', path);
    
    return {
      success: true,
      data: { path },
      evidence,
      strategyUsed: 'direct',
    };
  } catch (error) {
    const evidence = await captureEvidence(page, context, 'screenshot', false);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      evidence,
    };
  }
}

/**
 * Discover interactable elements on the page.
 * 
 * @param page - Playwright page instance
 * @returns Array of raw element data
 */
export async function discoverInteractableElements(page: Page): Promise<RawElement[]> {
  return await extractPageSnapshot(page);
}

/**
 * Resolve selector using multi-strategy approach.
 * 
 * Strategy priority:
 * 1. data-role attribute
 * 2. data-testid attribute
 * 3. ARIA role + accessible name
 * 4. aria-label
 * 5. Text content matching (heuristic)
 * 6. CSS selector fallback
 * 7. Fuzzy text matching (last resort)
 * 
 * @param target - Target description or selector
 * @param page - Playwright page instance
 * @returns Resolved locator or null if not found
 */
export async function resolveSelector(
  target: string,
  page: Page
): Promise<Locator | null> {
  const normalizedTarget = normalizeTarget(target);

  // Strategy 1: data-role attribute
  try {
    const locator = page.locator(`[data-role="${normalizedTarget}"]`);
    if (await locator.isVisible({ timeout: 1000 }).catch(() => false)) {
      return locator;
    }
  } catch {
    // Continue to next strategy
  }

  // Strategy 2: data-testid attribute
  try {
    const locator = page.locator(`[data-testid="${normalizedTarget}"]`);
    if (await locator.isVisible({ timeout: 1000 }).catch(() => false)) {
      return locator;
    }
  } catch {
    // Continue to next strategy
  }

  // Strategy 3: ARIA role + accessible name
  try {
    const locator = page.getByRole('button', { name: normalizedTarget });
    if (await locator.isVisible({ timeout: 1000 }).catch(() => false)) {
      return locator;
    }
  } catch {
    // Try link role
    try {
      const locator = page.getByRole('link', { name: normalizedTarget });
      if (await locator.isVisible({ timeout: 1000 }).catch(() => false)) {
        return locator;
      }
    } catch {
      // Continue to next strategy
    }
  }

  // Strategy 4: aria-label
  try {
    const locator = page.getByLabel(normalizedTarget);
    if (await locator.isVisible({ timeout: 1000 }).catch(() => false)) {
      return locator;
    }
  } catch {
    // Continue to next strategy
  }

  // Strategy 5: Text content matching (heuristic)
  try {
    const elements = await discoverInteractableElements(page);
    const matchedElement = findElementByText(elements, normalizedTarget);
    
    if (matchedElement) {
      // Try to create locator from matched element
      if (matchedElement.dataRole) {
        const locator = page.locator(`[data-role="${matchedElement.dataRole}"]`);
        if (await locator.isVisible({ timeout: 1000 }).catch(() => false)) {
          return locator;
        }
      }
      if (matchedElement.dataTestId) {
        const locator = page.locator(`[data-testid="${matchedElement.dataTestId}"]`);
        if (await locator.isVisible({ timeout: 1000 }).catch(() => false)) {
          return locator;
        }
      }
    }
  } catch {
    // Continue to next strategy
  }

  // Strategy 6: CSS selector fallback
  try {
    const locator = page.locator(normalizedTarget);
    if (await locator.isVisible({ timeout: 1000 }).catch(() => false)) {
      return locator;
    }
  } catch {
    // Continue to next strategy
  }

  // Strategy 7: Fuzzy text matching (last resort)
  try {
    const locator = page.locator(`text=${normalizedTarget}`);
    if (await locator.isVisible({ timeout: 1000 }).catch(() => false)) {
      return locator.first();
    }
  } catch {
    // All strategies failed
  }

  return null;
}

/**
 * Normalize target description for matching.
 * 
 * @param target - Target description
 * @returns Normalized string
 */
function normalizeTarget(target: string): string {
  return target
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}

/**
 * Find element by text content using heuristic matching.
 * 
 * @param elements - Array of raw elements
 * @param target - Target text to match
 * @returns Matched element or null
 */
function findElementByText(elements: RawElement[], target: string): RawElement | null {
  const normalizedTarget = normalizeTarget(target);
  let bestMatch: RawElement | null = null;
  let bestScore = 0;

  for (const element of elements) {
    if (!element.isVisible || !element.isEnabled) {
      continue;
    }

    let score = 0;

    // Check text content
    if (element.textContent) {
      const normalizedText = normalizeTarget(element.textContent);
      if (normalizedText.includes(normalizedTarget) || normalizedTarget.includes(normalizedText)) {
        score += 10;
      }
    }

    // Check aria-label
    if (element.ariaLabel) {
      const normalizedLabel = normalizeTarget(element.ariaLabel);
      if (normalizedLabel.includes(normalizedTarget) || normalizedTarget.includes(normalizedLabel)) {
        score += 8;
      }
    }

    // Check accessible name
    if (element.accessibleName) {
      const normalizedName = normalizeTarget(element.accessibleName);
      if (normalizedName.includes(normalizedTarget) || normalizedTarget.includes(normalizedName)) {
        score += 7;
      }
    }

    // Check data attributes (lower score, but still relevant)
    if (element.dataRole && normalizeTarget(element.dataRole) === normalizedTarget) {
      score += 5;
    }
    if (element.dataTestId && normalizeTarget(element.dataTestId) === normalizedTarget) {
      score += 5;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = element;
    }
  }

  return bestMatch;
}
