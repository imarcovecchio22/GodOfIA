# Roadmap

Plan por fases completo en `BRIEF.md`. Acá van las notas pendientes y la deuda conocida.

## Estado

- [x] Fase 0: base (scaffold, loop de paso fijo, overlay de debug, Rapier en producción, deploy)
- [x] Fase 1: paridad con el prototipo (pendiente de la prueba lado a lado de Nacho)
- [x] Fase 2: física y cámara
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
- **Mano del jugador.** El hacha sale y vuelve a `PlayerSim.handPos`, que escribe la vista en cada
  frame (como el prototipo, depende de la pose). Con los modelos de la fase 3 sale del hueso de la
  mano.
- **Tiempos con el timer descontado por paso** (muerte, congelamiento, invulnerabilidad) pueden caer
  un tick más tarde por redondeo; dentro del ±1 frame aceptado.
- **Peso de Rapier.** `@dimforge/rapier3d-compat` genera un chunk de 4,3 MB (1,67 MB gzip) porque
  el WASM viaja en base64; el `.wasm` crudo pesaría 1,17 MB gzip. Se mantiene la versión compat
  (la que pide el brief, y la única que corre en los tests de Node sin plugins): son ~0,7 s extra
  en una conexión de 20 Mbps solo la primera vez, porque `/assets/*` queda cacheado como
  immutable. Revisar en la fase 4 junto con la pantalla de carga si el tiempo total no da.
- **Rocas y hacha.** El hacha solo se clava en columnas y antorchas (como en el prototipo); en el
  borde se clava en el aire a radio + 3. Opción a evaluar: que también se clave en las rocas.
- **TypeScript 7.** Subir de `~6.0` cuando `typescript-eslint` lo soporte.
- **Chunk de Three.** El bundle inicial pesa 166 KB gzip en la fase 1. Vigilarlo cuando entren
  postprocessing y los loaders.
- **Shake de cámara.** El prototipo usa `Math.random()` por frame de render, así que tiembla distinto
  a 144 Hz que a 60 Hz. Se porta igual; opción a evaluar con Nacho: ruido suave a frecuencia fija
  con la misma amplitud.
