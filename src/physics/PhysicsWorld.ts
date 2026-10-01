import type {
  Collider,
  KinematicCharacterController,
  World as RapierWorld,
} from '@dimforge/rapier3d-compat';
import type { Vector3 } from 'three';
import { ARENA, pillarPositions, rockLayout, torchPositions } from '../data/arena';
import { PHYSICS } from '../data/physics';
import type { CharacterBody, Collision } from '../game/collision';
import {
  CAMERA_QUERY,
  CHARACTER_BODY,
  CHARACTER_QUERY,
  GROUP,
  PROJECTILE_QUERY,
  scenery,
} from './groups';
import type { Rapier } from './rapier';

interface RapierCharacter extends CharacterBody {
  readonly collider: Collider;
  readonly halfHeight: number;
}

const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };

/**
 * Mundo de Rapier con el escenario estático y los personajes. No hay cuerpos dinámicos: la física
 * se usa para el character controller y para consultas (hacha, cámara), así que nunca se simula.
 */
export class PhysicsWorld implements Collision {
  readonly world: RapierWorld;
  private readonly controller: KinematicCharacterController;
  private readonly R: Rapier;

  // Objetos reutilizados para no generar basura en cada consulta.
  private readonly v = { x: 0, y: 0, z: 0 };
  private readonly v2 = { x: 0, y: 0, z: 0 };
  private readonly moved = { x: 0, y: 0, z: 0 };
  private readonly ray;
  private readonly cameraBall;

  constructor(R: Rapier) {
    this.R = R;
    this.world = new R.World({ x: 0, y: 0, z: 0 });
    this.controller = this.world.createCharacterController(PHYSICS.characterOffset);
    this.controller.setSlideEnabled(true);
    this.ray = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    this.cameraBall = new R.Ball(1);
    this.buildScenery();
    // Las consultas usan la estructura de aceleración del broad-phase, que se arma al simular.
    // Como el escenario es estático, alcanza con un paso después de crearlo.
    this.world.step();
  }

  private buildScenery(): void {
    const { R, world } = this;
    const solid = scenery(GROUP.SOLID);

    for (const p of pillarPositions()) {
      const h = ARENA.pillarHeight;
      world.createCollider(
        R.ColliderDesc.cylinder(h / 2, p.r)
          .setTranslation(p.x, h / 2, p.z)
          .setCollisionGroups(solid),
      );
      const c = ARENA.pillarCapSize / 2;
      const ch = ARENA.pillarCapHeight / 2;
      world.createCollider(
        R.ColliderDesc.cuboid(c, ch, c)
          .setTranslation(p.x, h + ch, p.z)
          .setCollisionGroups(solid),
      );
    }
    for (const t of torchPositions()) {
      const h = ARENA.torchHeight;
      world.createCollider(
        R.ColliderDesc.cylinder(h / 2, t.r)
          .setTranslation(t.x, h / 2, t.z)
          .setCollisionGroups(solid),
      );
    }

    // Pared invisible: polígono de cajas inscripto en el círculo de radio − edgePadding (las
    // esquinas tocan el círculo), así nadie pasa del límite del prototipo.
    const n = PHYSICS.wallSegments;
    const inner = (ARENA.radius - ARENA.edgePadding) * Math.cos(Math.PI / n);
    const thick = PHYSICS.wallThickness;
    const halfLen = (inner + thick) * Math.tan(Math.PI / n) + 0.05;
    const wall = scenery(GROUP.WALL);
    for (let i = 0; i < n; i++) {
      const a = ((i + 0.5) / n) * Math.PI * 2;
      const r = inner + thick / 2;
      world.createCollider(
        R.ColliderDesc.cuboid(halfLen, PHYSICS.wallHeight / 2, thick / 2)
          .setTranslation(Math.sin(a) * r, PHYSICS.wallHeight / 2, Math.cos(a) * r)
          .setRotation({ x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) })
          .setCollisionGroups(wall),
      );
    }

    // Rocas del borde: solo para la cámara.
    const decor = scenery(GROUP.DECOR);
    for (const rock of rockLayout()) {
      world.createCollider(
        R.ColliderDesc.ball(rock.size * PHYSICS.rockColliderScale)
          .setTranslation(rock.x, rock.y, rock.z)
          .setCollisionGroups(decor),
      );
    }
  }

  createCharacter(radius: number, height: number): CharacterBody {
    const halfHeight = Math.max(0, height / 2 - radius);
    const collider = this.world.createCollider(
      this.R.ColliderDesc.capsule(halfHeight, radius).setCollisionGroups(CHARACTER_BODY),
    );
    const body: RapierCharacter = { radius, collider, halfHeight };
    return body;
  }

  removeCharacter(body: CharacterBody): void {
    this.world.removeCollider((body as RapierCharacter).collider, false);
  }

  moveCharacter(body: CharacterBody, from: Vector3, to: Vector3): void {
    const b = body as RapierCharacter;
    const v = this.v;
    // Movimiento horizontal: la cápsula apoya en y = 0.
    v.x = from.x;
    v.y = b.halfHeight + b.radius;
    v.z = from.z;
    b.collider.setTranslation(v);
    const d = this.v2;
    d.x = to.x - from.x;
    d.y = 0;
    d.z = to.z - from.z;
    this.controller.computeColliderMovement(b.collider, d, undefined, CHARACTER_QUERY);
    const m = this.controller.computedMovement(this.moved);
    to.x = from.x + m.x;
    to.z = from.z + m.z;
    v.x = to.x;
    v.z = to.z;
    b.collider.setTranslation(v);
  }

  castSolid(from: Vector3, to: Vector3): number {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) return -1;
    const o = this.ray.origin;
    o.x = from.x;
    o.y = from.y;
    o.z = from.z;
    const dir = this.ray.dir;
    dir.x = dx / len;
    dir.y = dy / len;
    dir.z = dz / len;
    const hit = this.world.castRay(this.ray, len, true, undefined, PROJECTILE_QUERY);
    return hit ? hit.timeOfImpact / len : -1;
  }

  /**
   * Esfera de radio `radius` desde `from` hacia `to`, contra lo que tapa a la cámara.
   * Devuelve la fracción del recorrido libre, en [0, 1].
   */
  castCamera(from: Vector3, to: Vector3, radius: number): number {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) return 1;
    this.cameraBall.radius = radius;
    this.v.x = from.x;
    this.v.y = from.y;
    this.v.z = from.z;
    this.v2.x = dx / len;
    this.v2.y = dy / len;
    this.v2.z = dz / len;
    const hit = this.world.castShape(
      this.v,
      IDENTITY,
      this.v2,
      this.cameraBall,
      0,
      len,
      true,
      undefined,
      CAMERA_QUERY,
    );
    return hit ? Math.min(1, hit.time_of_impact / len) : 1;
  }
}
