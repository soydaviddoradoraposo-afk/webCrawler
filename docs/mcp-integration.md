# MCP Integration Guide

Detailed guide for integrating and using Model Context Protocol (MCP) with the Directed UI Exploration System.

## Architecture Overview

The system uses a hybrid execution model combining MCP-driven AI automation with deterministic crawler fallback:

```
┌─────────────────┐
│  Exploration    │
│     Plan        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Step Executor  │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌──────┐  ┌──────────┐
│ MCP  │  │ Crawler  │
│Client│  │ Executor │
└──┬───┘  └────┬─────┘
   │           │
   └─────┬─────┘
         │
         ▼
┌─────────────────┐
│   Evidence      │
│   Capture       │
└─────────────────┘
```

## MCP Client API

### Connection

```typescript
import { MCPClient } from './exploration/mcp_client.js';

const mcpClient = new MCPClient();

// HTTP mode
await mcpClient.connect('http', {
  transport: 'http',
  httpPort: 8931,
  httpHost: 'localhost',
  timeout: 30000,
  enableEvidenceCapture: true,
}, page, context);

// stdio mode (for Claude Desktop)
await mcpClient.connect('stdio', {
  transport: 'stdio',
  timeout: 30000,
  enableEvidenceCapture: true,
}, page, context);
```

### Actions

#### Navigate

```typescript
const result = await mcpClient.navigate('https://example.com', {
  waitUntil: 'networkidle',
});

if (result.success) {
  console.log('Navigation successful');
  console.log('Evidence:', result.evidence);
} else {
  console.error('Navigation failed:', result.error);
}
```

#### Click

```typescript
const result = await mcpClient.click('Login button');

// MCP will use AI to resolve the selector
// Falls back to crawler if MCP fails
```

#### Fill

```typescript
const result = await mcpClient.fill('Username field', 'admin');
```

#### Hover

```typescript
const result = await mcpClient.hover('Menu item');
```

#### Scroll

```typescript
// Scroll to element
const result = await mcpClient.scroll('Footer section');

// Scroll to coordinates
const result = await mcpClient.scroll({ x: 0, y: 500 });
```

#### Screenshot

```typescript
const result = await mcpClient.screenshot({ name: 'step1', fullPage: true });
```

#### Execute JavaScript

```typescript
const result = await mcpClient.executeJS('document.title');
console.log('Page title:', result.data);
```

### Supported MCP Tools (Complete List)

All tools from `@executeautomation/playwright-mcp-server` are integrated. Use the MCP client when connected; steps fall back to the crawler when MCP is unavailable or fails.

#### Browser automation
| Method | Description |
|--------|-------------|
| `navigate(url, options?)` | Navigate to URL (options: waitUntil, browserType, width, height, timeout, headless) |
| `click(selector)` | Click element by CSS selector |
| `fill(selector, value)` | Fill input field |
| `select(selector, value)` | Select option in `<select>` |
| `hover(selector)` | Hover over element |
| `scroll(target)` | Scroll to selector or `{ x, y }` |
| `screenshot(options?)` | Capture screenshot (name, selector, fullPage, etc.) |
| `executeJS(code)` | Run JavaScript in page (tool: playwright_evaluate) |
| `pressKey(key, selector?)` | Press keyboard key |
| `drag(sourceSelector, targetSelector)` | Drag element to target |
| `uploadFile(selector, filePath)` | Upload file to `input[type="file"]` |
| `getVisibleText()` | Get visible text of the page |
| `getVisibleHtml(options?)` | Get HTML (optional selector, removeScripts, cleanHtml, etc.) |
| `goBack()` | Navigate back in history |
| `goForward()` | Navigate forward in history |
| `saveAsPdf(options)` | Save page as PDF (outputPath, filename, format, margin) |
| `clickAndSwitchTab(selector)` | Click link and switch to new tab |
| `iframeClick(iframeSelector, selector)` | Click element inside iframe |
| `iframeFill(iframeSelector, selector, value)` | Fill input inside iframe |
| `getConsoleLogs(options?)` | Get browser console logs (type, search, limit, clear) |
| `setCustomUserAgent(userAgent)` | Set custom User-Agent |
| `expectResponse(id, url)` | Start waiting for HTTP response |
| `assertResponse(id, value?)` | Wait and validate response from expectResponse |
| `closeBrowser()` | Close browser and release resources |

#### Device testing
| Method | Description |
|--------|-------------|
| `resize(options)` | Resize viewport: `{ device? }` (e.g. 'iPhone 13', 'Desktop Chrome') or `{ width?, height? }`, optional `orientation` |

#### API automation
| Method | Description |
|--------|-------------|
| `apiGet(url, options?)` | HTTP GET (options: token, headers) |
| `apiPost(url, value, options?)` | HTTP POST with body |
| `apiPut(url, value, options?)` | HTTP PUT |
| `apiPatch(url, value, options?)` | HTTP PATCH |
| `apiDelete(url, options?)` | HTTP DELETE |

#### Recording (code generation)
| Method | Description |
|--------|-------------|
| `startCodegenSession(options)` | Start recording session (outputPath, testNamePrefix?, includeComments?) |
| `endCodegenSession(sessionId)` | End session and generate test file |
| `getCodegenSession(sessionId)` | Get session info |
| `clearCodegenSession(sessionId)` | Clear session without generating |

