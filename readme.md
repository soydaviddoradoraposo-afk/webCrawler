# Directed UI Exploration System

Production-grade infrastructure for automatically extracting high-value UI knowledge from web applications using Playwright with hybrid MCP-driven and deterministic crawler execution.

## Overview

This system enables deterministic, plan-driven exploration of web applications to extract structured knowledge about:
- Pages and their structure
- Interactive UI elements
- Stable locators for each element
- UI transitions and navigation flows

The extracted knowledge can be used to generate Page Objects and deterministic E2E tests.

## Architecture

The system follows strict separation of concerns:

```
/exploration
 ├─ runner.ts              # Main orchestrator
 ├─ plan_parser.ts          # Markdown plan parsing
 ├─ step_executor.ts        # Hybrid MCP + crawler execution
 ├─ mcp_client.ts           # MCP server interface
 ├─ crawler_executor.ts     # Deterministic executor (fallback)
 ├─ evidence_capture.ts     # Evidence capture utilities
 ├─ snapshot_extractor.ts   # UI element extraction
 ├─ locator_ranker.ts       # Locator stability ranking
 ├─ knowledge_writer.ts     # Structured persistence
 └─ types.ts                # Type definitions
```

## Core Principles

1. **Hybrid Execution**: MCP-driven AI automation with deterministic crawler fallback
2. **Deterministic**: All exploration is driven by explicit plans, no guessing
3. **Safe**: Built-in safety constraints prevent destructive actions
4. **Traceable**: Full traceability from Page → Element → Locator → Source
5. **Auditable**: Complete evidence capture (screenshots, HTML, logs) for every action
6. **Production-Ready**: Designed for scale, not demos

## Installation

```bash
npm install
```

## Usage

### 1. Create an Exploration Plan

Create a Markdown file defining your exploration plan:

```markdown
# Metadata
- Name: My Application Exploration
- Version: 1.0.0
- BaseUrl: https://example.com

# Safety
- Forbidden Actions: delete, destroy
- Allow Destructive Forms: false

# Steps
- goto: https://example.com
- click: login-button
- fill: username-field admin
- fill: password-field secret123
- click: submit-button
```

### 2. Run Exploration

```bash
npm run build
npm start examples/example-plan.md
```

Or with custom options:

```bash
npm start examples/example-plan.md --headless=false --output-dir=./my-knowledge
```

### 3. Review Knowledge Base

The system generates:
- **JSON**: Structured, machine-readable knowledge base
- **Markdown**: Human-readable documentation

Both are saved in the output directory with timestamps and run IDs.

## Plan Format

Exploration plans are Markdown files with three main sections:

### Metadata
- `Name`: Plan identifier
- `Version`: Plan version
- `BaseUrl`: Base URL for navigation

### Safety
- `Forbidden Actions`: Actions that should never be executed
- `Forbidden Selectors`: Selector patterns to avoid
- `Allow Destructive Forms`: Whether to allow form submissions
- `Allow Delete Buttons`: Whether to allow delete button clicks

### Steps
- `goto`: Navigate to URL
- `click`: Click an element
- `fill`: Fill an input field
- `select`: Select dropdown option
- `check`/`uncheck`: Toggle checkbox
- `keyboard`: Send keyboard input
- `hover`: Hover over element
- `scroll`: Scroll to element or coordinates
- `wait`: Wait for condition
- `screenshot`: Capture screenshot

**Execution Preferences:**
- `[mcp-prefer]`: Try MCP first, fallback to crawler (default)
- `[crawler-only]`: Use crawler executor only
- `[mcp-only]`: Use MCP only, fail if unavailable

Example:
```markdown
- goto: https://example.com [mcp-prefer]
- click: login-button [mcp-prefer]
- fill: username-field admin [crawler-only]
- click: submit-button [mcp-prefer]
```

## Locator Priority

The system ranks locators by stability:

1. **data-role** (score: 100) - Highest priority
2. **data-testid** (score: 90)
3. **ARIA role + accessible name** (score: 80)
4. **aria-label** (score: 70)
5. **CSS fallback** (score: 30-50) - Lowest priority, discouraged

## Safety Features

