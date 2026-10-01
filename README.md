# Furia del Norte

Hack and slash nórdico en tercera persona que corre en el navegador. Un guerrero pelea contra
oleadas de draugr en una arena circular, con un hacha que puede lanzar y llamar de vuelta.

Three.js + Rapier + TypeScript, empaquetado con Vite y desplegado en Vercel.

## Requisitos

- Node 22.12 o superior (ver `.nvmrc`)
- npm

## Cómo correrlo

```sh
npm install
npm run dev        # servidor de desarrollo en http://localhost:5173
```

| Script            | Qué hace                                        |
| ----------------- | ----------------------------------------------- |
| `npm run dev`     | Servidor de desarrollo con recarga en caliente  |
| `npm run build`   | Chequeo de tipos y build de producción a `dist` |
| `npm run preview` | Sirve el build de producción localmente         |
| `npm run lint`    | ESLint + chequeo de formato de Prettier         |
| `npm run format`  | Formatea todo con Prettier                      |
| `npm test`        | Tests con Vitest                                |
| `npm run check`   | lint + test + build (lo mismo que corre el CI)  |
| `npm run assets`  | Regenera los modelos de `src/assets/models/`    |
| `npm run audio`   | Regenera los sonidos (requiere `ffmpeg`)        |

## Assets

Los modelos son packs CC0 de KayKit (ver `CREDITS.md`). `npm run assets` los descarga (con caché
en `.asset-cache/`), une cada personaje en un solo mesh, se queda con las animaciones que usa el
juego y comprime con Meshopt. Los GLB generados se commitean, así el deploy no depende de la
descarga. `node scripts/analyze-clips.mjs` mide el cuadro de contacto de cada golpe.

## Ajustes

Desde el menú o la pausa: sensibilidad del mouse, invertir el eje Y, volumen general, de música y
de efectos, y calidad gráfica (baja, media, alta). Se guardan en el navegador. `M` silencia todo.

## Debug

En desarrollo se muestra un overlay con FPS, tiempo de frame, draw calls y estado de los sistemas.
En producción se activa agregando `?debug` a la URL.

En desarrollo también aparece un panel de tuning (lil-gui, arriba a la derecha, cerrado por
defecto) que edita en vivo los valores de `src/data/`. Los cambios se pierden al recargar: para
dejarlos fijos hay que pasarlos al archivo correspondiente.

## Despliegue

- El repo está conectado a Vercel con el preset de Vite (`npm run build`, salida `dist`).
- Cada push a `main` despliega producción; cada PR genera un preview deployment.
- `vercel.json` define cache inmutable para `/assets/*` y headers de seguridad (incluida una CSP
  con `'wasm-unsafe-eval'`, necesaria para Rapier).
- GitHub Actions corre lint, test y build en cada PR (`.github/workflows/ci.yml`).

## Controles

Pide mouse y teclado.

| Tecla           | Acción                               |
| --------------- | ------------------------------------ |
| WASD            | Moverse (con Shift corrés)           |
| Mouse           | Cámara y puntería                    |
| Click izquierdo | Combo de tres hachazos               |
| Click derecho   | Golpe pesado contra el piso          |
| Q               | Tirar el hacha (congela al que toca) |
| Q o E           | Llamar al hacha de vuelta            |
| Espacio         | Rodar (invulnerable mientras rodás)  |
| Esc             | Pausa                                |
| M               | Silenciar                            |

## Estructura

```
src/
  Game.ts    Raíz de composición: modos (menú, juego, pausa, game over) y pointer lock
  core/      Loop, Time (paso fijo, hit-stop, timeScale), Input, EventBus, Rng
  game/      World (estado de la simulación), oleadas, estadísticas, eventos
  entities/  Jugador, hacha, enemigos y orbes (simulación pura, testeable)
  combat/    HitSystem y daño
  ai/        FSM genérica
  physics/   Rapier (carga diferida): escenario, character controller y consultas
  render/    Renderer, CameraRig, vistas de jugador/hacha/enemigos/orbes, overlay de debug
  fx/        Partículas instanciadas, anillos y el director de FX
  audio/     AudioManager y banco de sonidos sintetizados
  ui/        HUD, récord y aviso de dispositivo
  scenes/    Escenario de la arena
  data/      Todos los números de gameplay
  dev/       Panel de tuning (solo desarrollo)
reference/   Prototipo original (fuente de verdad del game feel)
```

Las carpetas se van creando a medida que tienen código. El plan por fases está en `BRIEF.md` y lo
pendiente en `ROADMAP.md`.
