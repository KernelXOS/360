import { useState } from 'react';
import { ImagePlus } from 'lucide-react';

interface Props {
  onPick: () => void;
  onFiles: (files: File[]) => void;
}

/**
 * Estado vacío del visor. El dibujo de fondo es puro trazo a muy baja opacidad:
 * sugiere de qué se trata sin competir con el texto.
 */
export function EmptyStage({ onPick, onFiles }: Props) {
  const [over, setOver] = useState(false);

  return (
    <div
      className={`stage stage--empty${over ? ' stage--over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        // El texto del centro promete que se puede soltar acá, así que se puede.
        const files = Array.from(e.dataTransfer.files);
        if (files.length) onFiles(files);
      }}
    >
      <RoomSketch />

      <div className="stage__center">
        <Logo360 />
        <h2>Tu tour 360°</h2>
        <p>
          Aún no hay panorámicas cargadas.
          <br />
          Agregá tu primera escena para comenzar a construir tu experiencia.
        </p>

        <button className="stage__drop" onClick={onPick}>
          <span className="stage__dropicon">
            <ImagePlus size={22} strokeWidth={1.5} />
          </span>
          <span className="stage__droparrow" aria-hidden="true">
            <svg viewBox="0 0 60 40" width="60" height="40" fill="none">
              <path
                d="M56 4C56 22 44 32 22 34"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeDasharray="3 4"
              />
              <path
                d="M28 28 L20 34.5 L28.5 38"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          Arrastrá una panorámica aquí
          <br />
          para empezar
        </button>
      </div>
    </div>
  );
}

function Logo360() {
  return (
    <svg viewBox="0 0 160 160" width="132" height="132" className="stage__logo" aria-hidden="true">
      <circle cx="80" cy="80" r="66" className="stage__logoring" />
      <path
        d="M80 14 A66 66 0 0 1 138 46"
        className="stage__logoarc"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M132 34 L142 48 L126 52 Z" className="stage__logohead" />
      <text x="80" y="92" textAnchor="middle" className="stage__logotext">
        360°
      </text>
    </svg>
  );
}

/**
 * Sala dibujada a un trazo, como marca de agua del escenario.
 * Se escala con `meet` y no con `slice`: el contenedor es más alto que el
 * dibujo, y recortarlo lo agrandaba hasta tapar el texto del centro.
 */
function RoomSketch() {
  return (
    <svg
      className="stage__sketch"
      viewBox="0 0 900 460"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      fill="none"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Piso y paredes */}
      <path d="M0 330 H900 M120 60 V330 M780 60 V330" />
      <path d="M0 400 H900" opacity="0.5" />

      {/* Ventana con paisaje */}
      <rect x="150" y="105" width="215" height="150" rx="4" />
      <path d="M150 215 L205 175 L245 205 L300 155 L365 205 V255 H150 Z" opacity="0.75" />
      <circle cx="330" cy="140" r="14" opacity="0.75" />

      {/* Lámpara colgante */}
      <path d="M450 60 V120" />
      <path d="M405 155 L432 120 H468 L495 155 Z" />

      {/* Sofá */}
      <path d="M150 300 V255 a12 12 0 0 1 12 -12 h176 a12 12 0 0 1 12 12 v45" />
      <path d="M150 300 h200 M186 243 v-22 a10 10 0 0 1 10 -10 h108 a10 10 0 0 1 10 10 v22" />
      <path d="M172 300 v22 M328 300 v22" />

      {/* Mesa baja */}
      <ellipse cx="440" cy="315" rx="52" ry="14" />
      <path d="M415 325 v16 M465 325 v16" />

      {/* Sillón */}
      <path d="M600 300 v-40 a10 10 0 0 1 10 -10 h48 a10 10 0 0 1 10 10 v40 Z" />
      <path d="M604 258 v-24 a9 9 0 0 1 9 -9 h42 a9 9 0 0 1 9 9 v24" />

      {/* Televisor */}
      <rect x="700" y="150" width="150" height="92" rx="5" />
      <path d="M760 242 v18 M735 262 h50" />

      {/* Planta */}
      <path d="M545 300 l10 -46 h26 l10 46 Z" />
      <path d="M568 254 c-14 -18 -6 -40 4 -46 c8 12 10 32 -4 46" />
    </svg>
  );
}
