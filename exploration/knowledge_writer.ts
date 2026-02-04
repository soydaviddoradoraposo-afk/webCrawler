/**
 * Knowledge Writer
 * 
 * Persists extracted knowledge in structured, versionable format.
 * 
 * Responsibilities:
 * - Write knowledge base to structured format (JSON)
 * - Ensure traceability: Page → Element → Locator → Source
 * - Never overwrite historical data
 * - Generate unique run identifiers
 * - Maintain version history
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { KnowledgeBase, PageKnowledge, ElementKnowledge } from './types.js';

/**
 * Write knowledge base to disk.
 * 
 * @param knowledge - Knowledge base to persist
 * @param outputDir - Output directory path
 * @returns Path to written file
 */
export async function writeKnowledgeBase(
  knowledge: KnowledgeBase,
  outputDir: string = './knowledge'
): Promise<string> {
  // Ensure output directory exists
  await mkdir(outputDir, { recursive: true });

  // Generate filename with timestamp and run ID
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `knowledge-${knowledge.runId}-${timestamp}.json`;
  const filepath = join(outputDir, filename);

  // Write knowledge base as formatted JSON
  const content = JSON.stringify(knowledge, null, 2);
  await writeFile(filepath, content, 'utf-8');

  return filepath;
}

/**
 * Write knowledge base in a human-readable format.
 * 
 * @param knowledge - Knowledge base to persist
 * @param outputDir - Output directory path
 * @returns Path to written file
 */
export async function writeKnowledgeBaseMarkdown(
  knowledge: KnowledgeBase,
  outputDir: string = './knowledge'
): Promise<string> {
  await mkdir(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `knowledge-${knowledge.runId}-${timestamp}.md`;
  const filepath = join(outputDir, filename);

  const content = formatKnowledgeAsMarkdown(knowledge);
  await writeFile(filepath, content, 'utf-8');

  return filepath;
}

/**
 * Format knowledge base as Markdown.
 */
function formatKnowledgeAsMarkdown(knowledge: KnowledgeBase): string {
  const lines: string[] = [];

  lines.push('# Knowledge Base');
  lines.push('');
  lines.push('## Metadata');
  lines.push('');
  lines.push(`- **Version**: ${knowledge.metadata.version}`);
  lines.push(`- **Created At**: ${knowledge.metadata.createdAt}`);
  lines.push(`- **Plan Name**: ${knowledge.metadata.planName}`);
  lines.push(`- **Plan Version**: ${knowledge.metadata.planVersion}`);
  lines.push(`- **Run ID**: ${knowledge.runId}`);
  lines.push('');

  lines.push(`## Pages (${knowledge.pages.length})`);
  lines.push('');

  for (const page of knowledge.pages) {
    lines.push(`### ${page.title || 'Untitled Page'}`);
    lines.push('');
    lines.push(`- **URL**: ${page.url}`);
    lines.push(`- **Extracted At**: ${page.extractedAt}`);
    if (page.sourceStepId) {
      lines.push(`- **Source Step**: ${page.sourceStepId}`);
    }
    lines.push(`- **Elements Found**: ${page.elements.length}`);
    lines.push('');

    if (page.elements.length > 0) {
      lines.push('#### Elements');
      lines.push('');

      for (const element of page.elements) {
        lines.push(`##### Element: ${element.elementId}`);
        lines.push('');
        lines.push('**Raw Data:**');
        lines.push('```json');
        lines.push(JSON.stringify(element.raw, null, 2));
        lines.push('```');
        lines.push('');

        if (element.locators.length > 0) {
          lines.push('**Locators (ranked by stability):**');
          lines.push('');
          for (const locator of element.locators) {
            const stability = locator.isLowStability ? '⚠️ LOW' : '✅';
            lines.push(
              `- ${stability} **${locator.strategy}** (score: ${locator.stabilityScore})`
            );
            lines.push(`  - Expression: \`${locator.expression}\``);
            lines.push(`  - Description: ${locator.description}`);
            lines.push('');
          }
        } else {
          lines.push('*No locators generated*');
          lines.push('');
        }
      }
    }

    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate a unique run identifier.
 * 
 * @returns Unique run ID
 */
export function generateRunId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `run-${timestamp}-${random}`;
}

/**
 * Create knowledge base structure.
 * 
 * @param planName - Name of the exploration plan
 * @param planVersion - Version of the exploration plan
 * @returns New knowledge base structure
 */
export function createKnowledgeBase(
  planName: string,
  planVersion: string
): KnowledgeBase {
  return {
    metadata: {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      planName,
      planVersion,
    },
    pages: [],
    runId: generateRunId(),
  };
}

/**
 * Add page knowledge to knowledge base.
 * 
 * @param knowledge - Knowledge base to update
 * @param page - Page knowledge to add
 */
export function addPageToKnowledge(
  knowledge: KnowledgeBase,
  page: PageKnowledge
): void {
  knowledge.pages.push(page);
}

/**
 * Create page knowledge structure.
 * 
 * @param url - Page URL
 * @param title - Page title
 * @param sourceStepId - Optional source step ID
 * @returns New page knowledge structure
 */
export function createPageKnowledge(
  url: string,
  title: string,
  sourceStepId?: string
): PageKnowledge {
  return {
    url,
    title,
    extractedAt: new Date().toISOString(),
    elements: [],
    sourceStepId,
  };
}

/**
 * Add element to page knowledge.
 * 
 * @param page - Page knowledge to update
 * @param element - Element knowledge to add
 */
export function addElementToPage(
  page: PageKnowledge,
  element: ElementKnowledge
): void {
  page.elements.push(element);
}

/**
 * Create element knowledge structure.
 * 
 * @param elementId - Unique element identifier
 * @param raw - Raw element data
 * @param locators - Ranked locator candidates
 * @returns New element knowledge structure
 */
export function createElementKnowledge(
  elementId: string,
  raw: ElementKnowledge['raw'],
  locators: ElementKnowledge['locators']
): ElementKnowledge {
  return {
    elementId,
    raw,
    locators,
    extractedAt: new Date().toISOString(),
  };
}