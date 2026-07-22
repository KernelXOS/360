/** Tope de textura para la vista previa. Evita reventar la GPU de un celular. */
export const PREVIEW_MAX_WIDTH = 4096;

export type ImageKind = 'jpeg' | 'png' | 'webp' | 'gif' | 'heic' | 'avif' | 'tiff' | 'desconocido';

export interface LoadedImage {
  file: File;
  kind: ImageKind;
  width: number;
  height: number;
  /** Bytes originales, solo si es un JPEG (permite exportar sin recomprimir). */
  jpegBytes: Uint8Array | null;
  /** Bitmap escalado para el visor 3D. */
  preview: ImageBitmap;
  /**
   * Bitmap a resolucion completa. Solo se conserva cuando la entrada no es
   * JPEG y hay que reencodar: exportar desde `preview` perderia resolucion.
   */
  full: ImageBitmap | null;
  /** Valor del tag EXIF Orientation (1 = normal). */
  exifOrientation: number;
  /** Como se decodifico, para diagnostico. */
  decodedVia: 'createImageBitmap' | 'HTMLImageElement';
}

export class ImageLoadError extends Error {
  constructor(
    message: string,
    /** Detalle tecnico para mostrar en pantalla y poder diagnosticar. */
    readonly detail: string,
  ) {
    super(message);
    this.name = 'ImageLoadError';
  }
}

export async function readImage(file: File): Promise<LoadedImage> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const context =
    `${file.name || 'sin nombre'} · ${(file.size / 1024 / 1024).toFixed(2)} MB · ` +
    `tipo del sistema: "${file.type || 'ninguno'}"`;

  if (buffer.length === 0) {
    throw new ImageLoadError('El archivo está vacío (0 bytes).', context);
  }

  // El tipo se decide por los bytes magicos, no por la extension ni por el MIME
  // que reporta Windows: ambos mienten seguido.
  const kind = sniffKind(buffer);

  if (kind === 'heic') {
    throw new ImageLoadError(
      'Es un HEIC de iPhone y ningún navegador lo puede abrir. Pasalo a JPG: en el iPhone, ' +
        'Ajustes → Cámara → Formatos → "Más compatible". O compartila por mail eligiendo ' +
        '"Automático", que la convierte sola.',
      `${context} · detectado por bytes mágicos: HEIC/HEIF`,
    );
  }
  if (kind === 'tiff') {
    throw new ImageLoadError(
      'Es un TIFF/RAW y el navegador no lo puede abrir. Exportala como JPG desde tu editor.',
      `${context} · detectado por bytes mágicos: TIFF`,
    );
  }

  const isJpeg = kind === 'jpeg';
  const mime = MIME_BY_KIND[kind] ?? file.type ?? '';
  const blob = new Blob([buffer], mime ? { type: mime } : undefined);

  const { bitmap: source, via } = await decode(blob, context, kind);

  const { width, height } = source;
  if (!width || !height) {
    source.close();
    throw new ImageLoadError(
      'La imagen se abrió con tamaño cero. El archivo puede estar cortado o corrupto.',
      context,
    );
  }

  let preview = source;
  let full: ImageBitmap | null = null;

  if (width > PREVIEW_MAX_WIDTH) {
    preview = await createImageBitmap(source, {
      resizeWidth: PREVIEW_MAX_WIDTH,
      resizeHeight: Math.max(1, Math.round((height * PREVIEW_MAX_WIDTH) / width)),
      resizeQuality: 'high',
    });
    // Con un JPEG exportamos los bytes originales, asi que el full-res sobra.
    if (isJpeg) source.close();
    else full = source;
  } else if (!isJpeg) {
    full = source;
  }

  return {
    file,
    kind,
    width,
    height,
    jpegBytes: isJpeg ? buffer : null,
    preview,
    full,
    exifOrientation: isJpeg ? readExifOrientation(buffer) : 1,
    decodedVia: via,
  };
}

/**
 * Cadena de decodificacion con respaldo. `createImageBitmap` sobre un Blob es
 * lo mas rapido, pero falla en algunos JPEG progresivos y en imagenes muy
 * grandes; el `<img>` del navegador aguanta mas.
 *
 * Se pide `imageOrientation: 'none'` a proposito: al exportar copiamos los
 * bytes originales del JPEG, asi que las dimensiones tienen que ser las
 * almacenadas y no las ya rotadas por EXIF.
 */
