import { forwardRef, useImperativeHandle, useRef } from 'react';

export interface CompassHandle {
  /** @param yaw radianes · @param fovDegrees apertura horizontal de la vista */
  update(yaw: number, fovDegrees: number): void;
}

/**
 * Brújula del visor. En el mockup hay un recuadro con un punto abajo a la
 * derecha; acá es un indicador real de hacia dónde mira la cámara, con el cono
 * de visión abierto según el zoom.
 *
 * Se actualiza escribiendo el DOM desde el bucle de render, igual que los
 * marcadores: si dependiera del estado de React habría un re-render por cuadro.
 */
export const Compass = forwardRef<CompassHandle>(function Compass(_props, ref) {
  const rotorRef = useRef<SVGGElement>(null);
  const coneRef = useRef<SVGPathElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);
  const last = useRef({ degrees: -999, fov: -1 });

  useImperativeHandle(ref, () => ({
    update(yaw, fovDegrees) {
      const degrees = ((((yaw * 180) / Math.PI) % 360) + 360) % 360;
      // Sin cambio apreciable no se toca el DOM.
      if (Math.abs(degrees - last.current.degrees) < 0.5 && fovDegrees === last.current.fov) return;

      if (Math.abs(degrees - last.current.degrees) >= 0.5) {
        rotorRef.current?.setAttribute('transform', `rotate(${degrees.toFixed(1)})`);
        if (valueRef.current) valueRef.current.textContent = `${Math.round(degrees)}°`;
      }
      if (fovDegrees !== last.current.fov) {
        coneRef.current?.setAttribute('d', cone(fovDegrees / 2, 33));
      }
      last.current = { degrees, fov: fovDegrees };
    },
  }));

  return (
    <div className="compass" title="Hacia dónde estás mirando">
      <svg viewBox="-50 -50 100 100" aria-hidden="true">
        <circle r="33" className="compass__dial" />
        <g ref={rotorRef}>
          <path ref={coneRef} d={cone(37.5, 33)} className="compass__cone" />
          <line x1="0" y1="0" x2="0" y2="-33" className="compass__needle" />
        </g>
        <circle r="2.6" className="compass__hub" />
      </svg>
      <span className="compass__value" ref={valueRef}>
        0°
      </span>
    </div>
  );
});

function cone(halfAngle: number, radius: number): string {
  const a = ((-90 - halfAngle) * Math.PI) / 180;
  const b = ((-90 + halfAngle) * Math.PI) / 180;
  const large = halfAngle > 90 ? 1 : 0;
  return (
    `M 0 0 L ${(radius * Math.cos(a)).toFixed(2)} ${(radius * Math.sin(a)).toFixed(2)} ` +
    `A ${radius} ${radius} 0 ${large} 1 ` +
    `${(radius * Math.cos(b)).toFixed(2)} ${(radius * Math.sin(b)).toFixed(2)} Z`
  );
}
