// URL de la API de prueba
const ENDPOINT = 'https://jsonplaceholder.typicode.com/posts';

// 1. Registrar el Service Worker y escuchar sus mensajes
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.tipo === 'OUTBOX_SINCRONIZADO') {
      console.log('[UI] El Service Worker terminó de sincronizar');
      renderizarColaOutbox();
    }
  });
}

// 2. Indicador de red
function actualizarIndicadorRed() {
  const badge = document.getElementById('badge-red');
  if (navigator.onLine) {
    badge.textContent = 'En Línea';
    badge.className = 'badge online';
  } else {
    badge.textContent = 'Sin Conexión';
    badge.className = 'badge offline';
  }
}

// 3. READ: mostrar los registros de IndexedDB
function renderizarColaOutbox() {
  return obtenerTodosLosRegistros().then((registros) => {
    const lista = document.getElementById('lista-outbox');
    lista.innerHTML = '';

    registros.forEach((item) => {
      const li = document.createElement('li');
      const hora = new Date(item.fechaCreacion).toLocaleTimeString();
      li.textContent = hora + ' | ' + item.titulo + ' (' + item.estado + ')';
      li.className = item.estado;
      lista.appendChild(li);
    });
  });
}

// 4. CREATE: enviar el reporte o guardarlo como pendiente
function procesarEnvioReporte(datosFormulario) {
  return fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datosFormulario)
  })
    .then((respuesta) => {
      if (!respuesta.ok) throw new Error('Error HTTP del servidor');
      return respuesta.json();
    })
    .then(() => {
      // Hay internet: se guarda como sincronizado
      return guardarRegistro({
        ...datosFormulario,
        estado: 'sincronizado',
        fechaCreacion: Date.now()
      });
    })
    .catch(() => {
      console.warn('[Outbox] Sin conexión. Encolando en IndexedDB...');

      // No hay internet: se guarda como pendiente
      return guardarRegistro({
        ...datosFormulario,
        estado: 'pendiente',
        fechaCreacion: Date.now()
      })
        .then(() => {
          // Si el navegador soporta Background Sync, se lo dejamos al Service Worker
          if ('serviceWorker' in navigator && 'SyncManager' in window) {
            return navigator.serviceWorker.ready.then((registro) => {
              return registro.sync.register('sync-reportes');
            });
          }
        });
    })
    .then(() => {
      return renderizarColaOutbox();
    });
}

// 5. UPDATE (respaldo para Safari/iOS): reenviar los pendientes
function sincronizarPendientesFallback() {
  return obtenerTodosLosRegistros()
    .then((registros) => {
      const pendientes = registros.filter((item) => item.estado === 'pendiente');

      const promesasDeEnvio = pendientes.map((item) => {
        return fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: item.titulo, body: item.descripcion })
        })
          .then((res) => {
            if (!res.ok) throw new Error('Falla al reintentar envío');
            return actualizarEstadoRegistro(item.id, 'sincronizado');
          });
      });

      return Promise.all(promesasDeEnvio);
    })
    .then(() => {
      return renderizarColaOutbox();
    })
    .catch((error) => {
      console.error('[Outbox] Error al sincronizar:', error);
    });
}

// 6. Eventos de red
window.addEventListener('online', () => {
  actualizarIndicadorRed();

  // Solo sincroniza aquí si el navegador NO tiene Background Sync
  if (!('SyncManager' in window)) {
    sincronizarPendientesFallback();
  }
});

window.addEventListener('offline', actualizarIndicadorRed);

// 7. Formulario
document.getElementById('form-incidencia').addEventListener('submit', (e) => {
  e.preventDefault();

  const datos = {
    titulo: document.getElementById('titulo').value,
    descripcion: document.getElementById('descripcion').value
  };

  procesarEnvioReporte(datos).then(() => {
    e.target.reset();
  });
});

// 8. DELETE: purgar los sincronizados
document.getElementById('btn-purgar').addEventListener('click', () => {
  obtenerTodosLosRegistros()
    .then((registros) => {
      const enviados = registros.filter((item) => item.estado === 'sincronizado');
      return Promise.all(enviados.map((item) => eliminarRegistro(item.id)));
    })
    .then(() => {
      return renderizarColaOutbox();
    });
});

// Al cargar la página
actualizarIndicadorRed();
renderizarColaOutbox();
