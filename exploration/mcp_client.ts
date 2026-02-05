/**
 * MCP Client
 * 
 * Interface with @executeautomation/playwright-mcp-server for AI-driven browser automation.
 * 
 * Responsibilities:
 * - Interface with MCP server (stdio and HTTP transport)
 * - Session lifecycle management (create, reuse, terminate)
 * - Evidence capture for all actions
 * - Structured response handling
 * - Error handling and timeout management
 */

import { Page, BrowserContext } from 'playwright';
import { MCPConfig, MCPActionResult, Evidence } from './types.js';
import { captureEvidence } from './evidence_capture.js';

/**
 * MCP Client class for interacting with Playwright MCP server.
 */
export class MCPClient {
  private config: MCPConfig | null = null;
  private sessionId: string | null = null;
  private connected: boolean = false;
  private page: Page | null = null;
  private context: BrowserContext | null = null;

  /**
   * Connect to MCP server.
   * 
   * @param transport - Transport mode: 'stdio' or 'http'
   * @param config - MCP configuration
   * @param page - Playwright page instance (optional, can be set later)
   * @param context - Browser context (optional, can be set later)
   */
  async connect(
    transport: 'stdio' | 'http',
    config: MCPConfig,
    page?: Page,
    context?: BrowserContext
  ): Promise<void> {
    this.config = { ...config, transport };
    this.page = page || null;
    this.context = context || null;

    try {
      if (transport === 'stdio') {
        // For stdio mode, we assume the MCP server is already running
        // and we communicate via stdin/stdout
        // In practice, this would use the MCP SDK ClientStdioTransport
        this.connected = true;
        this.sessionId = `session-${Date.now()}`;
      } else if (transport === 'http') {
        // For HTTP mode, connect to the MCP server via HTTP
        const host = config.httpHost || 'localhost';
        const port = config.httpPort || 8931;
        const url = `http://${host}:${port}`;
        
        // Test connection
        const response = await fetch(`${url}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(config.timeout || 5000),
        });

        if (!response.ok) {
          throw new Error(`MCP server health check failed: ${response.statusText}`);
        }

        this.connected = true;
        this.sessionId = `session-${Date.now()}`;
      } else {
        throw new Error(`Unsupported transport mode: ${transport}`);
      }
    } catch (error) {
      this.connected = false;
      throw new Error(
        `Failed to connect to MCP server: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Set Playwright page and context.
   * 
   * @param page - Playwright page instance
   * @param context - Browser context
   */
  setPage(page: Page, context: BrowserContext): void {
    this.page = page;
    this.context = context;
  }

  /**
   * Navigate to URL using MCP.
   * 
   * @param url - URL to navigate to
   * @param options - Navigation options
   * @returns MCP action result
   */
  async navigate(
    url: string,
    options?: {
      waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
      browserType?: 'chromium' | 'firefox' | 'webkit';
      width?: number;
      height?: number;
      timeout?: number;
      headless?: boolean;
    }
  ): Promise<MCPActionResult> {
    if (!this.connected || !this.page || !this.context) {
      return {
        success: false,
        error: 'MCP client not connected or page not set',
        executionPath: 'mcp',
      };
    }

    try {
      const result = await this.callMCP('playwright_navigate', {
        url,
        waitUntil: options?.waitUntil,
        browserType: options?.browserType,
        width: options?.width,
        height: options?.height,
        timeout: options?.timeout,
        headless: options?.headless,
      });
      
      const evidence = this.config?.enableEvidenceCapture
        ? await captureEvidence(this.page, this.context, 'navigate', true)
        : undefined;

      return {
        success: true,
        data: result,
        evidence,
        executionPath: 'mcp',
      };
    } catch (error) {
      const evidence = this.config?.enableEvidenceCapture && this.page && this.context
        ? await captureEvidence(this.page, this.context, 'navigate', false)
        : undefined;

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        evidence,
        executionPath: 'mcp',
      };
    }
  }

  /**
   * Click element using MCP.
   * 
   * @param description - Element description or selector
   * @param options - Click options
   * @returns MCP action result
   */
  async click(selector: string, options?: { timeout?: number }): Promise<MCPActionResult> {
    if (!this.connected || !this.page || !this.context) {
      return {
        success: false,
        error: 'MCP client not connected or page not set',
        executionPath: 'mcp',
      };
    }

    try {
      const result = await this.callMCP('playwright_click', { selector, ...options });
      
      const evidence = this.config?.enableEvidenceCapture
        ? await captureEvidence(this.page, this.context, 'click', true)
        : undefined;

      return {
        success: true,
        data: result,
        evidence,
        executionPath: 'mcp',
      };
    } catch (error) {
      const evidence = this.config?.enableEvidenceCapture && this.page && this.context
        ? await captureEvidence(this.page, this.context, 'click', false)
        : undefined;

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        evidence,
        executionPath: 'mcp',
      };
    }
  }

  /**
   * Fill input field using MCP.
   * 
   * @param description - Element description or selector
   * @param value - Value to fill
   * @returns MCP action result
   */
  async fill(selector: string, value: string): Promise<MCPActionResult> {
    if (!this.connected || !this.page || !this.context) {
      return {
        success: false,
        error: 'MCP client not connected or page not set',
        executionPath: 'mcp',
      };
    }

    try {
      const result = await this.callMCP('playwright_fill', { selector, value });
      
      const evidence = this.config?.enableEvidenceCapture
        ? await captureEvidence(this.page, this.context, 'fill', true)
        : undefined;

      return {
        success: true,
        data: result,
        evidence,
        executionPath: 'mcp',
      };
    } catch (error) {
      const evidence = this.config?.enableEvidenceCapture && this.page && this.context
        ? await captureEvidence(this.page, this.context, 'fill', false)
        : undefined;

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        evidence,
        executionPath: 'mcp',
      };
    }
  }

  /**
   * Hover over element using MCP.
   * 
   * @param description - Element description or selector
   * @returns MCP action result
   */
  async hover(selector: string): Promise<MCPActionResult> {
    if (!this.connected || !this.page || !this.context) {
      return {
        success: false,
        error: 'MCP client not connected or page not set',
        executionPath: 'mcp',
      };
    }

    try {
      const result = await this.callMCP('playwright_hover', { selector });
      
      const evidence = this.config?.enableEvidenceCapture
        ? await captureEvidence(this.page, this.context, 'hover', true)
        : undefined;

      return {
        success: true,
        data: result,
        evidence,
        executionPath: 'mcp',
      };
    } catch (error) {
      const evidence = this.config?.enableEvidenceCapture && this.page && this.context
        ? await captureEvidence(this.page, this.context, 'hover', false)
        : undefined;

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        evidence,
        executionPath: 'mcp',
      };
    }
  }

