# Roadmap

Plan por fases completo en `BRIEF.md`. Acá van las notas pendientes y la deuda conocida.

## Estado

- [x] Fase 0: base (scaffold, loop de paso fijo, overlay de debug, Rapier en producción, deploy)
- [ ] Fase 1: paridad con el prototipo
- [ ] Fase 2: física y cámara
- [ ] Fase 3: modelos y animación
- [ ] Fase 4: pulido
- [ ] Fase 5: el Jarl Ahogado
- [ ] Fase 6: arquero draugr y gamepad

## Pendientes y deuda

- **Peso de Rapier.** `@dimforge/rapier3d-compat` genera un chunk de 4,3 MB (1,67 MB gzip) porque
  el WASM viaja en base64. El `.wasm` crudo pesa 1,17 MB gzip y se compila en streaming. Evaluar en
  la fase 2 pasar a `@dimforge/rapier3d` con el `.wasm` como asset aparte (cacheado como immutable).
  Hoy está fuera del bundle inicial gracias al import dinámico.
- **TypeScript 7.** Subir de `~6.0` cuando `typescript-eslint` lo soporte.
- **Chunk de Three.** El bundle inicial pesa 134 KB gzip en la fase 0. Vigilarlo cuando entren
  postprocessing y los loaders.
- **Shake de cámara.** El prototipo usa `Math.random()` por frame de render, así que tiembla distinto
  a 144 Hz que a 60 Hz. Se porta igual; opción a evaluar con Nacho: ruido suave a frecuencia fija
  con la misma amplitud.
