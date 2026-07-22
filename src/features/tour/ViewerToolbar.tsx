import { Hand, Maximize, Minimize, ZoomIn, ZoomOut } from 'lucide-react';

interface Props {
  fullscreen: boolean;
  onResetView: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleFullscreen: () => void;
}

export function ViewerToolbar({
  fullscreen,
  onResetView,
  onZoomIn,
  onZoomOut,
  onToggleFullscreen,
}: Props) {
  return (
    <div className="vtoolbar">
      <button onClick={onResetView} title="Volver a la vista de entrada" aria-label="Reiniciar vista">
        <Hand size={16} strokeWidth={1.7} />
      </button>
      <button onClick={onZoomIn} title="Acercar" aria-label="Acercar">
        <ZoomIn size={16} strokeWidth={1.7} />
      </button>
      <button onClick={onZoomOut} title="Alejar" aria-label="Alejar">
        <ZoomOut size={16} strokeWidth={1.7} />
      </button>
      <span className="vtoolbar__sep" />
      <button
        onClick={onToggleFullscreen}
        title={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
        aria-label="Pantalla completa"
      >
        {fullscreen ? (
          <Minimize size={16} strokeWidth={1.7} />
        ) : (
          <Maximize size={16} strokeWidth={1.7} />
        )}
      </button>
    </div>
  );
}
