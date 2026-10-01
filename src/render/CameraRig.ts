import { PerspectiveCamera, Vector3 } from 'three';
import { CAMERA } from '../data/camera';
import { clamp, damp, lerp } from '../core/math';

const desired = new Vector3();
const head = new Vector3();
const pivot = new Vector3();
const toCam = new Vector3();

/** Lo que tapa a la cámara. Lo implementa `physics/PhysicsWorld`. */
export interface CameraObstacles {
  /** Fracción libre del recorrido de una esfera de `from` a `to`, en [0, 1]. */
  castCamera(from: Vector3, to: Vector3, radius: number): number;
}

/**
 * Cámara sobre el hombro derecho con seguimiento suavizado y temblor por trauma
 * (desplazamiento proporcional a trauma²). Corre en tiempo real: no se congela con el hit-stop.
 *
 * Colisión: una esfera va de la cabeza del jugador al punto sobre el hombro y de ahí a la cámara;
 * si algo la tapa, la cámara se acerca de golpe, y cuando se libera vuelve suave.
 */
export class CameraRig {
  readonly camera = new PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far);
  yaw = 0;
  pitch = CAMERA.pitchInitial;
  trauma = 0;
  obstacles: CameraObstacles | null = null;
  private readonly target = new Vector3();
  /** Distancia actual al punto de mira, acortada por la colisión. */
  private distance: number = CAMERA.distance;

  reset(follow: Vector3): void {
    this.yaw = 0;
    this.pitch = CAMERA.pitchInitial;
    this.trauma = 0;
    this.distance = CAMERA.distance;
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
    pivot.set(tx, ty, tz);
    this.resolveCollision(realDt);

    this.trauma = Math.max(0, this.trauma - realDt * CAMERA.traumaDecay);
    const s = this.trauma * this.trauma;
    const off = s * CAMERA.shakeOffset;
    desired.x += (Math.random() * 2 - 1) * off;
    desired.y += (Math.random() * 2 - 1) * off;
    desired.z += (Math.random() * 2 - 1) * off;
    this.camera.position.copy(desired);
    this.camera.lookAt(pivot);
    this.camera.rotation.z += (Math.random() * 2 - 1) * s * CAMERA.shakeRoll;
  }

  /** Ajusta `pivot` y `desired` para que la cámara no quede dentro de la geometría. */
  private resolveCollision(realDt: number): void {
    const obs = this.obstacles;
    const r = CAMERA.collisionRadius;
    if (obs) {
      // Si el jugador está pegado a una columna, el punto sobre el hombro puede quedar adentro.
      head.set(this.target.x, CAMERA.lookHeight, this.target.z);
      pivot.lerpVectors(head, pivot, obs.castCamera(head, pivot, r));
    }
    toCam.copy(desired).sub(pivot);
    const full = toCam.length();
    const allowed = obs
      ? Math.max(CAMERA.collisionMinDistance, full * obs.castCamera(pivot, desired, r))
      : full;
    this.distance =
      allowed < this.distance
        ? allowed
        : lerp(this.distance, allowed, damp(CAMERA.collisionReturnDamp, realDt));
    desired.copy(pivot).addScaledVector(toCam.normalize(), Math.min(this.distance, full));
  }

  /** Origen y dirección de la mira, para el lanzamiento del hacha. */
  writeAim(origin: Vector3, dir: Vector3): void {
    origin.copy(this.camera.position);
    this.camera.getWorldDirection(dir);
  }
}
