/**
 * Exploration Runner
 * 
 * Main orchestrator for the Directed UI Exploration System.
 * 
 * Responsibilities:
 * - Orchestrate the entire exploration lifecycle
 * - Ensure isolation between exploration steps
 * - Coordinate all modules
 * - Provide clear logging and error handling
 * - Generate complete exploration results
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { readFile } from 'fs/promises';
import { ExplorationPlan, ExplorationResult, RunnerConfig } from './types.js';
import { parseExplorationPlan } from './plan_parser.js';
import { executeStep } from './step_executor.js';
import { extractPageSnapshot } from './snapshot_extractor.js';
import { rankLocators } from './locator_ranker.js';
import { MCPClient } from './mcp_client.js';
import { saveEvidence } from './evidence_capture.js';
import {
  createKnowledgeBase,
  createPageKnowledge,
  createElementKnowledge,
  addPageToKnowledge,
  addElementToPage,
  writeKnowledgeBase,
  writeKnowledgeBaseMarkdown,
} from './knowledge_writer.js';

/**
 * Default runner configuration.
 */
const DEFAULT_CONFIG: Required<Omit<RunnerConfig, 'mcpConfig' | 'evidenceOutputDir'>> & {
  mcpEnabled: boolean;
  mcpConfig?: RunnerConfig['mcpConfig'];
  evidenceOutputDir: string;
  captureEvidence: boolean;
} = {
  browserType: 'chromium',
  headless: true,
  pageLoadTimeout: 30000,
  outputDir: './knowledge',
  takeScreenshots: false,
  mcpEnabled: false,
  evidenceOutputDir: './knowledge/evidence',
  captureEvidence: true,
};

/**
 * Run a complete exploration based on a Markdown plan.
 * 
 * @param planPath - Path to Markdown exploration plan file
 * @param config - Optional runner configuration
 * @returns Complete exploration result
 */
