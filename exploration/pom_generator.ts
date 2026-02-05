/**
 * Canonical model (KnowledgeBase) → Page Object Model code.
 */

import type { KnowledgeBase, PageKnowledge, ElementKnowledge, LocatorCandidate } from './types.js';

function sanitizeClassName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('')
    .replace(/^[0-9]/, 'P$&') || 'Page';
}

function sanitizeMethodName(name: string): string {
  const s = name
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join('');
  return s.replace(/^[0-9]/, 'e$&') || 'element';
}

function getElementName(el: ElementKnowledge): string {
  if (el.raw.dataRole) return sanitizeMethodName(el.raw.dataRole);
  if (el.raw.dataTestId) return sanitizeMethodName(el.raw.dataTestId);
  if (el.raw.accessibleName) return sanitizeMethodName(el.raw.accessibleName);
  if (el.raw.ariaLabel) return sanitizeMethodName(el.raw.ariaLabel);
  if (el.raw.textContent && el.raw.textContent.length < 30) return sanitizeMethodName(el.raw.textContent);
  return sanitizeMethodName(el.elementId);
}

function bestLocatorExpression(locators: LocatorCandidate[]): string {
  if (locators.length === 0) return "page.locator('body')";
  const first = locators[0]!;
  const expr = first.expression;
  return expr.startsWith('page.') ? expr : `page.${expr}`;
}

function generatePageClass(page: PageKnowledge, className: string): string {
  const lines: string[] = [];
  lines.push(`export class ${className} {`);
  lines.push(`  constructor(private page: import('playwright').Page) {}`);
  lines.push('');
  for (const el of page.elements) {
    const methodName = getElementName(el);
    const expr = bestLocatorExpression(el.locators);
    const locatorCode = expr.startsWith('page.') ? 'this.' + expr : 'this.page.' + expr;
    lines.push(`  get ${methodName}() {`);
    lines.push(`    return ${locatorCode};`);
    lines.push(`  }`);
    lines.push('');
  }
  lines.push('}');
  return lines.join('\n');
}

export interface POMGeneratorOptions {
  /** Optional import path for Page type (e.g. 'playwright') */
  pageImportPath?: string;
}

/**
 * Generate Page Object Model code from KnowledgeBase (one class per page).
 */
export function generatePOM(knowledge: KnowledgeBase, _options: POMGeneratorOptions = {}): string {
  const lines: string[] = [];
  lines.push('/**');
  lines.push(` * Generated POM from knowledge base ${knowledge.runId}`);
  lines.push(' */');
  lines.push('');
  for (const page of knowledge.pages) {
    const className = sanitizeClassName(page.title || page.url || 'Page');
    lines.push(generatePageClass(page, className));
    lines.push('');
  }
  return lines.join('\n').trim();
}
