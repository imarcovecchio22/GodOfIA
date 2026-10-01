import {
  BoxGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PointLight,
  Shape,
  Vector3,
  type Scene,
} from 'three';
import { LIGHTING } from '../data/arena';
import { REST_POSE } from '../data/attacks';
import { lerp } from '../core/math';
import type { AxeSim } from '../entities/Axe';
import type { PlayerView } from './PlayerView';
import { cyl, mat, mesh, sph } from './primitives';

const worldPos = new Vector3();

/** Hacha de primitivas con runas que brillan, y la luz que la acompaña fuera de la mano. */
export class AxeView {
  readonly group = new Group();
  private readonly light: PointLight;
  private wasInHand = true;

  constructor(
    private readonly scene: Scene,
    private readonly player: PlayerView,
  ) {
    const leatherM = mat(0x4a3322);
    const metalM = mat(0xb4bcc6, { metalness: 0.85, roughness: 0.28 });
    const handle = cyl(0.035, 0.042, 1.05, leatherM, 8);
    handle.position.y = -0.3;
    this.group.add(handle);

    const s = new Shape();
    s.moveTo(0, 0.1);
    s.lineTo(0.22, 0.2);
    s.quadraticCurveTo(0.4, 0, 0.22, -0.25);
    s.lineTo(0, -0.12);
    s.lineTo(0, 0.1);
    const bladeGeo = new ExtrudeGeometry(s, {
      depth: 0.04,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 1,
    });
    bladeGeo.translate(0, 0, -0.02);
    const blade = mesh(bladeGeo, metalM);
    blade.rotation.y = Math.PI / 2;
    blade.position.y = -0.72;
    this.group.add(blade);

    const runeM = new MeshBasicMaterial({ color: 0x86e6f7 });
    for (const side of [-1, 1]) {
      const r = new Mesh(new BoxGeometry(0.01, 0.17, 0.12), runeM);
      r.position.set(0.032 * side, -0.73, -0.15);
      this.group.add(r);
    }
    const pommel = sph(0.05, metalM, 8);
    pommel.position.y = 0.23;
    this.group.add(pommel);

    this.light = new PointLight(LIGHTING.axeLightColor, 0, LIGHTING.axeLightDistance, 1);
    scene.add(this.light);
    this.toHand();
  }

  private toHand(): void {
    this.player.armR.hand.add(this.group);
    this.group.position.set(0, 0, 0);
    this.group.rotation.order = 'XYZ';
    this.group.rotation.set(REST_POSE.ax, 0, 0);
    this.player.handAxeTilt = REST_POSE.ax;
  }

  update(axe: AxeSim, alpha: number, time: number): void {
    const inHand = axe.inHand;
    if (inHand !== this.wasInHand) {
      if (inHand) {
        this.toHand();
      } else {
        this.scene.add(this.group);
        this.group.rotation.order = 'YXZ';
      }
      this.wasInHand = inHand;
    }

    if (inHand) {
      this.group.rotation.x = this.player.handAxeTilt;
    } else {
      this.group.position.lerpVectors(axe.prevPos, axe.pos, alpha);
      this.group.rotation.set(lerp(axe.prevSpin, axe.spin, alpha), axe.yaw, 0);
    }

    this.group.getWorldPosition(worldPos);
    this.light.position.copy(worldPos);
    let target = LIGHTING.axeLightFlying;
    if (inHand) target = 0;
    else if (axe.state === 'ground') {
      target = LIGHTING.axeLightGround + Math.sin(time * 6) * LIGHTING.axeLightGroundPulse;
    }
    this.light.intensity = lerp(this.light.intensity, target, 0.2);
  }
}