export async function runExploration(
  planPath: string,
  config: RunnerConfig = {}
): Promise<ExplorationResult> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const errors: string[] = [];
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    // Load and parse plan
    console.log(`[Runner] Loading exploration plan from: ${planPath}`);
    const planContent = await readFile(planPath, 'utf-8');
    const plan = parseExplorationPlan(planContent);
    console.log(`[Runner] Plan parsed: ${plan.metadata.name} v${plan.metadata.version}`);

    // Create knowledge base
    const knowledge = createKnowledgeBase(
      plan.metadata.name,
      plan.metadata.version
    );
    console.log(`[Runner] Created knowledge base: ${knowledge.runId}`);

    // Launch browser
    console.log(`[Runner] Launching ${finalConfig.browserType} browser...`);
    browser = await chromium.launch({
      headless: finalConfig.headless,
    });

    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });

    page = await context.newPage();
    page.setDefaultTimeout(finalConfig.pageLoadTimeout);

    // Initialize MCP client if enabled
    let mcpClient: MCPClient | undefined;
    if (finalConfig.mcpEnabled && finalConfig.mcpConfig) {
      console.log(`[Runner] Initializing MCP client (${finalConfig.mcpConfig.transport} mode)...`);
      try {
        mcpClient = new MCPClient();
        await mcpClient.connect(
          finalConfig.mcpConfig.transport,
          finalConfig.mcpConfig,
          page,
          context
        );
        console.log(`[Runner] MCP client connected (session: ${mcpClient.getSessionId()})`);
      } catch (error) {
        console.warn(`[Runner] MCP client initialization failed: ${error}. Continuing with crawler-only mode.`);
        mcpClient = undefined;
      }
    }

    // Execute exploration steps
    const stepResults = [];
    let currentPageKnowledge: ReturnType<typeof createPageKnowledge> | null = null;

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      console.log(`[Runner] Executing step ${i + 1}/${plan.steps.length}: ${step.action} ${step.target}`);

      // Execute step with hybrid MCP + crawler approach
      const stepResult = await executeStep(page, context, step, plan.safety, mcpClient);
      stepResults.push(stepResult);

      // Log execution path
      if (stepResult.executionPath) {
        console.log(`[Runner] Step executed via ${stepResult.executionPath}${stepResult.mcpError ? ` (MCP error: ${stepResult.mcpError})` : ''}`);
      }

      // Save evidence if captured
      if (finalConfig.captureEvidence && stepResult.evidence) {
        const evidenceDir = finalConfig.evidenceOutputDir || `${finalConfig.outputDir}/evidence`;
        try {
          const evidencePaths = await saveEvidence(
            stepResult.evidence,
            evidenceDir,
            step.id
          );
          console.log(`[Runner] Evidence saved: ${evidencePaths.length} files`);
        } catch (error) {
          console.warn(`[Runner] Failed to save evidence for step ${step.id}: ${error}`);
        }
      }

      if (!stepResult.success) {
        const errorMsg = `Step ${step.id} failed: ${stepResult.error}`;
        console.error(`[Runner] ${errorMsg}`);
        errors.push(errorMsg);
        
        // Continue with next step (non-blocking)
        continue;
      }

      // Extract page snapshot after navigation steps or after any step that might change the page
      if (step.action === 'goto' || stepResult.finalUrl) {
        const url = stepResult.finalUrl || page.url();
        const title = stepResult.pageTitle || await page.title();

        console.log(`[Runner] Extracting snapshot from: ${title} (${url})`);

        // Create page knowledge
        currentPageKnowledge = createPageKnowledge(url, title, step.id);

        // Extract elements
        const rawElements = await extractPageSnapshot(page);

        console.log(`[Runner] Found ${rawElements.length} interactive elements`);

        // Process each element
        for (let j = 0; j < rawElements.length; j++) {
          const rawElement = rawElements[j];
          const elementId = `element-${i}-${j}`;

          // Rank locators
          const locators = rankLocators(rawElement);

          // Create element knowledge
          const elementKnowledge = createElementKnowledge(
            elementId,
            rawElement,
            locators
          );

          // Add to page
          addElementToPage(currentPageKnowledge, elementKnowledge);
        }

        // Add page to knowledge base
        addPageToKnowledge(knowledge, currentPageKnowledge);
      }
    }

    // Write knowledge base
    console.log(`[Runner] Writing knowledge base to: ${finalConfig.outputDir}`);
    const jsonPath = await writeKnowledgeBase(knowledge, finalConfig.outputDir);
    const mdPath = await writeKnowledgeBaseMarkdown(knowledge, finalConfig.outputDir);
    console.log(`[Runner] Knowledge base written:`);
    console.log(`  - JSON: ${jsonPath}`);
    console.log(`  - Markdown: ${mdPath}`);

    // Build result
    const result: ExplorationResult = {
      runId: knowledge.runId,
      plan,
      stepResults,
      knowledge,
      success: errors.length === 0,
      errors,
    };

    console.log(`[Runner] Exploration completed: ${result.success ? 'SUCCESS' : 'WITH ERRORS'}`);
    if (errors.length > 0) {
      console.log(`[Runner] Errors encountered: ${errors.length}`);
    }

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Runner] Fatal error: ${errorMsg}`);
    errors.push(errorMsg);

    // Return partial result if possible
    throw error;
  } finally {
    // Cleanup
    if (mcpClient) {
      try {
        await mcpClient.closeSession();
        console.log(`[Runner] MCP session closed`);
      } catch (error) {
        console.warn(`[Runner] Failed to close MCP session: ${error}`);
      }
    }
    if (page) {
      await page.close().catch(() => {});
    }
    if (context) {
      await context.close().catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
    }
    console.log(`[Runner] Browser closed`);
  }
}

/**
 * Main entry point for CLI usage.
 */
export async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: node runner.js <plan-path> [--headless=false] [--output-dir=./knowledge]');
    process.exit(1);
  }

  const planPath = args[0];
  const config: RunnerConfig = {};

  // Parse CLI arguments
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--headless=')) {
      config.headless = arg.split('=')[1] !== 'false';
    } else if (arg.startsWith('--output-dir=')) {
      config.outputDir = arg.split('=')[1];
    } else if (arg.startsWith('--browser=')) {
      const browserType = arg.split('=')[1];
      if (['chromium', 'firefox', 'webkit'].includes(browserType)) {
        config.browserType = browserType as 'chromium' | 'firefox' | 'webkit';
      }
    }
  }

  try {
    const result = await runExploration(planPath, config);
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run if executed directly (Node.js ES modules)
// Check if this module is being run as the main entry point
const isMainModule = process.argv[1] && 
  (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/')) ||
   import.meta.url.includes(process.argv[1].replace(/\\/g, '/')));

if (isMainModule) {
  main().catch(console.error);
}