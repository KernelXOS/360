/**
 * Escritor mínimo de ZIP, método `store` (sin comprimir).
 *
 * No hace falta una librería: los JPEG ya están comprimidos, así que aplicarles
 * deflate no ganaría casi nada y sí costaría tiempo y peso de bundle. El
 * formato ZIP con `store` es una cabecera por archivo más un directorio
 * central al final.
 */

export interface ZipEntry {
  name: string;
  /** Respaldado por ArrayBuffer, no SharedArrayBuffer: `Blob` solo acepta ese. */
  data: Uint8Array<ArrayBuffer>;
}

export function buildZip(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  const central: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;

  const { date, time } = dosDateTime(new Date());

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // firma de cabecera local
    lv.setUint16(4, 20, true); // versión necesaria
    lv.setUint16(6, 0x0800, true); // bit 11: nombre en UTF-8
    lv.setUint16(8, 0, true); // método 0 = store
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true); // comprimido
    lv.setUint32(22, size, true); // sin comprimir
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true); // sin campo extra
    local.set(name, 30);

    chunks.push(local, entry.data);

    const dir = new Uint8Array(46 + name.length);
    const dv = new DataView(dir.buffer);
    dv.setUint32(0, 0x02014b50, true); // firma de directorio central
    dv.setUint16(4, 20, true); // versión que lo creó
    dv.setUint16(6, 20, true); // versión necesaria
    dv.setUint16(8, 0x0800, true);
    dv.setUint16(10, 0, true);
    dv.setUint16(12, time, true);
    dv.setUint16(14, date, true);
    dv.setUint32(16, crc, true);
    dv.setUint32(20, size, true);
    dv.setUint32(24, size, true);
    dv.setUint16(28, name.length, true);
    dv.setUint32(42, offset, true); // desplazamiento de la cabecera local
    dir.set(name, 46);
    central.push(dir);

    offset += local.length + size;
  }

  const centralSize = central.reduce((sum, c) => sum + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); // fin del directorio central
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  return new Blob([...chunks, ...central, end], { type: 'application/zip' });
}

/** Tabla de CRC-32 (polinomio 0xEDB88320), construida una sola vez. */
let table: Uint32Array | null = null;
function crcTable(): Uint32Array {
  if (table) return table;
  table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
}

export function crc32(data: Uint8Array<ArrayBufferLike>): number {
  const t = crcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = t[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** ZIP guarda fecha y hora en el formato empaquetado de MS-DOS. */
function dosDateTime(d: Date): { date: number; time: number } {
  return {
    date: (((d.getFullYear() - 1980) & 0x7f) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
  };
}

/** Nombre de archivo seguro para cualquier sistema, sin colisiones. */
export function safeFileName(name: string, taken: Set<string>, extension: string): string {
  const base =
    name
      // NFD separa cada letra de su acento, y el filtro siguiente descarta el
      // acento suelto por no ser carácter de palabra: "Café" queda "Cafe".
      .normalize('NFD')
      .replace(/[^\w\- ]+/g, '')
      .trim()
      .slice(0, 60) || 'escena';
  let candidate = `${base}${extension}`;
  let n = 2;
  while (taken.has(candidate.toLowerCase())) candidate = `${base} (${n++})${extension}`;
  taken.add(candidate.toLowerCase());
  return candidate;
}
