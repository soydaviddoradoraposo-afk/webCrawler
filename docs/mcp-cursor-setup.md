# Configurar MCP Playwright en Cursor

Guía para cargar el MCP Playwright en Cursor (`mcp.json`) y usarlo con el agente.

---

## 1. Cargar el MCP en Cursor (`mcp.json`)

El archivo de configuración de MCP en Cursor está en:

- **Windows**: `C:\Users\<TuUsuario>\.cursor\mcp.json`
- **macOS/Linux**: `~/.cursor/mcp.json`

### Opción A: Usar el paquete publicado (npm)

Ya lo tienes así. Solo asegúrate de que el contenido sea:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@executeautomation/playwright-mcp-server"]
    }
  }
}
```

**Nota:** Esta versión no incluye las extensiones de este repo (captura de API, `export_codegen_session_json`, filtro de dominios). Para eso usa la Opción B.

---

### Opción B: Usar el MCP local extendido (este proyecto)

El MCP que hemos extendido está en `mcp-playwright-temp/mcp-playwright` (captura de API, export flow JSON, dominios qa.cakehr.biz / cakehr.dev.sageone.com).

**Paso 1 – Compilar el MCP local**

En la raíz del repo (o en la carpeta del MCP):

```bash
cd mcp-playwright-temp/mcp-playwright
npm install
npm run build
```

Si en Windows falla al final con `shx chmod`, ignóralo: `dist/` ya está generado. Si no existe `dist/index.js`, ejecuta solo `npx tsc`.

**Paso 2 – Añadir entrada en `mcp.json`**

Abre `C:\Users\Usuario\.cursor\mcp.json` y añade o reemplaza el servidor `playwright` por uno de estos dos modos.

**Modo stdio (recomendado con Cursor):** Cursor arranca el proceso por ti.

```json
{
  "mcpServers": {
    "playwright": {
      "command": "node",
      "args": [
        "D:/workspace/UIframework/crawlerPW/mcp-playwright-temp/mcp-playwright/dist/index.js"
      ]
    }
  }
}
```

Ajusta la ruta si tu proyecto está en otra carpeta (usa `/` o `\\` según el sistema).

**Modo HTTP:** El servidor debe estar en marcha en otro terminal.

1. En una terminal:

```bash
cd D:\workspace\UIframework\crawlerPW\mcp-playwright-temp\mcp-playwright
node dist/index.js --port 8931
```

2. En `mcp.json`:

```json
{
  "mcpServers": {
    "playwright": {
      "url": "http://localhost:8931/mcp",
      "type": "http"
    }
  }
}
```

**Reiniciar Cursor** después de tocar `mcp.json` para que cargue el MCP.

---

## 2. Cómo usarlo con el agente

Cuando el MCP está cargado, el agente (Cursor) puede llamar a las herramientas de Playwright. Resumen práctico:

### Grabación (codegen)

1. **Iniciar sesión de grabación**  
   El agente llama a `start_codegen_session` con `options` (por ejemplo `outputPath`).  
   A partir de aquí se graban acciones y, en el MCP extendido, tráfico API de los dominios permitidos.

2. **Ejecutar flujo en el navegador**  
   El agente usa herramientas como:
   - `playwright_navigate` (URL)
   - `playwright_click` (selector)
   - `playwright_fill` (selector, valor)
   - `playwright_select`, `playwright_hover`, etc.

3. **Exportar flow como JSON (solo MCP extendido)**  
   El agente llama a `export_codegen_session_json` con `sessionId` y opcionalmente `outputPath` para guardar `flow-{sessionId}-{timestamp}.json`.

4. **Terminar y generar test**  
   El agente llama a `end_codegen_session` con el `sessionId` para generar el `.spec.ts` y cerrar la sesión.

### Ejemplos de prompts para el agente

- *“Abre el MCP Playwright, inicia una sesión de codegen en `./e2e` y navega a https://qa.cakehr.biz.”*
- *“Haz click en el botón de login, rellena usuario y contraseña y exporta la sesión como flow JSON en `./flows`.”*
- *“Termina la sesión de codegen y genera el test.”*

### Exploración desde test (crawlerPW, sin MCP)

Desde terminal (no desde el MCP):

```bash
npm run explore-from-test -- e2e/login.spec.ts
```

Eso usa el runner de este repo para parsear el test y extraer conocimiento (locators, etc.).

---

## 3. Comprobar que el MCP está cargado

1. Reinicia Cursor.
2. En un chat con el agente, pregunta: *“¿Qué herramientas MCP de Playwright tienes?”* o *“Lista las herramientas de playwright.”*
3. Si aparece `playwright_navigate`, `playwright_click`, `start_codegen_session`, `export_codegen_session_json`, etc., el MCP está cargado.

Si no aparece nada de Playwright, revisa:

- Que la ruta en `args` (modo stdio) sea correcta y que `dist/index.js` exista.
- En modo HTTP, que el proceso `node dist/index.js --port 8931` siga corriendo.
- Que no haya errores en la pestaña “MCP” o “Output” de Cursor.

---

## 4. Resumen de `mcp.json` (ejemplo con ambos)

Puedes tener varios servidores. Ejemplo con el MCP local en stdio:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "node",
      "args": [
        "D:/workspace/UIframework/crawlerPW/mcp-playwright-temp/mcp-playwright/dist/index.js"
      ]
    }
  }
}
```

Sustituye la ruta por la de tu máquina si es distinta.
