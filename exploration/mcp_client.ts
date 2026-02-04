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
  async navigate(url: string, options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' }): Promise<MCPActionResult> {
    if (!this.connected || !this.page || !this.context) {
      return {
        success: false,
        error: 'MCP client not connected or page not set',
        executionPath: 'mcp',
      };
    }

    try {
      const prompt = `Navigate to ${url}${options?.waitUntil ? ` and wait for ${options.waitUntil}` : ''}`;
      const result = await this.callMCP('navigate', { url, options: options || {} });
      
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
  async click(description: string, options?: { timeout?: number }): Promise<MCPActionResult> {
    if (!this.connected || !this.page || !this.context) {
      return {
        success: false,
        error: 'MCP client not connected or page not set',
        executionPath: 'mcp',
      };
    }

    try {
      const result = await this.callMCP('click', { description, options: options || {} });
      
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
  async fill(description: string, value: string): Promise<MCPActionResult> {
    if (!this.connected || !this.page || !this.context) {
      return {
        success: false,
        error: 'MCP client not connected or page not set',
        executionPath: 'mcp',
      };
    }

    try {
      const result = await this.callMCP('fill', { description, value });
      
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
  async hover(description: string): Promise<MCPActionResult> {
    if (!this.connected || !this.page || !this.context) {
      return {
        success: false,
        error: 'MCP client not connected or page not set',
        executionPath: 'mcp',
      };
    }

    try {
      const result = await this.callMCP('hover', { description });
      
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
      const result = await this.callMCP('scroll', { target });
      
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
  async screenshot(path?: string): Promise<MCPActionResult> {
    if (!this.connected || !this.page || !this.context) {
      return {
        success: false,
        error: 'MCP client not connected or page not set',
        executionPath: 'mcp',
      };
    }

    try {
      const result = await this.callMCP('screenshot', { path });
      
      const evidence = this.config?.enableEvidenceCapture
        ? await captureEvidence(this.page, this.context, 'screenshot', true, 'file', path)
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
      const result = await this.callMCP('executeJS', { code });
      
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
