# Arquitectura y Flujo Técnico

Este documento resume cómo se arma y opera Battly Launcher para Hytale. Todo está pensado para Electron con separación clara entre proceso **Main** (control de ventana, IPC, orquestación) y **Renderer** (UI/DOM).

---
## Vista de Capas
- **Main (`src/main.js`)**: crea ventanas, gestiona el ciclo de vida, maneja IPC y delega a servicios Node.
- **Renderer (`src/renderer.js`)**: UI, binding de eventos y consumo de IPC. No accede directamente al FS.
- **Servicios (`src/services/`)**: lógica especializada y reutilizable:
  - `game.js`: prepara directorios, lanza el juego y coordina parches cliente/servidor.
  - `patcher.js`: binpatching del cliente (descarga Butler, aplica `.pwr`, reemplaza dominios).
  - `serverPatcher.js`: reescritura de cadenas dentro de `HytaleServer.jar`.
  - `mods.js`: búsqueda e instalación desde CurseForge.
  - `news.js`: feed oficial Hytale.
  - `config.js`: persistencia de ajustes en JSON (userData).
  - `updater.js`: lectura remota de config para avisos de actualización.
  - `utils.js`: utilidades de red/FS (descargas con cabeceras, helpers HTTP).
- **Recursos**: `assets/`, `images/`, `locales/`, HTML/CSS.

---
## Flujos Principales
### 1) Arranque y Splash
1. `main.js` crea ventana splash (ligera, siempre-on-top).
2. Se dispara `loadGpuInfo()` en background y `createMainWindow()` tras 1.5s.
3. Al cargar `index.html`, se cierra la splash y se inicializa telemetría / check de updates.

### 2) Render + UI
- `renderer.js` monta listeners de UI, solicita datos vía `ipcRenderer.invoke`:
  - `get-news` → feed Hytale.
  - `get-settings` / `save-settings` → configuración.
  - `get-gpu-info` → preferencia GPU.
  - `install-mod` / `list-installed-mods` → mods.
- Traducción (i18n): carga `locales/<lang>.json`, cachea en memoria y aplica a `[data-i18n]`.

### 3) Pipeline de Parcheo (Cliente)
1. `game.js` asegura descarga del cliente y determina rutas.
2. `patcher.js`:
   - Garantiza `butler` en `%AppData%/Hytale/tools` (descarga + unzip).
   - Descarga parche `.pwr` (fallback incluido).
   - Aplica `butler apply` sobre staging.
   - Hace reemplazo binario UTF-16LE de dominios (`hytale.com` → `sanasol.ws`) y Discord invite.
   - Marca con `.patched_custom` para idempotencia.

### 4) Pipeline de Parcheo (Servidor)
1. `serverPatcher.js` abre `HytaleServer.jar` con `adm-zip`.
2. Reemplaza cadenas UTF-8 en `.class`, `.properties`, `.json`, `.xml`, `.yml`.
3. Escribe flag `patched_server.json` con metadatos.

### 5) Mods
- `mods.js` consulta CurseForge API (`CF_API_URL`) y devuelve paginación, búsqueda y detalles.
- Instalación: descarga zip, descomprime en carpeta de mods del usuario, actualiza listado.

### 6) Noticias
- `news.js` consume `https://launcher.hytale.com/launcher-feed/release/feed.json`, normaliza y devuelve máximo 6 ítems.

### 7) Actualizaciones
- `updater.js` lee `UPDATE_CONFIG_URL` y emite IPC `update-available` para mostrar diálogo en renderer.

### 8) Telemetría (ligera)
- `analytics.js` usa Aptabase; envía `_trackEvent` con propiedades de sesión (sin `systeminformation`).

---
## Mapa de Directorios (src/)
```
src/
├─ main.js           # Proceso Main: ventanas, IPC, bootstrap
├─ renderer.js       # UI/DOM + handlers
├─ index.html / style.css / splash.html
├─ analytics.js
├─ services/
│  ├─ game.js        # Orquestación de launch/patch
│  ├─ patcher.js     # Patch cliente
│  ├─ serverPatcher.js
│  ├─ mods.js
│  ├─ news.js
│  ├─ updater.js
│  ├─ config.js
│  └─ utils.js
├─ locales/          # JSON de traducciones
├─ assets/, images/  # Recursos estáticos
```

---
## IPC Clave
| Canal IPC               | Dirección              | Propósito                           |
|-------------------------|------------------------|-------------------------------------|
| `perform-update`        | Renderer → Main (invoke)| Abrir URL descarga y cerrar app     |
| `track-event`           | Renderer → Main        | Telemetría custom                   |
| `get-settings` / `save-settings` | Renderer ↔ Main | Persistencia de ajustes             |
| `get-gpu-info`          | Renderer → Main        | Detalle GPU detectada               |
| `select-java-path`      | Renderer → Main        | Selector de binario Java            |
| `open-game-location`    | Renderer → Main        | Abrir carpeta `%AppData%/Hytale`    |
| `repair-game`           | Renderer → Main        | Borrar instalación y regenerar      |
| `get-news`              | Renderer → Main        | Feed de noticias                    |
| `launch-game`           | Renderer → Main        | Iniciar flujo de arranque/patch     |
| Mods (`search-mods`, `install-mod`, `list-installed-mods`) | Renderer → Main | Gestión de mods |

---
## Persistencia y Config
- Configuración: JSON en `app.getPath('userData')` vía `services/config.js`.
- Flags de parcheo: `.patched_custom` junto al binario cliente; `patched_server.json` junto al JAR.
- Cache y herramientas: `%AppData%/Hytale/tools` y `%AppData%/Hytale/cache`.

---
## Observabilidad y Errores
- Logs: `console.log`/`console.error` en Main y Renderer (visible en DevTools).
- Eventos de tracking: `_trackEvent` (Aptabase) para métricas de uso.
- Estrategias de resiliencia:
  - Fallback de descarga de parches (primary → secondary).
  - Restauración desde `.bak` antes de re-parchear cliente/servidor.
  - Timeouts en solicitudes HTTP críticas (5s en noticias).

---
## Build y Distribución
- Scripts npm:
  - `npm start` → modo desarrollo (Electron).
  - `npm run build` → genera instalador en `dist/`.
- Artefactos: carpeta `dist/` empaquetada; no se commitea contenido de `node_modules/`.

---
## Extender o Depurar
1. **Agregar nueva API**: crear servicio en `src/services/`, exponer por IPC en `main.js` y consumir en `renderer.js`.
2. **Nuevas traducciones**: añadir `locales/<lang>.json` y actualizar selector en UI.
3. **Depurar parcheo**: habilitar `console.log` en `patcher.js` / `serverPatcher.js`; revisar flags `.patched_custom` o `.bak`.

---
## Riesgos Conocidos
- Dependencia de `wmic` para GPU en Windows (legado). En máquinas sin `wmic`, se devuelve `'Unsupported Platform'`.
- Cambios de formato en el feed de noticias pueden dejar la lista vacía; el renderer muestra mensaje de error.
- Parches `.pwr` dependen de mirrors externos; si todos fallan, se aborta el launch con error.
