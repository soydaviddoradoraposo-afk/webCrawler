# Comandos de Ejecución - Sistemas de Exploración

Guía de comandos para ejecutar los 3 sistemas de exploración disponibles.

## Prerrequisitos

```bash
# Instalar dependencias
npm install

# Compilar TypeScript (opcional, se puede usar tsx directamente)
npm run build
```

## Sistema 1: Exploración Tradicional (Plan-based, sin MCP)

Ejecuta planes Markdown estructurados usando solo el crawler determinista.

### Comando básico:
```bash
npm run explore examples/example-plan.md
```

### Con opciones:
```bash
# Modo visible (no headless)
npm run explore examples/example-plan.md --headless=false

# Directorio de salida personalizado
npm run explore examples/example-plan.md --output-dir=./my-knowledge

# Tipo de navegador
npm run explore examples/example-plan.md --browser=firefox

# Combinación de opciones
npm run explore examples/example-plan.md --headless=false --output-dir=./results --browser=chromium
```

### Ejemplo completo:
```bash
npm run explore plans/my-exploration-plan.md --headless=false --output-dir=./knowledge/run-001
```

---

## Sistema 2: Exploración con MCP (Plan-based + MCP con fallback)

Ejecuta planes Markdown usando MCP como método principal, con fallback automático al crawler.

### Paso 1: Iniciar servidor MCP (en una terminal separada)

**HTTP Mode:**
```bash
npx @executeautomation/playwright-mcp-server --port 8931
```

**stdio Mode (para Claude Desktop/Cursor):**
Configurar en las opciones de MCP del cliente.

### Paso 2: Ejecutar exploración con MCP habilitado

```bash
# MCP habilitado en puerto por defecto (8931)
npm run explore examples/example-plan.md --mcp-enabled=true

# MCP en puerto personalizado
npm run explore examples/example-plan.md --mcp-enabled=true --mcp-port=8931

# Con opciones adicionales
npm run explore examples/example-plan.md --mcp-enabled=true --mcp-port=8931 --headless=false --output-dir=./mcp-results
```

### Ejemplo completo:
```bash
# Terminal 1: Iniciar servidor MCP
npx @executeautomation/playwright-mcp-server --port 8931

# Terminal 2: Ejecutar exploración
npm run explore plans/login-flow.md --mcp-enabled=true --mcp-port=8931 --headless=false
```

### Nota:
Si el servidor MCP no está disponible, el sistema automáticamente usa el crawler determinista como fallback.

---

## Sistema 3: Markdown Flow (E2E desde prompts naturales)

Ejecuta flujos E2E directamente desde archivos Markdown donde cada línea es un prompt en lenguaje natural.

### Comando básico (sin MCP, solo crawler):
```bash
npm run explore plans/templates/flow-from-markdown.md --markdown-flow
```

### Con MCP habilitado:
```bash
# Paso 1: Iniciar servidor MCP (en terminal separada)
npx @executeautomation/playwright-mcp-server --port 8931

# Paso 2: Ejecutar flujo Markdown con MCP
npm run explore plans/templates/flow-from-markdown.md --markdown-flow --mcp-enabled=true --mcp-port=8931
```

### Con opciones adicionales:
```bash
npm run explore flows/login.md --markdown-flow --mcp-enabled=true --mcp-port=8931 --headless=false --output-dir=./flow-results
```

### Ejemplo completo:
```bash
# Terminal 1: Servidor MCP
npx @executeautomation/playwright-mcp-server --port 8931

# Terminal 2: Ejecutar flujo
npm run explore flows/ecommerce-checkout.md --markdown-flow --mcp-enabled=true --mcp-port=8931 --headless=false
```

---

## Sistema 4: Explore from test (test como punto de entrada)

Ejecuta exploración tomando un archivo de test Playwright (`.spec.ts`) como plan: parsea los pasos (goto, click, fill, select, hover), los ejecuta y extrae snapshots y locators que se incorporan al modelo canónico.

### Comando básico:
```bash
npm run explore-from-test -- e2e/login.spec.ts
```

### Con opciones:
```bash
# Modo visible
npm run explore-from-test -- e2e/login.spec.ts --headless=false

# Directorio de salida
npm run explore-from-test -- e2e/login.spec.ts --output-dir=./knowledge

# Con MCP
npm run explore-from-test -- e2e/login.spec.ts --mcp-enabled=true --mcp-port=8931
```

### Uso con runner directo:
```bash
tsx exploration/runner.ts --explore-from-test e2e/login.spec.ts
```

---

## Grabación avanzada (MCP Codegen + API + modelo canónico)

