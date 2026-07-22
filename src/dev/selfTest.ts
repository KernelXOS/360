/**
 * Verificacion del nucleo del tour, contra JPEGs reales y contra una camara
 * three.js de verdad. Se corre desde la consola del navegador:
 *
 *   const { runSelfTest } = await import('/src/dev/selfTest.ts'); await runSelfTest();
 *
 * Lo critico que comprueba:
 *  - que proyectar un punto a pantalla y volver de la pantalla al punto sea la
 *    misma operacion en los dos sentidos (si no, los puntos se corren al girar);
 *  - que un punto a la espalda de la camara no se dibuje adelante;
 *  - que inyectar el XMP no toque un solo byte del dato comprimido.
 */
import * as THREE from 'three';
import { extractXmp, injectGPanoXmp } from '../lib/jpeg/injectXmp';
import { APP1, readApp1Namespace, readHeaderSegments } from '../lib/jpeg/segments';
import { XMP_NAMESPACE } from '../lib/jpeg/xmp';
import { defaultFitOptions, fitToEquirect } from '../features/editor/fitToEquirect';
import {
  directionFromYawPitch,
  projectToScreen,
  yawPitchFromScreen,
} from '../lib/tour/geometry';
import { brokenLinks, unreachableScenes, type Scene, type Tour } from '../lib/tour/types';
import { normalizeToEquirect } from '../lib/image/normalize';
import { buildZip, crc32, safeFileName } from '../lib/zip';

interface Result {
  name: string;
  ok: boolean;
  detail: string;
}

export async function runSelfTest(): Promise<Result[]> {
  const results: Result[] = [];
  const check = (name: string, ok: boolean, detail = '') => results.push({ name, ok, detail });

  geometryTests(check);
  graphTests(check);
  await jpegTests(check);
  await normalizeTests(check);
  zipTests(check);

  console.table(results);
  const failed = results.filter((r) => !r.ok);
  console.log(
    failed.length ? `❌ ${failed.length} fallo(s)` : `✅ ${results.length}/${results.length} OK`,
  );
  return results;
}

type Check = (name: string, ok: boolean, detail?: string) => void;

function geometryTests(check: Check) {
  const width = 1280;
  const height = 720;

  // Ida y vuelta con la camara en varias orientaciones y zooms: es la garantia
  // de que un punto se queda pegado donde el autor lo puso.
  let worstError = 0;
  let samples = 0;
  for (const camYaw of [0, 0.9, -2.4, 3.0]) {
    for (const camPitch of [0, 0.7, -1.1]) {
      for (const fov of [30, 75, 100]) {
        const camera = makeCamera(width, height, camYaw, camPitch, fov);
        for (let dYaw = -0.5; dYaw <= 0.5; dYaw += 0.25) {
          for (let dPitch = -0.4; dPitch <= 0.4; dPitch += 0.2) {
            const yaw = camYaw + dYaw;
            const pitch = clamp(camPitch + dPitch, -1.4, 1.4);
            const screen = projectToScreen(yaw, pitch, camera, width, height);
            if (!screen.visible) continue;
            const back = yawPitchFromScreen(camera, screen.x, screen.y, width, height);
            worstError = Math.max(
              worstError,
              angleBetween(yaw, pitch, back.yaw, back.pitch),
            );
            samples++;
          }
        }
      }
    }
  }
  check(
    'geometría: proyectar y desproyectar coinciden',
    samples > 200 && worstError < 1e-4,
    `${samples} muestras, error máximo ${(worstError * 180 / Math.PI).toExponential(2)}°`,
  );

  // Un punto justo detras no puede aparecer dibujado adelante.
  const camera = makeCamera(width, height, 0, 0, 75);
  const behind = projectToScreen(Math.PI, 0, camera, width, height);
  const front = projectToScreen(0, 0, camera, width, height);
  check('geometría: lo que está atrás no se dibuja', !behind.visible, `visible=${behind.visible}`);
  check(
    'geometría: el centro de la vista cae en el centro de la pantalla',
    front.visible &&
      Math.abs(front.x - width / 2) < 0.5 &&
      Math.abs(front.y - height / 2) < 0.5,
    `(${front.x.toFixed(1)}, ${front.y.toFixed(1)}) vs (640, 360)`,
  );

  // Un punto a la derecha del centro tiene que caer a la derecha en pantalla.
  const right = projectToScreen(0.3, 0, camera, width, height);
  const up = projectToScreen(0, 0.3, camera, width, height);
  check(
    'geometría: derecha es derecha y arriba es arriba',
    right.x > width / 2 && Math.abs(right.y - height / 2) < 1 && up.y < height / 2,
    `derecha x=${right.x.toFixed(0)}, arriba y=${up.y.toFixed(0)}`,
  );

  // El vector de direccion y el que usa la camara del visor son el mismo.
  const dir = directionFromYawPitch(0.7, 0.2);
  const expected = new THREE.Vector3(
    Math.sin(0.7) * Math.cos(0.2),
    Math.sin(0.2),
    -Math.cos(0.7) * Math.cos(0.2),
  );
  check(
    'geometría: la dirección coincide con la de la cámara',
    dir.distanceTo(expected) < 1e-12,
    `Δ=${dir.distanceTo(expected).toExponential(2)}`,
  );
}

