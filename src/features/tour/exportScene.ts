import { injectGPanoXmp } from '../../lib/jpeg/injectXmp';
import { getImage } from '../../lib/tour/storage';
import type { Scene } from '../../lib/tour/types';
import { fitToEquirect } from '../editor/fitToEquirect';

/**
 * Descarga la panoramica de una escena con el metadato GPano incrustado, para
 * subirla suelta a Facebook. Con un JPEG no se recomprime nada: se copian los
 * bytes originales y solo se agrega el segmento de metadatos.
 */
export async function downloadSceneForFacebook(scene: Scene): Promise<void> {
  const blob = await getImage(scene.imageId);
  if (!blob) throw new Error('No se encontró la imagen de esta escena.');

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const isJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8;
  if (!isJpeg) {
    throw new Error(
      'Solo se puede exportar a Facebook desde un JPG. Esta escena se cargó en otro formato.',
    );
  }

  const fit = fitToEquirect(scene.width, scene.height, scene.fit);
  const out = injectGPanoXmp(bytes, fit.meta);

  const url = URL.createObjectURL(new Blob([out], { type: 'image/jpeg' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${scene.name.replace(/[^\w\- ]+/g, '') || 'escena'}-360.jpg`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
