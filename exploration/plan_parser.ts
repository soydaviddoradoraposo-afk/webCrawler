/**
 * Markdown Plan Parser
 * 
 * Parses declarative Markdown exploration plans into strongly-typed
 * internal representations. Plans are treated as contracts, not suggestions.
 * 
 * Responsibilities:
 * - Parse Markdown plan structure
 * - Validate plan syntax and semantics
 * - Reject ambiguous or invalid plans
 * - Convert to ExplorationPlan type
 */

import { ExplorationPlan, ExplorationStep, SafetyConstraints, ActionType, KeyboardKey } from './types.js';

/**
 * Parse a Markdown exploration plan into a strongly-typed ExplorationPlan.
 * 
 * @param markdownContent - Raw Markdown content of the plan
 * @returns Parsed and validated ExplorationPlan
 * @throws Error if plan is invalid, ambiguous, or contains unsupported actions
 */
export function parseExplorationPlan(markdownContent: string): ExplorationPlan {
  const lines = markdownContent.split('\n');
  const plan: Partial<ExplorationPlan> = {
    metadata: {
      name: '',
      version: '',
      createdAt: new Date().toISOString(),
    },
    baseUrl: '',
    steps: [],
    safety: {
      forbiddenActions: [],
      forbiddenSelectors: [],
      allowDestructiveForms: false,
      allowDeleteButtons: false,
    },
  };

  let currentSection: string | null = null;
  let stepCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines and comments
    if (!line || line.startsWith('<!--')) continue;

    // Detect section headers
    if (line.startsWith('#')) {
      currentSection = line.replace(/^#+\s*/, '').toLowerCase();
      continue;
    }

    // Parse metadata section
    if (currentSection === 'metadata' || currentSection === 'plan') {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        switch (key.toLowerCase()) {
          case 'name':
            plan.metadata!.name = value;
            break;
          case 'version':
            plan.metadata!.version = value;
            break;
          case 'description':
            plan.metadata!.description = value;
            break;
          case 'baseurl':
          case 'base_url':
            plan.baseUrl = value;
            break;
        }
      }
    }

    // Parse safety constraints
    if (currentSection === 'safety' || currentSection === 'constraints') {
      if (line.startsWith('-')) {
        const constraint = line.replace(/^-\s*/, '');
        if (constraint.toLowerCase().includes('forbidden')) {
          const match = constraint.match(/forbidden[:\s]+(.+)/i);
          if (match) {
            const items = match[1].split(',').map(s => s.trim());
            if (constraint.toLowerCase().includes('action')) {
              plan.safety!.forbiddenActions.push(...items);
            } else if (constraint.toLowerCase().includes('selector')) {
              plan.safety!.forbiddenSelectors.push(...items);
            }
          }
        } else if (constraint.toLowerCase().includes('destructive')) {
          plan.safety!.allowDestructiveForms = constraint.toLowerCase().includes('allow');
        } else if (constraint.toLowerCase().includes('delete')) {
          plan.safety!.allowDeleteButtons = constraint.toLowerCase().includes('allow');
        }
      }
    }

    // Parse steps section
    if (currentSection === 'steps' || currentSection === 'exploration') {
      // Support both list format and table format
      if (line.startsWith('-') || line.startsWith('|')) {
        const step = parseStep(line, stepCounter++);
        if (step) {
          plan.steps!.push(step);
        }
      }
    }
  }

  // Validate required fields
  validatePlan(plan as ExplorationPlan);

  return plan as ExplorationPlan;
}

/**
 * Parse a single step from a Markdown line.
 * 
 * Supports formats:
 * - `- action: target [value] [description]`
 * - `| action | target | value | description |`
 */
