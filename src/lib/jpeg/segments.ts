/**
 * Parser minimo de la estructura de marcadores de un JPEG.
 *
 * Un JPEG es: SOI (FFD8), luego una secuencia de segmentos
 * `FFxx <len:2 bytes big-endian, incluye los 2 bytes de len> <payload>`,
 * hasta el SOS (FFDA) despues del cual viene el dato comprimido crudo.
 */

export const SOI = 0xd8;
export const EOI = 0xd9;
export const SOS = 0xda;
export const APP0 = 0xe0;
export const APP1 = 0xe1;

export interface Segment {
  /** Byte del marcador, ej. 0xe1 para APP1. */
  marker: number;
  /** Offset del 0xFF que abre el marcador. */
  start: number;
  /** Offset del primer byte despues del segmento. */
  end: number;
  /** Offset del primer byte del payload (despues de los 2 bytes de longitud). */
  payloadStart: number;
  payloadLength: number;
}

export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === SOI;
}

/**
 * Lee los segmentos de cabecera hasta el SOS (sin incluirlo).
 * No recorre el dato entropico: no hace falta para inyectar metadatos.
 */
export function readHeaderSegments(bytes: Uint8Array): Segment[] {
  if (!isJpeg(bytes)) throw new Error('El archivo no es un JPEG valido.');

  const segments: Segment[] = [];
  let offset = 2; // saltamos el SOI

  while (offset < bytes.length - 1) {
    if (bytes[offset] !== 0xff) {
      throw new Error(`JPEG corrupto: se esperaba 0xFF en el offset ${offset}.`);
    }

    // Puede haber bytes 0xFF de relleno entre segmentos.
    let markerOffset = offset;
    while (markerOffset < bytes.length && bytes[markerOffset] === 0xff) markerOffset++;
    const marker = bytes[markerOffset];

    // SOS marca el inicio del dato comprimido; paramos ahi.
    if (marker === SOS || marker === EOI) break;

    const lengthOffset = markerOffset + 1;
    if (lengthOffset + 1 >= bytes.length) break;
    const length = (bytes[lengthOffset] << 8) | bytes[lengthOffset + 1];
    if (length < 2) throw new Error(`Longitud de segmento invalida en el offset ${lengthOffset}.`);

    const start = offset;
    const payloadStart = lengthOffset + 2;
    const end = lengthOffset + length;

    segments.push({ marker, start, end, payloadStart, payloadLength: length - 2 });
    offset = end;
  }

  return segments;
}

const decoder = new TextDecoder('latin1');

/** Devuelve el namespace terminado en NUL de un APP1, o null si no lo tiene. */
export function readApp1Namespace(bytes: Uint8Array, segment: Segment): string | null {
  if (segment.marker !== APP1) return null;
  const limit = Math.min(segment.payloadStart + 64, segment.end);
  for (let i = segment.payloadStart; i < limit; i++) {
    if (bytes[i] === 0x00) {
      return decoder.decode(bytes.subarray(segment.payloadStart, i));
    }
  }
  return null;
}
