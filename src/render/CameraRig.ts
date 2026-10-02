import { PerspectiveCamera, Vector3 } from 'three';
import { CAMERA } from '../data/camera';
import { clamp, damp, lerp, lerpAngle } from '../core/math';

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
  /** Preferencias del jugador (ajustes). */
  sensitivity = 1;
  invertY: boolean = CAMERA.invertY;
  /**
   * Punto a mantener en cuadro (fijación de objetivo o cinemática): la cámara gira hacia él con
   * `focusDamp`. Si `focusPitch` no es null, también lleva el pitch a ese valor.
   */
  readonly focusPoint = new Vector3();
  focusing = false;
  focusDamp = 0;
  focusPitch: number | null = null;
  /** Distancia extra deseada (la entrada del jefe aleja la cámara). */
  pullBack = 0;
  private readonly target = new Vector3();
  /** Distancia actual al punto de mira, acortada por la colisión. */
  private distance: number = CAMERA.distance;
  private extra = 0;

  reset(follow: Vector3): void {
    this.yaw = 0;
    this.pitch = CAMERA.pitchInitial;
    this.trauma = 0;
    this.distance = CAMERA.distance;
    this.target.copy(follow);
    this.focusing = false;
    this.focusPitch = null;
    this.pullBack = 0;
    this.extra = 0;
  }

  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** Mirada con el mouse, en píxeles de movimiento. */
  look(dx: number, dy: number): void {
    this.yaw -= dx * CAMERA.yawSensitivity * this.sensitivity;
    const sign = this.invertY ? -1 : 1;
    this.pitch = clamp(
      this.pitch + dy * CAMERA.pitchSensitivity * this.sensitivity * sign,
      CAMERA.pitchMin,
      CAMERA.pitchMax,
    );
  }

  update(realDt: number, follow: Vector3): void {
    this.target.lerp(follow, damp(CAMERA.followDamp, realDt));
    if (this.focusing) {
      const dx = this.focusPoint.x - this.target.x;
      const dz = this.focusPoint.z - this.target.z;
      if (dx * dx + dz * dz > 0.25) {
        const k = damp(this.focusDamp, realDt);
        this.yaw = lerpAngle(this.yaw, Math.atan2(-dx, -dz), k);
        if (this.focusPitch !== null) this.pitch = lerp(this.pitch, this.focusPitch, k);
      }
    }
    this.extra = lerp(this.extra, this.pullBack, damp(CAMERA.followDamp * 0.25, realDt));
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);
    const tx = this.target.x + rx * CAMERA.shoulderOffset;
    const ty = CAMERA.lookHeight;
    const tz = this.target.z + rz * CAMERA.shoulderOffset;
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    const d = CAMERA.distance + this.extra;
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