function parseStep(line: string, index: number): ExplorationStep | null {
  // Extract execution preference if present: [mcp-prefer], [crawler-only], [mcp-only]
  let executionPreference: 'mcp-prefer' | 'crawler-only' | 'mcp-only' | undefined;
  const preferenceMatch = line.match(/\[(mcp-prefer|crawler-only|mcp-only)\]/);
  if (preferenceMatch) {
    executionPreference = preferenceMatch[1] as 'mcp-prefer' | 'crawler-only' | 'mcp-only';
    line = line.replace(/\[(mcp-prefer|crawler-only|mcp-only)\]/g, '').trim();
  }

  // List format: - action: target [value] [description]
  if (line.startsWith('-')) {
    const content = line.replace(/^-\s*/, '');
    const parts = content.split(/\s+/);
    
    if (parts.length < 2) {
      throw new Error(`Invalid step format at line: ${line}. Expected: action target [value]`);
    }

    const action = validateAction(parts[0].replace(':', ''));
    const target = parts[1];
    const value = parts[2];
    const description = parts.slice(3).join(' ') || undefined;

    return {
      id: `step-${index}`,
      action,
      target,
      value,
      description,
      executionPreference,
    };
  }

  // Table format: | action | target | value | description |
  if (line.startsWith('|')) {
    const cells = line.split('|').map(c => c.trim()).filter(c => c && !c.match(/^[-:]+$/));
    
    if (cells.length < 2) {
      throw new Error(`Invalid table step format at line: ${line}. Expected: | action | target | ...`);
    }

    const action = validateAction(cells[0]);
    const target = cells[1];
    const value = cells[2] || undefined;
    const description = cells[3] || undefined;

    return {
      id: `step-${index}`,
      action,
      target,
      value,
      description,
      executionPreference,
    };
  }

  return null;
}

/**
 * Validate and normalize action type.
 * 
 * @throws Error if action is unsupported
 */
function validateAction(actionStr: string): ActionType {
  const normalized = actionStr.toLowerCase().trim();
  
  const validActions: ActionType[] = [
    'goto',
    'click',
    'fill',
    'select',
    'check',
    'uncheck',
    'keyboard',
    'hover',
    'scroll',
    'wait',
    'screenshot',
    'drag',
    'upload_file',
    'press_key',
    'go_back',
    'go_forward',
    'get_visible_text',
    'get_visible_html',
    'resize',
    'save_as_pdf',
    'click_and_switch_tab',
    'iframe_click',
    'iframe_fill',
    'expect_response',
    'assert_response',
    'custom_user_agent',
    'console_logs',
    'api_get',
    'api_post',
    'api_put',
    'api_patch',
    'api_delete',
    'start_codegen',
    'end_codegen',
    'get_codegen',
    'clear_codegen',
    'evaluate',
  ];

  if (!validActions.includes(normalized as ActionType)) {
    throw new Error(
      `Unsupported action: ${actionStr}. ` +
      `Supported actions: ${validActions.join(', ')}`
    );
  }

  return normalized as ActionType;
}

/**
 * Validate complete plan structure.
 * 
 * @throws Error if plan is invalid or ambiguous
 */
function validatePlan(plan: ExplorationPlan): void {
  if (!plan.metadata.name) {
    throw new Error('Plan must have a name in metadata section');
  }

  if (!plan.metadata.version) {
    throw new Error('Plan must have a version in metadata section');
  }

  if (!plan.baseUrl) {
    throw new Error('Plan must specify a baseUrl');
  }

  if (!plan.steps || plan.steps.length === 0) {
    throw new Error('Plan must contain at least one exploration step');
  }

  // Validate each step
  for (const step of plan.steps) {
    if (!step.action) {
      throw new Error(`Step ${step.id} is missing an action`);
    }

    if (!step.target) {
      throw new Error(`Step ${step.id} is missing a target`);
    }

    // Validate action-specific requirements
    if ((step.action === 'fill' || step.action === 'select') && !step.value) {
      throw new Error(`Step ${step.id} (${step.action}) requires a value`);
    }

    if (step.action === 'keyboard' && !step.key) {
      throw new Error(`Step ${step.id} (keyboard) requires a key`);
    }
  }

  // Validate safety constraints
  if (!plan.safety) {
    throw new Error('Plan must define safety constraints');
  }
}

/**
 * Parse keyboard key from string.
 */
export function parseKeyboardKey(keyStr: string): KeyboardKey {
  const normalized = keyStr.trim();
  const validKeys: KeyboardKey[] = [
    'Enter',
    'Escape',
    'Tab',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Home',
    'End',
    'PageUp',
    'PageDown',
  ];

  if (!validKeys.includes(normalized as KeyboardKey)) {
    throw new Error(
      `Invalid keyboard key: ${keyStr}. ` +
      `Valid keys: ${validKeys.join(', ')}`
    );
  }

  return normalized as KeyboardKey;
}