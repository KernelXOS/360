# Sistema 360

Editor y visor de **tours virtuales** con fotos 360, al estilo de Street View,
Kuula o 3DVista. Se arma un recorrido con varias panorámicas conectadas por
puntos en los que el visitante hace clic para moverse.

Todo corre en el navegador: las imágenes nunca salen de la máquina.

## Cómo funciona

Cada **escena** es una panorámica apoyada sobre una esfera invertida en WebGL.
La cámara está en el centro, así que cualquier dirección cae sobre la foto.

Los **puntos** no se dibujan dentro del WebGL como sprites: son elementos HTML
cuya posición se calcula proyectando su dirección 3D a coordenadas de pantalla
en cada cuadro. Eso da texto nítido a cualquier zoom, animaciones y estados de
hover en CSS, y clics nativos del navegador — sin trazar rayos contra geometría.

Una posición es un par `yaw` / `pitch` en radianes, no un píxel: el punto queda
pegado al lugar del mundo aunque cambie la resolución, el zoom o el encuadre.

```
yaw   0 = centro de la panorámica, positivo hacia la derecha
pitch 0 = horizonte, positivo hacia arriba
```

## Uso

```bash
npm install
npm run dev            # http://localhost:5173
npm run dev:https      # HTTPS en la red local
npm run typecheck
npm run build
```

Para armar un tour:

1. En **Resolución y descargas**, elegí a qué medida se convierte todo. Si tenés
   una foto de referencia, subila y tocá *Usar la resolución de …*: adopta su
   ancho sin que tengas que averiguarlo.
2. Soltá varias panorámicas de una en **Escenas**.
3. Elegí **+ Salto a escena** y hacé clic en el visor donde va el punto.
4. Asignale destino en el panel de la derecha. Los puntos ya puestos se arrastran.
5. Girá la vista y usá **Fijar la vista actual como entrada** para elegir hacia
   dónde mira el visitante al llegar a esa escena.
6. Pasá a **Recorrer** para probarlo como lo va a ver la gente.

## Resolución de salida

Toda panorámica se convierte al importarla a una equirectangular exacta del
ancho elegido, con la altura siempre en la mitad. Así un tour no mezcla una
foto de 4096×2048 con una franja de celular de 11000×2000.

Solo se configura el ancho porque la proporción 2:1 es lo que define una esfera
de 360°×180°. Los presets que superan el `MAX_TEXTURE_SIZE` de la placa quedan
deshabilitados: una textura más grande no se puede dibujar.

Una panorámica de celular es una franja: cubre los 360° de horizonte pero solo
una banda vertical. Al normalizarla se la coloca en la altura que le
corresponde y el resto se rellena **estirando la fila de borde**, no con negro
—dos tapas negras se notan muchísimo al mirar al cielo o al piso.

Cambiar la resolución afecta a lo que subas de ahí en más; las escenas ya
cargadas quedan como están.

Desde la misma sección se descarga una escena suelta o todas en un ZIP. Salen
en JPG con el metadato GPano incrustado, así que también sirven para subirlas
sueltas a Facebook.

El tour se guarda solo en IndexedDB: las panorámicas pesan varios MB y
localStorage se quedaría corto al instante.

## Estructura

```
src/
├── lib/
│   ├── tour/
│   │   ├── types.ts     Tour, Scene, Hotspot + detección de saltos rotos
│   │   ├── geometry.ts  yaw/pitch ↔ dirección ↔ pantalla
│   │   └── storage.ts   IndexedDB (estructura del tour + blobs)
│   ├── image/
│   │   └── normalize.ts Conversión a equirectangular exacta
│   ├── zip.ts           Escritor de ZIP (método store, sin dependencias)
│   └── jpeg/            Inyección de metadatos GPano para exportar a Facebook
├── features/
│   ├── tour/            Visor, marcadores, lista de escenas, panel de puntos
│   ├── editor/          fitToEquirect: cómo se apoya la foto en la esfera
│   └── upload/          Lectura y validación de archivos
└── dev/selfTest.ts      Verificación del núcleo
```

