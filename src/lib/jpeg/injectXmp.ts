import { APP0, APP1, readApp1Namespace, readHeaderSegments } from './segments';
import { XMP_NAMESPACE, buildGPanoXmp, type GPanoMetadata } from './xmp';

const MAX_SEGMENT_PAYLOAD = 65533; // 65535 menos los 2 bytes de longitud

/**
 * Devuelve una copia del JPEG con el bloque GPano inyectado como segmento APP1.
 *
 * Los pixeles no se tocan: es una operacion sin perdida de calidad. Si el JPEG
 * ya traia un XMP propio, se reemplaza.
 */
export function injectGPanoXmp(
  jpegBytes: Uint8Array,
  meta: GPanoMetadata,
): Uint8Array<ArrayBuffer> {
  const segments = readHeaderSegments(jpegBytes);

  // El XMP debe ir despues del JFIF y del EXIF, que son los APP0/APP1 iniciales.
  let insertAt = 2; // justo despues del SOI
  for (const segment of segments) {
    if (segment.marker !== APP0 && segment.marker !== APP1) break;
    insertAt = segment.end;
  }

  // Un XMP preexistente se descarta para no dejar dos bloques en conflicto.
  const stale = segments.filter(
    (s) => s.marker === APP1 && readApp1Namespace(jpegBytes, s) === XMP_NAMESPACE,
  );

  const payload = buildApp1Payload(meta);
  if (payload.length > MAX_SEGMENT_PAYLOAD) {
    throw new Error('El bloque XMP no entra en un solo segmento APP1.');
  }

  const segment = new Uint8Array(4 + payload.length);
  segment[0] = 0xff;
  segment[1] = APP1;
  segment[2] = ((payload.length + 2) >> 8) & 0xff;
  segment[3] = (payload.length + 2) & 0xff;
  segment.set(payload, 4);

  // Construimos la salida como una lista de tramos a copiar, salteando los XMP viejos.
  const skip = stale.map((s) => ({ start: s.start, end: s.end })).sort((a, b) => a.start - b.start);
  const chunks: Uint8Array[] = [];
  let cursor = 0;

  const emitUpTo = (limit: number) => {
    for (const range of skip) {
      if (range.start >= limit || range.end <= cursor) continue;
      if (range.start > cursor) chunks.push(jpegBytes.subarray(cursor, range.start));
      cursor = Math.max(cursor, Math.min(range.end, limit));
    }
    if (cursor < limit) chunks.push(jpegBytes.subarray(cursor, limit));
    cursor = Math.max(cursor, limit);
  };

  emitUpTo(insertAt);
  chunks.push(segment);
  emitUpTo(jpegBytes.length);

  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function buildApp1Payload(meta: GPanoMetadata): Uint8Array {
  const encoder = new TextEncoder();
  const namespace = encoder.encode(XMP_NAMESPACE);
  const xmp = encoder.encode(buildGPanoXmp(meta));

  const payload = new Uint8Array(namespace.length + 1 + xmp.length);
  payload.set(namespace, 0);
  payload[namespace.length] = 0x00;
  payload.set(xmp, namespace.length + 1);
  return payload;
}

/** Lee el XMP ya presente en un JPEG, si lo hay. Util para verificar el resultado. */
export function extractXmp(jpegBytes: Uint8Array): string | null {
  for (const segment of readHeaderSegments(jpegBytes)) {
    if (readApp1Namespace(jpegBytes, segment) !== XMP_NAMESPACE) continue;
    const start = segment.payloadStart + XMP_NAMESPACE.length + 1;
    return new TextDecoder('utf-8').decode(jpegBytes.subarray(start, segment.end));
  }
  return null;
}
