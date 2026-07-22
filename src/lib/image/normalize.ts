import type { Fit } from '../../features/editor/fitToEquirect';

/**
 * Lleva cualquier panorámica a una equirectangular exacta de `targetWidth` × la
 * mitad, que es la proporción 2:1 que define una esfera completa.
 *
 * Una panorámica de celular es una franja: cubre los 360° de horizonte pero
 * solo una banda vertical. Acá esa franja se coloca en la altura que le
 * corresponde dentro del lienzo, y el resto se rellena estirando la primera y
 * la última fila de píxeles. Rellenar con negro dejaría dos tapas negras muy
 * visibles al mirar hacia arriba y hacia abajo.
 */
export interface NormalizeOptions {
  targetWidth: number;
  quality?: number;
}

export interface Normalized {
  blob: Blob;
  width: number;
  height: number;
  /** Qué se hizo, para poder informarlo en la interfaz. */
  scaled: 'reducida' | 'ampliada' | 'sin cambios';
  paddedRows: number;
}

export async function normalizeToEquirect(
  source: ImageBitmap,
  fit: Fit,
  { targetWidth, quality = 0.92 }: NormalizeOptions,
): Promise<Normalized> {
  const width = Math.max(2, Math.round(targetWidth));
  const height = Math.round(width / 2);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('El navegador no pudo abrir un canvas 2D.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Dónde cae la imagen original dentro de la esfera completa, a escala.
  const scale = width / fit.meta.fullPanoWidthPixels;
  const dx = Math.round(fit.meta.croppedAreaLeftPixels * scale);
  const dy = Math.round(fit.meta.croppedAreaTopPixels * scale);
  const dw = Math.max(1, Math.round(fit.meta.croppedAreaImageWidthPixels * scale));
  const dh = Math.max(1, Math.round(fit.meta.croppedAreaImageHeightPixels * scale));

  // El remuestreo del navegador (`resizeQuality: high`) da mucho mejor
  // resultado que un `drawImage` directo cuando hay que achicar varias veces.
  const fitted =
    dw === source.width && dh === source.height
      ? source
      : await createImageBitmap(source, {
          resizeWidth: dw,
          resizeHeight: dh,
          resizeQuality: 'high',
        });

  // Cielo y suelo: se estira la fila de borde en lugar de dejar negro.
  if (dy > 0) ctx.drawImage(fitted, 0, 0, dw, 1, dx, 0, dw, dy);
  const bottom = dy + dh;
  if (bottom < height) {
    ctx.drawImage(fitted, 0, dh - 1, dw, 1, dx, bottom, dw, height - bottom);
  }
  // Lo mismo a los costados cuando la foto no da la vuelta completa.
  if (dx > 0) {
    ctx.drawImage(fitted, 0, 0, 1, dh, 0, dy, dx, dh);
    const right = dx + dw;
    if (right < width) ctx.drawImage(fitted, dw - 1, 0, 1, dh, right, dy, width - right, dh);
  }

  ctx.drawImage(fitted, dx, dy);
  if (fitted !== source) fitted.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  );
  // Liberar el lienzo cuanto antes: a 8192px son 134 MB de memoria.
  canvas.width = 0;
  canvas.height = 0;

  if (!blob) {
    throw new Error(
      `No se pudo generar la imagen de ${width}×${height}px: supera el límite de canvas de ` +
        'este dispositivo. Probá con una resolución de salida más chica.',
    );
  }

  return {
    blob,
    width,
    height,
    scaled:
      dw === source.width ? 'sin cambios' : dw < source.width ? 'reducida' : 'ampliada',
    paddedRows: Math.max(0, dy) + Math.max(0, height - bottom),
  };
}

/** Resoluciones de salida ofrecidas. La altura siempre es la mitad del ancho. */
export const OUTPUT_PRESETS = [2048, 4096, 6144, 8192] as const;

export const DEFAULT_OUTPUT_WIDTH = 4096;

/**
 * Tope real de la GPU, consultado una sola vez. Una textura más grande que
 * esto no se puede dibujar, así que no tiene sentido ofrecerla.
 */
let cachedMaxTexture: number | null = null;
export function maxTextureSize(): number {
  if (cachedMaxTexture !== null) return cachedMaxTexture;
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
    cachedMaxTexture = gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : 4096;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    cachedMaxTexture = 4096;
  }
  return cachedMaxTexture ?? 4096;
}
