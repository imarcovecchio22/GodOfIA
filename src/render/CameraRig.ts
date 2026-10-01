import { PerspectiveCamera, Vector3 } from 'three';
import { CAMERA } from '../data/camera';
import { clamp, damp } from '../core/math';

const desired = new Vector3();

/**
 * Cámara sobre el hombro derecho con seguimiento suavizado y temblor por trauma
 * (desplazamiento proporcional a trauma²). Corre en tiempo real: no se congela con el hit-stop.
 */
export class CameraRig {
  readonly camera = new PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far);
  yaw = 0;
  pitch = CAMERA.pitchInitial;
  trauma = 0;
  private readonly target = new Vector3();

  reset(follow: Vector3): void {
    this.yaw = 0;
    this.pitch = CAMERA.pitchInitial;
    this.trauma = 0;
    this.target.copy(follow);
  }

  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** Mirada con el mouse, en píxeles de movimiento. */
  look(dx: number, dy: number): void {
    this.yaw -= dx * CAMERA.yawSensitivity;
    const sign = CAMERA.invertY ? -1 : 1;
    this.pitch = clamp(
      this.pitch + dy * CAMERA.pitchSensitivity * sign,
      CAMERA.pitchMin,
      CAMERA.pitchMax,
    );
  }

  update(realDt: number, follow: Vector3): void {
    this.target.lerp(follow, damp(CAMERA.followDamp, realDt));
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);
    const tx = this.target.x + rx * CAMERA.shoulderOffset;
    const ty = CAMERA.lookHeight;
    const tz = this.target.z + rz * CAMERA.shoulderOffset;
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    const d = CAMERA.distance;
    desired.set(tx - fx * d * cp, ty + d * sp, tz - fz * d * cp);

    this.trauma = Math.max(0, this.trauma - realDt * CAMERA.traumaDecay);
    const s = this.trauma * this.trauma;
    const off = s * CAMERA.shakeOffset;
    desired.x += (Math.random() * 2 - 1) * off;
    desired.y += (Math.random() * 2 - 1) * off;
    desired.z += (Math.random() * 2 - 1) * off;
    this.camera.position.copy(desired);
    this.camera.lookAt(tx, ty, tz);
    this.camera.rotation.z += (Math.random() * 2 - 1) * s * CAMERA.shakeRoll;
  }

  /** Origen y dirección de la mira, para el lanzamiento del hacha. */
  writeAim(origin: Vector3, dir: Vector3): void {
    origin.copy(this.camera.position);
    this.camera.getWorldDirection(dir);
  }
}
