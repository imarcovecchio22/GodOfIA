import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  FogExp2,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
} from 'three';

/**
 * Escena de la fase 0: un cubo cuya rotación vive en la simulación de paso fijo y se
 * renderiza interpolada. Sirve para validar loop, interpolación y deploy. Se reemplaza en la fase 1.
 */
const SPIN_SPEED = 1.2; // rad/s, solo para la demo

export class BootScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(62, 1, 0.1, 250);
  private readonly cube: Mesh;

  private angle = 0;
  private prevAngle = 0;

  constructor() {
    const fog = 0x18202c;
    this.scene.background = new Color(fog);
    this.scene.fog = new FogExp2(fog, 0.028);
    this.scene.add(new AmbientLight(0x9fb2d6, 0.6));
    const moon = new DirectionalLight(0xc4d4ff, 1.5);
    moon.position.set(-14, 26, 10);
    this.scene.add(moon);

    this.cube = new Mesh(
      new BoxGeometry(1.4, 1.4, 1.4),
      new MeshStandardMaterial({ color: 0x86e6f7, roughness: 0.4, metalness: 0.3 }),
    );
    this.scene.add(this.cube);
    this.camera.position.set(0, 1.6, 5);
    this.camera.lookAt(0, 0, 0);
  }

  update(step: number): void {
    this.prevAngle = this.angle;
    this.angle += SPIN_SPEED * step;
  }

  render(alpha: number): void {
    const a = this.prevAngle + (this.angle - this.prevAngle) * alpha;
    this.cube.rotation.set(a * 0.6, a, 0);
  }
}
