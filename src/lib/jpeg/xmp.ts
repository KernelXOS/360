/**
 * Construccion del paquete XMP con el esquema GPano (Google Photo Sphere).
 * Este es el metadato exacto que Facebook lee para decidir que una foto
 * es una 360 y renderizarla con su visor esferico.
 */

export interface GPanoMetadata {
  /** Ancho en px de la porcion de esfera que cubre la imagen. */
  croppedAreaImageWidthPixels: number;
  croppedAreaImageHeightPixels: number;
  /** Ancho en px que tendria la esfera completa (360 grados). */
  fullPanoWidthPixels: number;
  /** Alto en px que tendria la esfera completa (180 grados). Siempre fullWidth / 2. */
  fullPanoHeightPixels: number;
  /** Desde que px de la esfera completa arranca la imagen. */
  croppedAreaLeftPixels: number;
  croppedAreaTopPixels: number;
  /** Hacia donde apuntaba la camara. 0 = norte. */
  poseHeadingDegrees: number;
  /** Que parte de la foto muestra Facebook al abrirla. */
  initialViewHeadingDegrees: number;
  initialViewPitchDegrees: number;
}

export const XMP_NAMESPACE = 'http://ns.adobe.com/xap/1.0/';

export function buildGPanoXmp(meta: GPanoMetadata): string {
  const n = (v: number) => String(Math.round(v));

  return (
    `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>` +
    `<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="sistema-360">` +
    `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">` +
    `<rdf:Description rdf:about="" xmlns:GPano="http://ns.google.com/photos/1.0/panorama/"` +
    ` GPano:ProjectionType="equirectangular"` +
    ` GPano:UsePanoramaViewer="True"` +
    ` GPano:CroppedAreaImageWidthPixels="${n(meta.croppedAreaImageWidthPixels)}"` +
    ` GPano:CroppedAreaImageHeightPixels="${n(meta.croppedAreaImageHeightPixels)}"` +
    ` GPano:FullPanoWidthPixels="${n(meta.fullPanoWidthPixels)}"` +
    ` GPano:FullPanoHeightPixels="${n(meta.fullPanoHeightPixels)}"` +
    ` GPano:CroppedAreaLeftPixels="${n(meta.croppedAreaLeftPixels)}"` +
    ` GPano:CroppedAreaTopPixels="${n(meta.croppedAreaTopPixels)}"` +
    ` GPano:PoseHeadingDegrees="${n(meta.poseHeadingDegrees)}"` +
    ` GPano:InitialViewHeadingDegrees="${n(meta.initialViewHeadingDegrees)}"` +
    ` GPano:InitialViewPitchDegrees="${n(meta.initialViewPitchDegrees)}"` +
    ` GPano:InitialViewRollDegrees="0"` +
    ` GPano:InitialHorizontalFOVDegrees="90"` +
    `/>` +
    `</rdf:RDF>` +
    `</x:xmpmeta>` +
    `<?xpacket end="w"?>`
  );
}
