import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link2, MapPin, Plus } from 'lucide-react';
import { Header } from './Header';
import { IconRail, type RailTab } from './IconRail';
import { Stepper } from './Stepper';
import { PanoEditor } from '../features/editor/PanoEditor';
import { fitToEquirect } from '../features/editor/fitToEquirect';
import { TourViewer, type TourViewerHandle } from '../features/tour/TourViewer';
import { ScenesPanel } from '../features/tour/ScenesPanel';
import { HotspotPanel } from '../features/tour/HotspotPanel';
import { EmptyStage } from '../features/tour/EmptyStage';
import { preloadScenes, useSceneBitmap, useTour } from '../features/tour/useTour';
import { downloadSceneForFacebook } from '../features/tour/exportScene';
import {
  brokenLinks,
  findScene,
  unreachableScenes,
  type Hotspot,
  type HotspotKind,
} from '../lib/tour/types';

const THEME_KEY = 'sistema360:tema';

export function App() {
  const tourApi = useTour();
  const { tour, ready, busy, error, clearError } = tourApi;

  const [tab, setTab] = useState<RailTab>('escenas');
  const [theme, setTheme] = useState<'dark' | 'light'>(
    () => (localStorage.getItem(THEME_KEY) as 'dark' | 'light') ?? 'dark',
  );
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(null);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [editing, setEditing] = useState(true);
  const [placing, setPlacing] = useState<HotspotKind | null>(null);
  const [openInfo, setOpenInfo] = useState<Hotspot | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const viewerRef = useRef<TourViewerHandle>(null);
  const lastView = useRef({ yaw: 0, pitch: 0 });
  // Un solo input para toda la app: así el estado vacío del visor puede abrir
  // el selector aunque el panel de escenas no esté montado.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const openPicker = useCallback(() => fileInputRef.current?.click(), []);

  const scene = findScene(tour, currentSceneId);
  const { bitmap, loading } = useSceneBitmap(scene);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!ready) return;
    if (!findScene(tour, currentSceneId)) setCurrentSceneId(tour.startSceneId);
  }, [ready, tour, currentSceneId]);

  // Las escenas vecinas se descomprimen de fondo para que el salto sea directo.
  useEffect(() => {
    if (!scene) return;
    preloadScenes(
      scene.hotspots
        .map((h) => findScene(tour, h.targetSceneId ?? null))
        .filter((s): s is NonNullable<typeof s> => s !== null),
    );
  }, [scene, tour]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? '');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        if (e.shiftKey) tourApi.redo();
        else tourApi.undo();
        return;
      }
      if (e.key === 'Escape') {
        if (placing) setPlacing(null);
        else if (openInfo) setOpenInfo(null);
        else setSelectedHotspotId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [placing, openInfo, tourApi]);

  const sceneNames = useMemo(() => new Map(tour.scenes.map((s) => [s.id, s.name])), [tour.scenes]);
  const fit = useMemo(
    () => (scene ? fitToEquirect(scene.width, scene.height, scene.fit) : null),
    [scene],
  );
  const selectedHotspot = scene?.hotspots.find((h) => h.id === selectedHotspotId) ?? null;
  const broken = useMemo(() => brokenLinks(tour), [tour]);
  const orphans = useMemo(() => unreachableScenes(tour), [tour]);

  const goToScene = useCallback((sceneId: string) => {
    setCurrentSceneId(sceneId);
    setSelectedHotspotId(null);
    setOpenInfo(null);
  }, []);

  const handleFiles = async (files: File[]) => {
    let firstId: string | null = null;
    for (const file of files) {
      const id = await tourApi.addScene(file);
      firstId ??= id;
    }
    if (firstId && !currentSceneId) setCurrentSceneId(firstId);
  };

  const handlePlace = (yaw: number, pitch: number) => {
    if (!scene || !placing) return;
    setSelectedHotspotId(tourApi.addHotspot(scene.id, placing, yaw, pitch));
    setPlacing(null);
    setTab('puntos');
  };

  const handleExport = async () => {
    if (!scene) return;
    try {
      await downloadSceneForFacebook(scene);
      setNotice('Listo. Subilo a Facebook como una foto normal y lo muestra en 360.');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'No se pudo exportar.');
    }
  };

  return (
    <div className="app">
      <Header
        tourName={tour.name}
        isDraft
        savedAt={tourApi.savedAt}
        canUndo={tourApi.canUndo}
        canRedo={tourApi.canRedo}
        walking={!editing}
        onRename={tourApi.renameTour}
        onUndo={tourApi.undo}
        onRedo={tourApi.redo}
        onPreview={() => {
          setEditing(false);
          setPlacing(null);
          setSelectedHotspotId(null);
        }}
        onWalk={() => {
          setEditing(false);
          setPlacing(null);
          setSelectedHotspotId(null);
          viewerRef.current?.enterFullscreen();
        }}
      />

      <div className="workspace">
        <IconRail
          active={tab}
          theme={theme}
          onSelect={setTab}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          onHelp={() => setTab('ajustes')}
        />

        <aside className="sidebar">
          {error && (
            <div className="alert alert--error">
              {error.message}
              <details>
                <summary>Detalle técnico</summary>
                <code>{error.detail}</code>
              </details>
              <button className="linkish" onClick={clearError}>
                Cerrar
              </button>
            </div>
          )}

          {tab === 'escenas' && (
            <ScenesPanel
              tour={tour}
              currentSceneId={currentSceneId}
              busy={busy}
              onFiles={handleFiles}
              onPick={openPicker}
              onSelect={goToScene}
              onSetStart={tourApi.setStartScene}
              onRename={(id, name) => tourApi.updateScene(id, { name })}
              onRemove={(s) => {
                if (!confirm(`¿Eliminar "${s.name}"? También se borra su panorámica.`)) return;
                tourApi.removeScene(s.id);
                if (s.id === currentSceneId) setCurrentSceneId(null);
              }}
            />
          )}

          {tab === 'puntos' &&
            (!scene ? (
              <p className="hint">Abrí una escena para agregarle puntos.</p>
            ) : (
              <>
                <section className="block">
                  <h2>Puntos de {scene.name}</h2>
                  <div className="addpoints">
                    <button
                      className={`btn${placing === 'link' ? ' btn--primary' : ''}`}
                      onClick={() => {
                        setPlacing(placing === 'link' ? null : 'link');
                        setEditing(true);
                      }}
                    >
                      <Link2 size={14} strokeWidth={1.9} />
                      Salto
                    </button>
                    <button
                      className={`btn${placing === 'info' ? ' btn--primary' : ''}`}
                      onClick={() => {
                        setPlacing(placing === 'info' ? null : 'info');
                        setEditing(true);
                      }}
                    >
                      <MapPin size={14} strokeWidth={1.9} />
                      Información
                    </button>
                  </div>
                  <p className="hint">
                    {placing
                      ? 'Hacé clic en el visor donde va el punto.'
                      : 'Elegí un tipo y hacé clic en el visor. Los puestos se arrastran.'}
                  </p>

                  {scene.hotspots.length === 0 ? (
                    <p className="hint">Esta escena todavía no tiene puntos.</p>
                  ) : (
                    <ul className="hslist">
                      {scene.hotspots.map((h) => (
                        <li key={h.id}>
                          <button
                            className={h.id === selectedHotspotId ? 'is-on' : ''}
                            onClick={() => setSelectedHotspotId(h.id)}
                          >
                            <span className={`dot dot--${h.kind}`} />
                            {h.label ||
                              (h.kind === 'link' ? 'Salto sin nombre' : 'Info sin nombre')}
                            {h.kind === 'link' && (
                              <em>
                                {h.targetSceneId
                                  ? (sceneNames.get(h.targetSceneId) ?? '?')
                                  : 'sin destino'}
                              </em>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {selectedHotspot && (
                  <HotspotPanel
                    hotspot={selectedHotspot}
                    scene={scene}
                    scenes={tour.scenes}
                    onChange={(patch) =>
                      tourApi.updateHotspot(scene.id, selectedHotspot.id, patch)
                    }
                    onRemove={() => {
                      tourApi.removeHotspot(scene.id, selectedHotspot.id);
                      setSelectedHotspotId(null);
                    }}
                    onGoToTarget={goToScene}
                  />
                )}
              </>
            ))}

          {tab === 'encuadre' &&
            (!scene || !fit ? (
              <p className="hint">Abrí una escena para ajustar su encuadre.</p>
            ) : (
              <>
                <section className="block">
                  <h2>Encuadre de {scene.name}</h2>
                  <PanoEditor
                    width={scene.width}
                    height={scene.height}
                    options={scene.fit}
                    fit={fit}
                    onChange={(options) => tourApi.updateScene(scene.id, { fit: options })}
                  />
                </section>
                <section className="block">
                  <h2>Vista de entrada</h2>
                  <button
                    className="btn"
                    onClick={() => {
                      tourApi.updateScene(scene.id, {
                        initialYaw: lastView.current.yaw,
                        initialPitch: lastView.current.pitch,
                      });
                      setNotice('Guardado: el tour va a abrir esta escena mirando hacia acá.');
                    }}
                  >
                    Fijar la vista actual como entrada
                  </button>
                  <p className="hint">
                    Girá el visor hasta donde querés que mire el visitante al llegar, y tocá el
                    botón.
                  </p>
                  <button className="btn" onClick={handleExport} style={{ marginTop: 10 }}>
                    Descargar como foto 360 de Facebook
                  </button>
                  {notice && <p className="alert alert--ok">{notice}</p>}
                </section>
              </>
            ))}

          {tab === 'ajustes' && (
            <>
              <section className="block">
                <h2>Ajustes del tour</h2>
                <div className="field">
                  <label htmlFor="tour-name">Nombre</label>
                  <input
                    id="tour-name"
                    value={tour.name}
                    onChange={(e) => tourApi.renameTour(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="tour-start">Escena de inicio</label>
                  <select
                    id="tour-start"
                    value={tour.startSceneId ?? ''}
                    onChange={(e) => tourApi.setStartScene(e.target.value)}
                    disabled={tour.scenes.length === 0}
                  >
                    {tour.scenes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </section>

              <section className="block">
                <h2>Revisión</h2>
                {broken.length === 0 && orphans.length === 0 ? (
                  <p className="hint">No hay problemas: todos los puntos llevan a algún lado.</p>
                ) : (
                  <>
                    {broken.map(({ scene: s, hotspot }) => (
                      <p className="alert alert--warn" key={hotspot.id}>
                        En <strong>{s.name}</strong> hay un salto sin destino
                        {hotspot.label ? ` ("${hotspot.label}")` : ''}.
                      </p>
                    ))}
                    {orphans.map((s) => (
                      <p className="alert alert--warn" key={s.id}>
                        A <strong>{s.name}</strong> no llega ningún punto: el visitante nunca la va
                        a ver.
                      </p>
                    ))}
                  </>
                )}
              </section>

              <section className="block">
                <h2>Cómo funciona</h2>
                <p className="hint">
                  Cada escena es una panorámica apoyada sobre una esfera. Los puntos se guardan
                  como un ángulo, no como un píxel, así que quedan pegados al lugar aunque cambie
                  el zoom o el tamaño de la ventana.
                </p>
                <p className="hint">
                  Todo se guarda en tu navegador. Nada se sube a ningún servidor.
                </p>
              </section>
            </>
          )}
        </aside>

        <section className="stagecol">
          {scene && fit ? (
            <TourViewer
              ref={viewerRef}
              bitmap={bitmap}
              sphere={fit.sphere}
              hotspots={scene.hotspots}
              sceneNames={sceneNames}
              editing={editing}
              placing={!!placing}
              selectedId={selectedHotspotId}
              initialYaw={scene.initialYaw}
              initialPitch={scene.initialPitch}
              onPlace={handlePlace}
              onMove={(id, yaw, pitch) => tourApi.updateHotspot(scene.id, id, { yaw, pitch })}
              onSelect={setSelectedHotspotId}
              onNavigate={goToScene}
              onOpenInfo={setOpenInfo}
              onViewChange={(yaw, pitch) => {
                lastView.current = { yaw, pitch };
              }}
            />
          ) : loading ? (
            <div className="stage stage--empty">
              <p className="hint">Cargando escena…</p>
            </div>
          ) : (
            <EmptyStage onPick={openPicker} onFiles={handleFiles} />
          )}

          {openInfo && (
            <div className="infocard" role="dialog" aria-label={openInfo.label}>
              <button className="infocard__close" onClick={() => setOpenInfo(null)}>
                ✕
              </button>
              <h3>{openInfo.label || 'Información'}</h3>
              <p>{openInfo.text || 'Este punto todavía no tiene texto.'}</p>
            </div>
          )}

          <Stepper tour={tour} />
        </section>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        // Sin `accept`: Windows a veces no asocia un MIME al archivo y el
        // selector lo esconde, con lo que parece que el sitio no hace nada.
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) void handleFiles(files);
          e.target.value = '';
        }}
      />

      {editing || (
        <button className="backtoedit" onClick={() => setEditing(true)}>
          <Plus size={14} strokeWidth={2} style={{ transform: 'rotate(45deg)' }} />
          Salir de la vista previa
        </button>
      )}
    </div>
  );
}
