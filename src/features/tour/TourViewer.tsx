import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { Info } from 'lucide-react';
import type { Fit } from '../editor/fitToEquirect';
import type { Hotspot } from '../../lib/tour/types';
import {
  clampPitch,
  projectToScreen,
  yawPitchFromScreen,
  type ScreenPlacement,
} from '../../lib/tour/geometry';
import { HotspotMarker } from './HotspotMarker';
import { Compass, type CompassHandle } from './Compass';
import { ViewerToolbar } from './ViewerToolbar';

const BASE_FOV = 75;
const MIN_FOV = 30;
const MAX_FOV = 100;
/** Un arrastre menor a esto cuenta como clic, no como giro de camara. */
const CLICK_SLOP_PX = 5;

export interface TourViewerHandle {
  /** Usado por "Recorrer tour": abre el visor a pantalla completa. */
  enterFullscreen(): void;
}

interface Props {
  bitmap: ImageBitmap | null;
  sphere: Fit['sphere'];
  hotspots: Hotspot[];
  /** Nombre de cada escena, para rotular los puntos de salto. */
  sceneNames: Map<string, string>;
  editing: boolean;
  /** Armado para colocar el proximo punto donde se haga clic. */
  placing: boolean;
  selectedId: string | null;
  initialYaw: number;
  initialPitch: number;
  onPlace: (yaw: number, pitch: number) => void;
  onMove: (id: string, yaw: number, pitch: number) => void;
  onSelect: (id: string | null) => void;
  onNavigate: (sceneId: string) => void;
  onOpenInfo: (hotspot: Hotspot) => void;
  onViewChange: (yaw: number, pitch: number) => void;
}