  /**
   * Scroll using MCP.
   * 
   * @param target - Scroll target (description, selector, or coordinates)
   * @returns MCP action result
   */
  async scroll(target: string | { x: number; y: number }): Promise<MCPActionResult> {
    if (!this.connected || !this.page || !this.context) {
      return {
        success: false,
        error: 'MCP client not connected or page not set',
        executionPath: 'mcp',
      };
    }

    try {
      const result = await this.callMCP('playwright_scroll', { target });
      
      const evidence = this.config?.enableEvidenceCapture
        ? await captureEvidence(this.page, this.context, 'scroll', true)
        : undefined;

      return {
        success: true,
        data: result,
        evidence,
        executionPath: 'mcp',
      };
    } catch (error) {
      const evidence = this.config?.enableEvidenceCapture && this.page && this.context
        ? await captureEvidence(this.page, this.context, 'scroll', false)
        : undefined;

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        evidence,
        executionPath: 'mcp',
      };
    }
  }

  /**
   * Take screenshot using MCP.
   * 
   * @param path - Optional screenshot file path
   * @returns MCP action result
   */
  async screenshot(options?: {
    name?: string;
    path?: string;
    selector?: string;
    width?: number;
    height?: number;
    fullPage?: boolean;
    storeBase64?: boolean;
    savePng?: boolean;
    downloadsDir?: string;
  }): Promise<MCPActionResult> {
    if (!this.connected || !this.page || !this.context) {
      return {
        success: false,
        error: 'MCP client not connected or page not set',
        executionPath: 'mcp',
      };
    }

    try {
      const name = options?.name ?? options?.path ?? `screenshot-${Date.now()}`;
      const result = await this.callMCP('playwright_screenshot', {
        name,
        selector: options?.selector,
        width: options?.width,
        height: options?.height,
        fullPage: options?.fullPage,
        storeBase64: options?.storeBase64,
        savePng: options?.savePng,
        downloadsDir: options?.downloadsDir,
      });
      
      const evidence = this.config?.enableEvidenceCapture
        ? await captureEvidence(this.page, this.context, 'screenshot', true, 'file', options?.path ?? options?.name)
        : undefined;

      return {
        success: true,
        data: result,
        evidence,
        executionPath: 'mcp',
      };
    } catch (error) {
      const evidence = this.config?.enableEvidenceCapture && this.page && this.context
        ? await captureEvidence(this.page, this.context, 'screenshot', false)
        : undefined;

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        evidence,
        executionPath: 'mcp',
      };
    }
  }

  /**
   * Execute JavaScript using MCP.
   * 
   * @param code - JavaScript code to execute
   * @returns MCP action result
   */
  async executeJS(code: string): Promise<MCPActionResult> {
    if (!this.connected || !this.page || !this.context) {
      return {
        success: false,
        error: 'MCP client not connected or page not set',
        executionPath: 'mcp',
      };
    }

    try {
      const result = await this.callMCP('playwright_evaluate', { script: code });
      
      const evidence = this.config?.enableEvidenceCapture
        ? await captureEvidence(this.page, this.context, 'executeJS', true)
        : undefined;

      return {
        success: true,
        data: result,
        evidence,
        executionPath: 'mcp',
      };
    } catch (error) {
      const evidence = this.config?.enableEvidenceCapture && this.page && this.context
        ? await captureEvidence(this.page, this.context, 'executeJS', false)
        : undefined;

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        evidence,
        executionPath: 'mcp',
      };
    }
  }

  /**
   * Select option in a SELECT element using MCP.
   */
  async select(selector: string, value: string): Promise<MCPActionResult> {
    if (!this.connected || !this.page || !this.context) {
      return { success: false, error: 'MCP client not connected or page not set', executionPath: 'mcp' };
    }
    try {
      const result = await this.callMCP('playwright_select', { selector, value });
      const evidence = this.config?.enableEvidenceCapture ? await captureEvidence(this.page, this.context, 'select', true) : undefined;
      return { success: true, data: result, evidence, executionPath: 'mcp' };
    } catch (error) {
      const evidence = this.config?.enableEvidenceCapture && this.page && this.context ? await captureEvidence(this.page, this.context, 'select', false) : undefined;
      return { success: false, error: error instanceof Error ? error.message : String(error), evidence, executionPath: 'mcp' };
    }
  }

  /**
   * Press a keyboard key using MCP.
   */
  async pressKey(key: string, selector?: string): Promise<MCPActionResult> {
    if (!this.connected || !this.page || !this.context) {
      return { success: false, error: 'MCP client not connected or page not set', executionPath: 'mcp' };
    }
    try {
      const result = await this.callMCP('playwright_press_key', { key, selector });
      const evidence = this.config?.enableEvidenceCapture ? await captureEvidence(this.page, this.context, 'press_key', true) : undefined;
      return { success: true, data: result, evidence, executionPath: 'mcp' };
    } catch (error) {
      const evidence = this.config?.enableEvidenceCapture && this.page && this.context ? await captureEvidence(this.page, this.context, 'press_key', false) : undefined;
      return { success: false, error: error instanceof Error ? error.message : String(error), evidence, executionPath: 'mcp' };
    }
  }

  /**
   * Drag element to target using MCP.
   */
  async drag(sourceSelector: string, targetSelector: string): Promise<MCPActionResult> {
    if (!this.connected || !this.page || !this.context) {
      return { success: false, error: 'MCP client not connected or page not set', executionPath: 'mcp' };
    }
    try {
      const result = await this.callMCP('playwright_drag', { sourceSelector, targetSelector });
      const evidence = this.config?.enableEvidenceCapture ? await captureEvidence(this.page, this.context, 'drag', true) : undefined;
      return { success: true, data: result, evidence, executionPath: 'mcp' };
    } catch (error) {
      const evidence = this.config?.enableEvidenceCapture && this.page && this.context ? await captureEvidence(this.page, this.context, 'drag', false) : undefined;
      return { success: false, error: error instanceof Error ? error.message : String(error), evidence, executionPath: 'mcp' };
    }
  }

  /**
   * Upload file to input[type="file"] using MCP.
   */
  async uploadFile(selector: string, filePath: string): Promise<MCPActionResult> {
    if (!this.connected || !this.page || !this.context) {
      return { success: false, error: 'MCP client not connected or page not set', executionPath: 'mcp' };
    }
    try {
      const result = await this.callMCP('playwright_upload_file', { selector, filePath });
      const evidence = this.config?.enableEvidenceCapture ? await captureEvidence(this.page, this.context, 'upload_file', true) : undefined;
      return { success: true, data: result, evidence, executionPath: 'mcp' };
    } catch (error) {
      const evidence = this.config?.enableEvidenceCapture && this.page && this.context ? await captureEvidence(this.page, this.context, 'upload_file', false) : undefined;
      return { success: false, error: error instanceof Error ? error.message : String(error), evidence, executionPath: 'mcp' };
    }
  }

  /**
   * Get visible text of the current page using MCP.
   */
  async getVisibleText(): Promise<MCPActionResult> {
    if (!this.connected || !this.page || !this.context) {
      return { success: false, error: 'MCP client not connected or page not set', executionPath: 'mcp' };
    }
    try {
      const result = await this.callMCP('playwright_get_visible_text', {});
      const evidence = this.config?.enableEvidenceCapture ? await captureEvidence(this.page, this.context, 'get_visible_text', true) : undefined;
      return { success: true, data: result, evidence, executionPath: 'mcp' };
    } catch (error) {
      const evidence = this.config?.enableEvidenceCapture && this.page && this.context ? await captureEvidence(this.page, this.context, 'get_visible_text', false) : undefined;
      return { success: false, error: error instanceof Error ? error.message : String(error), evidence, executionPath: 'mcp' };
    }
  }

  /**
   * Get visible HTML of the current page using MCP.
   */
  async getVisibleHtml(options?: {
    selector?: string;
    removeScripts?: boolean;
    removeComments?: boolean;
    removeStyles?: boolean;
    removeMeta?: boolean;
    minify?: boolean;
    cleanHtml?: boolean;
    maxLength?: number;
  }): Promise<MCPActionResult> {
    if (!this.connected || !this.page || !this.context) {
      return { success: false, error: 'MCP client not connected or page not set', executionPath: 'mcp' };
    }
    try {
      const result = await this.callMCP('playwright_get_visible_html', options ?? {});
      const evidence = this.config?.enableEvidenceCapture ? await captureEvidence(this.page, this.context, 'get_visible_html', true) : undefined;
      return { success: true, data: result, evidence, executionPath: 'mcp' };
    } catch (error) {
      const evidence = this.config?.enableEvidenceCapture && this.page && this.context ? await captureEvidence(this.page, this.context, 'get_visible_html', false) : undefined;
      return { success: false, error: error instanceof Error ? error.message : String(error), evidence, executionPath: 'mcp' };
    }
  }

  /**
   * Navigate back in browser history using MCP.
   */
  async goBack(): Promise<MCPActionResult> {
    if (!this.connected || !this.page || !this.context) {
      return { success: false, error: 'MCP client not connected or page not set', executionPath: 'mcp' };
    }
    try {
      const result = await this.callMCP('playwright_go_back', {});
      const evidence = this.config?.enableEvidenceCapture ? await captureEvidence(this.page, this.context, 'go_back', true) : undefined;
      return { success: true, data: result, evidence, executionPath: 'mcp' };
    } catch (error) {
      const evidence = this.config?.enableEvidenceCapture && this.page && this.context ? await captureEvidence(this.page, this.context, 'go_back', false) : undefined;
      return { success: false, error: error instanceof Error ? error.message : String(error), evidence, executionPath: 'mcp' };
    }
  }

  /**
   * Navigate forward in browser history using MCP.
   */
  async goForward(): Promise<MCPActionResult> {
    if (!this.connected || !this.page || !this.context) {
      return { success: false, error: 'MCP client not connected or page not set', executionPath: 'mcp' };
    }
    try {
      const result = await this.callMCP('playwright_go_forward', {});
      const evidence = this.config?.enableEvidenceCapture ? await captureEvidence(this.page, this.context, 'go_forward', true) : undefined;
      return { success: true, data: result, evidence, executionPath: 'mcp' };
    } catch (error) {
      const evidence = this.config?.enableEvidenceCapture && this.page && this.context ? await captureEvidence(this.page, this.context, 'go_forward', false) : undefined;
      return { success: false, error: error instanceof Error ? error.message : String(error), evidence, executionPath: 'mcp' };
    }
  }

  /**
   * Resize viewport or set device preset using MCP.
   */
  async resize(options: {
    device?: string;
    orientation?: 'portrait' | 'landscape';
    width?: number;
    height?: number;
  }): Promise<MCPActionResult> {
    if (!this.connected || !this.page || !this.context) {
      return { success: false, error: 'MCP client not connected or page not set', executionPath: 'mcp' };
    }
    try {
      const result = await this.callMCP('playwright_resize', options);
      const evidence = this.config?.enableEvidenceCapture ? await captureEvidence(this.page, this.context, 'resize', true) : undefined;
      return { success: true, data: result, evidence, executionPath: 'mcp' };
    } catch (error) {
      const evidence = this.config?.enableEvidenceCapture && this.page && this.context ? await captureEvidence(this.page, this.context, 'resize', false) : undefined;
      return { success: false, error: error instanceof Error ? error.message : String(error), evidence, executionPath: 'mcp' };
    }
  }

  /**
   * Save current page as PDF using MCP.
   */
  async saveAsPdf(options: {
    outputPath: string;
    filename?: string;
    format?: string;
    printBackground?: boolean;
    margin?: { top?: string; right?: string; bottom?: string; left?: string };
  }): Promise<MCPActionResult> {
    if (!this.connected || !this.page || !this.context) {
      return { success: false, error: 'MCP client not connected or page not set', executionPath: 'mcp' };
    }
    try {
      const result = await this.callMCP('playwright_save_as_pdf', options);
      const evidence = this.config?.enableEvidenceCapture ? await captureEvidence(this.page, this.context, 'save_as_pdf', true) : undefined;
      return { success: true, data: result, evidence, executionPath: 'mcp' };
    } catch (error) {
      const evidence = this.config?.enableEvidenceCapture && this.page && this.context ? await captureEvidence(this.page, this.context, 'save_as_pdf', false) : undefined;
      return { success: false, error: error instanceof Error ? error.message : String(error), evidence, executionPath: 'mcp' };
    }
  }

  /**
   * Click a link and switch to the newly opened tab using MCP.
   */
  async clickAndSwitchTab(selector: string): Promise<MCPActionResult> {
    if (!this.connected || !this.page || !this.context) {
      return { success: false, error: 'MCP client not connected or page not set', executionPath: 'mcp' };
    }
    try {
      const result = await this.callMCP('playwright_click_and_switch_tab', { selector });
      const evidence = this.config?.enableEvidenceCapture ? await captureEvidence(this.page, this.context, 'click_and_switch_tab', true) : undefined;
      return { success: true, data: result, evidence, executionPath: 'mcp' };
    } catch (error) {
      const evidence = this.config?.enableEvidenceCapture && this.page && this.context ? await captureEvidence(this.page, this.context, 'click_and_switch_tab', false) : undefined;
      return { success: false, error: error instanceof Error ? error.message : String(error), evidence, executionPath: 'mcp' };
    }
  }

  /**
   * Click element inside an iframe using MCP.
   */
  async iframeClick(iframeSelector: string, selector: string): Promise<MCPActionResult> {
    if (!this.connected || !this.page || !this.context) {
      return { success: false, error: 'MCP client not connected or page not set', executionPath: 'mcp' };
    }
    try {
      const result = await this.callMCP('playwright_iframe_click', { iframeSelector, selector });
      const evidence = this.config?.enableEvidenceCapture ? await captureEvidence(this.page, this.context, 'iframe_click', true) : undefined;
      return { success: true, data: result, evidence, executionPath: 'mcp' };
    } catch (error) {
      const evidence = this.config?.enableEvidenceCapture && this.page && this.context ? await captureEvidence(this.page, this.context, 'iframe_click', false) : undefined;
      return { success: false, error: error instanceof Error ? error.message : String(error), evidence, executionPath: 'mcp' };
    }
  }

  /**
   * Fill element inside an iframe using MCP.
   */
  async iframeFill(iframeSelector: string, selector: string, value: string): Promise<MCPActionResult> {
    if (!this.connected || !this.page || !this.context) {
      return { success: false, error: 'MCP client not connected or page not set', executionPath: 'mcp' };
    }
    try {
      const result = await this.callMCP('playwright_iframe_fill', { iframeSelector, selector, value });
      const evidence = this.config?.enableEvidenceCapture ? await captureEvidence(this.page, this.context, 'iframe_fill', true) : undefined;
      return { success: true, data: result, evidence, executionPath: 'mcp' };
    } catch (error) {
      const evidence = this.config?.enableEvidenceCapture && this.page && this.context ? await captureEvidence(this.page, this.context, 'iframe_fill', false) : undefined;
      return { success: false, error: error instanceof Error ? error.message : String(error), evidence, executionPath: 'mcp' };
    }
  }

  /**
   * Get console logs from the browser using MCP.
   */
  async getConsoleLogs(options?: {
    type?: 'all' | 'error' | 'warning' | 'log' | 'info' | 'debug' | 'exception';
    search?: string;
    limit?: number;
    clear?: boolean;
  }): Promise<MCPActionResult> {
    if (!this.connected || !this.page || !this.context) {
      return { success: false, error: 'MCP client not connected or page not set', executionPath: 'mcp' };
    }
    try {
      const result = await this.callMCP('playwright_console_logs', options ?? {});
      const evidence = this.config?.enableEvidenceCapture ? await captureEvidence(this.page, this.context, 'console_logs', true) : undefined;
      return { success: true, data: result, evidence, executionPath: 'mcp' };
    } catch (error) {
      const evidence = this.config?.enableEvidenceCapture && this.page && this.context ? await captureEvidence(this.page, this.context, 'console_logs', false) : undefined;
      return { success: false, error: error instanceof Error ? error.message : String(error), evidence, executionPath: 'mcp' };
    }
  }

  /**
   * Set custom user agent using MCP.
   */
  async setCustomUserAgent(userAgent: string): Promise<MCPActionResult> {
    if (!this.connected || !this.page || !this.context) {
      return { success: false, error: 'MCP client not connected or page not set', executionPath: 'mcp' };
    }
    try {
      const result = await this.callMCP('playwright_custom_user_agent', { userAgent });
      const evidence = this.config?.enableEvidenceCapture ? await captureEvidence(this.page, this.context, 'custom_user_agent', true) : undefined;
      return { success: true, data: result, evidence, executionPath: 'mcp' };
    } catch (error) {
      const evidence = this.config?.enableEvidenceCapture && this.page && this.context ? await captureEvidence(this.page, this.context, 'custom_user_agent', false) : undefined;
      return { success: false, error: error instanceof Error ? error.message : String(error), evidence, executionPath: 'mcp' };
    }
  }

  /**
   * Start waiting for an HTTP response (use with assertResponse later).
   */
  async expectResponse(id: string, url: string): Promise<MCPActionResult> {
    if (!this.connected || !this.page || !this.context) {
      return { success: false, error: 'MCP client not connected or page not set', executionPath: 'mcp' };
    }
    try {
      const result = await this.callMCP('playwright_expect_response', { id, url });
      return { success: true, data: result, executionPath: 'mcp' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error), executionPath: 'mcp' };
    }
  }

  /**
   * Wait for and validate a previously expected HTTP response.
   */
  async assertResponse(id: string, value?: string): Promise<MCPActionResult> {
    if (!this.connected || !this.page || !this.context) {
      return { success: false, error: 'MCP client not connected or page not set', executionPath: 'mcp' };
    }
    try {
      const result = await this.callMCP('playwright_assert_response', { id, value });
      const evidence = this.config?.enableEvidenceCapture ? await captureEvidence(this.page, this.context, 'assert_response', true) : undefined;
      return { success: true, data: result, evidence, executionPath: 'mcp' };
    } catch (error) {
      const evidence = this.config?.enableEvidenceCapture && this.page && this.context ? await captureEvidence(this.page, this.context, 'assert_response', false) : undefined;
      return { success: false, error: error instanceof Error ? error.message : String(error), evidence, executionPath: 'mcp' };
    }
  }

  /**
   * Perform HTTP GET using MCP API tools.
   */
  async apiGet(url: string, options?: { token?: string; headers?: Record<string, string> }): Promise<MCPActionResult> {
    if (!this.connected) {
      return { success: false, error: 'MCP client not connected', executionPath: 'mcp' };
    }
    try {
      const result = await this.callMCP('playwright_get', { url, token: options?.token, headers: options?.headers });
      return { success: true, data: result, executionPath: 'mcp' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error), executionPath: 'mcp' };
    }
  }

  /**
   * Perform HTTP POST using MCP API tools.
   */
  async apiPost(url: string, value: string, options?: { token?: string; headers?: Record<string, string> }): Promise<MCPActionResult> {
    if (!this.connected) {
      return { success: false, error: 'MCP client not connected', executionPath: 'mcp' };
    }
    try {
      const result = await this.callMCP('playwright_post', { url, value, token: options?.token, headers: options?.headers });
      return { success: true, data: result, executionPath: 'mcp' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error), executionPath: 'mcp' };
    }
  }

  /**
   * Perform HTTP PUT using MCP API tools.
   */
  async apiPut(url: string, value: string, options?: { token?: string; headers?: Record<string, string> }): Promise<MCPActionResult> {
    if (!this.connected) {
      return { success: false, error: 'MCP client not connected', executionPath: 'mcp' };
    }
    try {
      const result = await this.callMCP('playwright_put', { url, value, token: options?.token, headers: options?.headers });
      return { success: true, data: result, executionPath: 'mcp' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error), executionPath: 'mcp' };
    }
  }

  /**
   * Perform HTTP PATCH using MCP API tools.
   */
  async apiPatch(url: string, value: string, options?: { token?: string; headers?: Record<string, string> }): Promise<MCPActionResult> {
    if (!this.connected) {
      return { success: false, error: 'MCP client not connected', executionPath: 'mcp' };
    }
    try {
      const result = await this.callMCP('playwright_patch', { url, value, token: options?.token, headers: options?.headers });
      return { success: true, data: result, executionPath: 'mcp' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error), executionPath: 'mcp' };
    }
  }

  /**
   * Perform HTTP DELETE using MCP API tools.
   */
  async apiDelete(url: string, options?: { token?: string; headers?: Record<string, string> }): Promise<MCPActionResult> {
    if (!this.connected) {
      return { success: false, error: 'MCP client not connected', executionPath: 'mcp' };
    }
    try {
      const result = await this.callMCP('playwright_delete', { url, token: options?.token, headers: options?.headers });
      return { success: true, data: result, executionPath: 'mcp' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error), executionPath: 'mcp' };
    }
  }

  /**
   * Start a code generation (recording) session.
   */
  async startCodegenSession(options: { outputPath: string; testNamePrefix?: string; includeComments?: boolean }): Promise<MCPActionResult> {
    if (!this.connected) {
      return { success: false, error: 'MCP client not connected', executionPath: 'mcp' };
    }
    try {
      const result = await this.callMCP('start_codegen_session', options);
      return { success: true, data: result, executionPath: 'mcp' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error), executionPath: 'mcp' };
    }
  }

  /**
   * End code generation session and generate test file.
   */
  async endCodegenSession(sessionId: string): Promise<MCPActionResult> {
    if (!this.connected) {
      return { success: false, error: 'MCP client not connected', executionPath: 'mcp' };
    }
    try {
      const result = await this.callMCP('end_codegen_session', { sessionId });
      return { success: true, data: result, executionPath: 'mcp' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error), executionPath: 'mcp' };
    }
  }

  /**
   * Get code generation session info.
   */
  async getCodegenSession(sessionId: string): Promise<MCPActionResult> {
    if (!this.connected) {
      return { success: false, error: 'MCP client not connected', executionPath: 'mcp' };
    }
    try {
      const result = await this.callMCP('get_codegen_session', { sessionId });
      return { success: true, data: result, executionPath: 'mcp' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error), executionPath: 'mcp' };
    }
  }

  /**
   * Clear code generation session without generating test.
   */
  async clearCodegenSession(sessionId: string): Promise<MCPActionResult> {
    if (!this.connected) {
      return { success: false, error: 'MCP client not connected', executionPath: 'mcp' };
    }
    try {
      const result = await this.callMCP('clear_codegen_session', { sessionId });
      return { success: true, data: result, executionPath: 'mcp' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error), executionPath: 'mcp' };
    }
  }

  /**
   * Close browser and release resources (playwright_close).
   */
  async closeBrowser(): Promise<MCPActionResult> {
    if (!this.connected) {
      return { success: false, error: 'MCP client not connected', executionPath: 'mcp' };
    }
    try {
      const result = await this.callMCP('playwright_close', {});
      this.connected = false;
      this.sessionId = null;
      return { success: true, data: result, executionPath: 'mcp' };
    } catch (error) {
      this.connected = false;
      this.sessionId = null;
      return { success: false, error: error instanceof Error ? error.message : String(error), executionPath: 'mcp' };
    }
  }

  /**
   * Capture evidence for current page state.
   * 
   * @returns Evidence object
   */
  async captureEvidence(): Promise<Evidence> {
    if (!this.page || !this.context) {
      throw new Error('Page and context must be set to capture evidence');
    }

    return await captureEvidence(this.page, this.context, 'evidence', true);
  }

  /**
   * Execute a natural language prompt and return structured action.
   * 
   * @param prompt - Natural language prompt describing the action
   * @param options - Execution options
   * @returns MCP action result with parsed action
   */
  async executePrompt(
    prompt: string,
    options?: {
      timeout?: number;
      retryCount?: number;
    }
  ): Promise<MCPActionResult & { parsedAction?: { action: string; target: string; value?: string } }> {
    if (!this.connected || !this.page || !this.context) {
      return {
        success: false,
        error: 'MCP client not connected or page not set',
        executionPath: 'mcp',
      };
    }

    const retryCount = options?.retryCount || 1;

    let lastError: string | undefined;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        // Call MCP server with prompt
        const result = await this.callMCP('executePrompt', {
          prompt,
          sessionId: this.sessionId,
        });

        // Parse result into structured action
        const parsedAction = result.action
          ? {
              action: result.action,
              target: result.target || '',
              value: result.value,
            }
          : undefined;

        const evidence = this.config?.enableEvidenceCapture
          ? await captureEvidence(this.page, this.context, 'prompt', true)
          : undefined;

        return {
          success: true,
          data: result,
          evidence,
          executionPath: 'mcp',
          parsedAction,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        
        if (attempt < retryCount) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
      }
    }

    const evidence = this.config?.enableEvidenceCapture && this.page && this.context
      ? await captureEvidence(this.page, this.context, 'prompt', false)
      : undefined;

    return {
      success: false,
      error: lastError || 'Failed to execute prompt',
      evidence,
      executionPath: 'mcp',
    };
  }

  /**
   * Get current session ID.
   * 
   * @returns Session ID or null if not connected
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Check if client is connected.
   * 
   * @returns True if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Close MCP session.
   */
  async closeSession(): Promise<void> {
    if (this.connected && this.config) {
      try {
        if (this.config.transport === 'http') {
          const host = this.config.httpHost || 'localhost';
          const port = this.config.httpPort || 8931;
          await fetch(`http://${host}:${port}/session/${this.sessionId}`, {
            method: 'DELETE',
            signal: AbortSignal.timeout(this.config.timeout || 5000),
          });
        }
      } catch (error) {
        // Log but don't throw - session cleanup is best effort
        console.warn(`Failed to close MCP session: ${error}`);
      }
    }

    this.connected = false;
    this.sessionId = null;
  }

  /**
   * Call MCP server with action and parameters.
   * 
   * @param action - Action name
   * @param params - Action parameters
   * @returns Action result
   */
  private async callMCP(action: string, params: any): Promise<any> {
    if (!this.config) {
      throw new Error('MCP client not configured');
    }

    const timeout = this.config.timeout || 30000;

    if (this.config.transport === 'stdio') {
      // For stdio mode, this would use MCP SDK ClientStdioTransport
      // For now, we'll simulate the call structure
      // In production, this would be:
      // const client = new Client({ transport: new ClientStdioTransport(...) });
      // return await client.callTool({ name: action, arguments: params });
      
      throw new Error('stdio transport not fully implemented - use HTTP mode');
    } else if (this.config.transport === 'http') {
      const host = this.config.httpHost || 'localhost';
      const port = this.config.httpPort || 8931;
      const url = `http://${host}:${port}/tools/${action}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: this.sessionId,
            ...params,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`MCP action failed: ${response.status} ${errorText}`);
        }

        return await response.json();
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`MCP action timed out after ${timeout}ms`);
        }
        throw error;
      }
    } else {
      throw new Error(`Unsupported transport: ${this.config.transport}`);
    }
  }
}