**Toggle de grabación:** No hay hotkey en el MCP; el inicio/fin de grabación se controla con las herramientas de codegen:
- `start_codegen_session` — inicia la sesión (y la captura de tráfico API en dominios permitidos).
- `end_codegen_session` — termina la sesión y genera el test Playwright.
- `export_codegen_session_json` — exporta la sesión como flow JSON (pasos + apiTraffic) sin generar test; opcionalmente escribe en un directorio (`outputPath`).

**Captura de API:** Durante una sesión activa se graba automáticamente el tráfico HTTP solo de los dominios permitidos (por defecto: `qa.cakehr.biz`, `cakehr.dev.sageone.com`). Configurable con `MCP_API_TRAFFIC_ALLOWED_DOMAINS` (lista separada por comas).

**Post-procesamiento (en crawlerPW):**
1. Cargar flow JSON (desde export o desde `get_codegen_session`).
2. Enriquecer: `enrichFlow(flow)` — replay + snapshot + locators (data-role primero, luego todos los recomendados por Playwright).
3. Fusionar en modelo canónico: `mergeEnrichedFlowIntoKnowledge(enrichedFlow)` y `writeKnowledgeBase(knowledge, outputDir)`.
4. Generar test: `flowToPlaywrightTest(flow)` o POM: `generatePOM(knowledge)`.

---

## Resumen de Flags Disponibles

| Flag | Descripción | Valores | Sistema |
|------|-------------|---------|---------|
| `--headless=` | Modo headless | `true` (default) / `false` | Todos |
| `--output-dir=` | Directorio de salida | Ruta (default: `./knowledge`) | Todos |
| `--browser=` | Tipo de navegador | `chromium` / `firefox` / `webkit` | Todos |
| `--markdown-flow` | Ejecutar como flujo Markdown | Flag booleano | Sistema 3 |
| `--explore-from-test` | Entrada = archivo test Playwright (.spec.ts) | Flag booleano | Sistema 4 |
| `--mcp-enabled=` | Habilitar MCP | `true` / `false` | Sistema 2, 3, 4 |
| `--mcp-port=` | Puerto del servidor MCP | Número (default: 8931) | Sistema 2, 3, 4 |

---

## Ejemplos de Archivos de Entrada

### Sistema 1 y 2: Plan Markdown estructurado
```markdown
# Metadata
- Name: Login Flow
- Version: 1.0.0
- BaseUrl: https://example.com

# Safety
- Forbidden Actions: delete, destroy
- Allow Destructive Forms: false

# Steps
- goto: https://example.com/login
- click: login-button [mcp-prefer]
- fill: username-field admin
- fill: password-field secret123
- click: submit-button [mcp-prefer]
```

### Sistema 3: Flujo Markdown (prompts naturales)
```markdown
Navigate to https://example.com/login
Fill the username field with 'testuser'
Fill the password field with 'password123'
Click the 'Login' button
Wait for element with text 'Welcome'
Take a screenshot
```

---

## Modo Desarrollo (sin compilar)

Para desarrollo rápido sin compilar TypeScript:

```bash
# Sistema 1: Tradicional
npm run dev examples/example-plan.md

# Sistema 2: Con MCP
npm run dev examples/example-plan.md --mcp-enabled=true --mcp-port=8931

# Sistema 3: Markdown Flow
npm run dev flows/login.md --markdown-flow --mcp-enabled=true --mcp-port=8931

# Sistema 4: Explore from test
npm run explore-from-test -- e2e/login.spec.ts --headless=false
```

---

## Troubleshooting

### Error: "MCP client not connected"
- Verifica que el servidor MCP esté corriendo: `curl http://localhost:8931/health`
- Verifica el puerto: `--mcp-port=8931`
- El sistema automáticamente usa crawler como fallback

### Error: "Cannot find module"
- Ejecuta `npm install`
- Si usas `npm start`, primero ejecuta `npm run build`

### Flujo Markdown no ejecuta
- Verifica que uses el flag `--markdown-flow` o `--md-flow`
- Verifica que el archivo tenga líneas con prompts (no solo metadata)

---

## Comparación Rápida

| Característica | Sistema 1 | Sistema 2 | Sistema 3 | Sistema 4 |
|----------------|-----------|-----------|-----------|-----------|
| **Entrada** | Plan estructurado | Plan estructurado | Prompts naturales | Test .spec.ts |
| **MCP** | No | Sí (opcional) | Sí (opcional) | Sí (opcional) |
| **Fallback** | N/A | Crawler automático | Crawler automático | Crawler automático |
| **Evidencia** | Sí | Sí | Sí | Sí |
| **Uso** | Exploración estructurada | Exploración con AI | E2E desde texto | Test como plan |