function graphTests(check: Check) {
  const scene = (id: string, hotspots: Scene['hotspots']): Scene => ({
    id,
    name: id,
    imageId: `img_${id}`,
    thumb: '',
    width: 4096,
    height: 2048,
    fit: defaultFitOptions(4096, 2048),
    initialYaw: 0,
    initialPitch: 0,
    hotspots,
  });
  const link = (id: string, target?: string) => ({
    id,
    kind: 'link' as const,
    yaw: 0,
    pitch: 0,
    label: '',
    targetSceneId: target,
  });

  const tour: Tour = {
    id: 't',
    name: 't',
    startSceneId: 'a',
    outputWidth: 4096,
    updatedAt: 0,
    scenes: [
      scene('a', [link('h1', 'b'), link('h2', 'fantasma'), link('h3')]),
      scene('b', [link('h4', 'a')]),
      scene('c', []), // nadie la enlaza
    ],
  };

  const broken = brokenLinks(tour);
  check(
    'grafo: detecta saltos rotos y sin destino',
    broken.length === 2 && broken.every((b) => b.scene.id === 'a'),
    `${broken.length} rotos: ${broken.map((b) => b.hotspot.id).join(', ')}`,
  );

  const orphans = unreachableScenes(tour);
  check(
    'grafo: detecta escenas inalcanzables',
    orphans.length === 1 && orphans[0].id === 'c',
    `huérfanas: ${orphans.map((s) => s.id).join(', ') || 'ninguna'}`,
  );
}

async function jpegTests(check: Check) {
  for (const [path, width, height] of [
    ['/samples/equirect-2048.jpg', 2048, 1024],
    ['/samples/strip-4096.jpg', 4096, 1024],
  ] as const) {
    const original = new Uint8Array(await (await fetch(path)).arrayBuffer());
    const fit = fitToEquirect(width, height, defaultFitOptions(width, height));
    const out = injectGPanoXmp(original, fit.meta);

    const expectedFullHeight = width / 2;
    check(
      `${path}: geometría GPano`,
      fit.meta.fullPanoWidthPixels === width &&
        fit.meta.fullPanoHeightPixels === expectedFullHeight &&
        fit.meta.croppedAreaTopPixels === Math.round((expectedFullHeight - height) / 2),
      `full ${fit.meta.fullPanoWidthPixels}x${fit.meta.fullPanoHeightPixels}, top ${fit.meta.croppedAreaTopPixels}`,
    );

    const xmp = extractXmp(out) ?? '';
    check(
      `${path}: XMP legible`,
      xmp.includes('GPano:ProjectionType="equirectangular"') &&
        xmp.includes(`GPano:FullPanoHeightPixels="${expectedFullHeight}"`),
      `${xmp.length} bytes`,
    );

    const tailA = original.subarray(startOfScan(original));
    const tailB = out.subarray(startOfScan(out));
    check(
      `${path}: píxeles sin tocar`,
      tailA.length === tailB.length && tailA.every((b, i) => b === tailB[i]),
      `${tailA.length} bytes de scan`,
    );

    const twice = injectGPanoXmp(out, fit.meta);
    const blocks = readHeaderSegments(twice).filter(
      (s) => s.marker === APP1 && readApp1Namespace(twice, s) === XMP_NAMESPACE,
    );
    check(
      `${path}: reinyección idempotente`,
      blocks.length === 1 && twice.length === out.length,
      `${blocks.length} bloque(s) XMP`,
    );
  }
}

/**
 * La normalización es lo que garantiza que todo lo que se suba termine con la
 * misma medida exacta, venga de donde venga.
 */