- Never submits destructive forms
- Never clicks delete buttons
- Never confirms irreversible actions
- Validates all actions against safety constraints
- Fails fast on ambiguous or invalid plans

## Output Format

The knowledge base includes:

- **Pages**: URLs, titles, extraction timestamps
- **Elements**: Raw element data (tag, attributes, properties)
- **Locators**: Ranked candidates with stability scores
- **Traceability**: Full chain from page to element to locator

## Development

```bash
# Build
npm run build

# Run in development mode
npm run dev examples/example-plan.md
```

## MCP Server Setup

The system supports Model Context Protocol (MCP) for AI-driven browser automation via `@executeautomation/playwright-mcp-server`.

### Installation

```bash
npm install -D @executeautomation/playwright-mcp-server
```

### Running MCP Server

**HTTP Mode (recommended for development):**
```bash
npx @executeautomation/playwright-mcp-server --port 8931
```

**stdio Mode (for Claude Desktop / Cursor):**
Configure in your MCP client settings.

### Configuration

Enable MCP in your exploration:

```typescript
const config: RunnerConfig = {
  mcpEnabled: true,
  mcpConfig: {
    transport: 'http',
    httpPort: 8931,
    httpHost: 'localhost',
    timeout: 30000,
    enableEvidenceCapture: true,
  },
  captureEvidence: true,
  evidenceOutputDir: './evidence',
};
```

## Hybrid Execution

The system implements a hybrid execution model:

1. **Primary**: MCP-driven execution via `@executeautomation/playwright-mcp-server`
   - AI-powered selector resolution
   - Natural language action descriptions
   - Real-time browser interaction

2. **Fallback**: Deterministic crawler with multi-strategy selectors
   - Automatic fallback when MCP fails or is unavailable
   - Multi-strategy selector resolution (data-role → data-testid → ARIA → CSS)
   - Heuristic-based element matching

**Execution Flow:**
- Try MCP first (if enabled and available)
- If MCP fails or preference is `crawler-only`, use deterministic crawler
- Both paths capture evidence (screenshots, HTML, console logs)
- Execution path is logged for auditability

## Evidence Capture

Every action captures evidence for auditability:

- **Screenshots**: Full-page screenshots (base64 or file)
- **HTML Snapshots**: Complete page HTML
- **Console Logs**: Browser console output with timestamps
- **Accessibility Tree**: ARIA tree structure
- **Network Logs**: Request/response logs (optional)

Evidence is organized by run and step:
```
{outputDir}/
  evidence/
    {runId}/
      step-{stepId}/
        screenshot.png
        html-snapshot.html
        console-logs.json
        accessibility-tree.json
        execution-log.json
```

## CI/Offline Mode

Disable MCP for CI environments or offline execution:

```typescript
const config: RunnerConfig = {
  mcpEnabled: false, // Disables MCP, uses crawler-only
  captureEvidence: true,
};
```

The deterministic crawler can run independently without MCP.

## Troubleshooting

### MCP Connection Issues

**Problem**: MCP client fails to connect

**Solutions:**
1. Verify MCP server is running: `curl http://localhost:8931/health`
2. Check firewall/network settings
3. Verify port is not in use: `netstat -an | grep 8931`
4. Try stdio mode instead of HTTP
5. Check MCP server logs for errors

**Fallback**: System automatically falls back to crawler executor

### Selector Resolution Failures

**Problem**: Elements cannot be found

**Solutions:**
1. Check element visibility (may be hidden or in iframe)
2. Verify element has stable attributes (data-role, data-testid)
3. Use execution preference `[crawler-only]` to force deterministic resolution
4. Review evidence screenshots to verify page state
5. Check console logs for JavaScript errors

### Evidence Capture Problems

**Problem**: Evidence files not saved

**Solutions:**
1. Verify output directory permissions
2. Check disk space
3. Review error logs for file system errors
4. Ensure `captureEvidence: true` in config

## Requirements

- Node.js 18+
- TypeScript 5.3+
- Playwright 1.40+
- @executeautomation/playwright-mcp-server (optional, for MCP mode)
- @modelcontextprotocol/sdk (optional, for MCP mode)

## License

MIT