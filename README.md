# Battly Launcher for Hytale

Lanzador de código abierto para Hytale con soporte de mods, gestión de parches cliente/servidor y UX simplificada.

![Estado](https://img.shields.io/badge/Estado-Beta-blue) ![Plataforma](https://img.shields.io/badge/Plataforma-Windows-lightgrey)

---
## Resumen
Battly automatiza la descarga del cliente, aplica parches para conectarse a servidores comunitarios, instala mods y muestra noticias oficiales. Usa Electron: proceso **Main** para orquestación y proceso **Renderer** para la UI.

### Características clave
- Parcheo binario automático del cliente (dominios y parches `.pwr`) con fallback de mirrors.
- Patcher para servidores (`HytaleServer.jar`) compatible con dominios personalizados.
- Gestor de mods con búsqueda e instalación en un clic (CurseForge).
- Noticias in-app desde el feed oficial.
- Multilenguaje (ES/EN/FR, ampliable vía `src/locales/`).
- Telemetría ligera con Aptabase (sin `systeminformation` pesado).

### Stack
- **Runtime**: Electron + Node.js 18+
- **UI**: HTML/CSS/JS (renderer), i18n con JSON.
- **Herramientas**: Butler (itch.io) para aplicar parches `.pwr`, AdmZip para JARs.

---
## Requisitos
- Windows 10/11 x64
- Node.js 18 o superior
- Conexión a Internet (descarga inicial de assets/parches)

---
## Instalación (desarrollo)
```bash
git clone https://github.com/1ly4s0/Battly4Hytale.git
cd Battly4Hytale
npm install
npm start
```

Scripts útiles:
- `npm start` — modo desarrollo.
- `npm run build` — genera instalador en `dist/`.

---
## Estructura rápida
```
src/
├─ main.js, renderer.js
├─ index.html, style.css, splash.html
├─ analytics.js
├─ services/ (game, patcher, serverPatcher, mods, news, updater, config, utils)
├─ locales/        # traducciones
├─ assets/, images/
docs/ARCHITECTURE.md
```

Más detalle en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---
## Uso básico
1) Ejecuta `npm start`.  
2) Introduce tu nombre de jugador y elige preferencia de GPU si aplica.  
3) Pulsa **Play**: el launcher descargará parches, aplicará modificaciones y lanzará Hytale.  
4) Para mods, abre la pestaña Mods, busca e instala.  
5) El botón de reparación borra la instalación y fuerza reinstalación limpia.

---
## Solución de problemas
- **403 al descargar parches**: asegúrate de usar la versión más reciente; las peticiones llevan `User-Agent` de navegador para evitar bloqueos de CDN.  
- **El juego no inicia**: usa la opción “Reparar juego” o borra `%AppData%/Hytale/install/release`.  
- **GPU no detectada**: la detección usa `wmic`; si no está disponible, selecciona GPU manualmente o deja en automático.  
- **Noticias vacías**: el feed puede cambiar formato; el launcher muestra mensaje de error pero el resto funciona.

---
## Contribuir
- Issues y PRs son bienvenidos.  
- Sigue las convenciones de lint/estilo del proyecto.  
- Para nuevas funciones, documenta en `docs/ARCHITECTURE.md` y añade claves i18n si corresponde.

---
## Licencia
ISC.  
Hytale es una marca registrada de Hypixel Studios; este launcher no está afiliado.