async function decode(
  blob: Blob,
  context: string,
  kind: ImageKind,
): Promise<{ bitmap: ImageBitmap; via: LoadedImage['decodedVia'] }> {
  const failures: string[] = [];

  try {
    return { bitmap: await createImageBitmap(blob, { imageOrientation: 'none' }), via: 'createImageBitmap' };
  } catch (e) {
    failures.push(`createImageBitmap: ${describe(e)}`);
  }

  try {
    return { bitmap: await createImageBitmap(blob), via: 'createImageBitmap' };
  } catch (e) {
    failures.push(`createImageBitmap sin opciones: ${describe(e)}`);
  }

  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { bitmap: await createImageBitmap(img), via: 'HTMLImageElement' };
  } catch (e) {
    failures.push(`HTMLImageElement: ${describe(e)}`);
  } finally {
    URL.revokeObjectURL(url);
  }

  throw new ImageLoadError(
    kind === 'desconocido'
      ? 'No se reconoce el formato del archivo. ¿Seguro que es una imagen?'
      : `El navegador no pudo decodificar este ${kind.toUpperCase()}.`,
    `${context} · formato: ${kind} · ${failures.join(' | ')}`,
  );
}

const MIME_BY_KIND: Partial<Record<ImageKind, string>> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
};

function sniffKind(b: Uint8Array): ImageKind {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'gif';
  if (b.length >= 4 && ((b[0] === 0x49 && b[1] === 0x49) || (b[0] === 0x4d && b[1] === 0x4d))) {
    if (b[2] === 0x2a || b[3] === 0x2a) return 'tiff';
  }
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'webp';
  if (b.length >= 12 && ascii(b, 4, 4) === 'ftyp') {
    const brand = ascii(b, 8, 4);
    if (/^(heic|heix|hevc|hevx|mif1|msf1|heim|heis)$/.test(brand)) return 'heic';
    if (/^(avif|avis)$/.test(brand)) return 'avif';
  }
  return 'desconocido';
}

function ascii(b: Uint8Array, offset: number, length: number): string {
  let s = '';
  for (let i = offset; i < offset + length && i < b.length; i++) s += String.fromCharCode(b[i]);
  return s;
}

/** Lee el tag 0x0112 (Orientation) del IFD0 del EXIF. Devuelve 1 si no lo encuentra. */
function readExifOrientation(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;

  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const length = view.getUint16(offset + 2);
    if (length < 2) break;

    if (marker === 0xe1 && ascii(bytes, offset + 4, 4) === 'Exif') {
      const tiff = offset + 10;
      if (tiff + 8 > bytes.length) return 1;
      const little = ascii(bytes, tiff, 2) === 'II';
      const ifd0 = tiff + view.getUint32(tiff + 4, little);
      if (ifd0 + 2 > bytes.length) return 1;

      const count = view.getUint16(ifd0, little);
      for (let i = 0; i < count; i++) {
        const entry = ifd0 + 2 + i * 12;
        if (entry + 12 > bytes.length) break;
        if (view.getUint16(entry, little) === 0x0112) {
          return view.getUint16(entry + 8, little) || 1;
        }
      }
      return 1;
    }
    offset += 2 + length;
  }
  return 1;
}

function describe(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  return String(e);
}

/**
 * Reencoda a JPEG cuando la entrada no lo era (PNG, WebP). Solo se usa en ese
 * caso: con un JPEG de entrada exportamos los bytes originales intactos.
 */
export async function encodeToJpeg(bitmap: ImageBitmap, quality = 0.92): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('El navegador no pudo abrir un canvas 2D.');
  ctx.drawImage(bitmap, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  );
  if (!blob) {
    throw new Error(
      `No se pudo generar el JPEG de ${bitmap.width}×${bitmap.height}px: supera el límite de ` +
        'canvas de este dispositivo. Convertí la imagen a JPG antes de subirla.',
    );
  }
  return new Uint8Array(await blob.arrayBuffer());
}
