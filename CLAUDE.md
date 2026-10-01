# Convenciones del proyecto

Furia del Norte: hack and slash 3D para web. Leé `BRIEF.md` (alcance, fases, especificación) antes
de trabajar. `reference/prototype.html` es la fuente de verdad del game feel: sus valores de timing,
daño, velocidades, hit-stop y shake se portan tal cual salvo que Nacho apruebe un cambio.

## Flujo

- Una fase por vez y solo con aprobación de Nacho. Una rama por fase, commits chicos con mensajes
  convencionales (`feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`), PR a `main` para que
  Vercel genere el preview.
- Antes de cada commit: `npm run check` en verde (lint + test + build). Ojo con encadenar
  `npm run check | grep ...`: el pipe esconde el código de salida; chequear `$?` del check.
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

## Arquitectura (fase 1 en adelante)

- `game/World` es el estado completo de la simulación: jugador, hacha, enemigos, orbes, oleadas,
  estadísticas y eventos. No toca DOM ni WebGL; los tests lo crean con `game/testUtils.ts`.
- La simulación solo recibe de la vista la cámara (`camYaw`, `aimOrigin`, `aimDir`) y
  `player.handPos`. El hit-stop y el temblor salen por la interfaz `Feedback`.
- Las vistas (`render/`, `fx/`, `ui/`, `audio/`) leen el estado o escuchan eventos; nunca modifican
  la simulación.
- Entidades con `prevPos`/`prevFacing` (snapshot al inicio de cada paso) para interpolar el render.
- Física (fase 2): `physics/PhysicsWorld` arma el escenario estático de Rapier y nunca simula
  cuerpos; se usa para el character controller y consultas. Grupos en `physics/groups.ts`: `WALL`
  (borde invisible, solo personajes), `SOLID` (columnas y antorchas: personajes, cámara, hacha),
  `DECOR` (rocas: solo cámara). Si se agregan colliders estáticos hay que llamar `world.step()`
  después, o las consultas no los ven.
- Cada personaje calcula su desplazamiento libremente y al final del paso lo resuelve
  `collision.moveCharacter(body, prevPos, pos)`. En enemigos, la separación va antes de resolver.
- Modelos (fase 3): `npm run assets` genera `src/assets/models/*.glb`. Cada personaje es un solo
  mesh con skinning (más los ojos de los esqueletos y el hacha del jugador, aparte). Los clips de
  acción se manejan con `Animator.drive()` y `warpTime()`: el cuadro de contacto del clip
  (`data/models.ts`, medido con `scripts/analyze-clips.mjs`) cae en el impacto de la tabla. Nunca
  ajustar timings de gameplay para que encaje una animación: se ajusta el `contact`.
- Three saca los puntos de los nombres de nodo: `handslot.r` se busca como `handslotr`.
- Imagen (fase 4): pipeline sRGB con post-procesado (`render/PostFX.ts`: bloom, AgX, color,
  viñeta). Luces calibradas a ojo en `data/arena.ts`; lo emisivo usa colores HDR (`GLOW` en
  `data/graphics.ts`) para que lo agarre el bloom. `renderer.info` se reinicia a mano por frame.
- Audio (fase 4): `npm run audio` genera `src/assets/audio/*.mp3` (requiere ffmpeg). Se cargan en
  diferido con el primer click; hasta entonces suena el sintetizado. Mezcla y bancos en
  `data/audio.ts`; los eventos se traducen en `audio/AudioDirector.ts`.
- Ajustes del jugador en `ui/settings.ts` (localStorage `furia-settings`); ayudas de una sola vez en
  `ui/Tips.ts` (`furia-tips`).
- Con `?debug`, `window.__furia` expone el juego (para la consola y las pruebas en navegador).
- Los tests inicializan Rapier en `src/test/setup.ts`; `makeWorld()` arma un `PhysicsWorld` real.
- Tests de timing: los valores de la tabla se verifican en ticks a 60 Hz.

## Decisiones tomadas

- TypeScript fijado en `~6.0`: `typescript-eslint` todavía no soporta TS 7.
- Se portan tal cual estas conductas del prototipo, aunque el brief no las mencione: el 3er golpe
  del combo rompe la súper armadura del bruto, se puede cancelar del combo al pesado, y un click
  durante el 3er golpe se pierde.
- El presupuesto de 150 draw calls incluye la pasada de sombras.
- Fuente Cinzel self-hosteada con `@fontsource` (OFL), sin CDN.
- Protagonista: Bárbaro de KayKit **con el gorro de oso y sin capa**. Sin gorro (pelado, barba, hacha
  de hielo que vuelve) se parecía demasiado al protagonista de God of War; no volver a esa variante.

## Propiedad intelectual

Todo es original. Nada de nombres, personajes, modelos, sonidos ni assets de otras franquicias.
Cada asset externo va a `CREDITS.md` con su licencia (CC0 preferido).

## Presupuestos

60 fps en GPU integrada con 15 enemigos, menos de 150 draw calls, assets por debajo de 20 MB,
bundle JS inicial por debajo de 1 MB gzip.
