import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { ARENA, pillarPositions, rockLayout, torchPositions } from '../data/arena';
import { CAMERA } from '../data/camera';
import { BRUTE, DRAUGR } from '../data/enemies';
import { PLAYER } from '../data/player';
import { input, makeWorld, placeEnemy, tick } from '../game/testUtils';
import type { World } from '../game/World';
import { CameraRig } from '../render/CameraRig';

const pillar = pillarPositions()[0];
if (!pillar) throw new Error('sin columnas');
const EPS = 0.02;

const distXZ = (a: Vector3, x: number, z: number): number => Math.hypot(a.x - x, a.z - z);

/** Yaw de cámara para que "adelante" (W) apunte en la dirección (dx, dz). */
function faceCamera(world: World, dx: number, dz: number): void {
  world.camYaw = Math.atan2(-dx, -dz);
}

describe('Colisión del jugador', () => {
  it('no atraviesa una columna caminando ni corriendo hacia ella', () => {
    const { world } = makeWorld();
    const dir = new Vector3(pillar.x, 0, pillar.z).normalize();
    world.player.pos.copy(dir).multiplyScalar(pillar.r + 3);
    faceCamera(world, pillar.x, pillar.z);
    let minDist = Infinity;
    for (let i = 0; i < 240; i++) {
      tick(world, 1, input({ moveZ: 1, sprint: i > 120 }));
      minDist = Math.min(minDist, distXZ(world.player.pos, pillar.x, pillar.z));
    }
    expect(minDist).toBeGreaterThanOrEqual(pillar.r + PLAYER.radius - EPS);
  });

  it('no atraviesa una columna rodando ni empujado', () => {
    const { world } = makeWorld();
    const dir = new Vector3(pillar.x, 0, pillar.z).normalize();
    world.player.pos.copy(dir).multiplyScalar(pillar.r + 1.2);
    faceCamera(world, pillar.x, pillar.z);
    tick(world, 1, input({ moveZ: 1, dodge: true }));
    world.player.kb.copy(dir).multiplyScalar(40);
    let minDist = Infinity;
    for (let i = 0; i < 60; i++) {
      tick(world, 1, input({ moveZ: 1 }));
      minDist = Math.min(minDist, distXZ(world.player.pos, pillar.x, pillar.z));
    }
    expect(minDist).toBeGreaterThanOrEqual(pillar.r + PLAYER.radius - EPS);
  });

  it('desliza contra la columna en vez de quedar trabado', () => {
    const { world } = makeWorld();
    // Arranca en diagonal a la columna: el empuje lateral lo hace rodearla.
    world.player.pos.set(pillar.x - 3, 0, pillar.z - 0.4);
    faceCamera(world, 1, 0);
    tick(world, 90, input({ moveZ: 1 }));
    expect(world.player.pos.x).toBeGreaterThan(pillar.x);
  });

  it('no sale de la arena', () => {
    const { world } = makeWorld();
    const limit = ARENA.radius - ARENA.edgePadding - PLAYER.radius;
    for (const a of [0, 1, 2.2, 3.9, 5.1]) {
      world.player.pos.set(0, 0, 0);
      faceCamera(world, Math.sin(a), Math.cos(a));
      tick(world, 300, input({ moveZ: 1, sprint: true }));
      expect(Math.hypot(world.player.pos.x, world.player.pos.z)).toBeLessThanOrEqual(limit + EPS);
      // La pared es un polígono inscripto: a lo sumo 0,03 u más adentro que el círculo.
      expect(Math.hypot(world.player.pos.x, world.player.pos.z)).toBeGreaterThan(limit - 0.06);
    }
  });

  it('no atraviesa las antorchas', () => {
    const { world } = makeWorld();
    const t = torchPositions()[0];
    if (!t) throw new Error('sin antorchas');
    world.player.pos.set(t.x, 0, t.z - 3);
    faceCamera(world, 0, 1);
    let minDist = Infinity;
    for (let i = 0; i < 120; i++) {
      tick(world, 1, input({ moveZ: 1 }));
      minDist = Math.min(minDist, distXZ(world.player.pos, t.x, t.z));
    }
    expect(minDist).toBeGreaterThanOrEqual(t.r + PLAYER.radius - EPS);
  });
});