**Crawler fallback:** Actions such as `api_*`, codegen, `expect_response`, `assert_response`, `custom_user_agent`, and `console_logs` have no crawler implementation; use MCP or omit those steps when running without MCP.

### Evidence Capture

```typescript
const evidence = await mcpClient.captureEvidence();
console.log('Screenshot:', evidence.screenshot);
console.log('HTML:', evidence.html);
console.log('Console logs:', evidence.consoleLogs);
```

### Session Management

```typescript
// Get session ID
const sessionId = mcpClient.getSessionId();

// Check connection status
if (mcpClient.isConnected()) {
  // Use MCP
}

// Close session
await mcpClient.closeSession();
```

## Crawler Executor API

The crawler executor provides deterministic fallback when MCP is unavailable:

```typescript
import {
  executeClick,
  executeFill,
  executeHover,
  executeScroll,
  executeWait,
  executeScreenshot,
  resolveSelector,
} from './exploration/crawler_executor.js';

// Click with multi-strategy selector resolution
const result = await executeClick('login-button', page, context);

// Fill input
const result = await executeFill('username-field', 'admin', page, context);

// Resolve selector manually
const locator = await resolveSelector('submit-button', page);
if (locator) {
  await locator.click();
}
```

## Step Executor Integration

The step executor automatically chooses between MCP and crawler:

```typescript
import { executeStep } from './exploration/step_executor.js';

const result = await executeStep(
  page,
  context,
  step,
  safetyConstraints,
  mcpClient, // Optional
  crawlerExecutor // Optional
);

// Result includes:
// - success: boolean
// - evidence: Evidence object
// - executionPath: 'mcp' | 'crawler'
// - mcpError: string (if MCP was attempted and failed)
```

## Execution Preferences

Control execution path per step in plan:

```markdown
## Steps
# Try MCP first, fallback to crawler (default)
- click: login-button [mcp-prefer]

# Use crawler only
- fill: username-field admin [crawler-only]

# Use MCP only, fail if unavailable
- click: submit-button [mcp-only]
```

## Best Practices

### 1. Use MCP for Complex Interactions

MCP excels at:
- Natural language element descriptions
- Dynamic content that changes frequently
- Complex multi-step interactions
- Situations where selectors are unstable

### 2. Use Crawler for Stable Elements

Crawler is better for:
- Elements with stable data-role/data-testid attributes
- Form inputs with consistent names
- Navigation elements that rarely change
- CI environments where MCP may be unavailable

### 3. Evidence Capture

Always enable evidence capture for production:

```typescript
const config: RunnerConfig = {
  captureEvidence: true,
  evidenceOutputDir: './evidence',
  mcpConfig: {
    enableEvidenceCapture: true,
  },
};
```

### 4. Error Handling

Both MCP and crawler return structured results:

```typescript
if (!result.success) {
  // Log error
  console.error('Action failed:', result.error);
  
  // Check execution path
  if (result.executionPath === 'mcp' && result.mcpError) {
    console.error('MCP error:', result.mcpError);
  }
  
  // Review evidence
  if (result.evidence) {
    console.log('Screenshot:', result.evidence.screenshot);
  }
}
```

### 5. Timeout Configuration

Set appropriate timeouts:

```typescript
const config: RunnerConfig = {
  mcpConfig: {
    timeout: 30000, // 30 seconds for MCP actions
  },
  pageLoadTimeout: 30000, // 30 seconds for page loads
};
```

## Performance Considerations

### MCP Overhead

- MCP adds network latency (HTTP mode) or process overhead (stdio mode)
- Use `[crawler-only]` for time-sensitive operations
- Batch related actions when possible

### Evidence Capture

- Screenshots and HTML snapshots can be large
- Consider disabling for high-frequency operations
- Use base64 format for in-memory storage, file format for persistence

### Session Reuse

- MCP sessions are reused across steps
- Avoid creating multiple MCP clients
- Close sessions properly to free resources

## Troubleshooting

### MCP Connection Timeout

**Symptom**: `MCP action timed out after 30000ms`

**Solutions:**
1. Increase timeout in config
2. Check MCP server performance
3. Verify network connectivity
4. Use crawler-only mode for problematic steps

### Selector Resolution Failures

**Symptom**: MCP cannot find elements

**Solutions:**
1. Provide more descriptive target descriptions
2. Check element visibility in evidence screenshots
3. Verify page has fully loaded
4. Use crawler with explicit selectors

### Evidence Not Captured

**Symptom**: Evidence object is undefined

**Solutions:**
1. Verify `enableEvidenceCapture: true` in config
2. Check page and context are set on MCP client
3. Review error logs for capture failures
4. Ensure output directory is writable

## Example: Complete Integration

```typescript
import { runExploration } from './exploration/runner.js';
import { RunnerConfig } from './exploration/types.js';

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
  headless: false,
  outputDir: './knowledge',
};

const result = await runExploration('./plans/login-flow.md', config);

if (result.success) {
  console.log('Exploration completed successfully');
  console.log(`Evidence saved to: ${config.evidenceOutputDir}`);
} else {
  console.error('Exploration failed:', result.errors);
}
```

## API Reference

See inline documentation in:
- `exploration/mcp_client.ts` - MCP client methods
- `exploration/crawler_executor.ts` - Crawler executor methods
- `exploration/step_executor.ts` - Step executor integration
- `exploration/evidence_capture.ts` - Evidence capture utilities
