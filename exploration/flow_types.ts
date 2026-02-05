/**
 * Flow JSON schema for recording and exploration.
 * Canonical format used by both recording (MCP codegen) and exploration pipeline.
 */

/**
 * A single recorded action (step) in a flow.
 */
export interface FlowStep {
  toolName: string;
  parameters: Record<string, unknown>;
  timestamp: number;
  result?: unknown;
}

/**
 * Optional enrichment attached to a step after replay/snapshot.
 */
export interface FlowStepEnrichment {
  pageUrl?: string;
  pageTitle?: string;
  elementSnapshot?: ElementSnapshot;
}

/**
 * Element snapshot with raw props and ranked locators (data-role first, then Playwright-recommended).
 */
export interface ElementSnapshot {
  raw: RawElementSnapshot;
  locators: LocatorEntry[];
}

export interface RawElementSnapshot {
  tag: string;
  role?: string;
  dataRole?: string;
  dataTestId?: string;
  ariaLabel?: string;
  accessibleName?: string;
  textContent?: string;
  inputType?: string;
  placeholder?: string;
  alt?: string;
  title?: string;
  selectOptions?: string[];
  isVisible: boolean;
  isEnabled: boolean;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface LocatorEntry {
  strategy: string;
  expression: string;
  stabilityScore?: number;
  description?: string;
}

/**
 * API traffic entry (request/response) for backend/endpoint capture.
 */
export interface ApiTrafficEntry {
  url: string;
  method: string;
  status?: number;
  requestHeaders?: Record<string, string>;
  postData?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  timestamp: number;
}

/**
 * Complete flow JSON (session recording or exported flow).
 */
export interface FlowJSON {
  sessionId: string;
  startTime: number;
  endTime?: number;
  baseUrl?: string;
  steps: FlowStep[];
  /** Optional per-step enrichment (pageUrl, pageTitle, elementSnapshot). */
  stepEnrichments?: Record<number, FlowStepEnrichment>;
  /** Captured API traffic (only allowed domains). */
  apiTraffic?: ApiTrafficEntry[];
}

/**
 * Convert a step index to enrichment key (0-based).
 */
export function getStepEnrichmentKey(stepIndex: number): number {
  return stepIndex;
}
