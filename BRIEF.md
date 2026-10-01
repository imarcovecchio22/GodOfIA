# Furia del Norte: brief de desarrollo

## Tu rol

Sos un game developer senior especializado en juegos 3D para web (Three.js, TypeScript, WebGL) con criterio de producción: arquitectura limpia, rendimiento medido y game feel cuidado. Vas a llevar un prototipo jugable a un vertical slice desplegado en Vercel.

Trabajás conmigo (Nacho, dev con experiencia en backend y legacy, cómodo con TypeScript). Antes de escribir código, leé este brief completo y el prototipo de referencia, y proponé un plan. No arranques una fase sin que yo la apruebe.

## Contexto y fuente de verdad

En `reference/prototype.html` está el prototipo original: un solo HTML con Three.js r128, primitivas geométricas y todo el combate funcionando. **Es la fuente de verdad del game feel.** Los valores de timing, daño, velocidades, hit-stop y temblor de cámara que están ahí fueron probados y se sienten bien. Portalos tal cual; si querés cambiar alguno, proponelo y justificalo.

El juego es un hack and slash en tercera persona: un guerrero nórdico original pelea contra oleadas de draugr en una arena circular, con un hacha que puede lanzar y llamar de vuelta.

**Propiedad intelectual:** el juego es 100% original. No uses nombres, personajes, modelos, sonidos ni assets de God of War ni de ninguna otra franquicia. El género y las mecánicas genéricas (combos, hacha arrojadiza, esquive) están bien; la identidad visual y los nombres son nuestros.

## Objetivo del vertical slice

Un juego que se abre desde una URL de Vercel, carga en menos de 5 segundos con buena conexión, corre a 60 fps en una notebook con GPU integrada y se siente como el prototipo pero con modelos animados, mejor iluminación, audio real, una UI prolija y un jefe cada 5 oleadas que sea lo que todos recuerden del juego.

Fuera de alcance por ahora: multijugador, móviles y táctil (mostrar un aviso de que pide mouse y teclado), guardado en servidor, cuentas de usuario.

## Stack

- **Vite + TypeScript** en modo `strict`. Sin frameworks de UI: el HUD es DOM liviano manejado por una clase.
- **Three.js** (última versión estable, por npm, módulos ES). Nada de UMD ni CDN.
- **Rapier** (`@dimforge/rapier3d-compat`) para colliders del escenario y el character controller cinemático del jugador y los enemigos. La detección de golpes sigue siendo propia (consultas de solapamiento por arco y radio), igual que en el prototipo.
- **postprocessing** (pmndrs) para bloom suave, viñeta y corrección de color.
- **lil-gui** como panel de tuning, solo en desarrollo (`import.meta.env.DEV`).
- **Vitest** para la lógica pura (máquinas de estado, daño, oleadas). **ESLint + Prettier.**
- Audio con Web Audio API propia. Se puede mantener el sintetizado del prototipo como fallback mientras no haya samples.

Si creés que alguna pieza sobra o falta, decímelo en el plan antes de instalarla.

## Arquitectura

Estructura sugerida (ajustala si tenés una razón concreta):

```
src/
  core/       Game loop, Time (timeScale y hit-stop), Input, EventBus, AssetLoader
  render/     Renderer, PostFX, CameraRig (sobre el hombro, shake por trauma)
  physics/    Mundo Rapier, helpers de colisión y queries
  combat/     Datos de ataques, HitSystem, Damage, estados de golpe
  entities/   Player, Enemy base, Draugr, Brute, Axe (proyectil con estados)
  ai/         FSM genérica y comportamientos de enemigos
  fx/         Partículas con pooling (InstancedMesh), anillos de impacto, trails
  audio/      AudioManager, banco de sonidos
  ui/         HUD, menús, pausa, game over, ajustes
  data/       Tuning centralizado en TypeScript tipado (un solo lugar para los números)
  scenes/     Arena
```

Principios:

- **Simulación con paso fijo** (60 Hz) y render interpolado. El hit-stop congela la simulación, no el render ni la cámara.
- **Ataques data-driven:** cada ataque es un objeto con ventanas de daño, alcance, arco, empuje, hit-stop y shake. Agregar un ataque nuevo no debería requerir tocar la lógica.
- **Máquinas de estado explícitas** para jugador, enemigos y hacha (`hand`, `flying`, `stuck`, `ground`, `recall`), con tests.
- **Cero allocations en el loop caliente:** vectores temporales reutilizados, pools para partículas, proyectiles y enemigos.
- Composición antes que herencia profunda. Nada de un ECS completo salvo que lo justifiques.
- Comunicación entre sistemas por eventos (`enemy:hit`, `axe:caught`, `wave:start`) para que audio, FX y HUD no estén acoplados al combate.

