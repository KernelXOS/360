import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Hotspot } from '../../lib/tour/types';

interface Props {
  hotspot: Hotspot;
  /** Nombre de la escena destino, para el rotulo de los puntos de salto. */
  targetName?: string;
  editing: boolean;
  selected: boolean;
  registerRef: (id: string, el: HTMLElement | null) => void;
  onPointerDown: (event: ReactPointerEvent) => void;
  onActivate: () => void;
}

export function HotspotMarker({
  hotspot,
  targetName,
  editing,
  selected,
  registerRef,
  onPointerDown,
  onActivate,
}: Props) {
  const broken = hotspot.kind === 'link' && !targetName;
  const label = hotspot.label || targetName || (hotspot.kind === 'link' ? 'Sin destino' : 'Info');

  return (
    <div
      // El bucle de render escribe `transform` sobre este nodo cada cuadro,
      // asi que su posicion no puede venir de CSS.
      ref={(el) => registerRef(hotspot.id, el)}
      className={
        `hs hs--${hotspot.kind}` +
        (selected ? ' hs--selected' : '') +
        (broken ? ' hs--broken' : '') +
        (editing ? ' hs--editing' : '')
      }
      role="button"
      tabIndex={0}
      aria-label={label}
      onPointerDown={onPointerDown}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate();
        }
      }}
    >
      <span className="hs__pulse" aria-hidden="true" />
      <span className="hs__core" aria-hidden="true">
        {hotspot.kind === 'link' ? <ArrowGlyph /> : <InfoGlyph />}
      </span>
      <span className="hs__label">{label}</span>
    </div>
  );
}

function ArrowGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path
        d="M12 4.5 L19 12.5 L14.5 12.5 L14.5 19.5 L9.5 19.5 L9.5 12.5 L5 12.5 Z"
        fill="currentColor"
      />
    </svg>
  );
}

function InfoGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle cx="12" cy="6.6" r="1.9" fill="currentColor" />
      <rect x="10.1" y="10" width="3.8" height="10" rx="1.9" fill="currentColor" />
    </svg>
  );
}
