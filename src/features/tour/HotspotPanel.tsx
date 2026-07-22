import * as THREE from 'three';
import type { Hotspot, Scene } from '../../lib/tour/types';

interface Props {
  hotspot: Hotspot;
  scene: Scene;
  scenes: Scene[];
  onChange: (patch: Partial<Hotspot>) => void;
  onRemove: () => void;
  onGoToTarget: (sceneId: string) => void;
}

export function HotspotPanel({ hotspot, scene, scenes, onChange, onRemove, onGoToTarget }: Props) {
  const others = scenes.filter((s) => s.id !== scene.id);

  return (
    <section className="panel panel--accent">
      <h2>Punto seleccionado</h2>

      <div className="field">
        <label htmlFor="hs-kind">Tipo</label>
        <div className="segmented" id="hs-kind">
          <button
            className={hotspot.kind === 'link' ? 'is-on' : ''}
            onClick={() => onChange({ kind: 'link' })}
          >
            Salto a escena
          </button>
          <button
            className={hotspot.kind === 'info' ? 'is-on' : ''}
            onClick={() => onChange({ kind: 'info' })}
          >
            Información
          </button>
        </div>
      </div>

      <div className="field">
        <label htmlFor="hs-label">Etiqueta</label>
        <input
          id="hs-label"
          value={hotspot.label}
          placeholder={hotspot.kind === 'link' ? 'Ej. Cocina' : 'Ej. Obra de 1920'}
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </div>

      {hotspot.kind === 'link' ? (
        <div className="field">
          <label htmlFor="hs-target">Lleva a</label>
          {others.length === 0 ? (
            <p className="hint">
              Necesitás al menos dos escenas para conectar uno con otro. Agregá otra panorámica.
            </p>
          ) : (
            <>
              <select
                id="hs-target"
                value={hotspot.targetSceneId ?? ''}
                onChange={(e) => onChange({ targetSceneId: e.target.value || undefined })}
              >
                <option value="">— elegí una escena —</option>
                {others.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {hotspot.targetSceneId && (
                <button
                  className="linkish"
                  onClick={() => onGoToTarget(hotspot.targetSceneId!)}
                >
                  Ir a esa escena →
                </button>
              )}
            </>
          )}
          {!hotspot.targetSceneId && others.length > 0 && (
            <p className="alert alert--warn">
              Sin destino, este punto es un callejón sin salida. En el visor se ve en rojo.
            </p>
          )}
        </div>
      ) : (
        <div className="field">
          <label htmlFor="hs-text">Texto del cartel</label>
          <textarea
            id="hs-text"
            rows={4}
            value={hotspot.text ?? ''}
            placeholder="Lo que se muestra al hacer clic."
            onChange={(e) => onChange({ text: e.target.value })}
          />
        </div>
      )}

      <p className="hint">
        Posición: {fmt(hotspot.yaw)}° horizontal, {fmt(hotspot.pitch)}° vertical. Arrastralo en el
        visor para moverlo.
      </p>

      <button className="btn btn--danger" onClick={onRemove}>
        Eliminar punto
      </button>
    </section>
  );
}

function fmt(radians: number): string {
  return Math.round(THREE.MathUtils.radToDeg(radians)).toString();
}
