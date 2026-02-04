/**
 * Locator Ranker
 * 
 * Generates and ranks locator candidates for UI elements based on stability.
 * 
 * Responsibilities:
 * - Generate multiple locator strategies for each element
 * - Rank locators by stability score
 * - Flag low-stability locators
 * - Provide traceable source information
 * 
 * Locator Priority (MANDATORY):
 * 1. data-role (highest priority, score: 100)
 * 2. data-testid (score: 90)
 * 3. ARIA role + accessible name (score: 80)
 * 4. aria-label (score: 70)
 * 5. CSS fallback (lowest priority, score: 30-50)
 */

import { RawElement, LocatorCandidate, LocatorStrategy } from './types.js';

/**
 * Generate and rank locator candidates for an element.
 * 
 * @param element - Raw element data
 * @returns Array of locator candidates sorted by stability (highest first)
 */
export function rankLocators(element: RawElement): LocatorCandidate[] {
  const candidates: LocatorCandidate[] = [];

  // Strategy 1: data-role (highest priority)
  if (element.dataRole) {
    candidates.push({
      strategy: 'data-role',
      expression: `getByTestId('${element.dataRole}').or(page.locator('[data-role="${element.dataRole}"]'))`,
      stabilityScore: 100,
      description: `data-role="${element.dataRole}"`,
      isLowStability: false,
    });
  }

  // Strategy 2: data-testid
  if (element.dataTestId) {
    candidates.push({
      strategy: 'data-testid',
      expression: `getByTestId('${element.dataTestId}')`,
      stabilityScore: 90,
      description: `data-testid="${element.dataTestId}"`,
      isLowStability: false,
    });
  }

  // Strategy 3: ARIA role + accessible name
  if (element.role && element.accessibleName) {
    candidates.push({
      strategy: 'role-accessible-name',
      expression: `getByRole('${element.role}', { name: '${escapeString(element.accessibleName)}' })`,
      stabilityScore: 80,
      description: `role="${element.role}" with accessible name "${element.accessibleName}"`,
      isLowStability: false,
    });
  }

  // Strategy 4: aria-label
  if (element.ariaLabel) {
    candidates.push({
      strategy: 'aria-label',
      expression: `getByLabel('${escapeString(element.ariaLabel)}')`,
      stabilityScore: 70,
      description: `aria-label="${element.ariaLabel}"`,
      isLowStability: false,
    });
  }

  // Strategy 5: CSS fallback (lowest priority, discouraged)
  const cssLocator = generateCssLocator(element);
  if (cssLocator) {
    const score = calculateCssStabilityScore(element, cssLocator);
    candidates.push({
      strategy: 'css-fallback',
      expression: `locator('${cssLocator}')`,
      stabilityScore: score,
      description: `CSS selector: ${cssLocator}`,
      isLowStability: score < 50,
    });
  }

  // Sort by stability score (highest first)
  candidates.sort((a, b) => b.stabilityScore - a.stabilityScore);

  return candidates;
}

/**
 * Generate a CSS locator as fallback.
 * 
 * This is the lowest priority strategy and should only be used
 * when no semantic locators are available.
 */
function generateCssLocator(element: RawElement): string | null {
  const parts: string[] = [];

  // Prefer ID if available
  // Note: We don't have ID in RawElement, so we'll use other attributes

  // Use tag name
  parts.push(element.tag);

  // Add type for inputs
  if (element.tag === 'input' && element.inputType) {
    parts.push(`[type="${element.inputType}"]`);
  }

  // Add data attributes if available (but these should have been caught above)
  if (element.dataRole) {
    parts.push(`[data-role="${element.dataRole}"]`);
  } else if (element.dataTestId) {
    parts.push(`[data-testid="${element.dataTestId}"]`);
  }

  // Add aria-label as fallback
  if (element.ariaLabel && !element.dataRole && !element.dataTestId) {
    parts.push(`[aria-label="${element.ariaLabel}"]`);
  }

  // If we have text content and it's a button/link, use it
  if (element.textContent && (element.tag === 'button' || element.tag === 'a')) {
    // Only use text if it's short and doesn't contain special chars
    const cleanText = element.textContent.trim();
    if (cleanText.length < 50 && !cleanText.includes('\n')) {
      // Note: text-based selectors are very unstable, so we give them low score
      // This is just for completeness
    }
  }

  if (parts.length === 0) {
    return null;
  }

  return parts.join('');
}

/**
 * Calculate stability score for CSS locators.
 * 
 * CSS locators are inherently less stable, so they get lower scores.
 * The score depends on how specific and semantic the selector is.
 */
function calculateCssStabilityScore(element: RawElement, cssLocator: string): number {
  let score = 30; // Base score for CSS (low)

  // Boost score if using data attributes
  if (cssLocator.includes('[data-role=') || cssLocator.includes('[data-testid=')) {
    score += 20;
  }

  // Boost score if using aria-label
  if (cssLocator.includes('[aria-label=')) {
    score += 10;
  }

  // Reduce score if using text content (very unstable)
  if (cssLocator.includes('text=') || cssLocator.includes('::text')) {
    score -= 20;
  }

  // Reduce score if using nth-child or similar (very unstable)
  if (cssLocator.includes('nth-child') || cssLocator.includes('nth-of-type')) {
    score -= 30;
  }

  // Ensure score is within bounds
  return Math.max(0, Math.min(100, score));
}

/**
 * Escape string for use in locator expressions.
 */
function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"');
}

/**
 * Get the best (highest stability) locator for an element.
 * 
 * @param element - Raw element data
 * @returns Best locator candidate or null if none available
 */
export function getBestLocator(element: RawElement): LocatorCandidate | null {
  const candidates = rankLocators(element);
  return candidates.length > 0 ? candidates[0] : null;
}