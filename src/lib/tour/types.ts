import type { FitOptions } from '../../features/editor/fitToEquirect';

export type HotspotKind = 'link' | 'info';

export interface Hotspot {
  id: string;
  kind: HotspotKind;
  /** Posicion sobre la esfera, en radianes. */
  yaw: number;
  pitch: number;
  label: string;
  /** Escena a la que salta. Solo en los de tipo `link`. */
  targetSceneId?: string;
  /** Texto del cartel. Solo en los de tipo `info`. */
  text?: string;
}

export interface Scene {
  id: string;
  name: string;
  /** Clave del blob en el store de imagenes de IndexedDB. */
  imageId: string;
  /** Miniatura en data URL. Va con el tour: es chica y evita decodificar todo. */
  thumb: string;
  width: number;
  height: number;
  /** Como se apoya la panoramica sobre la esfera. Reusa la logica del conversor. */
  fit: FitOptions;
  /** Hacia donde mira la camara al entrar a la escena, en radianes. */
  initialYaw: number;
  initialPitch: number;
  hotspots: Hotspot[];
}

export interface Tour {
  id: string;
  name: string;
  startSceneId: string | null;
  scenes: Scene[];
  updatedAt: number;
}

export function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyTour(): Tour {
  return {
    id: createId('tour'),
    name: 'Tour sin título',
    startSceneId: null,
    scenes: [],
    updatedAt: Date.now(),
  };
}

export function findScene(tour: Tour, id: string | null): Scene | null {
  return tour.scenes.find((s) => s.id === id) ?? null;
}

/**
 * Un punto de tipo `link` sin destino, o apuntando a una escena borrada, deja
 * al visitante en un callejon sin salida. Se listan para avisar en el editor.
 */
export function brokenLinks(tour: Tour): Array<{ scene: Scene; hotspot: Hotspot }> {
  const ids = new Set(tour.scenes.map((s) => s.id));
  const broken: Array<{ scene: Scene; hotspot: Hotspot }> = [];
  for (const scene of tour.scenes) {
    for (const hotspot of scene.hotspots) {
      if (hotspot.kind !== 'link') continue;
      if (!hotspot.targetSceneId || !ids.has(hotspot.targetSceneId)) {
        broken.push({ scene, hotspot });
      }
    }
  }
  return broken;
}

/** Escenas a las que no llega ningun punto: solo alcanzables desde el listado. */
export function unreachableScenes(tour: Tour): Scene[] {
  const reached = new Set<string>(tour.startSceneId ? [tour.startSceneId] : []);
  const queue = [...reached];
  while (queue.length) {
    const scene = findScene(tour, queue.shift()!);
    if (!scene) continue;
    for (const hotspot of scene.hotspots) {
      const target = hotspot.targetSceneId;
      if (hotspot.kind === 'link' && target && !reached.has(target)) {
        reached.add(target);
        queue.push(target);
      }
    }
  }
  return tour.scenes.filter((s) => !reached.has(s.id));
}
