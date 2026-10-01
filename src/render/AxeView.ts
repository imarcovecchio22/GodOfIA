import { Mesh, PointLight, Vector3, type MeshStandardMaterial, type Scene } from 'three';
import { LIGHTING } from '../data/arena';
import { PLAYER_MODEL } from '../data/models';
import { lerp } from '../core/math';
import type { AxeSim } from '../entities/Axe';
import type { PlayerView } from './PlayerView';

const worldPos = new Vector3();

/**
 * El hacha del modelo del jugador: va en la mano mientras no se lanza y pasa a la escena cuando
 * vuela, está clavada o vuelve. Brilla con un tono frío y lleva una luz cuando está afuera.
 */
export class AxeView {
  private readonly light: PointLight;
  private wasInHand = true;
  /** Transformación original dentro de la mano, para devolverla igual al atraparla. */
  private readonly handPosition: Vector3;
  private readonly handQuaternion;

  constructor(
    private readonly scene: Scene,
    private readonly player: PlayerView,
  ) {
    const axe = player.axeObject;
    this.handPosition = axe.position.clone();
    this.handQuaternion = axe.quaternion.clone();
    axe.traverse((m) => {
      if (!(m instanceof Mesh)) return;
      const mat = (m.material as MeshStandardMaterial).clone();
      mat.emissive.setHex(PLAYER_MODEL.axeGlow);
      m.material = mat;
      m.castShadow = true;
    });
    this.light = new PointLight(LIGHTING.axeLightColor, 0, LIGHTING.axeLightDistance, 1);
    scene.add(this.light);
  }

  private toHand(): void {
    const axe = this.player.axeObject;
    this.player.hand.add(axe);
    axe.position.copy(this.handPosition);
    axe.quaternion.copy(this.handQuaternion);
    axe.scale.setScalar(1);
  }

  update(axe: AxeSim, alpha: number, time: number): void {
    const obj = this.player.axeObject;
    const inHand = axe.inHand;
    if (inHand !== this.wasInHand) {
      if (inHand) {
        this.toHand();
      } else {
        this.scene.add(obj);
        obj.scale.setScalar(PLAYER_MODEL.scale);
        obj.rotation.order = 'YXZ';
      }
      this.wasInHand = inHand;
    }

    if (!inHand) {
      obj.position.lerpVectors(axe.prevPos, axe.pos, alpha);
      obj.rotation.set(lerp(axe.prevSpin, axe.spin, alpha), axe.yaw, 0);
    }

    obj.getWorldPosition(worldPos);
    this.light.position.copy(worldPos);
    let target = LIGHTING.axeLightFlying;
    if (inHand) target = 0;
    else if (axe.state === 'ground') {
      target = LIGHTING.axeLightGround + Math.sin(time * 6) * LIGHTING.axeLightGroundPulse;
    }
    this.light.intensity = lerp(this.light.intensity, target, 0.2);
  }
}
