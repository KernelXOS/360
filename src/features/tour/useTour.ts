import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteImage, getImage, loadTour, putImage, saveTour } from '../../lib/tour/storage';
import {
  createId,
  emptyTour,
  type Hotspot,
  type HotspotKind,
  type Scene,
  type Tour,
} from '../../lib/tour/types';
import { defaultFitOptions } from '../editor/fitToEquirect';
import { PREVIEW_MAX_WIDTH, readImage } from '../upload/readImage';

/** Bitmaps decodificados, fuera de React: sobreviven a los re-renders. */
const bitmapCache = new Map<string, ImageBitmap>();

const THUMB_WIDTH = 240;

export function useTour() {
  const [tour, setTour] = useState<Tour>(emptyTour);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; detail: string } | null>(null);

  useEffect(() => {
    loadTour()
      .then((stored) => {
        if (stored?.scenes) setTour(stored);
      })
      .catch((e) => setError({ message: 'No se pudo leer el tour guardado.', detail: String(e) }))
      .finally(() => setReady(true));
  }, []);

  // Autoguardado. El retardo evita escribir en cada tecla al renombrar.
  const firstSave = useRef(true);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  useEffect(() => {
    if (!ready) return;
    if (firstSave.current) {
      firstSave.current = false;
      return;
    }
    const timer = setTimeout(() => {
      saveTour(tour)
        .then(() => setSavedAt(Date.now()))
        .catch((e) => setError({ message: 'No se pudo guardar el tour.', detail: String(e) }));
    }, 400);
    return () => clearTimeout(timer);
  }, [tour, ready]);

  /**
   * Historial. Se toma una instantanea recien cuando los cambios se aquietan,
   * asi escribir un nombre entero deja una sola entrada y no una por tecla.
   */
  const past = useRef<Tour[]>([]);
  const future = useRef<Tour[]>([]);
  const skipHistory = useRef(false);
  const [historyTick, setHistoryTick] = useState(0);

  useEffect(() => {
    if (!ready) return;
    if (skipHistory.current) {
      skipHistory.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const last = past.current[past.current.length - 1];
      if (last && sameTour(last, tour)) return;
      past.current = [...past.current, tour].slice(-50);
      future.current = [];
      setHistoryTick((n) => n + 1);
    }, 600);
    return () => clearTimeout(timer);
  }, [tour, ready]);

  const undo = useCallback(() => {
    // La ultima entrada es el estado actual: hay que saltearla.
    if (past.current.length < 2) return;
    const current = past.current[past.current.length - 1];
    const previous = past.current[past.current.length - 2];
    past.current = past.current.slice(0, -1);
    future.current = [current, ...future.current].slice(0, 50);
    skipHistory.current = true;
    setTour(previous);
    setHistoryTick((n) => n + 1);
  }, []);

  const redo = useCallback(() => {
    const [next, ...rest] = future.current;
    if (!next) return;
    future.current = rest;
    past.current = [...past.current, next].slice(-50);
    skipHistory.current = true;
    setTour(next);
    setHistoryTick((n) => n + 1);
  }, []);

  const addScene = useCallback(async (file: File) => {
    setBusy(`Procesando ${file.name}…`);
    setError(null);
    try {
      const image = await readImage(file);
      const imageId = createId('img');
      await putImage(imageId, file);
      bitmapCache.set(imageId, image.preview);

      const scene: Scene = {
        id: createId('scene'),
        name: file.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'Escena',
        imageId,
        thumb: makeThumb(image.preview),
        width: image.width,
        height: image.height,
        fit: defaultFitOptions(image.width, image.height),
        initialYaw: 0,
        initialPitch: 0,
        hotspots: [],
      };

      setTour((prev) => ({
        ...prev,
        scenes: [...prev.scenes, scene],
        startSceneId: prev.startSceneId ?? scene.id,
      }));
      return scene.id;
    } catch (e) {
      const detail = e instanceof Error ? ((e as { detail?: string }).detail ?? e.message) : String(e);
      setError({
        message: e instanceof Error ? e.message : 'No se pudo agregar la panorámica.',
        detail,
      });
      return null;
    } finally {
      setBusy(null);
    }
  }, []);

  const removeScene = useCallback((sceneId: string) => {
    setTour((prev) => {
      const scene = prev.scenes.find((s) => s.id === sceneId);
      if (scene) {
        bitmapCache.get(scene.imageId)?.close();
        bitmapCache.delete(scene.imageId);
        void deleteImage(scene.imageId);
      }
      const scenes = prev.scenes
        .filter((s) => s.id !== sceneId)
        // Los saltos que apuntaban a la escena borrada quedan huerfanos:
        // se les quita el destino para que el editor los marque en rojo.
        .map((s) => ({
          ...s,
          hotspots: s.hotspots.map((h) =>
            h.targetSceneId === sceneId ? { ...h, targetSceneId: undefined } : h,
          ),
        }));
      return {
        ...prev,
        scenes,
        startSceneId: prev.startSceneId === sceneId ? (scenes[0]?.id ?? null) : prev.startSceneId,
      };
    });
  }, []);

  const updateScene = useCallback((sceneId: string, patch: Partial<Scene>) => {
    setTour((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s) => (s.id === sceneId ? { ...s, ...patch } : s)),
    }));
  }, []);

  const addHotspot = useCallback(
    (sceneId: string, kind: HotspotKind, yaw: number, pitch: number) => {
      const hotspot: Hotspot = {
        id: createId('hs'),
        kind,
        yaw,
        pitch,
        label: '',
        ...(kind === 'info' ? { text: '' } : {}),
      };
      setTour((prev) => ({
        ...prev,
        scenes: prev.scenes.map((s) =>
          s.id === sceneId ? { ...s, hotspots: [...s.hotspots, hotspot] } : s,
        ),
      }));
      return hotspot.id;
    },
    [],
  );

  const updateHotspot = useCallback(
    (sceneId: string, hotspotId: string, patch: Partial<Hotspot>) => {
      setTour((prev) => ({
        ...prev,
        scenes: prev.scenes.map((s) =>
          s.id === sceneId
            ? {
                ...s,
                hotspots: s.hotspots.map((h) => (h.id === hotspotId ? { ...h, ...patch } : h)),
              }
            : s,
        ),
      }));
    },
    [],
  );

  const removeHotspot = useCallback((sceneId: string, hotspotId: string) => {
    setTour((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s) =>
        s.id === sceneId ? { ...s, hotspots: s.hotspots.filter((h) => h.id !== hotspotId) } : s,
      ),
    }));
  }, []);

  const renameTour = useCallback((name: string) => setTour((prev) => ({ ...prev, name })), []);
  const setStartScene = useCallback(
    (sceneId: string) => setTour((prev) => ({ ...prev, startSceneId: sceneId })),
    [],
  );

  return {
    tour,
    ready,
    busy,
    error,
    savedAt,
    undo,
    redo,
    // `historyTick` fuerza el re-render: las pilas viven en refs.
    canUndo: historyTick >= 0 && past.current.length > 1,
    canRedo: historyTick >= 0 && future.current.length > 0,
    clearError: useCallback(() => setError(null), []),
    addScene,
    removeScene,
    updateScene,
    addHotspot,
    updateHotspot,
    removeHotspot,
    renameTour,
    setStartScene,
  };
}

