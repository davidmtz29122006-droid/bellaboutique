# Guía de Bella Boutique POS

## Visión general

Bella Boutique POS administra las ventas y existencias de dos sucursales. Los perfiles de acceso son administración, cajero y vendedor. Las ventas, movimientos de inventario, clientas, proveedores y cuentas se guardan en SQLite.

## Requisitos

- Node.js 22.13 o superior (incluye SQLite integrado)
- npm
- Un navegador moderno

## Puesta en marcha

```powershell
npm install
npm run dev
```

Abre `http://localhost:5173`. El servidor crea la base de datos en `data/bella-boutique.db` al iniciar.

Acceso de demostración: usuario `admin`, contraseña `Bella2026!`. Cambia la contraseña desde **Equipo** antes de introducir datos reales.
El catálogo público y adaptable a móviles está en `http://localhost:5173/catalogo`. Se genera un respaldo diario en `data/backups`.

## Producción

```powershell
npm run build
npm start
```

El servidor presenta la aplicación en `http://localhost:3000`. Define `SESSION_SECRET` con una clave aleatoria y usa HTTPS en una instalación publicada.

## Módulos

- **Punto de venta:** búsqueda o lectura de código de barras, pagos en efectivo, tarjeta y transferencia; genera e imprime tickets; requiere una caja abierta.
- **Caja:** apertura con fondo, ingresos/retiros y cierre con efectivo esperado, ventas por método de pago, cancelaciones y devoluciones.
- **Productos e inventario:** captura manual y edición del catálogo, talla y color por variante, existencias por sucursal, entradas, ajustes (incluida existencia cero) y alertas cuando el stock queda por debajo del mínimo (cinco por defecto).
- **Catálogo digital:** consulta pública en celulares/tabletas, con precio y disponibilidad desglosada para ambas sucursales.
- **Clientas:** número de socia y membresía, aceptación de privacidad/promociones y descuentos automáticos.
- **Ventas:** historial de caja, cancelaciones y devoluciones/cambios dentro de 15 días; no se aceptan prendas de lencería ni artículos usados o sin etiqueta.
- **Proveedores:** número de proveedor, contacto y registro de surtidos con fecha, prenda, sucursal y cantidad.
- **Equipo y reportes:** alta/desactivación de usuarios y reportes mensuales de ventas diarias, métodos de pago, devoluciones, cancelaciones, inventario, usuarios y ventas por cajero.

### Acceso por perfil

- **Administración:** todos los módulos y sucursales, además de gestionar productos, inventario, proveedores, usuarios y reportes. Es el único perfil que autoriza cambios y devoluciones.
- **Cajero:** vende y cobra en su sucursal, consulta productos/inventario y clientas, registra caja y puede cancelar ventas de su sucursal. No gestiona catálogo, inventario, proveedores, usuarios ni reportes.
- **Vendedor:** registra ventas con la caja previamente abierta y consulta catálogo/inventario de su sucursal. No accede al historial de ventas, reportes, caja, administración ni datos de contacto de clientas.
- Cada usuario puede cambiar su propia contraseña. Las restricciones se aplican tanto en la interfaz como en los endpoints de la API.
- Solo la cuenta principal `admin` puede agregar usuarios; no se puede desactivar ni eliminar.

## Sucursales y datos

El sistema precarga productos y seis cuentas de demostración en una base nueva; todas comienzan con `Bella2026!` y deben cambiarse antes de usar información real. SQLite funciona en la máquina o servidor donde se inicia la aplicación. Para compartir existencias entre sucursales, aloja una única instancia del servicio en una red común o en línea. No abras el archivo `.db` directamente desde una carpeta compartida.

Los descuentos definidos son 20% para socias y 30% al superar $20,000 MXN de compras completadas en los últimos doce meses; se aplica el mayor que corresponda. No se tramitan devoluciones de lencería. Los requisitos del negocio son la fuente de verdad para la política vigente.
