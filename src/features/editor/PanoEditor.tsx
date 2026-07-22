import type { Fit, FitOptions } from './fitToEquirect';
import { maxHorizontalFov } from './fitToEquirect';

interface Props {
  width: number;
  height: number;
  options: FitOptions;
  fit: Fit;
  onChange: (options: FitOptions) => void;
}

export function PanoEditor({ width, height, options, fit, onChange }: Props) {
  const set = (patch: Partial<FitOptions>) => onChange({ ...options, ...patch });
  const maxFov = maxHorizontalFov(width, height);
  const { min, max } = fit.verticalOffsetRange;

  return (
    <section className="panel">
      <h2>2 · Ajustar el encuadre</h2>

      <Slider
        label="Horizonte cubierto"
        value={options.horizontalFovDegrees}
        min={60}
        max={maxFov}
        step={1}
        format={(v) => `${Math.round(v)}°`}
        onChange={(v) => set({ horizontalFovDegrees: v })}
        help={
          maxFov < 359.5
            ? `Tope de ${Math.round(maxFov)}° por la proporción de la foto (${width}×${height}).`
            : 'Dejalo en 360° si diste la vuelta completa.'
        }
      />

      <Slider
        label="Altura del horizonte"
        value={options.verticalOffsetPixels}
        min={min}
        max={max}
        step={1}
        disabled={max - min < 1}
        format={(v) => (v === 0 ? 'centrado' : `${v > 0 ? '+' : ''}${Math.round(v)} px`)}
        onChange={(v) => set({ verticalOffsetPixels: v })}
        help="Movés la franja hacia arriba o abajo dentro de la esfera. Alineá el piso real."
      />

      <Slider
        label="Punto de vista inicial"
        value={options.headingDegrees}
        min={-180}
        max={180}
        step={1}
        format={(v) => `${Math.round(v)}°`}
        onChange={(v) => set({ headingDegrees: v })}
        help="Qué parte de la foto ve alguien al abrirla en Facebook."
      />

      <Slider
        label="Inclinación inicial"
        value={options.initialPitchDegrees}
        min={-60}
        max={60}
        step={1}
        format={(v) => `${Math.round(v)}°`}
        onChange={(v) => set({ initialPitchDegrees: v })}
      />

      {fit.warnings.map((warning) => (
        <p className="alert alert--warn" key={warning}>
          {warning}
        </p>
      ))}
    </section>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  help?: string;
  format: (value: number) => string;
  onChange: (value: number) => void;
}

function Slider({ label, value, min, max, step, disabled, help, format, onChange }: SliderProps) {
  return (
    <label className={`slider${disabled ? ' slider--off' : ''}`}>
      <span className="slider__row">
        <span className="slider__label">{label}</span>
        <span className="slider__value">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {help && <span className="slider__help">{help}</span>}
    </label>
  );
}
