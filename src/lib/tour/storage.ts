import type { Tour } from './types';

/**
 * Persistencia local del tour. Las panoramicas pesan varios MB cada una, asi
 * que van a IndexedDB como Blob; localStorage se quedaria corto al instante.
 */
const DB_NAME = 'sistema-360';
const DB_VERSION = 1;
const STORE_TOURS = 'tours';
const STORE_IMAGES = 'images';
const ACTIVE_TOUR_KEY = 'activo';

/** Tope para abrir la base. Sin esto un bloqueo deja la app colgada sin aviso. */
const OPEN_TIMEOUT_MS = 8000;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    // `indexedDB.open` no falla cuando otra pestaña tiene la base tomada:
    // se queda esperando en silencio. Sin este tope la app muestra
    // "Procesando…" para siempre y no hay forma de enterarse.
    const timer = setTimeout(
      () =>
        finish(() =>
          reject(
            new Error(
              'El almacenamiento del navegador no responde. Suele pasar si el tour está ' +
                'abierto en otra pestaña: cerrala y volvé a intentar.',
            ),
          ),
        ),
      OPEN_TIMEOUT_MS,
    );

    request.onblocked = () =>
      finish(() =>
        reject(
          new Error(
            'Hay otra pestaña con este tour abierto bloqueando el almacenamiento. ' +
              'Cerrala y recargá.',
          ),
        ),
      );

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_TOURS)) db.createObjectStore(STORE_TOURS);
      if (!db.objectStoreNames.contains(STORE_IMAGES)) db.createObjectStore(STORE_IMAGES);
    };

    request.onsuccess = () =>
      finish(() => {
        const db = request.result;
        // Si otra pestaña necesita migrar o borrar la base, le soltamos la
        // conexión en lugar de bloquearla.
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        db.onclose = () => {
          dbPromise = null;
        };
        resolve(db);
      });

    request.onerror = () =>
      finish(() => reject(request.error ?? new Error('No se pudo abrir IndexedDB.')));
  }).catch((e) => {
    // Una apertura fallida no debe quedar cacheada: así el próximo intento
    // vuelve a probar en vez de fallar para siempre.
    dbPromise = null;
    throw e;
  });

  return dbPromise;
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const request = fn(tx.objectStore(store));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Falló la operación.'));
        // Una transacción abortada no dispara `onerror` del request. El caso
        // típico es quedarse sin cuota: las panorámicas pesan varios MB.
        tx.onabort = () =>
          reject(
            tx.error?.name === 'QuotaExceededError'
              ? new Error(
                  'No queda espacio en el navegador para más panorámicas. Borrá alguna ' +
                    'escena o liberá espacio del sitio.',
                )
              : (tx.error ?? new Error('La operación de almacenamiento se canceló.')),
          );
      }),
  );
}

export function saveTour(tour: Tour): Promise<IDBValidKey> {
  return run(STORE_TOURS, 'readwrite', (s) =>
    s.put({ ...tour, updatedAt: Date.now() }, ACTIVE_TOUR_KEY),
  );
}

export function loadTour(): Promise<Tour | undefined> {
  return run<Tour | undefined>(STORE_TOURS, 'readonly', (s) => s.get(ACTIVE_TOUR_KEY));
}

export function putImage(id: string, blob: Blob): Promise<IDBValidKey> {
  return run(STORE_IMAGES, 'readwrite', (s) => s.put(blob, id));
}

export function getImage(id: string): Promise<Blob | undefined> {
  return run<Blob | undefined>(STORE_IMAGES, 'readonly', (s) => s.get(id));
}

export function deleteImage(id: string): Promise<undefined> {
  return run<undefined>(STORE_IMAGES, 'readwrite', (s) => s.delete(id));
}

/** Cuanto espacio hay usado y disponible, para avisar antes de que reviente. */
export async function storageEstimate(): Promise<{ usedMb: number; quotaMb: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usedMb: usage / 1024 / 1024, quotaMb: quota / 1024 / 1024 };
}
