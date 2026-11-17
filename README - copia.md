# Bella Boutique POS

Sistema de punto de venta responsive para Bella Boutique, respaldado por SQLite.

## Desarrollo

Requiere Node.js 22.13 o posterior.

```powershell
npm install
npm run dev
```

Abre `http://localhost:5173`. El comando inicia la interfaz y la API; los datos se guardan en `data/bella-boutique.db`.

Acceso de demostración: `admin` / `Bella2026!`. Cambia la contraseña en **Equipo → Cambiar contraseña** antes de utilizar información real.

También se crea un respaldo diario de SQLite en `data/backups`. El catálogo adaptable a celulares y tabletas está disponible sin iniciar sesión en `http://localhost:5173/catalogo`.

## Perfiles de acceso

- **Administración:** acceso completo a las sucursales, catálogo, inventario, proveedores y surtidos, clientas, devoluciones/cambios, caja, equipo y reportes.
- **Cajero:** ventas y tickets de su sucursal, apertura/cierre y movimientos de caja, consulta de productos e inventario, clientas y cancelación de sus ventas. No puede administrar productos, proveedores, usuarios ni reportes.
- **Vendedor:** punto de venta y consulta de productos/disponibilidad. No puede abrir caja, consultar el historial de ventas ni acceder a datos de contacto de clientas.

Todos pueden cambiar su propia contraseña desde **Equipo**. Los permisos se validan en la API, además de ocultar las pantallas no autorizadas.
Solo la cuenta principal (`admin`) puede agregar cuentas. Esta cuenta no se puede desactivar ni eliminar.

En una base nueva se crean seis cuentas de demostración (`admin`, `caja`, `ventas-centro`, `caja-norte`, `ventas`, `ventas-norte2`); todas usan inicialmente `Bella2026!`. Cambia esas contraseñas desde el sistema.

## Producción

```powershell
npm run build
npm start
```

Abre `http://localhost:3000`. Define `SESSION_SECRET` y habilita HTTPS en producción.

Para compartir datos entre las dos sucursales, ambas deben conectarse a una única instancia del servidor. No compartas el archivo SQLite directamente por una unidad de red.
