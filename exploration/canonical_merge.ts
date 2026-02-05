/**
 * Canonical merge: enriched flow JSON → KnowledgeBase (pages, elements, apiEndpoints).
 */

import type { FlowJSON, ElementSnapshot, RawElementSnapshot, LocatorEntry } from './flow_types.js';
import {
  createKnowledgeBase,
  createPageKnowledge,
  createElementKnowledge,
  addPageToKnowledge,
  addElementToPage,
} from './knowledge_writer.js';
import type { KnowledgeBase, PageKnowledge, RawElement, LocatorCandidate, LocatorStrategy, ApiEndpointEntry } from './types.js';

function rawSnapshotToRaw(snapshot: RawElementSnapshot): RawElement {
  return {
    tag: snapshot.tag,
    role: snapshot.role,
    dataRole: snapshot.dataRole,
    dataTestId: snapshot.dataTestId,
    ariaLabel: snapshot.ariaLabel,
    accessibleName: snapshot.accessibleName,
    textContent: snapshot.textContent,
    inputType: snapshot.inputType,
    selectOptions: snapshot.selectOptions,
    isVisible: snapshot.isVisible,
    isEnabled: snapshot.isEnabled,
    boundingBox: snapshot.boundingBox,
  };
}

function locatorEntryToCandidate(entry: LocatorEntry): LocatorCandidate {
  const score = entry.stabilityScore ?? 50;
  return {
    strategy: entry.strategy as LocatorStrategy,
    expression: entry.expression,
    stabilityScore: score,
    description: entry.description ?? entry.strategy,
    isLowStability: score < 50,
  };
}

function rawKey(r: { tag: string; role?: string; dataRole?: string; dataTestId?: string; accessibleName?: string; ariaLabel?: string }): string {
  return [r.tag, r.role ?? '', r.dataRole ?? '', r.dataTestId ?? '', r.accessibleName ?? '', r.ariaLabel ?? ''].join('|');
}

function elementStableKey(snapshot: ElementSnapshot): string {
  return rawKey(snapshot.raw);
}

/**
 * Merge enriched flow into a KnowledgeBase. Never overwrites; uses new run ID.
 */
export function mergeEnrichedFlowIntoKnowledge(
  flow: FlowJSON,
  planName: string = 'recording',
  planVersion: string = '1.0.0'
): KnowledgeBase {
  const knowledge = createKnowledgeBase(planName, planVersion);
  const stepEnrichments = flow.stepEnrichments ?? {};
  const pageByUrl = new Map<string, PageKnowledge>();

  for (let i = 0; i < flow.steps.length; i++) {
    const enrichment = stepEnrichments[i];
    if (!enrichment?.pageUrl) continue;

    let page = pageByUrl.get(enrichment.pageUrl);
    if (!page) {
      page = createPageKnowledge(
        enrichment.pageUrl,
        enrichment.pageTitle ?? '',
        `step-${i}`
      );
      pageByUrl.set(enrichment.pageUrl, page);
      addPageToKnowledge(knowledge, page);
    }

    if (enrichment.elementSnapshot) {
      const key = elementStableKey(enrichment.elementSnapshot);
      const existing = page.elements.find((el) => rawKey(el.raw) === key);
      if (!existing) {
        const raw = rawSnapshotToRaw(enrichment.elementSnapshot.raw);
        const locators = enrichment.elementSnapshot.locators.map(locatorEntryToCandidate);
        const elementId = `element-${i}-${page.elements.length}`;
        const elementKnowledge = createElementKnowledge(elementId, raw, locators);
        addElementToPage(page, elementKnowledge);
      }
    }
  }

  if (flow.apiTraffic?.length) {
    knowledge.apiEndpoints = flow.apiTraffic.map((t): ApiEndpointEntry => ({
      url: t.url,
      method: t.method,
      status: t.status,
      source: 'recording',
      sourceFlowId: flow.sessionId,
      timestamp: t.timestamp,
    }));
  }

  return knowledge;
}
