import { Vector3 } from 'three';
import { COMBAT, type AttackDef } from '../data/attacks';
import { PLAYER } from '../data/player';
import type { World } from '../game/World';
import { BOSS } from '../data/boss';
import { damageBoss, damageEnemy } from './damage';

const dir = new Vector3();
const toTarget = new Vector3();

/**
 * Consulta de solapamiento de un ataque del jugador contra los enemigos.
 * Cada enemigo recibe como máximo un golpe por ataque (`player.hitSet`), y el hit-stop y el
 * temblor se aplican solo con el primero.
 */
export function resolvePlayerAttack(world: World, def: AttackDef): void {
  const p = world.player;
  const fx = Math.sin(p.facing);
  const fz = Math.cos(p.facing);
  const armed = world.axe.inHand;
  const damageMult = armed ? 1 : PLAYER.unarmedDamageMult;
  const rangeMult = armed ? 1 : PLAYER.unarmedRangeMult;

  let cx = p.pos.x;
  let cz = p.pos.z;
  let baseReach: number;
  if (def.shape.kind === 'circle') {
    cx += fx * def.shape.offset;
    cz += fz * def.shape.offset;
    baseReach = def.shape.radius;
  } else {
    baseReach = def.shape.range;
  }

  for (const e of world.enemies.active) {
    if (!e.canBeHit || p.hitSet.has(e)) continue;
    const dx = e.pos.x - cx;
    const dz = e.pos.z - cz;
    const dist = Math.hypot(dx, dz) || 0.001;
    const reach = baseReach * rangeMult + e.arch.radius * COMBAT.targetRadiusReach;
    if (dist > reach) continue;
    if (
      def.shape.kind === 'arc' &&
      dist > COMBAT.arcMinDistance &&
      (dx * fx + dz * fz) / dist < def.shape.minDot
    ) {
      continue;
    }

    p.hitSet.add(e);
    toTarget.set(dx / dist, 0, dz / dist);
    if (def.shape.kind === 'circle') dir.copy(toTarget);
    else dir.set(fx, 0, fz).lerp(toTarget, COMBAT.arcKnockbackBlend).normalize();

    damageEnemy(world, e, def.damage * damageMult, dir, def.knockback, {
      y: e.arch.hitHeight,
      heavy: def.heavy,
    });

    landed(world, def);
  }

  // El jefe: misma consulta, con su radio.
  const boss = world.boss;
  if (boss.canBeHit && !p.hitSet.has(boss)) {
    const dx = boss.pos.x - cx;
    const dz = boss.pos.z - cz;
    const dist = Math.hypot(dx, dz) || 0.001;
    const reach = baseReach * rangeMult + BOSS.radius * COMBAT.targetRadiusReach;
    const inArc =
      def.shape.kind !== 'arc' ||
      dist <= COMBAT.arcMinDistance + BOSS.radius ||
      (dx * fx + dz * fz) / dist >= def.shape.minDot;
    if (dist <= reach && inArc) {
      p.hitSet.add(boss);
      const at = {
        x: boss.pos.x - (dx / dist) * BOSS.radius,
        y: BOSS.hitHeight * 0.5,
        z: boss.pos.z - (dz / dist) * BOSS.radius,
      };
      if (damageBoss(world, def.damage * damageMult, def.breakDamage, at)) landed(world, def);
    }
  }
}

/** Hit-stop y temblor solo con el primer objetivo alcanzado por el ataque. */
function landed(world: World, def: AttackDef): void {
  const p = world.player;
  if (p.hitAny) return;
  p.hitAny = true;
  world.feedback.hitStop(def.hitStop);
  world.feedback.shake(def.shake);
  world.events.emit('player:hit-landed', { heavy: def.heavy });
}