/**
 * Devuelve el bitmap de una escena, decodificandolo desde IndexedDB la primera
 * vez. Las escenas ya visitadas quedan en cache, asi que volver atras es
 * instantaneo.
 */
export function useSceneBitmap(scene: Scene | null): {
  bitmap: ImageBitmap | null;
  loading: boolean;
} {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!scene) {
      setBitmap(null);
      return;
    }
    const cached = bitmapCache.get(scene.imageId);
    if (cached) {
      setBitmap(cached);
      return;
    }

    let cancelled = false;
    setLoading(true);
    getImage(scene.imageId)
      .then(async (blob) => {
        if (!blob) throw new Error('La imagen de esta escena no está en el almacenamiento.');
        const decoded = await readImage(new File([blob], scene.name, { type: blob.type }));
        bitmapCache.set(scene.imageId, decoded.preview);
        if (!cancelled) setBitmap(decoded.preview);
      })
      .catch(() => {
        if (!cancelled) setBitmap(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [scene]);

  return { bitmap, loading };
}

/** Precarga escenas vecinas para que el salto no muestre un negro. */
export function preloadScenes(scenes: Scene[]) {
  for (const scene of scenes) {
    if (bitmapCache.has(scene.imageId)) continue;
    void getImage(scene.imageId)
      .then((blob) => {
        if (!blob) return null;
        // Mismo tope que la decodificacion normal: una panoramica de 12000px
        // como textura agota la memoria de video de un celular.
        const options: ImageBitmapOptions = { imageOrientation: 'none' };
        if (scene.width > PREVIEW_MAX_WIDTH) {
          options.resizeWidth = PREVIEW_MAX_WIDTH;
          options.resizeHeight = Math.max(
            1,
            Math.round((scene.height * PREVIEW_MAX_WIDTH) / scene.width),
          );
          options.resizeQuality = 'high';
        }
        return createImageBitmap(blob, options);
      })
      .then((bitmap) => {
        if (bitmap && !bitmapCache.has(scene.imageId)) bitmapCache.set(scene.imageId, bitmap);
        else bitmap?.close();
      })
      .catch(() => undefined);
  }
}

/** `updatedAt` cambia en cada guardado, asi que no cuenta como cambio real. */
function sameTour(a: Tour, b: Tour): boolean {
  return (
    JSON.stringify({ ...a, updatedAt: 0 }) === JSON.stringify({ ...b, updatedAt: 0 })
  );
}

function makeThumb(bitmap: ImageBitmap): string {
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_WIDTH;
  canvas.height = Math.max(1, Math.round((bitmap.height * THUMB_WIDTH) / bitmap.width));
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.7);
}
