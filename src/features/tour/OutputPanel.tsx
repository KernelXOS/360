import { useEffect, useState } from 'react';
import { Download, Package } from 'lucide-react';
import type { Scene, Tour } from '../../lib/tour/types';
import { OUTPUT_PRESETS, maxTextureSize } from '../../lib/image/normalize';

interface Props {
  tour: Tour;
  scene: Scene | null;
  onChangeWidth: (width: number) => void;
  onDownloadScene: () => void;
  onDownloadAll: () => void;
  busy: string | null;
  notice: string | null;
}

export function OutputPanel({
  tour,
  scene,
  onChangeWidth,
  onDownloadScene,
  onDownloadAll,
  busy,
  notice,
}: Props) {
  const [draft, setDraft] = useState(String(tour.outputWidth));
  useEffect(() => setDraft(String(tour.outputWidth)), [tour.outputWidth]);

  const gpuMax = maxTextureSize();
  const parsed = Number(draft);
  const valido = Number.isFinite(parsed) && parsed >= 512 && parsed <= 16384;

  const commit = () => {
    if (valido && parsed !== tour.outputWidth) onChangeWidth(Math.round(parsed));
    else setDraft(String(tour.outputWidth));
  };

  return (
    <>
      <section className="block">
        <h2>Resolución de salida</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          Toda panorámica que subas se convierte a esta medida exacta. La altura es siempre la
          mitad del ancho: eso es lo que define una equirectangular de 360°×180°.
        </p>

        <div className="presets">
          {OUTPUT_PRESETS.map((width) => (
            <button
              key={width}
              className={tour.outputWidth === width ? 'is-on' : ''}
              onClick={() => onChangeWidth(width)}
              disabled={width > gpuMax}
              title={
                width > gpuMax
                  ? `Tu placa de video no soporta texturas de ${width}px.`
                  : `${width} × ${width / 2}`
              }
            >
              {width} × {width / 2}
            </button>
          ))}
        </div>

        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="out-width">Ancho exacto (px)</label>
          <div className="widthrow">
            <input
              id="out-width"
              type="number"
              min={512}
              max={16384}
              step={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => e.key === 'Enter' && commit()}
            />
            <span className="widthrow__times">×</span>
            <output className="widthrow__height">
              {valido ? Math.round(parsed / 2) : '—'}
            </output>
          </div>
          {!valido && <p className="alert alert--warn">Poné un ancho entre 512 y 16384.</p>}
          {valido && parsed > gpuMax && (
            <p className="alert alert--warn">
              Tu placa de video llega hasta {gpuMax}px. Más grande que eso se guarda igual, pero el
              visor lo va a mostrar reducido.
            </p>
          )}
        </div>

        {scene && (
          <>
            <button
              className="btn"
              onClick={() => onChangeWidth(scene.width)}
              disabled={scene.width === tour.outputWidth}
            >
              Usar la resolución de «{scene.name}» ({scene.width})
            </button>
            <p className="hint">
              Cargá tu foto de referencia y tocá este botón: fija su medida para todo el tour, sin
              que tengas que averiguarla.
            </p>
          </>
        )}

        <p className="alert">
          Cambiar la resolución afecta a las panorámicas que subas <strong>de ahora en más</strong>.
          Las {tour.scenes.length} que ya cargaste quedan como están.
        </p>
      </section>

      <section className="block">
        <h2>Descargar</h2>
        <button className="btn" onClick={onDownloadScene} disabled={!scene || !!busy}>
          <Download size={15} strokeWidth={1.75} />
          {scene ? `Descargar «${scene.name}»` : 'Descargar esta escena'}
        </button>
        <button
          className="btn"
          onClick={onDownloadAll}
          disabled={tour.scenes.length === 0 || !!busy}
          style={{ marginTop: 8 }}
        >
          <Package size={15} strokeWidth={1.75} />
          Descargar las {tour.scenes.length} en un ZIP
        </button>
        <p className="hint">
          Salen en JPG con el metadato 360 incrustado, así que también las podés subir sueltas a
          Facebook y las muestra como esféricas.
        </p>
        {busy && <p className="alert">{busy}</p>}
        {notice && <p className="alert alert--ok">{notice}</p>}
      </section>
    </>
  );
}
