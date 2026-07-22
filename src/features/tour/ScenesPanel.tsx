import { useState } from 'react';
import { CloudUpload, FolderOpen, LayoutGrid, List, Plus, Star, Trash2 } from 'lucide-react';
import type { Scene, Tour } from '../../lib/tour/types';

interface Props {
  tour: Tour;
  currentSceneId: string | null;
  busy: string | null;
  onFiles: (files: File[]) => void;
  /** Abre el selector de archivos, que vive en la App para estar siempre disponible. */
  onPick: () => void;
  onSelect: (sceneId: string) => void;
  onSetStart: (sceneId: string) => void;
  onRename: (sceneId: string, name: string) => void;
  onRemove: (scene: Scene) => void;
}

export function ScenesPanel({
  tour,
  currentSceneId,
  busy,
  onFiles,
  onPick,
  onSelect,
  onSetStart,
  onRename,
  onRemove,
}: Props) {
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [over, setOver] = useState(false);

  return (
    <div className="spanel">
      <div className="spanel__head">
        <h2>Escenas</h2>
        <div className="viewtoggle">
          <button
            className={view === 'list' ? 'is-on' : ''}
            onClick={() => setView('list')}
            title="Ver como lista"
            aria-label="Ver como lista"
          >
            <List size={15} strokeWidth={1.75} />
          </button>
          <button
            className={view === 'grid' ? 'is-on' : ''}
            onClick={() => setView('grid')}
            title="Ver como grilla"
            aria-label="Ver como grilla"
          >
            <LayoutGrid size={15} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <div
        className={`uploader${over ? ' uploader--over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const files = Array.from(e.dataTransfer.files);
          if (files.length) onFiles(files);
        }}
      >
        <span className="uploader__icon">
          <CloudUpload size={26} strokeWidth={1.4} />
        </span>
        <p className="uploader__title">Importá tus panorámicas 360°</p>
        <p className="uploader__sub">
          Arrastrá y soltá tus imágenes equirectangulares (JPG, PNG)
        </p>
        <button className="btn btn--primary" onClick={onPick} disabled={!!busy}>
          <Plus size={15} strokeWidth={2} />
          Agregar escena
        </button>
        <div className="uploader__or">
          <span>o</span>
        </div>
        <button className="btn" onClick={onPick} disabled={!!busy}>
          <FolderOpen size={15} strokeWidth={1.75} />
          Seleccionar archivos
        </button>
      </div>

      {busy && <p className="alert">{busy}</p>}

      <p className="spanel__count">
        {tour.scenes.length} escena{tour.scenes.length === 1 ? '' : 's'}
      </p>

      {tour.scenes.length === 0 ? (
        <div className="blank">
          <PlanetSketch />
          <p className="blank__title">Aún no hay escenas en tu tour</p>
          <p className="blank__sub">Agregá tu primera panorámica 360° para comenzar.</p>
        </div>
      ) : view === 'list' ? (
        <ul className="scenes">
          {tour.scenes.map((scene, index) => (
            <SceneRow
              key={scene.id}
              scene={scene}
              index={index}
              active={scene.id === currentSceneId}
              isStart={scene.id === tour.startSceneId}
              onSelect={onSelect}
              onSetStart={onSetStart}
              onRename={onRename}
              onRemove={onRemove}
            />
          ))}
        </ul>
      ) : (
        <ul className="scenegrid">
          {tour.scenes.map((scene, index) => (
            <li
              key={scene.id}
              className={`sgcard${scene.id === currentSceneId ? ' sgcard--active' : ''}`}
            >
              <button onClick={() => onSelect(scene.id)}>
                {scene.thumb ? <img src={scene.thumb} alt="" /> : <span className="sgcard__ph" />}
                <span className="sgcard__index">{index + 1}</span>
                {scene.id === tour.startSceneId && (
                  <span className="sgcard__star" title="Escena de inicio">
                    <Star size={11} strokeWidth={2} fill="currentColor" />
                  </span>
                )}
              </button>
              <p title={scene.name}>{scene.name}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface RowProps {
  scene: Scene;
  index: number;
  active: boolean;
  isStart: boolean;
  onSelect: (id: string) => void;
  onSetStart: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (scene: Scene) => void;
}

function SceneRow({
  scene,
  index,
  active,
  isStart,
  onSelect,
  onSetStart,
  onRename,
  onRemove,
}: RowProps) {
  const links = scene.hotspots.filter((h) => h.kind === 'link').length;
  const infos = scene.hotspots.length - links;

  return (
    <li className={`scene${active ? ' scene--active' : ''}`}>
      <button className="scene__open" onClick={() => onSelect(scene.id)} title="Abrir escena">
        {scene.thumb ? (
          <img src={scene.thumb} alt="" className="scene__thumb" />
        ) : (
          <span className="scene__thumb scene__thumb--empty" />
        )}
        <span className="scene__index">{index + 1}</span>
      </button>

      <div className="scene__body">
        <input
          className="scene__name"
          value={scene.name}
          onChange={(e) => onRename(scene.id, e.target.value)}
          aria-label="Nombre de la escena"
        />
        <p className="scene__stats">
          {links} salto{links === 1 ? '' : 's'} · {infos} info{infos === 1 ? '' : 's'}
          {isStart && <span className="chip chip--start">Inicio</span>}
        </p>
      </div>

      <div className="scene__actions">
        {!isStart && (
          <button onClick={() => onSetStart(scene.id)} title="Empezar el tour por esta escena">
            <Star size={14} strokeWidth={1.75} />
          </button>
        )}
        <button className="scene__delete" onClick={() => onRemove(scene)} title="Eliminar escena">
          <Trash2 size={14} strokeWidth={1.75} />
        </button>
      </div>
    </li>
  );
}

function PlanetSketch() {
  return (
    <svg viewBox="0 0 120 90" width="118" height="90" className="blank__art" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
        <circle cx="60" cy="45" r="21" />
        <ellipse cx="60" cy="45" rx="38" ry="12" transform="rotate(-19 60 45)" />
        <path d="M49 38 q8 5 17 2 M52 52 q9 4 18 -1" opacity="0.65" />
        <path d="M22 18 v8 M18 22 h8 M99 26 v6 M96 29 h6 M30 70 v6 M27 73 h6" opacity="0.8" />
      </g>
    </svg>
  );
}
