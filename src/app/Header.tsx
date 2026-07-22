import { useEffect, useState } from 'react';
import {
  Check,
  ChevronDown,
  CloudUpload,
  Footprints,
  Pencil,
  Play,
  Redo2,
  Share2,
  Undo2,
  Rocket,
} from 'lucide-react';

interface Props {
  tourName: string;
  isDraft: boolean;
  savedAt: number | null;
  canUndo: boolean;
  canRedo: boolean;
  walking: boolean;
  onRename: (name: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onPreview: () => void;
  onWalk: () => void;
}

export function Header({
  tourName,
  isDraft,
  savedAt,
  canUndo,
  canRedo,
  walking,
  onRename,
  onUndo,
  onRedo,
  onPreview,
  onWalk,
}: Props) {
  const [editing, setEditing] = useState(false);

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="topbar__logo">
          <CloudUpload size={17} strokeWidth={1.75} />
        </span>
        <span className="topbar__product">Creador de Tours 360°</span>
      </div>

      <div className="topbar__doc">
        <div className="topbar__docname">
          {editing ? (
            <input
              autoFocus
              value={tourName}
              onChange={(e) => onRename(e.target.value)}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => e.key === 'Enter' && setEditing(false)}
              aria-label="Nombre del tour"
            />
          ) : (
            <>
              <h1>{tourName || 'Tour sin título'}</h1>
              <button onClick={() => setEditing(true)} aria-label="Renombrar tour">
                <Pencil size={13} strokeWidth={1.75} />
              </button>
            </>
          )}
        </div>
        <p className="topbar__meta">
          {isDraft ? 'Tour sin publicar' : 'Tour'}
          <span className="chip">Borrador</span>
        </p>
      </div>

      <div className="topbar__history">
        <button onClick={onUndo} disabled={!canUndo} title="Deshacer (Ctrl+Z)">
          <Undo2 size={16} strokeWidth={1.75} />
        </button>
        <button onClick={onRedo} disabled={!canRedo} title="Rehacer (Ctrl+Shift+Z)">
          <Redo2 size={16} strokeWidth={1.75} />
        </button>
      </div>

      <SaveIndicator savedAt={savedAt} />

      <div className="topbar__actions">
        <button className="tbtn" onClick={onPreview}>
          <Play size={15} strokeWidth={1.75} />
          Vista previa
        </button>
        <button className={`tbtn${walking ? ' tbtn--on' : ''}`} onClick={onWalk}>
          <Footprints size={15} strokeWidth={1.75} />
          Recorrer tour
        </button>
        <button
          className="tbtn"
          disabled
          title="Necesita la exportación del visor autónomo, que todavía no está hecha."
        >
          <Share2 size={15} strokeWidth={1.75} />
          Compartir
        </button>
        <div className="tbtn__split">
          <button
            className="tbtn tbtn--primary"
            disabled
            title="Necesita la exportación del visor autónomo, que todavía no está hecha."
          >
            <Rocket size={15} strokeWidth={1.75} />
            Publicar
          </button>
          <button className="tbtn tbtn--primary tbtn--caret" disabled aria-label="Más opciones">
            <ChevronDown size={15} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </header>
  );
}

/** Muestra hace cuánto se guardó, refrescándose solo. */
function SaveIndicator({ savedAt }: { savedAt: number | null }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 20_000);
    return () => clearInterval(timer);
  }, []);

  if (!savedAt) return <span className="topbar__saved topbar__saved--idle">Sin cambios</span>;

  return (
    <span className="topbar__saved">
      <Check size={14} strokeWidth={2} />
      <span>
        Guardado
        <em>{relativeTime(savedAt)}</em>
      </span>
    </span>
  );
}

function relativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 45) return 'recién';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `hace ${hours} h`;
}