## Especificación de gameplay (valores del prototipo)

**Movimiento y cámara.** Caminar a 6 u/s, correr con Shift a 9. Cámara sobre el hombro derecho (offset lateral 0,75, altura de mira 1,75, distancia 5,4, pitch entre −0,15 y 1,1 rad), seguimiento suavizado. Agregar colisión de cámara con el escenario.

**Combo liviano (click izquierdo).** Tres golpes encadenables con buffer de input:

| Golpe              | Ventana activa (s) | Duración (s) | Daño | Alcance | Empuje | Hit-stop (s) | Shake |
| ------------------ | ------------------ | ------------ | ---- | ------- | ------ | ------------ | ----- |
| 1 diagonal         | 0,10 a 0,20        | 0,38         | 14   | 2,5     | 5      | 0,05         | 0,22  |
| 2 revés horizontal | 0,10 a 0,20        | 0,38         | 14   | 2,5     | 5      | 0,05         | 0,22  |
| 3 vertical         | 0,18 a 0,30        | 0,56         | 24   | 2,8     | 12     | 0,08         | 0,42  |

El golpe siguiente arranca 0,04 s después de cerrar la ventana activa si hubo click durante el golpe. El jugador se orienta hacia la cámara al atacar y avanza un poco durante la ventana activa.

**Golpe pesado (click derecho).** Impacto a los 0,43 s, duración total 0,85 s, daño 34 en área de radio 3,3 centrada 1,3 u adelante, empuje 14, hit-stop 0,1, shake 0,7, onda expansiva visual. Rompe la súper armadura de los brutos.

**Hacha arrojadiza.** Q lanza hacia donde apunta la mira (velocidad 32, gravedad 4). Al tocar un enemigo hace 28 de daño, queda clavada y lo congela (2,8 s, brutos 1,5 s). Se clava en el piso, columnas o bordes. Q o E la llaman: vuelve en curva Bézier (duración distancia/26, entre 0,25 y 0,95 s), hace 16 de daño a todo lo que cruza y al atraparla hay hit-stop 0,035 y shake 0,28. Sin hacha, los golpes hacen la mitad de daño con 72% del alcance.

**Esquive (Espacio).** Rodada de 0,38 s con invulnerabilidad completa, enfriamiento 0,55 s, puede cancelar la recuperación de cualquier ataque.

**Jugador.** 100 de vida, 0,55 s de invulnerabilidad tras recibir daño, viñeta roja al ser golpeado y pulso con menos de 30 de vida.

**Enemigos.**

- _Draugr:_ vida 38 + 5 por oleada, velocidad 2,6 + 0,13 por oleada (tope +1,6), daño 10, carga de ataque 0,55 s con ojos en rojo como aviso. Se aturde con cualquier golpe.
- _Bruto_ (desde la oleada 3): escala 1,45, vida 140 + 12 por oleada, velocidad 2,1, daño 22, carga 0,8 s, súper armadura contra golpes livianos.
- Aparecen saliendo del suelo durante 1,1 s, nunca a menos de 8 u del jugador. Se separan entre sí para no apilarse.

**Oleadas.** Cantidad 3 + 2 × oleada, brutos (oleada − 1) / 2 redondeado hacia abajo, máximo de vivos simultáneos 4 + oleada. Al limpiar una oleada: cartel, +20 de vida y 3 s de respiro. **Cada 5 oleadas (5, 10, 15…) la oleada es de jefe** (ver sección siguiente); la numeración y el escalado de las oleadas normales siguen como si nada.

**Orbes de vida.** Los suelta el 28% de los draugr y el 90% de los brutos. Curan 18 y duran 20 s.

**Feedback.** Hit-stop en cada impacto, temblor por trauma (decae 1,6/s, desplazamiento proporcional a trauma²), destello blanco en el enemigo golpeado, partículas de icor y chispas, contador de combo que se reinicia a los 2,5 s sin golpes.

## Jefe: el Jarl Ahogado

Es el momento más memorable del juego y tiene que sentirse como tal. Un rey draugr gigante (escala 3,2 respecto del jugador) que pasó siglos bajo un lago congelado: corona de hierro oxidado, barba de algas y hielo, fuego azul en los ojos y el pecho, y un hacha a dos manos con una cadena de ancla enrollada en el brazo. El diseño visual es nuestro; no tiene que parecerse a ningún jefe conocido.

