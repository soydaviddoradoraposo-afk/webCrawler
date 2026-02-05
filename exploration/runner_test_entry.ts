/**
 * Explore-from-test runner: parse a Playwright test file, execute steps, extract snapshots and locators, merge into canonical model.
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { ExplorationPlan, ExplorationResult, RunnerConfig, SafetyConstraints, ExplorationStep } from './types.js';
import { parsePlaywrightTestFile, parsedStepsToExplorationSteps } from './test_parser.js';
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

const DEFAULT_SAFETY: SafetyConstraints = {
  forbiddenActions: [],
  forbiddenSelectors: [],
  allowDestructiveForms: false,
  allowDeleteButtons: false,
};

const DEFAULT_CONFIG: RunnerConfig & {
  browserType: 'chromium' | 'firefox' | 'webkit';
  headless: boolean;
  pageLoadTimeout: number;
  outputDir: string;
  takeScreenshots: boolean;
  mcpEnabled: boolean;
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

export interface ExploreFromTestResult extends ExplorationResult {
  /** Source test file path */
  sourceTest: string;
}

/**
 * Run exploration from a Playwright test file: parse steps, execute, extract snapshots and locators, write knowledge base.
 */
export async function runExplorationFromTest(
  testPath: string,
  config: RunnerConfig = {}
): Promise<ExploreFromTestResult> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const errors: string[] = [];
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let mcpClient: MCPClient | undefined;

  const steps: ExplorationStep[] = parsedStepsToExplorationSteps(await parsePlaywrightTestFile(testPath));
  const baseUrl = steps[0]?.action === 'goto' ? steps[0].target : '';

  const plan: ExplorationPlan = {
    metadata: {
      name: 'exploration-from-test',
      version: '1.0',
      createdAt: new Date().toISOString(),
      description: `Parsed from ${testPath}`,
    },
    baseUrl,
    steps,
    safety: DEFAULT_SAFETY,
  };

  try {
    console.log(`[RunnerTestEntry] Parsed ${testPath}: ${steps.length} steps`);
    const knowledge = createKnowledgeBase(plan.metadata.name, plan.metadata.version);
    console.log(`[RunnerTestEntry] Created knowledge base: ${knowledge.runId}`);

    browser = await chromium.launch({ headless: finalConfig.headless });
    context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    page = await context.newPage();
    page.setDefaultTimeout(finalConfig.pageLoadTimeout);

    if (finalConfig.mcpEnabled && finalConfig.mcpConfig) {
      try {
        mcpClient = new MCPClient();
        await mcpClient.connect(
          finalConfig.mcpConfig.transport,
          finalConfig.mcpConfig,
          page,
          context
        );
      } catch (error) {
        console.warn(`[RunnerTestEntry] MCP init failed: ${error}. Using crawler-only.`);
        mcpClient = undefined;
      }
    }

    const stepResults = [];
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i]!;
      console.log(`[RunnerTestEntry] Step ${i + 1}/${plan.steps.length}: ${step.action} ${step.target}`);

      const stepResult = await executeStep(page, context, step, plan.safety, mcpClient);
      stepResults.push(stepResult);

      if (finalConfig.captureEvidence && stepResult.evidence) {
        const evidenceDir = finalConfig.evidenceOutputDir || `${finalConfig.outputDir}/evidence`;
        try {
          await saveEvidence(stepResult.evidence, evidenceDir, step.id);
        } catch (error) {
          console.warn(`[RunnerTestEntry] Evidence save failed for ${step.id}: ${error}`);
        }
      }

      if (!stepResult.success) {
        errors.push(`Step ${step.id} failed: ${stepResult.error}`);
        continue;
      }

      if (step.action === 'goto' || stepResult.finalUrl) {
        const url = stepResult.finalUrl || page!.url();
        const title = stepResult.pageTitle || await page!.title().catch(() => '');

        const currentPageKnowledge = createPageKnowledge(url, title, step.id);
        const rawElements = await extractPageSnapshot(page!);

        for (let j = 0; j < rawElements.length; j++) {
          const rawElement = rawElements[j]!;
          const locators = rankLocators(rawElement);
          const elementKnowledge = createElementKnowledge(`element-${i}-${j}`, rawElement, locators);
          addElementToPage(currentPageKnowledge, elementKnowledge);
        }
        addPageToKnowledge(knowledge, currentPageKnowledge);
      }
    }

    console.log(`[RunnerTestEntry] Writing knowledge to: ${finalConfig.outputDir}`);
    await writeKnowledgeBase(knowledge, finalConfig.outputDir);
    await writeKnowledgeBaseMarkdown(knowledge, finalConfig.outputDir);

    const result: ExploreFromTestResult = {
      runId: knowledge.runId,
      plan,
      stepResults,
      knowledge,
      success: errors.length === 0,
      errors,
      sourceTest: testPath,
    };
    console.log(`[RunnerTestEntry] Done: ${result.success ? 'SUCCESS' : 'WITH ERRORS'}`);
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[RunnerTestEntry] Fatal: ${errorMsg}`);
    throw error;
  } finally {
    if (mcpClient) {
      try {
        await mcpClient.closeSession();
      } catch {
        // ignore
      }
    }
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}
