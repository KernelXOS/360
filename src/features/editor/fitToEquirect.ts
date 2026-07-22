import type { GPanoMetadata } from '../../lib/jpeg/xmp';

export interface FitOptions {
  /** Cuantos grados de horizonte cubre la foto. 360 = vuelta completa. */
  horizontalFovDegrees: number;
  /** Corrimiento vertical en px sobre la posicion centrada. Negativo = sube. */
  verticalOffsetPixels: number;
  /** Rumbo de la camara y punto de vista inicial que abre Facebook. */
  headingDegrees: number;
  initialPitchDegrees: number;
}

export interface Fit {
  meta: GPanoMetadata;
  /** Grados de esfera que cubre la imagen en vertical. */
  verticalFovDegrees: number;
  /** Rango legal para `verticalOffsetPixels` con este encuadre. */
  verticalOffsetRange: { min: number; max: number };
  /** Angulos para mapear la imagen sobre la porcion correcta de la esfera. */
  sphere: { phiStart: number; phiLength: number; thetaStart: number; thetaLength: number };
  warnings: string[];
}

/**
 * El FOV horizontal no puede ser tan grande que la esfera resultante quede
 * mas baja que la propia imagen: `fullHeight = width * 180 / hfov` debe ser
 * >= `height`. De ahi sale este tope.
 */
export function maxHorizontalFov(width: number, height: number): number {
  return Math.min(360, (180 * width) / height);
}

export function defaultFitOptions(width: number, height: number): FitOptions {
  return {
    horizontalFovDegrees: maxHorizontalFov(width, height),
    verticalOffsetPixels: 0,
    headingDegrees: 0,
    initialPitchDegrees: 0,
  };
}

export function fitToEquirect(width: number, height: number, options: FitOptions): Fit {
  const warnings: string[] = [];
  const hfov = clamp(options.horizontalFovDegrees, 1, maxHorizontalFov(width, height));

  const fullPanoWidthPixels = Math.round((width * 360) / hfov);
  const fullPanoHeightPixels = Math.round(fullPanoWidthPixels / 2);

  const croppedAreaLeftPixels = Math.round((fullPanoWidthPixels - width) / 2);
  const slack = fullPanoHeightPixels - height;
  const centeredTop = slack / 2;
  const croppedAreaTopPixels = Math.round(
    clamp(centeredTop + options.verticalOffsetPixels, 0, slack),
  );

  if (hfov < 359.5) {
    warnings.push(
      `La foto cubre ${Math.round(hfov)}° de horizonte, no los 360°. Facebook la va a mostrar ` +
        `como una esfera parcial, con vacio a los costados.`,
    );
  }
  if (width < 2048) {
    warnings.push(
      `Solo ${width}px de ancho: al estirarse sobre la esfera se va a ver muy pixelada. ` +
        `Ideal 4096px o mas.`,
    );
  }
  if (width / height > 2.05 && hfov >= 359.5) {
    warnings.push(
      'La foto es mas ancha que 2:1, asi que cubre menos de 180° en vertical. Es normal en ' +
        'panoramicas de celular: usa el control vertical para alinear el horizonte.',
    );
  }

  return {
    meta: {
      croppedAreaImageWidthPixels: width,
      croppedAreaImageHeightPixels: height,
      fullPanoWidthPixels,
      fullPanoHeightPixels,
      croppedAreaLeftPixels,
      croppedAreaTopPixels,
      poseHeadingDegrees: normalizeDegrees(options.headingDegrees),
      initialViewHeadingDegrees: normalizeDegrees(options.headingDegrees),
      initialViewPitchDegrees: clamp(options.initialPitchDegrees, -90, 90),
    },
    verticalFovDegrees: (180 * height) / fullPanoHeightPixels,
    verticalOffsetRange: { min: -centeredTop, max: slack - centeredTop },
    sphere: {
      phiStart: -Math.PI / 2 + (croppedAreaLeftPixels / fullPanoWidthPixels) * Math.PI * 2,
      phiLength: (width / fullPanoWidthPixels) * Math.PI * 2,
      thetaStart: (croppedAreaTopPixels / fullPanoHeightPixels) * Math.PI,
      thetaLength: (height / fullPanoHeightPixels) * Math.PI,
    },
    warnings,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}
