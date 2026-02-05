/**
 * Recording locators: data-role first (if exists), then all Playwright-recommended locators.
 * Used for recorded objects in flow enrichment and canonical model.
 */

import type { RawElement } from './types.js';
import type { LocatorEntry } from './flow_types.js';

function escapeForLocator(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"');
}

/**
 * Generate all Playwright-recommended locators for a raw element.
 * Order: data-role first (if exists), then getByTestId, getByRole, getByLabel, getByPlaceholder, getByText, getByAltText, getByTitle.
 * Only includes strategies that apply to the element.
 */
export function getRecordingLocators(element: RawElement): LocatorEntry[] {
  const entries: LocatorEntry[] = [];

  // 1. data-role (priority when it exists)
  if (element.dataRole) {
    entries.push({
      strategy: 'data-role',
      expression: `page.getByTestId('${escapeForLocator(element.dataRole)}').or(page.locator('[data-role="${escapeForLocator(element.dataRole)}"]'))`,
      stabilityScore: 100,
      description: `data-role="${element.dataRole}"`,
    });
  }

  // 2. data-testid (getByTestId) - if present and not already used as data-role
  if (element.dataTestId && element.dataTestId !== element.dataRole) {
    entries.push({
      strategy: 'data-testid',
      expression: `page.getByTestId('${escapeForLocator(element.dataTestId)}')`,
      stabilityScore: 90,
      description: `data-testid="${element.dataTestId}"`,
    });
  }

  // 3. getByRole(role, { name: accessibleName })
  if (element.role && element.accessibleName) {
    entries.push({
      strategy: 'getByRole',
      expression: `page.getByRole('${escapeForLocator(element.role)}', { name: '${escapeForLocator(element.accessibleName)}' })`,
      stabilityScore: 80,
      description: `role="${element.role}" with name "${element.accessibleName}"`,
    });
  }

  // 4. getByLabel (aria-label or accessible name for form controls)
  if (element.ariaLabel) {
    entries.push({
      strategy: 'getByLabel',
      expression: `page.getByLabel('${escapeForLocator(element.ariaLabel)}')`,
      stabilityScore: 70,
      description: `aria-label="${element.ariaLabel}"`,
    });
  } else if (element.accessibleName && element.tag !== 'button' && element.tag !== 'a') {
    entries.push({
      strategy: 'getByLabel',
      expression: `page.getByLabel('${escapeForLocator(element.accessibleName)}')`,
      stabilityScore: 65,
      description: `label/accessible name "${element.accessibleName}"`,
    });
  }

  // 5. getByText (when element has short, single-line text content)
  if (element.textContent) {
    const trimmed = element.textContent.trim();
    if (trimmed.length > 0 && trimmed.length < 100 && !trimmed.includes('\n')) {
      entries.push({
        strategy: 'getByText',
        expression: `page.getByText('${escapeForLocator(trimmed)}')`,
        stabilityScore: 50,
        description: `text "${trimmed.slice(0, 30)}${trimmed.length > 30 ? '...' : ''}"`,
      });
    }
  }

  // 6. getByPlaceholder - RawElement does not have placeholder; accept optional extended type later
  const elWithPlaceholder = element as RawElement & { placeholder?: string };
  if (elWithPlaceholder.placeholder) {
    entries.push({
      strategy: 'getByPlaceholder',
      expression: `page.getByPlaceholder('${escapeForLocator(elWithPlaceholder.placeholder)}')`,
      stabilityScore: 60,
      description: `placeholder="${elWithPlaceholder.placeholder}"`,
    });
  }

  // 7. getByAltText - RawElement does not have alt; accept optional extended type later
  const elWithAlt = element as RawElement & { alt?: string };
  if (elWithAlt.alt) {
    entries.push({
      strategy: 'getByAltText',
      expression: `page.getByAltText('${escapeForLocator(elWithAlt.alt)}')`,
      stabilityScore: 70,
      description: `alt="${elWithAlt.alt}"`,
    });
  }

  // 8. getByTitle - RawElement does not have title; accept optional extended type later
  const elWithTitle = element as RawElement & { title?: string };
  if (elWithTitle.title) {
    entries.push({
      strategy: 'getByTitle',
      expression: `page.getByTitle('${escapeForLocator(elWithTitle.title)}')`,
      stabilityScore: 55,
      description: `title="${elWithTitle.title}"`,
    });
  }

  return entries;
}