**Regla de oro: es difícil pero justo.** Todo ataque se anuncia con al menos 0,6 s de aviso, combinando tres señales: pose de carga, indicador en el piso (decal rojo con la forma exacta del área) y un sonido propio. Nunca hay dos ataques imposibles de esquivar a la vez. Si el jugador muere, tiene que entender por qué.

**Entrada.** Cinemática de 3 s: barras negras arriba y abajo, la cámara se aleja, el círculo de runas del centro se agrieta y el Jarl sale del piso rompiéndolo. Rugido, cartel con su nombre y cambio de música. Desde la segunda vez se puede saltear con cualquier tecla.

**Vida y quiebre.** Barra de vida grande abajo de la pantalla con su nombre. Vida 1200, más 400 por cada aparición siguiente (oleadas 10, 15…). Tiene súper armadura siempre, pero acumula **quiebre**: cada golpe llena un medidor oculto (los pesados, el tercer golpe del combo y el hacha llenan más). Al romperse, cae de rodillas 3 s y recibe 50% más de daño. El hacha no lo congela: lo ralentiza 40% durante 1,5 s y suma quiebre.

**Fase 1 (100% a 60% de vida)**

- _Tajo amplio:_ barrido horizontal en arco de 160°, alcance 5, carga 0,9 s, daño 25. Se esquiva rodando a través o alejándose.
- _Martillazo:_ golpe vertical sobre la posición del jugador, carga 1,1 s, área de radio 3, daño 35. Deja una grieta de hielo que quema (5 por segundo) durante 3 s.
- _Embestida:_ marca una línea en el piso y carga 12 u en línea recta, carga 0,8 s, daño 30. Si choca contra una columna queda aturdido 2 s: es la recompensa por usar el escenario.

**Transición a fase 2 (60%).** Ruge, es invulnerable 2 s y suelta una onda que empuja al jugador. El fuego azul se intensifica.

**Fase 2 (60% a 30%)**

- Mantiene los ataques de la fase 1 con 15% menos de carga.
- _Llamado de los ahogados:_ invoca 4 draugr del piso, como máximo cada 25 s.
- _Garfio de cadena:_ revolea la cadena y la lanza en línea recta (carga 0,7 s). Si engancha, tira al jugador hacia él y encadena un tajo inmediato. Se esquiva con la rodada.
- _Furia triple:_ combo de tres hachazos con cargas de 0,6, 0,5 y 0,8 s.

**Fase 3 (menos de 30%)**

- El borde de la arena se congela: fuera de un radio de 16 u hay daño de frío por segundo. La pelea se vuelve más cerrada.
- Todos los ataques 20% más rápidos.
- _Juicio del lago_, cada 20 s: salta fuera de cámara y cae en el centro generando tres anillos de onda expansiva, uno tras otro, que hay que pasar rodando en el momento justo.

**Muerte.** Cámara lenta (escala de tiempo 0,3 durante 1,5 s), explosión de hielo y fuego azul, el cuerpo se desarma y se hunde. Cura toda la vida, suelta tres orbes y aparece el cartel de victoria antes de la oleada siguiente.

**Implementación.**

- El moveset es data-driven, igual que los ataques del jugador: cada ataque define fase mínima, rango de distancia preferido, peso, enfriamiento, carga, ventanas de daño y forma del área (arco, círculo, línea o anillo).
- Selección de ataque por peso según distancia y fase, sin repetir el mismo ataque más de dos veces seguidas.
- Un sistema de **decals de aviso** reutilizable que después puedan usar otros enemigos.
- **Fijación de objetivo** (click del medio o Tab): la cámara mantiene al objetivo en cuadro. Funciona también con enemigos comunes.
- Primero se arma con primitivas (greybox) hasta que la pelea se sienta bien, y recién después se le pone modelo y animaciones. Puede partir de un esqueleto CC0 escalado, con corona, cadena y efectos emisivos propios.
- Tests de las transiciones de fase, del medidor de quiebre y de la selección de ataques.
- La pelea con el jefe y 4 draugr invocados tiene que mantener los 60 fps.
- Panel lil-gui propio para tunear el jefe en vivo y un atajo de desarrollo para saltar directo a la oleada 5.

## Mejoras sobre el prototipo

En orden de prioridad:

