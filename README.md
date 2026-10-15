# DGGRRD · Generador de informes

Primera versión funcional para pruebas, alojable en GitHub Pages. Conexión a capas protegidas ArcGIS, recuentos por categoría y estado, exportación Word y vista imprimible en PDF.

## Publicación

1. GitHub → Settings → Pages → Deploy from branch → main / (root).
2. URL prevista: https://zezzi01.github.io/dggrrd-informes/
3. Registrar una aplicación OAuth 2.0 de navegador en ArcGIS Online, con la URL anterior como Redirect URI.
4. Copiar el Client ID público, abrir la web y conectarse con usuario autorizado.

## Capas

- Jornadas: FeatureServer/0
- Intervenciones: FeatureServer/1
- Servicio base: https://services7.arcgis.com/rMjPnBdK2qv90f42/arcgis/rest/services/service_03acd09013ba4976b3cc79e87c6a6689/FeatureServer

## Importante

- No añadir Client Secret, token ni datos personales al repositorio. La aplicación no guarda credenciales. Conserva temporalmente el Client ID público durante la sesión para completar OAuth.
- Los archivos se generan en el navegador: el PDF se obtiene mediante impresión a PDF y Word con docx.js.
- Esta versión todavía **no está verificada** con el servicio ArcGIS protegido del usuario. Es necesario probar OAuth y los campos de la capa.
- Las cifras se obtienen de las capas. Verificar fechas heredadas, códigos de las categorías, kilogramos declarados y la relación de jornadas antes de un informe oficial.
- Por ahora no se incluyen fotografías, mapas dentro del informe ni reconciliación con las cifras históricas anteriores a Survey123. El contenido institucional requiere revisión del responsable.
- GitHub Pages publica el código, pero las capas privadas permanecen controladas por permisos de ArcGIS Online.
