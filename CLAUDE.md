# Convenciones del proyecto

Furia del Norte: hack and slash 3D para web. Leé `BRIEF.md` (alcance, fases, especificación) antes
de trabajar. `reference/prototype.html` es la fuente de verdad del game feel: sus valores de timing,
daño, velocidades, hit-stop y shake se portan tal cual salvo que Nacho apruebe un cambio.

## Flujo

- Una fase por vez y solo con aprobación de Nacho. Una rama por fase, commits chicos con mensajes
  convencionales (`feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`), PR a `main` para que
  Vercel genere el preview.
- Antes de cada commit: `npm run check` en verde (lint + test + build).
- Nada de `TODO` en el código sin una entrada en `ROADMAP.md` o un issue.
- Si algo del brief choca con una buena práctica, avisar y proponer una alternativa.
- Comunicación con Nacho en español rioplatense.

## Código

- TypeScript `strict` + `noUncheckedIndexedAccess`. Sin `any`.
- Todos los números de gameplay viven en `src/data/`, tipados. Nada hardcodeado en la lógica.
- Simulación con paso fijo (60 Hz, `core/Time`), render interpolado con `alpha`.
  - La lógica de juego corre en `update(step)`; nunca usa el delta del frame.
  - El hit-stop congela la simulación, no el render, la cámara ni el HUD.
  - Cámara, HUD y ambiente usan el `realDt` que devuelve el loop.
- Separar simulación (estado puro, testeable en Node) de vista (objetos de Three que leen el
  estado interpolado).
- Máquinas de estado explícitas para jugador, enemigos, hacha y jefe, con tests.
- Ataques data-driven: agregar un ataque no requiere tocar la lógica.
- Cero allocations en el loop caliente: vectores temporales reutilizados y pools.
- Composición antes que herencia. Sistemas desacoplados por el EventBus tipado.
- RNG con semilla inyectado en la lógica (nada de `Math.random` directo en la simulación).
- Rapier se carga con import dinámico (`physics/rapier.ts`) para no inflar el bundle inicial.
- Herramientas de desarrollo (lil-gui, atajos) detrás de `import.meta.env.DEV` y con import
  dinámico.

## Decisiones tomadas

- TypeScript fijado en `~6.0`: `typescript-eslint` todavía no soporta TS 7.
- Se portan tal cual estas conductas del prototipo, aunque el brief no las mencione: el 3er golpe
  del combo rompe la súper armadura del bruto, se puede cancelar del combo al pesado, y un click
  durante el 3er golpe se pierde.
- El presupuesto de 150 draw calls incluye la pasada de sombras.
- Fuente Cinzel self-hosteada con `@fontsource` (OFL), sin CDN.

## Propiedad intelectual

Todo es original. Nada de nombres, personajes, modelos, sonidos ni assets de otras franquicias.
Cada asset externo va a `CREDITS.md` con su licencia (CC0 preferido).

## Presupuestos

60 fps en GPU integrada con 15 enemigos, menos de 150 draw calls, assets por debajo de 20 MB,
bundle JS inicial por debajo de 1 MB gzip.
