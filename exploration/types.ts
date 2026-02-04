/**
 * Core type definitions for the Directed UI Exploration System.
 * 
 * These types enforce strict contracts between modules and ensure
 * deterministic behavior throughout the exploration lifecycle.
 */

/**
 * Supported action types in exploration plans.
 */
export type ActionType = 
  | 'goto'
  | 'click'
  | 'fill'
  | 'select'
  | 'check'
  | 'uncheck'
  | 'keyboard'
  | 'hover'
  | 'scroll'
  | 'wait'
  | 'screenshot';

/**
 * Keyboard action key types.
 */
export type KeyboardKey = 
  | 'Enter'
  | 'Escape'
  | 'Tab'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'Home'
  | 'End'
  | 'PageUp'
  | 'PageDown';

/**
 * A single step in an exploration plan.
 */
export interface ExplorationStep {
  /** Unique identifier for this step */
  id: string;
  /** Action to perform */
  action: ActionType;
  /** Target selector or URL */
  target: string;
  /** Optional value for fill/select actions */
  value?: string;
  /** Optional keyboard key for keyboard actions */
  key?: KeyboardKey;
  /** Optional description for logging */
  description?: string;
  /** Wait condition after action (e.g., 'navigation', 'networkidle') */
  waitFor?: 'navigation' | 'networkidle' | 'load' | 'domcontentloaded';
  /** Execution preference: mcp-prefer (try MCP first), crawler-only, mcp-only */
  executionPreference?: 'mcp-prefer' | 'crawler-only' | 'mcp-only';
}

/**
 * Safety constraints for exploration.
 */
export interface SafetyConstraints {
  /** Actions that are explicitly forbidden */
  forbiddenActions: string[];
  /** Selectors that should never be interacted with */
  forbiddenSelectors: string[];
  /** Whether destructive forms can be submitted */
  allowDestructiveForms: boolean;
  /** Whether delete buttons can be clicked */
  allowDeleteButtons: boolean;
}

/**
 * Complete exploration plan structure.
 */
export interface ExplorationPlan {
  /** Plan metadata */
  metadata: {
    name: string;
    version: string;
    description?: string;
    createdAt: string;
  };
  /** Base URL for navigation */
  baseUrl: string;
  /** Ordered list of exploration steps */
  steps: ExplorationStep[];
  /** Safety constraints */
  safety: SafetyConstraints;
  /** Optional scope restrictions */
  scope?: {
    allowedPaths?: string[];
    forbiddenPaths?: string[];
  };
}

/**
 * Raw element data extracted from the DOM.
 */
