# Guía de Contribución

Si quieres contribuir al desarrollo de Battly Launcher, sigue estas pautas técnicas.

## Requisitos Previos

- **Node.js**: v18 o superior.
- **Git**: Para control de versiones.
- **Entorno Windows**: Recomendado para pruebas de binarios `.exe`, aunque el código es mayormente agnóstico.

## Flujo de Trabajo

1.  **Instalación**:

    ```bash
    npm install
    ```

2.  **Modo Desarrollo**:

    ```bash
    npm start
    ```

    Esto lanza Electron con las herramientas de desarrollo abiertas.

3.  **Compilación**:
    ```bash
    npm run build
    ```
    Genera el instalador NSIS en `dist/`.

## Normas de Código

- **IPC**: Usar `ipcMain.handle` para operaciones asíncronas y `ipcMain.on` para eventos de una vía.
- **Rutas**: Siempre usar `path.join()` para compatibilidad multiplataforma. No hardcodear separadores `\` o `/`.
- **Async/Await**: Preferible sobre `.then/catch` para legibilidad, excepto en streams.
- **Logs**: Usar `console.log` solo para flujo normal. `console.error` para capturas `try/catch`.

## Gestión de Errores

El launcher debe ser robusto ante fallos de red.

- Implementar **retries** o **fallbacks** en descargas críticas.
- Validar existencia de archivos antes de operaciones de I/O.
- Notificar al usuario mediante IPC (`launch-error` o `launch-status`) en lugar de fallar silenciosamente.

## Traducciones

Si añades texto visible al usuario:

1. Crea una clave snake_case en `src/locales/en.json` (idioma base).
2. Replica la clave en `es.json` y otros idiomas.
3. No uses texto plano en `renderer.js` o `index.html`. Usa `t('clave')`.
