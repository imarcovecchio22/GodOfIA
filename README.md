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

## Debug

En desarrollo se muestra un overlay con FPS, tiempo de frame, draw calls y estado de los sistemas.
En producción se activa agregando `?debug` a la URL.

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

> Los controles se implementan en la fase 1. En la fase 0 solo hay una escena de prueba.

## Estructura

```
src/
  core/      Loop, Time (paso fijo, hit-stop, timeScale), Input, EventBus
  render/    Renderer, PostFX, CameraRig, overlay de debug
  physics/   Rapier (carga diferida), colliders y queries
  combat/    Ataques data-driven, HitSystem, daño
  entities/  Jugador, enemigos, hacha
  ai/        FSM y comportamientos
  fx/        Partículas con pooling
  audio/     AudioManager y banco de sonidos
  ui/        HUD y menús
  data/      Todos los números de gameplay
  scenes/    Escenas
reference/   Prototipo original (fuente de verdad del game feel)
```

Las carpetas se van creando a medida que tienen código. El plan por fases está en `BRIEF.md` y lo
pendiente en `ROADMAP.md`.
