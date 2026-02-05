/**
 * Core type definitions for the Directed UI Exploration System.
 * 
 * These types enforce strict contracts between modules and ensure
 * deterministic behavior throughout the exploration lifecycle.
 */

/**
 * Supported action types in exploration plans.
 * Includes browser automation, device testing, API automation, and recording.
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
  | 'screenshot'
  | 'drag'
  | 'upload_file'
  | 'press_key'
  | 'go_back'
  | 'go_forward'
  | 'get_visible_text'
  | 'get_visible_html'
  | 'resize'
  | 'save_as_pdf'
  | 'click_and_switch_tab'
  | 'iframe_click'
  | 'iframe_fill'
  | 'expect_response'
  | 'assert_response'
  | 'custom_user_agent'
  | 'console_logs'
  | 'api_get'
  | 'api_post'
  | 'api_put'
  | 'api_patch'
  | 'api_delete'
  | 'start_codegen'
  | 'end_codegen'
  | 'get_codegen'
  | 'clear_codegen'
  | 'evaluate';

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
 * Device preset or manual viewport for resize actions.
 */
export interface ResizeOptions {
  /** Device preset (e.g. 'iPhone 13', 'iPad Pro 11', 'Desktop Chrome') */
  device?: string;
  /** Orientation when using device preset */
  orientation?: 'portrait' | 'landscape';
  /** Viewport width in pixels (manual mode) */
  width?: number;
  /** Viewport height in pixels (manual mode) */
  height?: number;
}

/**
 * Options for API automation (HTTP request).
 */
export interface ApiRequestOptions {
  /** Request URL */
  url: string;
  /** Request body (for POST/PUT/PATCH) */
  value?: string;
  /** Bearer token for Authorization header */
  token?: string;
  /** Additional headers */
  headers?: Record<string, string>;
}

/**
 * Code generation / recording session options.
 */
export interface CodegenSessionOptions {
  /** Directory path where generated tests will be saved (absolute path) */
  outputPath: string;
  /** Prefix for generated test names (default: 'GeneratedTest') */
  testNamePrefix?: string;
  /** Include descriptive comments in generated tests */
  includeComments?: boolean;
}

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
  /** For drag: source selector (target = source, value or extra = target selector). Stored as target=source, value=targetSelector */
  /** For iframe_click/iframe_fill: iframe CSS selector (target = iframe, value or extra = inner selector). Stored as target=iframeSelector, value=selector */
  /** For resize: use resizeOptions */
  resizeOptions?: ResizeOptions;
  /** For API actions: request options */
  apiOptions?: ApiRequestOptions;
  /** For codegen: session options (start_codegen) or sessionId (end_codegen, get_codegen, clear_codegen) */
  codegenOptions?: CodegenSessionOptions;
  /** Session ID for codegen get/end/clear */
  sessionId?: string;
  /** Console log filter: type (all, error, warning, log, info, debug, exception), search, limit, clear */
  consoleLogOptions?: { type?: string; search?: string; limit?: number; clear?: boolean };
  /** For expect_response/assert_response: unique id and optional url/value */
  responseId?: string;
  /** File path for upload_file (absolute path) */
  filePath?: string;
  /** Screenshot/PDF options */
  screenshotOptions?: { name?: string; fullPage?: boolean; selector?: string };
  /** PDF options for save_as_pdf */
  pdfOptions?: { outputPath: string; filename?: string; format?: string; printBackground?: boolean; margin?: { top?: string; right?: string; bottom?: string; left?: string } };
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
  | 'css-fallback'
  | 'getByRole'
  | 'getByLabel'
  | 'getByPlaceholder'
  | 'getByText'
  | 'getByAltText'
  | 'getByTitle';

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
 * API endpoint entry (from recording apiTraffic).
 */
export interface ApiEndpointEntry {
  url: string;
  method: string;
  status?: number;
  source: 'recording' | 'exploration-from-test';
  sourceFlowId?: string;
  timestamp: number;
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
  /** API endpoints / backends (from recording or exploration). */
  apiEndpoints?: ApiEndpointEntry[];
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
  /** Whether Markdown flow execution is enabled */
  enableMarkdownFlows?: boolean;
  /** Markdown flow configuration */
  markdownFlowConfig?: MarkdownFlowConfig;
}

/**
 * Configuration for Markdown flow execution.
 */
export interface MarkdownFlowConfig {
  /** Default timeout per step (milliseconds) */
  stepTimeout?: number;
  /** Retry count per prompt */
  retryCount?: number;
  /** Whether to reuse MCP session across steps */
  reuseSession?: boolean;
  /** Default evidence capture per step */
  captureEvidencePerStep?: boolean;
  /** Logging verbosity */
  verbosity?: 'minimal' | 'normal' | 'verbose';
  /** Default execution preference (MCP vs crawler) */
  defaultExecutionPreference?: 'mcp-prefer' | 'crawler-only' | 'mcp-only';
}

/**
 * Result of executing a prompt from Markdown flow.
 */
export interface MarkdownFlowStepResult {
  /** Line number in Markdown file */
  lineNumber: number;
  /** Original prompt text */
  prompt: string;
  /** Whether step succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Execution path used */
  executionPath?: 'mcp' | 'crawler';
  /** Captured evidence */
  evidence?: Evidence;
  /** Evidence file paths */
  evidencePaths?: string[];
  /** Timestamp of execution */
  executedAt: string;
  /** Duration in milliseconds */
  duration: number;
  /** MCP error if MCP was attempted */
  mcpError?: string;
  /** Parsed action from prompt (if available) */
  parsedAction?: {
    action: ActionType;
    target: string;
    value?: string;
  };
}

/**
 * Result of executing a complete Markdown flow.
 */
export interface MarkdownFlowResult {
  /** Flow file path */
  flowPath: string;
  /** Total steps executed */
  totalSteps: number;
  /** Successful steps */
  successfulSteps: number;
  /** Failed steps */
  failedSteps: number;
  /** Step results */
  stepResults: MarkdownFlowStepResult[];
  /** Overall success status */
  success: boolean;
  /** Errors encountered */
  errors: string[];
  /** Timestamp of flow execution */
  executedAt: string;
  /** Total duration in milliseconds */
  totalDuration: number;
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