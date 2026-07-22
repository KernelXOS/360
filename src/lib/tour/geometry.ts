import * as THREE from 'three';

/**
 * Convenciones del visor, usadas por igual para la camara y para los puntos:
 *   yaw   0 = centro de la panoramica, positivo hacia la derecha
 *   pitch 0 = horizonte, positivo hacia arriba
 * La direccion resultante es (sin yaw · cos pitch, sin pitch, −cos yaw · cos pitch).
 */
export function directionFromYawPitch(yaw: number, pitch: number, out = new THREE.Vector3()) {
  const cos = Math.cos(pitch);
  return out.set(Math.sin(yaw) * cos, Math.sin(pitch), -Math.cos(yaw) * cos);
}

export function yawPitchFromDirection(dir: THREE.Vector3): { yaw: number; pitch: number } {
  return {
    yaw: Math.atan2(dir.x, -dir.z),
    pitch: Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)),
  };
}

/**
 * Convierte un clic en pantalla a la direccion de la esfera que hay debajo.
 * No hace falta trazar rayos contra la geometria: la camara esta en el centro,
 * asi que cualquier direccion cae sobre la esfera.
 */
export function yawPitchFromScreen(
  camera: THREE.PerspectiveCamera,
  x: number,
  y: number,
  width: number,
  height: number,
): { yaw: number; pitch: number } {
  const ndc = new THREE.Vector3((x / width) * 2 - 1, -(y / height) * 2 + 1, 0.5);
  const dir = ndc.unproject(camera).sub(camera.position).normalize();
  return yawPitchFromDirection(dir);
}

export interface ScreenPlacement {
  x: number;
  y: number;
  /** Falso cuando el punto queda detras de la camara. */
  visible: boolean;
  /** Cuan al centro de la vista esta, de 0 (borde) a 1 (mirandolo de frente). */
  centrality: number;
}

const point = new THREE.Vector3();
const local = new THREE.Vector3();

/** Proyecta un punto de la esfera a coordenadas de pantalla en pixeles CSS. */
export function projectToScreen(
  yaw: number,
  pitch: number,
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
): ScreenPlacement {
  directionFromYawPitch(yaw, pitch, point).multiplyScalar(100);

  // En espacio de camara, mirar hacia -Z. Un z positivo significa "atras".
  local.copy(point);
  camera.worldToLocal(local);
  if (local.z >= 0) return { x: 0, y: 0, visible: false, centrality: 0 };

  const ndc = point.clone().project(camera);
  return {
    x: ((ndc.x + 1) / 2) * width,
    y: ((1 - ndc.y) / 2) * height,
    visible: true,
    centrality: Math.max(0, 1 - Math.hypot(ndc.x, ndc.y)),
  };
}

export function normalizeYaw(yaw: number): number {
  return Math.atan2(Math.sin(yaw), Math.cos(yaw));
}

export const MAX_PITCH = Math.PI / 2 - 0.01;

export function clampPitch(pitch: number): number {
  return THREE.MathUtils.clamp(pitch, -MAX_PITCH, MAX_PITCH);
}
