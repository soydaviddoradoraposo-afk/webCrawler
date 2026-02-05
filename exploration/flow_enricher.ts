/**
 * Flow enricher: replay a flow JSON and attach page/element snapshots with recording locators.
 */

import { chromium, Page } from 'playwright';
import type { FlowJSON, FlowStep, FlowStepEnrichment, RawElementSnapshot } from './flow_types.js';
import { extractElementsBySelector } from './snapshot_extractor.js';
import { getRecordingLocators } from './recording_locators.js';
import type { RawElement } from './types.js';

export interface FlowEnricherConfig {
  headless?: boolean;
  timeout?: number;
}

function rawToSnapshot(raw: RawElement): RawElementSnapshot {
  return {
    tag: raw.tag,
    role: raw.role,
    dataRole: raw.dataRole,
    dataTestId: raw.dataTestId,
    ariaLabel: raw.ariaLabel,
    accessibleName: raw.accessibleName,
    textContent: raw.textContent,
    inputType: raw.inputType,
    selectOptions: raw.selectOptions,
    isVisible: raw.isVisible,
    isEnabled: raw.isEnabled,
    boundingBox: raw.boundingBox,
  };
}

async function replayStep(page: Page, step: FlowStep): Promise<void> {
  const { toolName, parameters } = step;
  const selector = parameters.selector as string | undefined;
  const url = parameters.url as string | undefined;
  const value = parameters.value as string | undefined;

  switch (toolName) {
    case 'playwright_navigate':
      if (url) await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      break;
    case 'playwright_click':
      if (selector) await page.locator(selector).first().click({ timeout: 10000 }).catch(() => {});
      break;
    case 'playwright_fill':
      if (selector && value !== undefined) await page.locator(selector).first().fill(value, { timeout: 10000 }).catch(() => {});
      break;
    case 'playwright_select':
      if (selector && value !== undefined) await page.locator(selector).first().selectOption(value, { timeout: 10000 }).catch(() => {});
      break;
    case 'playwright_hover':
      if (selector) await page.locator(selector).first().hover({ timeout: 10000 }).catch(() => {});
      break;
    default:
      break;
  }
}

function getSelectorFromStep(step: FlowStep): string | undefined {
  const { toolName, parameters } = step;
  if (parameters.selector && typeof parameters.selector === 'string') return parameters.selector;
  if (toolName === 'playwright_iframe_click' || toolName === 'playwright_iframe_fill') {
    return (parameters.iframeSelector as string) || undefined;
  }
  return undefined;
}

function isStepWithTarget(toolName: string): boolean {
  return ['playwright_click', 'playwright_fill', 'playwright_select', 'playwright_hover'].includes(toolName);
}

/**
 * Enrich a flow JSON by replaying steps and attaching page URL/title and element snapshots (with recording locators).
 */
export async function enrichFlow(flow: FlowJSON, config: FlowEnricherConfig = {}): Promise<FlowJSON> {
  const { headless = true, timeout = 30000 } = config;
  const enriched: FlowJSON = {
    ...flow,
    stepEnrichments: { ...flow.stepEnrichments },
  };

  const browser = await chromium.launch({ headless });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    page.setDefaultTimeout(timeout);

    for (let i = 0; i < flow.steps.length; i++) {
      const step = flow.steps[i];
      if (!step) continue;
      await replayStep(page, step);

      const pageUrl = page.url();
      const pageTitle = await page.title().catch(() => '');

      const enrichment: FlowStepEnrichment = {
        pageUrl,
        pageTitle,
      };

      if (isStepWithTarget(step.toolName)) {
        const selector = getSelectorFromStep(step);
        if (selector) {
          try {
            const elements = await extractElementsBySelector(page, selector);
            const first = elements[0];
            if (first) {
              const locators = getRecordingLocators(first);
              const rawSnapshot = rawToSnapshot(first);
              enrichment.elementSnapshot = {
                raw: rawSnapshot,
                locators,
              };
            }
          } catch {
            // skip element snapshot on error
          }
        }
      }

      enriched.stepEnrichments![i] = enrichment;
    }

    await context.close();
  } finally {
    await browser.close();
  }

  return enriched;
}