export const TourViewer = forwardRef<TourViewerHandle, Props>(function TourViewer(
  {
    bitmap,
    sphere,
    hotspots,
    sceneNames,
    editing,
    placing,
    selectedId,
    initialYaw,
    initialPitch,
    onPlace,
    onMove,
    onSelect,
    onNavigate,
    onOpenInfo,
    onViewChange,
  },
  ref,
) {
  const shellRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const compassRef = useRef<CompassHandle>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const textureRef = useRef<THREE.Texture | null>(null);
  const viewRef = useRef({ yaw: initialYaw, pitch: initialPitch });
  const sizeRef = useRef({ width: 1, height: 1 });

  // Los datos que el bucle de render necesita cada frame viven en refs: si
  // dependieran del estado de React, habria un re-render por cuadro.
  const markersRef = useRef(new Map<string, HTMLElement>());
  const hotspotsRef = useRef(hotspots);
  hotspotsRef.current = hotspots;
  const draggingHotspotRef = useRef<string | null>(null);
  const cameraControlRef = useRef<{ reset: () => void; zoom: (delta: number) => void } | null>(null);
  const initialViewRef = useRef({ yaw: initialYaw, pitch: initialPitch });
  initialViewRef.current = { yaw: initialYaw, pitch: initialPitch };

  const [fading, setFading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const registerMarker = useCallback((id: string, el: HTMLElement | null) => {
    if (el) markersRef.current.set(id, el);
    else markersRef.current.delete(id);
  }, []);

  // --- Escena, controles y bucle de render: se montan una sola vez ---
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x0d1017);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.1, 1100);
    sceneRef.current = scene;
    cameraRef.current = camera;

    const backdrop = new THREE.Mesh(
      new THREE.SphereGeometry(505, 32, 24),
      new THREE.MeshBasicMaterial({
        color: 0x1a202e,
        side: THREE.BackSide,
        wireframe: true,
        transparent: true,
        opacity: 0.3,
      }),
    );
    scene.add(backdrop);

    const resize = () => {
      const { clientWidth, clientHeight } = host;
      if (!clientWidth || !clientHeight) return;
      sizeRef.current = { width: clientWidth, height: clientHeight };
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    // --- Camara: arrastre y zoom ---
    const canvas = renderer.domElement;
    let dragging = false;
    let moved = 0;
    let lastX = 0;
    let lastY = 0;

    const onPointerDown = (e: PointerEvent) => {
      if (draggingHotspotRef.current) return;
      dragging = true;
      moved = 0;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      moved += Math.abs(dx) + Math.abs(dy);
      const speed = (camera.fov / BASE_FOV) * 0.005;
      viewRef.current.yaw -= dx * speed;
      viewRef.current.pitch = clampPitch(viewRef.current.pitch + dy * speed);
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      canvas.releasePointerCapture(e.pointerId);
      if (moved > CLICK_SLOP_PX) {
        onViewChangeRef.current(viewRef.current.yaw, viewRef.current.pitch);
        return;
      }
      // Clic limpio sobre la esfera.
      const rect = canvas.getBoundingClientRect();
      const { width, height } = sizeRef.current;
      const { yaw, pitch } = yawPitchFromScreen(
        camera,
        e.clientX - rect.left,
        e.clientY - rect.top,
        width,
        height,
      );
      if (placingRef.current) onPlaceRef.current(yaw, clampPitch(pitch));
      else onSelectRef.current(null);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camera.fov = THREE.MathUtils.clamp(camera.fov + e.deltaY * 0.05, MIN_FOV, MAX_FOV);
      camera.updateProjectionMatrix();
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    const target = new THREE.Vector3();
    const draw = () => {
      const { yaw, pitch } = viewRef.current;
      const cos = Math.cos(pitch);
      target.set(Math.sin(yaw) * cos, Math.sin(pitch), -Math.cos(yaw) * cos);
      camera.lookAt(target);
      renderer.render(scene, camera);
      positionMarkers(camera);
      compassRef.current?.update(yaw, camera.fov);
    };
    cameraControlRef.current = {
      reset: () => {
        camera.fov = BASE_FOV;
        camera.updateProjectionMatrix();
        viewRef.current.yaw = initialViewRef.current.yaw;
        viewRef.current.pitch = initialViewRef.current.pitch;
      },
      zoom: (delta: number) => {
        camera.fov = THREE.MathUtils.clamp(camera.fov + delta, MIN_FOV, MAX_FOV);
        camera.updateProjectionMatrix();
      },
    };

    /** Pega cada marcador HTML a su posicion proyectada desde la esfera. */
    const positionMarkers = (cam: THREE.PerspectiveCamera) => {
      const { width, height } = sizeRef.current;
      // Los puntos crecen al acercar el zoom, como si estuvieran en el mundo.
      const scale = THREE.MathUtils.clamp(BASE_FOV / cam.fov, 0.55, 2.2);
      for (const hotspot of hotspotsRef.current) {
        const el = markersRef.current.get(hotspot.id);
        if (!el) continue;
        const placement: ScreenPlacement = projectToScreen(
          hotspot.yaw,
          hotspot.pitch,
          cam,
          width,
          height,
        );
        if (!placement.visible) {
          el.style.visibility = 'hidden';
          continue;
        }
        el.style.visibility = 'visible';
        el.style.transform =
          `translate(${placement.x.toFixed(1)}px, ${placement.y.toFixed(1)}px) ` +
          `translate(-50%, -50%) scale(${scale.toFixed(3)})`;
      }
    };

    renderer.setAnimationLoop(draw);

    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__viewer = {
        renderer,
        scene,
        camera,
        draw,
        view: viewRef.current,
        size: sizeRef.current,
      };
    }

    return () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      backdrop.geometry.dispose();
      backdrop.material.dispose();
      renderer.dispose();
      host.removeChild(canvas);
      sceneRef.current = null;
      cameraRef.current = null;
    };
  }, []);

  // Callbacks siempre frescos sin volver a montar la escena.
  const onPlaceRef = useRef(onPlace);
  const onSelectRef = useRef(onSelect);
  const onViewChangeRef = useRef(onViewChange);
  const placingRef = useRef(placing);
  onPlaceRef.current = onPlace;
  onSelectRef.current = onSelect;
  onViewChangeRef.current = onViewChange;
  placingRef.current = placing;

  // --- Textura de la escena actual ---
  useEffect(() => {
    if (!bitmap) return;
    const texture = new THREE.Texture(bitmap as unknown as HTMLImageElement);
    texture.colorSpace = THREE.SRGBColorSpace;
    // three.js ignora `flipY` con ImageBitmap: la imagen quedaria de cabeza.
    // Se invierte la V por matriz de UV, sin tocar los pixeles.
    texture.flipY = false;
    texture.repeat.y = -1;
    texture.offset.y = 1;
    texture.needsUpdate = true;
    textureRef.current = texture;

    const mesh = meshRef.current;
    if (mesh) {
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.map = texture;
      material.needsUpdate = true;
    }

    // Fundido de entrada: disimula el salto entre escenas.
    setFading(true);
    const timer = setTimeout(() => setFading(false), 30);
    return () => {
      clearTimeout(timer);
      texture.dispose();
      textureRef.current = null;
    };
  }, [bitmap]);

  // --- Geometria: cambia con el encuadre de la escena ---
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const geometry = new THREE.SphereGeometry(
      500,
      Math.max(16, Math.round((sphere.phiLength / (Math.PI * 2)) * 96)),
      Math.max(12, Math.round((sphere.thetaLength / Math.PI) * 64)),
      sphere.phiStart,
      sphere.phiLength,
      sphere.thetaStart,
      sphere.thetaLength,
    );
    geometry.scale(-1, 1, 1); // caras hacia adentro sin espejar la textura

    const material = new THREE.MeshBasicMaterial({
      map: textureRef.current,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    meshRef.current = mesh;

    return () => {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
      meshRef.current = null;
    };
  }, [sphere.phiStart, sphere.phiLength, sphere.thetaStart, sphere.thetaLength]);

  // Al entrar a una escena la camara arranca donde la dejo el autor.
  useEffect(() => {
    viewRef.current.yaw = initialYaw;
    viewRef.current.pitch = clampPitch(initialPitch);
  }, [initialYaw, initialPitch, bitmap]);

  // --- Arrastre de un punto en modo edicion ---
  const startHotspotDrag = useCallback(
    (id: string, event: React.PointerEvent) => {
      if (!editing) return;
      event.stopPropagation();
      event.preventDefault();
      const camera = cameraRef.current;
      const host = hostRef.current;
      if (!camera || !host) return;

      draggingHotspotRef.current = id;
      onSelect(id);

      const rect = host.getBoundingClientRect();
      let moved = 0;

      const move = (e: PointerEvent) => {
        moved += Math.abs(e.movementX) + Math.abs(e.movementY);
        const { yaw, pitch } = yawPitchFromScreen(
          camera,
          e.clientX - rect.left,
          e.clientY - rect.top,
          sizeRef.current.width,
          sizeRef.current.height,
        );
        onMove(id, yaw, clampPitch(pitch));
      };
      const up = () => {
        draggingHotspotRef.current = null;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [editing, onMove, onSelect],
  );

  // Pantalla completa: el navegador puede salir por Esc sin avisarnos, así que
  // el estado se toma del evento y no de nuestro propio clic.
  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void shellRef.current?.requestFullscreen?.().catch(() => undefined);
  }, []);

  useImperativeHandle(ref, () => ({
    enterFullscreen() {
      if (!document.fullscreenElement) {
        void shellRef.current?.requestFullscreen?.().catch(() => undefined);
      }
    },
  }), []);

  return (
    <div
      className={`tourviewer${placing ? ' tourviewer--placing' : ''}`}
      ref={shellRef}
    >
      <div className="tourviewer__canvas" ref={hostRef} />

      <div className="tourviewer__overlay">
        {hotspots.map((hotspot) => (
          <HotspotMarker
            key={hotspot.id}
            hotspot={hotspot}
            targetName={
              hotspot.targetSceneId ? sceneNames.get(hotspot.targetSceneId) : undefined
            }
            editing={editing}
            selected={hotspot.id === selectedId}
            registerRef={registerMarker}
            onPointerDown={(e) => startHotspotDrag(hotspot.id, e)}
            onActivate={() => {
              if (editing) onSelect(hotspot.id);
              else if (hotspot.kind === 'link' && hotspot.targetSceneId) {
                onNavigate(hotspot.targetSceneId);
              } else if (hotspot.kind === 'info') {
                onOpenInfo(hotspot);
              }
            }}
          />
        ))}
      </div>

      <div className={`tourviewer__fade${fading ? ' tourviewer__fade--on' : ''}`} />

      {placing && (
        <p className="tourviewer__banner">
          Hacé clic donde quieras el punto. Con <kbd>Esc</kbd> cancelás.
        </p>
      )}

      <button
        className="howto"
        onClick={() => setHelpOpen((open) => !open)}
        aria-expanded={helpOpen}
      >
        <Info size={13} strokeWidth={1.9} />
        ¿Cómo funciona?
      </button>

      {helpOpen && (
        <div className="howto__pop" role="dialog" aria-label="Cómo funciona">
          <p>
            <strong>Arrastrá</strong> para mirar alrededor y usá la <strong>rueda</strong> para
            acercar.
          </p>
          <p>
            En <strong>Editar</strong>, elegí un tipo de punto y hacé clic donde va. Los puntos ya
            colocados se arrastran.
          </p>
          <p>
            En <strong>Recorrer</strong>, los puntos llevan de una escena a otra, como en Street
            View.
          </p>
          <button onClick={() => setHelpOpen(false)}>Entendido</button>
        </div>
      )}

      <ViewerToolbar
        fullscreen={fullscreen}
        onResetView={() => cameraControlRef.current?.reset()}
        onZoomIn={() => cameraControlRef.current?.zoom(-10)}
        onZoomOut={() => cameraControlRef.current?.zoom(10)}
        onToggleFullscreen={toggleFullscreen}
      />

      <Compass ref={compassRef} />
    </div>
  );
});