async function normalizeTests(check: Check) {
  const casos: Array<[string, number, number]> = [
    ['equirectangular 2:1', 2048, 1024],
    ['franja de celular', 6000, 1000],
    ['más chica que el destino', 1024, 512],
    ['impar', 3001, 1499],
  ];

  for (const [nombre, w, h] of casos) {
    const fuente = await solidBitmap(w, h);
    const fit = fitToEquirect(w, h, defaultFitOptions(w, h));
    const salida = await normalizeToEquirect(fuente, fit, { targetWidth: 4096 });
    fuente.close();

    const bitmap = await createImageBitmap(salida.blob);
    const exacta = bitmap.width === 4096 && bitmap.height === 2048;
    check(
      `normalizar ${nombre} (${w}×${h}) → 4096×2048`,
      exacta,
      `salió ${bitmap.width}×${bitmap.height}, ${(salida.blob.size / 1024).toFixed(0)} KB, ` +
        `${salida.paddedRows} filas rellenadas`,
    );
    bitmap.close();
  }

  // Una franja tiene que quedar centrada en vertical, no pegada arriba: el
  // relleno de arriba y el de abajo deben medir lo mismo.
  const fit = fitToEquirect(6000, 1000, defaultFitOptions(6000, 1000));
  const escala = 2048 / fit.meta.fullPanoWidthPixels;
  const arriba = Math.round(fit.meta.croppedAreaTopPixels * escala);
  const alto = Math.round(fit.meta.croppedAreaImageHeightPixels * escala);
  const abajo = 1024 - (arriba + alto);
  check(
    'normalizar: la franja queda centrada en vertical',
    Math.abs(arriba - abajo) <= 1 && arriba > 0,
    `${arriba}px arriba, ${alto}px de foto, ${abajo}px abajo (de 1024)`,
  );
}

function zipTests(check: Check) {
  // Vector conocido: el CRC-32 de "123456789" es 0xCBF43926.
  const patron = new TextEncoder().encode('123456789');
  check('zip: CRC-32 contra vector conocido', crc32(patron) === 0xcbf43926,
    '0x' + crc32(patron).toString(16).toUpperCase());

  const a = new TextEncoder().encode('hola');
  const b = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x42]);
  const zip = buildZip([
    { name: 'uno.txt', data: a },
    { name: 'dos.bin', data: b },
  ]);
  // 30 bytes de cabecera + nombre + datos, por archivo; 46 + nombre en el
  // directorio central; 22 del cierre.
  const esperado =
    30 + 7 + a.length + (30 + 7 + b.length) + (46 + 7) + (46 + 7) + 22;
  check('zip: tamaño exacto según el formato', zip.size === esperado,
    `${zip.size} bytes, esperado ${esperado}`);

  check('zip: nombres saneados y sin colisión', (() => {
    const usados = new Set<string>();
    const uno = safeFileName('Café / Patio', usados, '.jpg');
    const dos = safeFileName('Café / Patio', usados, '.jpg');
    return uno === 'Cafe  Patio.jpg' && dos === 'Cafe  Patio (2).jpg';
  })(), 'acentos y duplicados');
}

async function solidBitmap(width: number, height: number): Promise<ImageBitmap> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#3b6ea5';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#c4a24a';
  ctx.fillRect(0, Math.floor(height / 2), width, Math.ceil(height / 2));
  return createImageBitmap(canvas);
}

/** Camara equivalente a la del visor, mirando a un yaw/pitch dados. */
function makeCamera(
  width: number,
  height: number,
  yaw: number,
  pitch: number,
  fov: number,
): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(fov, width / height, 0.1, 1100);
  camera.lookAt(directionFromYawPitch(yaw, pitch));
  camera.updateMatrixWorld(true);
  return camera;
}

function angleBetween(yawA: number, pitchA: number, yawB: number, pitchB: number): number {
  const a = directionFromYawPitch(yawA, pitchA);
  const b = directionFromYawPitch(yawB, pitchB);
  return Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

/** Offset del marcador SOS (0xFFDA), donde arranca el dato comprimido. */
function startOfScan(bytes: Uint8Array): number {
  let offset = 2;
  while (offset < bytes.length - 1) {
    while (offset < bytes.length && bytes[offset] !== 0xff) offset++;
    let marker = offset;
    while (marker < bytes.length && bytes[marker] === 0xff) marker++;
    if (bytes[marker] === 0xda) return marker + 1;
    const length = (bytes[marker + 1] << 8) | bytes[marker + 2];
    offset = marker + 1 + length;
  }
  return bytes.length;
}
