# DGGRRD · Generador de informes

Generador institucional de informes Word y PDF a partir de capas privadas de ArcGIS. La interfaz no recibe ni guarda credenciales: un backend de Cloudflare Pages consulta ArcGIS y Cloudflare Access identifica individualmente a cada funcionario autorizado.

## Arquitectura elegida

- **Cloudflare Pages** publica los archivos estáticos y ejecuta `functions/api/arcgis.js`.
- **Cloudflare Access** protege la web y `/api`, con código de un solo uso enviado al correo de cada persona autorizada. Se admiten correos personales o institucionales.
- **ArcGIS** se consulta únicamente desde la función del servidor. Los secretos se cargan como variables cifradas de Cloudflare y no se incluyen en GitHub ni llegan al navegador.
- **Word/PDF** siguen generándose localmente en el navegador después de la consulta autorizada.

GitHub Pages no debe usarse para la versión real: es un hosting estático y no puede proteger secretos ni ejecutar este backend.

## Publicación inicial en Cloudflare

1. Crear una cuenta de Cloudflare y, en **Workers & Pages**, crear una aplicación Pages conectada a `zezzi01/dggrrd-informes`.
2. Configurar: rama `main`, sin framework, sin comando de compilación y directorio de salida `.` (raíz del repositorio).
3. En la configuración del proyecto → **Variables and Secrets**, cargar una de estas opciones:
   - Recomendada: `ARCGIS_CLIENT_ID` y `ARCGIS_CLIENT_SECRET` de una aplicación ArcGIS con acceso de lectura a las dos capas.
   - Alternativa si la organización no permite credenciales de aplicación: `ARCGIS_USERNAME`, `ARCGIS_PASSWORD` y `ARCGIS_REFERER` (la URL pública exacta de Pages). Usar una cuenta técnica de solo lectura, no una cuenta personal.
4. En **Zero Trust → Access → Applications**, agregar una aplicación *Self-hosted* para el dominio completo de Pages, incluidos los dominios de vista previa.
5. Crear una política **Allow** con los correos autorizados. Activar **One-time PIN** como método de inicio de sesión. Cada alta/baja se administra aquí; los usuarios no necesitan cuentas ArcGIS.
6. Confirmar que una ventana privada sin autenticar sea redirigida a Access y que un correo no incluido sea rechazado.
7. Probar **Verificar**, consultar un período y descargar Word y PDF antes de utilizar cifras oficialmente.

## Configuración de ArcGIS

Servicio fijo consultado por el backend:

- Jornadas: `FeatureServer/0`
- Intervenciones: `FeatureServer/1`
- Base: `https://services7.arcgis.com/rMjPnBdK2qv90f42/arcgis/rest/services/service_03acd09013ba4976b3cc79e87c6a6689/FeatureServer`

La identidad configurada en el servidor debe tener solo permiso de lectura. Si se usa OAuth de aplicación, compartir las capas con la aplicación/identidad correspondiente según la configuración de ArcGIS Online. Rotar el secreto si alguna vez se copia fuera del administrador de secretos.

## Desarrollo local

Cloudflare Access agrega el encabezado de identidad solamente en el entorno publicado. Para probar el flujo completo se recomienda una implementación de vista previa también protegida por Access. No se debe añadir un modo de autenticación simulada a producción.

## Estado

Ya implementado en el repositorio:

- interfaz y agregación de jornadas/intervenciones;
- exportación Word sin dependencias externas;
- vista imprimible para guardar como PDF;
- backend restringido a las capas 0 y 1, sin URL ni consulta arbitraria;
- caché temporal del token de ArcGIS en memoria;
- lectura de identidad individual entregada por Cloudflare Access;
- cabeceras de seguridad y exclusión de archivos locales con secretos.

Requiere intervención del administrador:

- crear/conectar el proyecto de Cloudflare Pages;
- decidir qué correos concretos quedan autorizados en Access;
- crear una credencial ArcGIS de solo lectura y cargarla como secretos;
- proteger también los dominios de vista previa y probar los nombres/campos reales de las capas privadas.

Nunca añadir contraseñas, secretos, tokens, exportaciones de datos ni archivos `.dev.vars` al repositorio.
