import { Check, ChevronRight } from 'lucide-react';
import type { Tour } from '../lib/tour/types';

const STEPS = [
  { title: 'Agregar escenas', hint: 'Subí tus panorámicas 360°' },
  { title: 'Conectar escenas', hint: 'Creá puntos de navegación' },
  { title: 'Personalizar', hint: 'Editá hotspots y contenido' },
  { title: 'Publicar y compartir', hint: 'Hacé tu tour público' },
];

/**
 * El paso vigente sale del estado real del tour, no de un contador: si borrás
 * todos los puntos, el stepper vuelve a marcar "Conectar escenas".
 */
export function currentStep(tour: Tour): number {
  if (tour.scenes.length === 0) return 0;
  const hotspots = tour.scenes.flatMap((s) => s.hotspots);
  const connected = hotspots.some((h) => h.kind === 'link' && h.targetSceneId);
  if (!connected) return 1;
  const named = hotspots.every((h) => h.label.trim().length > 0);
  if (!named) return 2;
  return 3;
}

export function Stepper({ tour }: { tour: Tour }) {
  const step = currentStep(tour);

  return (
    <ol className="stepper">
      {STEPS.map((item, index) => {
        const state = index < step ? 'done' : index === step ? 'now' : 'todo';
        return (
          <li key={item.title} className={`stepper__item stepper__item--${state}`}>
            <span className="stepper__badge">
              {state === 'done' ? <Check size={13} strokeWidth={2.5} /> : index + 1}
            </span>
            <span className="stepper__text">
              <strong>{item.title}</strong>
              <em>{item.hint}</em>
            </span>
            {index < STEPS.length - 1 && (
              <ChevronRight className="stepper__sep" size={16} strokeWidth={1.5} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