1. **Modelos y animaciones reales.** Usar packs con licencia CC0, como KayKit (Adventurers para el protagonista, Skeletons para los draugr) o Quaternius. Las ventanas de daño pasan a estar definidas por eventos de animación o por tiempo normalizado del clip, manteniendo los timings de la tabla. Blending entre animaciones con `AnimationMixer`. Registrar cada asset y su licencia en `CREDITS.md`.
2. **Escenario.** Arena con colliders de Rapier, niebla, antorchas con luces que titilan, brasas flotando y runas emisivas. Una sola luz direccional con sombras; el resto sin sombras.
3. **Audio.** Samples CC0 para golpes, impactos, pasos, gruñidos y música de ambiente, con variación de pitch y volumen por reproducción. Silenciar con M y slider de volumen.
4. **UI.** Menú principal, pausa, ajustes (sensibilidad del mouse, invertir Y, volumen, calidad gráfica), game over con récord en `localStorage` y pantalla de carga con progreso real.
5. **Contenido nuevo.** Un tercer enemigo a distancia (arquero draugr que telegrafía el disparo) y soporte de gamepad.

## Presupuestos de rendimiento

- 60 fps estables en GPU integrada con 15 enemigos en pantalla.
- Menos de 150 draw calls. Instancing para rocas, árboles y partículas.
- Assets totales por debajo de 20 MB: modelos en GLB comprimidos con Draco o Meshopt (usar `gltf-transform`), texturas en KTX2 cuando convenga.
- Bundle JS inicial por debajo de 1 MB gzip. Audio cargado en diferido.
- Incluir un overlay de FPS y draw calls en desarrollo.

## Deploy en Vercel

- Repo en GitHub conectado a Vercel con preset de Vite (`npm run build`, salida `dist`).
- Deploy desde el día uno: la fase 0 termina con un "hola mundo" en una URL pública.
- Preview deployments automáticos por cada PR.
- `vercel.json` con cache inmutable para `/assets/*` y headers de seguridad básicos.
- Verificar que el WASM de Rapier funcione en producción (la versión `-compat` lo trae embebido).

## Plan por fases

Cada fase termina con `build`, `lint` y `test` en verde, commit con mensaje convencional y deploy de preview que yo pueda probar.

**Fase 0, base.** Scaffold de Vite + TS, ESLint, Prettier, Vitest, estructura de carpetas, escena vacía con loop de paso fijo y deploy en Vercel.
_Aceptación:_ URL pública con un cubo girando y overlay de FPS.

**Fase 1, paridad con el prototipo.** Portar todo el combate con primitivas, con la arquitectura nueva y los valores de la tabla. Panel lil-gui conectado al tuning.
_Aceptación:_ jugándolo al lado del prototipo, se siente igual. Tests de las FSM del jugador, enemigos y hacha.

**Fase 2, física y cámara.** Rapier para escenario y character controllers, colisión de cámara.
_Aceptación:_ nada atraviesa columnas ni bordes, la cámara no se mete en la geometría.

**Fase 3, modelos y animación.** Assets CC0, animaciones con blending, golpes sincronizados con los clips.
_Aceptación:_ timings de la tabla respetados (±1 frame) y presupuestos cumplidos.

**Fase 4, pulido.** Post-procesado, audio real, UI completa, pantalla de carga.
_Aceptación:_ se puede compartir el link con alguien que nunca lo vio y entiende cómo jugar sin explicación.

**Fase 5, el Jarl Ahogado.** Fijación de objetivo, decals de aviso, el jefe en greybox con sus tres fases y después con modelo, animaciones, cinemática de entrada y muerte.
_Aceptación:_ alguien que juega por primera vez pierde contra el jefe al menos una vez, pero en cada intento llega más lejos y sabe qué hizo mal.

**Fase 6, contenido.** Arquero draugr y gamepad.

## Cómo trabajamos

- Empezá respondiendo con: tu lectura del prototipo, el plan de la fase 0 y 1 en detalle, las dudas que tengas y cualquier cambio que propongas al stack o la arquitectura.
- Commits chicos y frecuentes. No dejes `TODO` sin un issue o una nota en `ROADMAP.md`.
- Todos los números de gameplay viven en `src/data/`. Nada hardcodeado en la lógica.
- Si algo del brief choca con una buena práctica, avisame y proponé una alternativa en vez de seguirlo a ciegas.
- Mantené un `README.md` con cómo correrlo, cómo desplegar y los controles, y un `CLAUDE.md` con las convenciones del proyecto para próximas sesiones.
