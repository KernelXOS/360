import { injectGPanoXmp } from '../../lib/jpeg/injectXmp';
import { getImage } from '../../lib/tour/storage';
import type { Scene, Tour } from '../../lib/tour/types';
import { buildZip, safeFileName, type ZipEntry } from '../../lib/zip';
import { fitToEquirect } from '../editor/fitToEquirect';

/**
 * Las panorámicas se guardan ya normalizadas a la resolución de salida, así que
 * exportarlas es copiar los bytes e incrustarles el metadato GPano. Ni un píxel
 * se recomprime, y el archivo queda listo para subir a Facebook.
 */
async function sceneJpegWithMetadata(scene: Scene): Promise<Uint8Array<ArrayBuffer>> {
  const blob = await getImage(scene.imageId);
  if (!blob) throw new Error(`No se encontró la imagen de "${scene.name}".`);

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const isJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8;
  if (!isJpeg) throw new Error(`La imagen de "${scene.name}" no quedó guardada como JPG.`);

  const fit = fitToEquirect(scene.width, scene.height, scene.fit);
  return injectGPanoXmp(bytes, fit.meta);
}

export async function downloadScene(scene: Scene): Promise<void> {
  const bytes = await sceneJpegWithMetadata(scene);
  const name = safeFileName(scene.name, new Set(), '.jpg');
  download(new Blob([bytes], { type: 'image/jpeg' }), name);
}

export interface BulkResult {
  count: number;
  bytes: number;
}

/** Empaqueta todas las escenas en un ZIP, numeradas en el orden del tour. */
export async function downloadAllScenes(tour: Tour): Promise<BulkResult> {
  if (tour.scenes.length === 0) throw new Error('El tour no tiene escenas para descargar.');

  const taken = new Set<string>();
  const entries: ZipEntry[] = [];

  for (const [index, scene] of tour.scenes.entries()) {
    const bytes = await sceneJpegWithMetadata(scene);
    const prefix = String(index + 1).padStart(2, '0');
    entries.push({ name: `${prefix} - ${safeFileName(scene.name, taken, '.jpg')}`, data: bytes });
  }

  const zip = buildZip(entries);
  download(zip, `${safeFileName(tour.name, new Set(), '')} - panoramicas.zip`);
  return { count: entries.length, bytes: zip.size };
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
