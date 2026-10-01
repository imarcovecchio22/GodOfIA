# Roadmap

Plan por fases completo en `BRIEF.md`. Acá van las notas pendientes y la deuda conocida.

## Estado

- [x] Fase 0: base (scaffold, loop de paso fijo, overlay de debug, Rapier en producción, deploy)
- [x] Fase 1: paridad con el prototipo (pendiente de la prueba lado a lado de Nacho)
- [ ] Fase 2: física y cámara
- [ ] Fase 3: modelos y animación
- [ ] Fase 4: pulido
- [ ] Fase 5: el Jarl Ahogado
- [ ] Fase 6: arquero draugr y gamepad

## Pendientes y deuda

- **Draw calls (fase 3).** Con los modelos de primitivas, ~5 enemigos en pantalla ya dan ~165
  draw calls contando la pasada de sombras (cada draugr son ~14 meshes con sus materiales para el
  destello). Igual que en el prototipo. Se resuelve con los modelos de la fase 3: meshes unidos,
  sombras solo en personajes cercanos.
- **Pipeline de color (fase 4).** Para igualar el look de r128 la gestión de color está apagada y
  la salida es lineal (`render/colorSetup.ts`), y las intensidades de luz están convertidas a mano
  (`data/arena.ts`). Al sumar postprocessing conviene pasar a sRGB + tone mapping y recalibrar.
- **Colisión (fase 2).** `physics/ArenaCollision.ts` es la colisión analítica del prototipo. La
  reemplazan los colliders de Rapier. Hoy Rapier solo se carga con `?debug` para verificar el WASM.
- **Mano del jugador.** El hacha sale y vuelve a `PlayerSim.handPos`, que escribe la vista en cada
  frame (como el prototipo, depende de la pose). Con los modelos de la fase 3 sale del hueso de la
  mano.
- **Tiempos con el timer descontado por paso** (muerte, congelamiento, invulnerabilidad) pueden caer
  un tick más tarde por redondeo; dentro del ±1 frame aceptado.
- **Peso de Rapier.** `@dimforge/rapier3d-compat` genera un chunk de 4,3 MB (1,67 MB gzip) porque
  el WASM viaja en base64. El `.wasm` crudo pesa 1,17 MB gzip y se compila en streaming. Evaluar en
  la fase 2 pasar a `@dimforge/rapier3d` con el `.wasm` como asset aparte (cacheado como immutable).
  Hoy está fuera del bundle inicial gracias al import dinámico.
- **TypeScript 7.** Subir de `~6.0` cuando `typescript-eslint` lo soporte.
- **Chunk de Three.** El bundle inicial pesa 166 KB gzip en la fase 1. Vigilarlo cuando entren
  postprocessing y los loaders.
- **Shake de cámara.** El prototipo usa `Math.random()` por frame de render, así que tiembla distinto
  a 144 Hz que a 60 Hz. Se porta igual; opción a evaluar con Nacho: ruido suave a frecuencia fija
  con la misma amplitud.
