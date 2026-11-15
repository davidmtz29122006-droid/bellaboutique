# Bella Boutique · Documentación del proyecto

Bella Boutique es un sistema de punto de venta para una tienda de ropa femenina elegante con dos sucursales. Esta carpeta contiene guías de apoyo y políticas del negocio.

## Objetivo del proyecto

- Registrar ventas, pagos y tickets.
- Gestionar prendas, inventario por sucursal, clientas, proveedores y usuarios.
- Consultar reportes de ventas, caja y existencias.
- Mantener una interfaz adaptable a computadora, tableta y teléfono.

## Estructura principal

- `src/`: código fuente de la aplicación front-end.
- `server/`: API y persistencia SQLite.
- `data/`: base SQLite local, creada al arrancar.
- `documents/`: documentación operativa y del negocio.
- `public/`: recursos estáticos accesibles por la aplicación.

## Inicio rápido

Usa Node.js 22.13 o posterior. Ejecuta `npm install` y luego `npm run dev`; abre `http://localhost:5173`. La API escucha en el puerto 3000.

Para compilar y servir la aplicación: `npm run build` y `npm start`.

El acceso de desarrollo inicial es `admin` / `Bella2026!`. Cambia la contraseña desde **Equipo → Cambiar contraseña** antes de usar información real.

La base SQLite vive en `data/bella-boutique.db`. Para operar las dos sucursales con la misma información, ambas deben acceder a una sola instancia del servidor; SQLite no se debe compartir directamente por una carpeta de red.

## Documentos incluidos

- `guia-del-proyecto.md`: descripción general y flujo de uso.
- `terminos-y-condiciones.md`: condiciones de compra y uso.
- `politica-de-privacidad.md`: tratamiento de datos e información personal.
- `devoluciones-y-envios.md`: políticas de envío y devoluciones.
- `faq.md`: preguntas frecuentes.
