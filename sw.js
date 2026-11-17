// Importar el mini-wrapper de IndexedDB
importScripts('./db-helper.js');

const CACHE_STATIC_NAME = 'static-outbox-v2';
const STATIC_FILES = [
  './',
  './index.html',
  './styles.css',
  './db-helper.js',
  './app.js',
  './manifest.json'
];

// Instalación: guardar el App Shell en caché
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC_NAME).then((cache) => cache.addAll(STATIC_FILES))
  );
  self.skipWaiting();
});

// Activación: borrar cachés viejas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nombres) => {
      return Promise.all(
        nombres
          .filter((nombre) => nombre !== CACHE_STATIC_NAME)
          .map((nombre) => caches.delete(nombre))
      );
    })
  );
  self.clients.claim();
});

// Fetch: primero caché, luego red (solo peticiones GET)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((respuesta) => {
      return respuesta || fetch(event.request);
    })
  );
});

// Avisar a las pestañas abiertas que ya se sincronizó
function notificarClientesActualizacion() {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then((clientes) => {
      clientes.forEach((cliente) => {
        cliente.postMessage({
          tipo: 'OUTBOX_SINCRONIZADO',
          timestamp: Date.now()
        });
      });
    });
}

// Reenviar los pendientes desde el Service Worker
function sincronizarPendientesSW() {
  return obtenerTodosLosRegistros()
    .then((registros) => {
      const pendientes = registros.filter((item) => item.estado === 'pendiente');

      if (pendientes.length === 0) {
        return;
      }

      const promesasDeEnvio = pendientes.map((item) => {
        return fetch('https://jsonplaceholder.typicode.com/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: item.titulo,
            body: item.descripcion
          })
        })
          .then((respuesta) => {
            if (!respuesta.ok) {
              throw new Error('Error HTTP ' + respuesta.status);
            }
            return actualizarEstadoRegistro(item.id, 'sincronizado');
          });
      });

      return Promise.all(promesasDeEnvio)
        .then(() => notificarClientesActualizacion());
    });
}

// Evento sync: el navegador lo dispara cuando regresa el internet
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-reportes') {
    event.waitUntil(
      sincronizarPendientesSW()
        .catch((error) => {
          console.error('[SW-Sync] Falló, el navegador reintentará:', error);
          throw error;
        })
    );
  }
});