export interface RawElement {
  /** HTML tag name */
  tag: string;
  /** ARIA role if present */
  role?: string;
  /** data-role attribute value (highest priority) */
  dataRole?: string;
  /** data-testid attribute value */
  dataTestId?: string;
  /** aria-label attribute value */
  ariaLabel?: string;
  /** Computed accessible name */
  accessibleName?: string;
  /** Visible text content (trimmed) */
  textContent?: string;
  /** Input type if element is an input */
  inputType?: string;
  /** Select options if element is a select */
  selectOptions?: string[];
  /** Whether element is visible */
  isVisible: boolean;
  /** Whether element is enabled */
  isEnabled: boolean;
  /** Element's bounding box */
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Locator strategy types.
 */
export type LocatorStrategy = 
  | 'data-role'
  | 'data-testid'
  | 'role-accessible-name'
  | 'aria-label'
  | 'css-fallback';

/**
 * A ranked locator candidate for an element.
 */
export interface LocatorCandidate {
  /** Locator strategy used */
  strategy: LocatorStrategy;
  /** Playwright locator expression */
  expression: string;
  /** Stability score (0-100, higher is more stable) */
  stabilityScore: number;
  /** Human-readable description of the locator */
  description: string;
  /** Whether this locator is considered low-stability */
  isLowStability: boolean;
}

/**
 * Normalized element with ranked locators.
 */
export interface ElementKnowledge {
  /** Unique identifier for this element */
  elementId: string;
  /** Raw element data */
  raw: RawElement;
  /** Ranked locator candidates (sorted by stability, highest first) */
  locators: LocatorCandidate[];
  /** Timestamp of extraction */
  extractedAt: string;
}

/**
 * Page-level knowledge structure.
 */
export interface PageKnowledge {
  /** Page URL */
  url: string;
  /** Page title */
  title: string;
  /** Timestamp of extraction */
  extractedAt: string;
  /** Elements found on this page */
  elements: ElementKnowledge[];
  /** Navigation step that led to this page */
  sourceStepId?: string;
}

/**
 * Complete knowledge base structure.
 */
export interface KnowledgeBase {
  /** Knowledge base metadata */
  metadata: {
    version: string;
    createdAt: string;
    planName: string;
    planVersion: string;
  };
  /** Pages explored */
  pages: PageKnowledge[];
  /** Exploration run identifier */
  runId: string;
}

/**
 * Result of executing a single step.
 */
export interface StepExecutionResult {
  /** Step that was executed */
  step: ExplorationStep;
  /** Whether execution was successful */
  success: boolean;
  /** Error message if execution failed */
  error?: string;
  /** Final URL after execution */
  finalUrl?: string;
  /** Page title after execution */
  pageTitle?: string;
  /** Timestamp of execution */
  executedAt: string;
  /** Captured evidence */
  evidence?: Evidence;
  /** Execution path used (MCP or crawler) */
  executionPath?: 'mcp' | 'crawler';
  /** MCP error if MCP was attempted and failed */
  mcpError?: string;
}

/**
 * Complete exploration run result.
 */
export interface ExplorationResult {
  /** Run identifier */
  runId: string;
  /** Plan that was executed */
  plan: ExplorationPlan;
  /** Step execution results */
  stepResults: StepExecutionResult[];
  /** Knowledge base generated */
  knowledge: KnowledgeBase;
  /** Overall success status */
  success: boolean;
  /** Errors encountered during exploration */
  errors: string[];
}

/**
 * Configuration for the exploration runner.
 */
export interface RunnerConfig {
  /** Playwright browser type */
  browserType?: 'chromium' | 'firefox' | 'webkit';
  /** Whether to run in headless mode */
  headless?: boolean;
  /** Timeout for page loads (milliseconds) */
  pageLoadTimeout?: number;
  /** Output directory for knowledge base */
  outputDir?: string;
  /** Whether to take screenshots */
  takeScreenshots?: boolean;
  /** Whether MCP execution is enabled */
  mcpEnabled?: boolean;
  /** MCP server configuration */
  mcpConfig?: MCPConfig;
  /** Output directory for evidence capture */
  evidenceOutputDir?: string;
  /** Whether to capture evidence for each step */
  captureEvidence?: boolean;
}

/**
 * Console log entry captured from browser.
 */
export interface ConsoleLogEntry {
  /** Log level (log, error, warn, info, debug) */
  level: 'log' | 'error' | 'warn' | 'info' | 'debug';
  /** Log message */
  text: string;
  /** Timestamp of log */
  timestamp: string;
  /** Source location if available */
  location?: {
    url?: string;
    lineNumber?: number;
    columnNumber?: number;
  };
}

/**
 * Network log entry captured from browser.
 */
export interface NetworkLogEntry {
  /** Request URL */
  url: string;
  /** HTTP method */
  method: string;
  /** Response status code */
  status?: number;
  /** Request timestamp */
  timestamp: string;
  /** Response headers */
  responseHeaders?: Record<string, string>;
  /** Request headers */
  requestHeaders?: Record<string, string>;
}

/**
 * Evidence captured during step execution.
 */
export interface Evidence {
  /** Screenshot as base64 string or file path */
  screenshot?: string;
  /** Page HTML snapshot */
  html?: string;
  /** Accessibility tree JSON */
  accessibilityTree?: any;
  /** Console logs */
  consoleLogs?: ConsoleLogEntry[];
  /** Network logs */
  networkLogs?: NetworkLogEntry[];
  /** Timestamp of capture */
  timestamp: string;
  /** Action that triggered capture */
  action: string;
  /** Whether action was successful */
  success: boolean;
}

/**
 * MCP server configuration.
 */
export interface MCPConfig {
  /** Transport mode: stdio or http */
  transport: 'stdio' | 'http';
  /** HTTP port (required for http transport) */
  httpPort?: number;
  /** HTTP host (default: localhost) */
  httpHost?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Whether to capture evidence automatically */
  enableEvidenceCapture?: boolean;
}

/**
 * Result of MCP action execution.
 */
export interface MCPActionResult {
  /** Whether action succeeded */
  success: boolean;
  /** Action result data */
  data?: any;
  /** Captured evidence */
  evidence?: Evidence;
  /** Error message if failed */
  error?: string;
  /** Execution path used */
  executionPath: 'mcp' | 'crawler';
}

/**
 * Result of crawler action execution.
 */
export interface CrawlerActionResult {
  /** Whether action succeeded */
  success: boolean;
  /** Action result data */
  data?: any;
  /** Captured evidence */
  evidence?: Evidence;
  /** Error message if failed */
  error?: string;
  /** Locator strategy used */
  strategyUsed?: string;
}

/**
 * Execution log entry for auditability.
 */
export interface ExecutionLog {
  /** Step identifier */
  stepId: string;
  /** Action type */
  action: ActionType;
  /** Target selector or description */
  target: string;
  /** Execution path used */
  executionPath: 'mcp' | 'crawler';
  /** Whether execution succeeded */
  success: boolean;
  /** Paths to evidence files */
  evidencePaths: string[];
  /** Timestamp of execution */
  timestamp: string;
  /** Duration in milliseconds */
  duration: number;
  /** Error message if failed */
  error?: string;
  /** MCP error if MCP was attempted */
  mcpError?: string;
}