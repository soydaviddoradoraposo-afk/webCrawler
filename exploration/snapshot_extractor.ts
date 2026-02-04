/**
 * Snapshot Extractor
 * 
 * Extracts raw UI element data from the current page state.
 * 
 * Responsibilities:
 * - Extract ONLY visible and enabled interactive elements
 * - Capture element attributes and properties
 * - Return raw data without interpretation
 * - Ignore hidden, disabled, or decorative elements
 */

import { Page, Locator } from 'playwright';
import { RawElement } from './types.js';

/**
 * Extract all interactive elements from the current page.
 * 
 * @param page - Playwright page instance
 * @returns Array of raw element data
 */
export async function extractPageSnapshot(page: Page): Promise<RawElement[]> {
  const elements: RawElement[] = [];

  // Get all potentially interactive elements
  const selectors = [
    'button',
    'a[href]',
    'input',
    'select',
    'textarea',
    '[role="button"]',
    '[role="link"]',
    '[role="menuitem"]',
    '[role="tab"]',
    '[role="option"]',
    '[onclick]',
    '[data-role]',
    '[data-testid]',
  ];

  for (const selector of selectors) {
    const locators = await page.locator(selector).all();
    
    for (const locator of locators) {
      const element = await extractElement(locator);
      if (element && element.isVisible && element.isEnabled) {
        elements.push(element);
      }
    }
  }

  return elements;
}

/**
 * Extract data from a single element.
 * 
 * @param locator - Playwright locator for the element
 * @returns Raw element data or null if element should be ignored
 */
async function extractElement(locator: Locator): Promise<RawElement | null> {
  try {
    // Check visibility and enabled state first
    const isVisible = await locator.isVisible().catch(() => false);
    const isEnabled = await locator.isEnabled().catch(() => false);

    if (!isVisible || !isEnabled) {
      return null;
    }

    // Get element properties
    const tag = await locator.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');
    const role = await locator.getAttribute('role').catch(() => undefined);
    const dataRole = await locator.getAttribute('data-role').catch(() => undefined);
    const dataTestId = await locator.getAttribute('data-testid').catch(() => undefined);
    const ariaLabel = await locator.getAttribute('aria-label').catch(() => undefined);

    // Get accessible name (computed)
    const accessibleName = await locator.evaluate((el) => {
      // Try aria-label first
      if (el.getAttribute('aria-label')) {
        return el.getAttribute('aria-label');
      }
      // Try aria-labelledby
      const labelledBy = el.getAttribute('aria-labelledby');
      if (labelledBy) {
        const labelEl = document.getElementById(labelledBy);
        if (labelEl) {
          return labelEl.textContent?.trim() || undefined;
        }
      }
      // Try associated label
      if (el.id) {
        const label = document.querySelector(`label[for="${el.id}"]`);
        if (label) {
          return label.textContent?.trim() || undefined;
        }
      }
      // Fallback to text content for certain elements
      if (['button', 'a', 'label'].includes(el.tagName.toLowerCase())) {
        return el.textContent?.trim() || undefined;
      }
      return undefined;
    }).catch(() => undefined);

    // Get text content (trimmed)
    const textContent = await locator.textContent().catch(() => undefined);
    const trimmedText = textContent?.trim() || undefined;

    // Get input-specific properties
    let inputType: string | undefined;
    if (tag === 'input') {
      inputType = await locator.getAttribute('type').catch(() => 'text') || 'text';
    }

    // Get select options
    let selectOptions: string[] | undefined;
    if (tag === 'select') {
      selectOptions = await locator.evaluate((el) => {
        if (el instanceof HTMLSelectElement) {
          return Array.from(el.options).map(opt => opt.text?.trim() || '').filter(Boolean);
        }
        return [];
      }).catch(() => undefined);
    }

    // Get bounding box
    const boundingBox = await locator.boundingBox().catch(() => undefined);

    // Filter out decorative elements (very small or zero-sized)
    if (boundingBox && (boundingBox.width === 0 || boundingBox.height === 0)) {
      return null;
    }

    return {
      tag,
      role,
      dataRole,
      dataTestId,
      ariaLabel,
      accessibleName,
      textContent: trimmedText,
      inputType,
      selectOptions,
      isVisible,
      isEnabled,
      boundingBox,
    };
  } catch (error) {
    // If extraction fails, skip this element
    return null;
  }
}

/**
 * Extract elements matching a specific selector.
 * 
 * @param page - Playwright page instance
 * @param selector - CSS selector or Playwright locator string
 * @returns Array of raw element data
 */
export async function extractElementsBySelector(
  page: Page,
  selector: string
): Promise<RawElement[]> {
  const elements: RawElement[] = [];
  const locators = await page.locator(selector).all();

  for (const locator of locators) {
    const element = await extractElement(locator);
    if (element && element.isVisible && element.isEnabled) {
      elements.push(element);
    }
  }

  return elements;
}