describe('Colisión de enemigos', () => {
  it('rodean la columna para llegar al jugador sin atravesarla', () => {
    for (const kind of ['draugr', 'brute'] as const) {
      const { world } = makeWorld();
      const dir = new Vector3(pillar.x, 0, pillar.z).normalize();
      world.player.pos.copy(dir).multiplyScalar(ARENA.pillarRing - 2.5);
      const e = placeEnemy(world, kind, 0, 0);
      e.pos.copy(dir).multiplyScalar(ARENA.pillarRing + 2.5);
      e.prevPos.copy(e.pos);
      e.speed = 3;
      const r = kind === 'brute' ? BRUTE.radius : DRAUGR.radius;
      let minDist = Infinity;
      for (let i = 0; i < 300; i++) {
        tick(world, 1);
        minDist = Math.min(minDist, distXZ(e.pos, pillar.x, pillar.z));
      }
      expect(minDist, kind).toBeGreaterThanOrEqual(pillar.r + r - EPS);
    }
  });

  it('la separación no los mete dentro de una columna', () => {
    const { world } = makeWorld();
    const dir = new Vector3(pillar.x, 0, pillar.z).normalize();
    const side = new Vector3(-dir.z, 0, dir.x);
    const base = dir.clone().multiplyScalar(ARENA.pillarRing - pillar.r - DRAUGR.radius - 0.01);
    // Cuatro enemigos apretados contra la columna.
    const list = [0, 0.1, -0.1, 0.05].map((o) => {
      const e = placeEnemy(world, 'draugr', 0, 0);
      e.pos.copy(base).addScaledVector(side, o).addScaledVector(dir, -Math.abs(o));
      e.prevPos.copy(e.pos);
      return e;
    });
    tick(world, 30);
    for (const e of list) {
      expect(distXZ(e.pos, pillar.x, pillar.z)).toBeGreaterThanOrEqual(
        pillar.r + DRAUGR.radius - EPS,
      );
    }
  });

  it('el empuje de un golpe pesado no los saca de la arena', () => {
    const { world } = makeWorld();
    const limit = ARENA.radius - ARENA.edgePadding;
    world.player.pos.set(0, 0, limit - 3);
    world.player.facing = 0;
    world.camYaw = Math.PI;
    const e = placeEnemy(world, 'draugr', 0, limit - 1.5);
    e.hp = 999;
    world.player.startHeavy();
    tick(world, 120);
    expect(Math.hypot(e.pos.x, e.pos.z)).toBeLessThanOrEqual(limit - DRAUGR.radius + EPS);
  });
});

describe('Hacha contra el escenario', () => {
  it('se clava en la superficie de la columna, no adentro', () => {
    const { world } = makeWorld();
    world.player.handPos.set(0, 1.3, 0);
    world.aimOrigin.set(0, 1.3, 0);
    world.aimDir.set(pillar.x, 0, pillar.z).normalize();
    world.axe.throwFrom(world.player.handPos, world.aimOrigin, world.aimDir);
    for (let i = 0; i < 60 && world.axe.state === 'flying'; i++) tick(world, 1);
    expect(world.axe.state).toBe('ground');
    const d = distXZ(world.axe.pos, pillar.x, pillar.z);
    expect(d).toBeGreaterThanOrEqual(pillar.r - EPS);
    expect(d).toBeLessThan(pillar.r + 0.1);
  });

  it('pasa por encima de las columnas si va alto', () => {
    const { world } = makeWorld();
    world.player.handPos.set(0, 6, 0);
    world.aimOrigin.set(0, 6, 0);
    world.aimDir.set(pillar.x, 0.05, pillar.z).normalize();
    const surfaces: string[] = [];
    world.events.on('axe:embedded', (e) => surfaces.push(e.surface));
    world.axe.throwFrom(world.player.handPos, world.aimOrigin, world.aimDir);
    for (let i = 0; i < 200 && world.axe.state === 'flying'; i++) tick(world, 1);
    expect(surfaces).not.toContain('obstacle');
  });
});

describe('Colisión de la cámara', () => {
  function cameraAt(world: World, physics: ReturnType<typeof makeWorld>['physics'], yaw: number) {
    const rig = new CameraRig();
    rig.obstacles = physics;
    rig.reset(world.player.pos);
    rig.yaw = yaw;
    rig.pitch = 0.1;
    rig.update(1 / 60, world.player.pos);
    return rig.camera.position;
  }

  it('se acerca para no meterse en una columna que queda detrás del jugador', () => {
    const { world, physics } = makeWorld();
    const dir = new Vector3(pillar.x, 0, pillar.z).normalize();
    // Jugador a 2 u de la columna, de espaldas a ella: la cámara caería adentro.
    world.player.pos.copy(dir).multiplyScalar(ARENA.pillarRing - pillar.r - 2);
    const yaw = Math.atan2(dir.x, dir.z);
    const cam = cameraAt(world, physics, yaw);
    const d = distXZ(cam, pillar.x, pillar.z);
    expect(d).toBeGreaterThanOrEqual(pillar.r + CAMERA.collisionRadius - EPS);
    expect(cam.distanceTo(world.player.pos)).toBeLessThan(CAMERA.distance);
  });

  it('sin obstáculos queda a la distancia normal', () => {
    const { world, physics } = makeWorld();
    world.player.pos.set(0, 0, 0);
    const cam = cameraAt(world, physics, 0.3);
    const free = cameraAt(world, { castCamera: () => 1 } as never, 0.3);
    expect(cam.distanceTo(free)).toBeLessThan(1e-6);
  });

  it('no se mete en las rocas del borde', () => {
    const { world, physics } = makeWorld();
    const rock = rockLayout().reduce((a, b) => (b.size > a.size ? b : a));
    const dir = new Vector3(rock.x, 0, rock.z).normalize();
    const limit = ARENA.radius - ARENA.edgePadding - PLAYER.radius;
    world.player.pos.copy(dir).multiplyScalar(limit);
    const cam = cameraAt(world, physics, Math.atan2(-dir.x, -dir.z));
    const center = new Vector3(rock.x, rock.y, rock.z);
    expect(cam.distanceTo(center)).toBeGreaterThanOrEqual(
      rock.size * 0.8 + CAMERA.collisionRadius - EPS,
    );
  });
});
