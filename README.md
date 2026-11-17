# Bella Boutique · Sistema de punto de venta

Aplicación web responsive para el punto de venta de Bella Boutique. La API guarda usuarios, sucursales, prendas, existencias, clientas, proveedores, ventas, pagos y devoluciones en una base SQLite persistente.

## Requisitos

- Node.js 22.13 o posterior (utiliza el módulo SQLite integrado en Node)
- npm

## Iniciar en desarrollo

```powershell
npm install
npm run dev
```

Abre la dirección local indicada por Vite (normalmente `http://localhost:5173`). La API usa el puerto `3000` y Vite redirige `/api` al servidor local.

El catálogo público está disponible en `http://localhost:5173/catalogo`. Después de iniciar sesión, la pantalla **Inicio** muestra los accesos disponibles para cada perfil. Administración tiene acceso a todos los módulos; Caja puede usar ventas, clientes y reportes; Ventas puede consultar productos e inventario y atender ventas y clientes. Administración es el único perfil que puede acceder a proveedores, usuarios, documentación del proyecto y su PDF original.

| Perfil | Accesos principales |
| --- | --- |
| Administración | Todos los módulos, configuración, equipo y documentación |
| Caja | Punto de venta, ventas, clientes y reportes de su sucursal |
| Ventas | Punto de venta, productos, inventario de consulta y clientes |
| Todos | Catálogo digital público |

La sección **Equipo** permite a Administración desactivar o reactivar cuentas. Una cuenta desactivada no puede iniciar sesión y sus sesiones abiertas quedan bloqueadas; no se permite desactivar la cuenta propia ni la última cuenta de administración activa. La sección **Proyecto** reúne la planificación, el cuestionario, el cronograma, el presupuesto, los requisitos y la lista de cotejo. El PDF original se conserva en `documents/` y se sirve solo a cuentas de administración.

## Accesos iniciales

| Perfil | Usuario | Contraseña |
| --- | --- | --- |
| Administración | `admin` | `Bella2026!` |
| Caja | `caja` | `Bella2026!` |
| Ventas | `ventas` | `Bella2026!` |

Los accesos se crean al iniciar la base por primera vez. Cambia las contraseñas de prueba desde **Equipo → Cambiar contraseña** antes de usar la aplicación con información real. Las cuentas de prueba son solo para desarrollo.

## Base de datos

El archivo se crea automáticamente en `data/bella-boutique.db`; conserva la información al reiniciar el servidor. Para guardarlo en otra ubicación puedes definir `DB_PATH` o `DATA_DIRECTORY`.

El esquema relacional incluye usuarios, clientas, sucursales, categorías, productos, proveedores, inventario, ventas, detalle de venta, pagos, descuentos y devoluciones. Los productos se relacionan con categorías y proveedores; las ventas con cliente, sucursal, usuario, descuento, detalle y pagos. Las reglas de descuento y los pagos históricos se migran desde las ventas existentes. Las migraciones se registran en `schema_migrations` y conservan los campos anteriores que la aplicación aún utiliza.

El sistema viene precargado con dos sucursales, prendas de ejemplo, dos clientas, un proveedor y tres cuentas de prueba. Las ventas reducen las existencias dentro de una transacción; las cancelaciones válidas y devoluciones autorizadas las reintegran y se conservan en el historial. Las devoluciones requieren etiquetas intactas, prenda sin uso, se limitan a 15 días y excluyen lencería. Las socias reciben 20% de descuento y las clientas que superen $20,000 MXN en ventas completadas durante los últimos doce meses reciben 30% (se aplica un solo descuento, el mayor que corresponda).

## Ejecutar como sitio compilado

```powershell
npm run build
npm start
```

El servidor entrega el sitio compilado y la API desde `http://localhost:3000`. Para un despliegue en red, define `SESSION_SECRET` con un secreto aleatorio de al menos 32 bytes y protege el servidor con HTTPS.

## Alcance de SQLite local

Esta configuración mantiene la base en el equipo/servidor donde se ejecuta la aplicación. Para que las dos sucursales vean los mismos datos, ambas deben acceder a una misma instancia del servidor, alojada en una red común o en línea. No expongas directamente el archivo SQLite a través de una carpeta compartida; para operar tiendas remotas con alta disponibilidad conviene migrar a PostgreSQL administrado.