## Verificación

`tools/make-samples.ps1` genera panorámicas de prueba con meridianos etiquetados
cada 30° y una línea de horizonte, en `public/samples/`.

Con el dev server andando, desde la consola del navegador:

```js
const { runSelfTest } = await import('/src/dev/selfTest.ts');
await runSelfTest();
```

Comprueba lo que rompe un tour si falla:

- **Ida y vuelta de la proyección.** Proyectar un punto a pantalla y volver de
  la pantalla al punto tiene que dar lo mismo, en 4 orientaciones × 3
  inclinaciones × 3 niveles de zoom. Si no coinciden, los puntos se corren al
  girar. Error máximo medido: 1.2e-6 grados sobre 900 muestras.
- **Oclusión.** Un punto a la espalda de la cámara no puede dibujarse adelante.
- **Orientación.** Derecha es derecha y arriba es arriba.
- **Grafo del tour.** Saltos sin destino y escenas a las que no llega nadie.
- **Metadatos JPEG.** Que el XMP quede legible, que el dato comprimido no se
  toque ni un byte y que reinyectar no duplique bloques.
- **Normalización.** Cuatro formas de entrada —2:1, franja, más chica que el
  destino, y de medidas impares— tienen que salir todas a la medida exacta, y
  la franja tiene que quedar centrada en vertical.
- **ZIP.** CRC-32 contra vector conocido, tamaño exacto según el formato y
  nombres saneados sin colisiones. El contenedor se validó además extrayéndolo
  con `Expand-Archive` de Windows, que es una implementación independiente:
  conserva nombres con acento, subcarpetas y bytes binarios exactos.

En modo dev el visor expone `window.__viewer` (`renderer`, `scene`, `camera`,
`draw()`, `view`) para renderizar a demanda e inspeccionar píxeles — necesario
porque el navegador congela `requestAnimationFrame` con la pestaña de fondo.

## Estado

- [x] Escenas múltiples con miniaturas, renombrado y escena de inicio.
- [x] Puntos de salto e información: colocar con un clic, arrastrar, etiquetar.
- [x] Navegación entre escenas con fundido y precarga de las vecinas.
- [x] Vista de entrada por escena.
- [x] Detección de saltos rotos y escenas inalcanzables.
- [x] Autoguardado en IndexedDB, con indicador de "guardado hace…".
- [x] Deshacer / rehacer (Ctrl+Z / Ctrl+Shift+Z), con instantáneas al aquietarse
      los cambios: escribir un nombre entero deja una sola entrada.
- [x] Interfaz de trabajo: rail de secciones, panel lateral, brújula, pantalla
      completa, tema claro/oscuro y guía de pasos calculada del estado real.
- [x] Normalización de toda panorámica importada a una resolución fija.
- [x] Descarga por escena y de todas juntas en un ZIP, listas para Facebook.
- [ ] **Publicar el tour**: exportar un visor autónomo (HTML + imágenes) para
      subir a cualquier hosting. Los botones "Compartir" y "Publicar" de la
      barra superior están deshabilitados a propósito hasta que exista: no son
      botones decorativos.
- [ ] Plano/minimapa con la ubicación de cada escena.
- [ ] Giroscopio en el celular y modo pantalla completa.
- [ ] Captura guiada desde la cámara del navegador.

No hay integración con la Graph API de Facebook y no está previsto agregarla:
publicar por API tiene riesgo de sanción a la cuenta.

## Límites conocidos

- **HEIC** (iPhone por defecto) no se puede decodificar en el navegador. Hay que
  exportar como JPG, o poner la cámara en modo "Más compatible".
- El archivo original no se conserva: al importarlo se guarda ya convertido a la
  resolución de salida. Cambiar esa resolución después no reconvierte lo que ya
  estaba cargado, hay que volver a subirlo.
- La textura del visor se limita a 4096px de ancho aunque la escena sea mayor.
- El tour vive en el navegador donde se armó. Sin la exportación del visor
  autónomo todavía no se puede compartir.
