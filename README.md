# Bitácora de Mantenimiento (PWA Outbox)

Práctica de los Temas 5.1, 5.2 y 5.3: IndexedDB, Patrón Outbox, GitHub Pages y Background Sync.

## Archivos

- `index.html`: formulario y bandeja de salida.
- `styles.css`: estilos.
- `db-helper.js`: mini-wrapper de IndexedDB con promesas (`abrirDB`, `guardarRegistro`, `obtenerTodosLosRegistros`, `eliminarRegistro`, `actualizarEstadoRegistro`).
- `app.js`: envía el reporte; si no hay internet lo guarda como `pendiente` y registra `sync-reportes`.
- `sw.js`: caché del App Shell, evento `sync` y aviso a la página con `postMessage`.
- `manifest.json`: manifiesto con rutas relativas.

## Cómo probar

1. Abrir la página en Chrome y entrar a DevTools → Application.
2. En Network activar **Offline** y enviar un reporte: queda como `pendiente`.
3. Quitar Offline: el Service Worker lo reenvía y queda como `sincronizado`.
