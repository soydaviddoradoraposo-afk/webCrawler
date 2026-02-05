/**
 * Public API exports for the Directed UI Exploration System.
 */

export * from './types.js';
export * from './flow_types.js';
export { getRecordingLocators } from './recording_locators.js';
export { enrichFlow } from './flow_enricher.js';
export { mergeEnrichedFlowIntoKnowledge } from './canonical_merge.js';
export { flowToPlaywrightTest } from './flow_to_playwright.js';
export { generatePOM } from './pom_generator.js';
export {
  parsePlaywrightTestContent,
  parsePlaywrightTestFile,
  parsedStepsToExplorationSteps,
} from './test_parser.js';
export type { ParsedTestStep } from './test_parser.js';
export { parseExplorationPlan, parseKeyboardKey } from './plan_parser.js';
export { executeStep } from './step_executor.js';
export { extractPageSnapshot, extractElementsBySelector } from './snapshot_extractor.js';
export { rankLocators, getBestLocator } from './locator_ranker.js';
export {
  writeKnowledgeBase,
  writeKnowledgeBaseMarkdown,
  generateRunId,
  createKnowledgeBase,
  createPageKnowledge,
  createElementKnowledge,
  addPageToKnowledge,
  addElementToPage,
} from './knowledge_writer.js';
export { runExploration, main } from './runner.js';
export { runExplorationFromTest } from './runner_test_entry.js';
export type { ExploreFromTestResult } from './runner_test_entry.js';