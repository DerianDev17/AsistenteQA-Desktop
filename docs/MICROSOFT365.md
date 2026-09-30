# Conectar correo y calendario institucional de Microsoft 365

La app ya incluye conexión OAuth y sincronización de correo. La cuenta real solo queda conectada cuando introduces el registro de tu institución y completas el acceso de Microsoft en el navegador.

## 1. Registrar QA Assistant Desktop

Entra al [centro de administración de Microsoft Entra](https://entra.microsoft.com/) con la cuenta institucional. Si no puedes registrar aplicaciones, entrega los requisitos de esta sección a TI.

1. Abre **Identidad → Aplicaciones → Registros de aplicaciones → Nuevo registro** (la ubicación del menú puede variar).
2. Nombre: **QA Assistant Desktop**.
3. Tipos de cuenta: **Solo las cuentas de este directorio organizativo**.
4. Registra la aplicación. Copia los valores de **Application (client) ID** y **Directory (tenant) ID** de Información general.
5. En **Autenticación → Agregar una plataforma → Aplicaciones móviles y de escritorio**, registra **`http://localhost`** como URI de redirección. El puerto es dinámico. No selecciones plataforma Web ni SPA para este flujo.
6. En **Permisos de API → Agregar un permiso → Microsoft Graph → Permisos delegados**, agrega **`Mail.Read`**. Es necesario para la vista previa del mensaje. No agregues permisos de aplicación, escritura o envío.
7. Si la política de tu organización exige consentimiento administrativo o bloquea el registro de aplicaciones, TI debe autorizarlo. No es necesario crear un **client secret**: se usa un cliente público con PKCE.

Estos pasos siguen la [configuración oficial de aplicaciones de escritorio](https://learn.microsoft.com/en-us/entra/identity-platform/scenario-desktop-app-configuration) y los [permisos de Microsoft Graph](https://learn.microsoft.com/en-us/graph/permissions-reference).

## 2. Conectar desde la app

```powershell
npm ci
npm run dev
```

1. Abre **Correos**.
2. Introduce el **client ID** y el **tenant ID**. Son identificadores públicos; no introduzcas una contraseña ni un secreto de cliente.
3. Elige si quieres sincronizar automáticamente cada cinco minutos y pulsa **Guardar conexión**.
4. Pulsa **Conectar y sincronizar**.
5. En el navegador de Microsoft, elige la cuenta institucional y completa MFA/consentimiento si se solicita.
6. Regresa a QA Assistant. Verifica que aparezca tu cuenta y que se complete la primera sincronización.

Mientras esté en curso, **Cancelar operación** detiene la espera de autorización o la sincronización. La recepción local del código expira después de tres minutos. La cuenta no se guarda si la operación fue cancelada.

## Qué se sincroniza

- Bandeja de entrada principal de Exchange Online en la nube global de Microsoft 365.
- Mensajes recibidos en los últimos 30 días: asunto, remitente, vista previa, fecha, prioridad, estado leído e indicador de adjuntos.
- Cambios incrementales mediante Microsoft Graph delta: mensajes nuevos, actualizaciones y mensajes eliminados o movidos fuera de la bandeja.
- Páginas solicitadas de 50 mensajes y hasta 10 páginas por ejecución. Si quedan cambios, el cursor permite continuar manualmente o en la siguiente ejecución automática.
- La lista local se pagina en bloques de 50. La retención de 30 días se aplica durante la sincronización; sin conexión se conserva la última copia disponible.

El botón **Sincronizar ahora** permite actualizar manualmente. Con la opción automática activada, la app revisa al arrancar y cada cinco minutos mientras esté abierta o en la bandeja. No abre pantallas de login automáticamente. Las sesiones que necesiten consentimiento/MFA adicional requieren **Volver a autorizar**.

En **Inicio**, el panel **Correo institucional** muestra la cuenta, la última sincronización, el total de correos descargados y los cinco mensajes más recientes con su vista previa. Puedes sincronizar desde ese panel o abrir **Correos** para consultar toda la bandeja. El dashboard consulta la copia local cada cinco segundos y al recuperar el foco; esa actualización de pantalla no realiza solicitudes a Microsoft. Los errores, la descarga incompleta y la necesidad de renovar acceso también aparecen en Inicio. Para crear una tarea, abre un mensaje y revisa su borrador antes de guardarlo.

La sincronización usa la [API delta de mensajes de Microsoft Graph](https://learn.microsoft.com/en-us/graph/api/message-delta?view=graph-rest-1.0).

## Convertir un correo en tarea

En **Inicio** o **Correos**, abre un mensaje y pulsa **Crear tarea desde correo**. La app propone un título basado en el asunto y prioridad alta si Microsoft marca el mensaje como importante. Revisa el título, añade una descripción si la necesitas y elige proyecto y fecha. La app no inventa un vencimiento y no guarda la tarea hasta que pulses **Guardar tarea**. El borrador no copia el cuerpo ni la vista previa del correo.

El formulario explica que el texto aprobado pasa a las tareas locales, almacenadas sin cifrado: evita copiar información sensible. La copia original del correo permanece cifrada. La referencia de origen es un hash de la cuenta y el identificador del mensaje, sin guardar credenciales en la tarea.

Cada correo puede originar una tarea. Volver a pulsar la acción abre la existente para editarla, y los intentos simultáneos se deduplican en SQLite sin sobrescribirla. La referencia se conserva aunque se reconstruya la copia del correo. Si eliminas la tarea, puedes crear otra desde el mismo mensaje. Desconectar la cuenta o eliminar el correo no elimina la tarea ya creada.

Las tareas creadas aparecen en **Tareas**, en la ficha del proyecto elegido y en **Mi Día** según su fecha y estado. En **Proyectos**, pulsa el nombre para consultar contexto, avance, tareas y últimas actualizaciones; puedes filtrar las procedentes de correo.

### Propuestas de certificaciones y proyectos

**Inicio** y **Mi Día** muestran hasta diez propuestas basadas en los 150 correos descargados más recientes. Reglas locales revisan asunto y vista previa buscando certificación/homologación, acciones de proyecto y nombres o códigos de proyectos activos. Las coincidencias son orientativas: revisa el mensaje antes de guardar. No se analiza con IA ni se descarga el cuerpo completo.

Pulsa **Revisar actividad**. Si hay un único proyecto coincidente, aparece preseleccionado; si hay varios, debes elegir. Las fechas siguen vacías hasta que tú las indiques. Se excluyen propuestas cuyos correos ya originaron una tarea, incluso completada. No existe aún una opción persistente para descartar propuestas.

## Reuniones de Teams como actividades de agenda

1. En el registro de **QA Assistant Desktop** en Microsoft Entra, abre **Permisos de API → Agregar un permiso → Microsoft Graph → Permisos delegados**.
2. Añade **Calendars.Read** y conserva **Mail.Read**. La política de la institución puede exigir aprobación de TI.
3. Reinicia la app con esta versión, abre **Calendario** y pulsa **Autorizar calendario**. Inicia sesión con la misma cuenta ya conectada.
4. Comprueba la última sincronización y los eventos. **Sincronizar agenda** actualiza manualmente. La opción automática en Correos incluye el calendario autorizado cada cinco minutos mientras la app está abierta o en la bandeja.

No basta con haber conectado el correo: el calendario solicita permiso adicional. Si Microsoft exige nueva autorización, el calendario lo indica sin marcar el acceso de correo como inválido. No requiere client secret ni permisos de escritura o lectura de chats de Teams.

La agenda lee el **calendario principal de Outlook/Exchange Online**, donde aparecen las reuniones de Teams que se hayan agregado a ese calendario. No lee chats, canales ni calendarios compartidos. Los eventos se muestran automáticamente en **Inicio**, **Mi Día** y **Calendario**, con horario, estado de invitación y botón **Abrir Teams** cuando hay un enlace compatible. Son actividades de agenda, no nuevas filas de tareas; no se suman a los contadores de tareas.

En **Reuniones** puedes filtrar los eventos próximos o en curso y abrir su preparación. Elige un proyecto para consultar su contexto, próxima acción y tareas abiertas, abrir su ficha o editar una tarea. La selección se usa solo durante la consulta; no guarda una asociación ni genera actas o un resumen con IA.

La ventana descargada va desde la medianoche local de siete días atrás hasta la medianoche de hoy más 31 días, sin incluir ese último instante. Incluye las ocurrencias y excepciones de reuniones recurrentes. Una descarga completa sustituye la anterior: reprogramaciones, eventos eliminados y cancelaciones se reflejan en la siguiente sincronización. Las invitaciones rechazadas y canceladas no aparecen; las pendientes se marcan **Por responder**. La app no acepta ni rechaza invitaciones.

Se solicitan páginas de 100 eventos, con límites de 20 páginas y 2000 eventos. Si una página falla o se supera el límite, se conserva toda la copia anterior y se muestra el error. Esta primera versión usa una instantánea acotada, no sincronización delta del calendario. Las consultas siguen la [API calendarView](https://learn.microsoft.com/en-us/graph/api/calendar-list-calendarview?view=graph-rest-1.0).

El horario se recibe en UTC y se presenta en la zona horaria del equipo; los días completos respetan el intervalo final exclusivo. Eventos privados o confidenciales se muestran como **Evento privado**, sin organizador, ubicación ni enlace de reunión. No se descargan cuerpos, adjuntos ni listas de asistentes. Solo se abren enlaces HTTPS de los dominios de Teams permitidos, recuperados del evento de la cuenta actual por el proceso principal.

## Protección de datos

- OAuth Authorization Code + PKCE con MSAL Node, navegador del sistema, `state` aleatorio y listener ligado a loopback. Solo se abren URLs de autenticación de Microsoft generadas para el tenant configurado.
- La contraseña se introduce exclusivamente en Microsoft. No se solicita un secreto de cliente ni se usa autenticación básica.
- La caché de tokens, la cuenta y los cursores se guardan en `microsoft365.bin`, cifrado con `safeStorage` de Electron. En Windows utiliza protección del sistema vinculada al usuario. No se exponen por IPC.
- El contenido del correo se guarda como un BLOB cifrado en SQLite. Solo identificadores y fecha de recepción quedan como metadatos de indexación. Además se redactan patrones comunes de tarjetas y credenciales; esta detección es una defensa adicional, no una garantía de identificar todo dato sensible.
- La agenda se guarda como instantánea cifrada en `CalendarCache`, separada por cuenta. Incluye los campos visibles del evento y su enlace Teams; no se guarda como tarea sin cifrar. Correo y calendario serializan acceso a la caché OAuth y a las operaciones de sincronización.
- Si el cifrado seguro del sistema no está disponible, la conexión falla sin guardar credenciales en texto plano.
- Los correos se presentan como texto. No se ejecuta HTML ni se cargan imágenes remotas.
- No se descargan adjuntos ni cuerpos completos. No se envía correo, no se cambia el estado leído de Outlook, no se crean tareas automáticamente y no se envía contenido a IA.
- Los errores y logs no incluyen tokens, respuestas crudas de Microsoft ni contenido del correo.

Consulta las propiedades y límites de [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage). Esto no protege de programas que ya ejecutan código bajo el mismo usuario de Windows. Los proyectos y tareas existentes siguen en SQLite sin cifrado; utiliza sus campos para información de productividad, no para secretos.

## Desconexión y recuperación

**Desconectar cuenta** pide confirmación y elimina las credenciales locales, la caché de mensajes y la agenda descargada. No borra correos ni eventos del servidor, no cambia proyectos/tareas y no cierra la sesión general del navegador. Para revocar el consentimiento del servicio, utiliza el portal de aplicaciones de tu institución o contacta con TI.

Si Microsoft invalida un cursor, la app reinicia la copia local del correo y pide sincronizar para reconstruir los últimos 30 días. Los errores de red conservan la copia descargada. Las respuestas 429 y fallos temporales se reintentan de forma limitada, respetando `Retry-After`; las esperas superiores a 30 segundos se dejan para una sincronización posterior.

Las credenciales cifradas no son portables a otra cuenta o equipo. Tras restaurar una copia en un entorno distinto, será necesario volver a conectar. Si `microsoft365.bin` no puede descifrarse, conserva una copia, cierra la app y retira únicamente ese archivo de su carpeta de datos para volver a configurar la conexión.

## Validación y alcance pendiente

Las pruebas cubren reglas, redacción, protección de URLs, reintentos, cursores, idempotencia, parches parciales, desconexión, cifrado, migración desde la base anterior, listener OAuth y configuración desde Electron. Usan cuentas sintéticas y respuestas simuladas; no conceden acceso a un buzón real.

La validación final contra Microsoft depende del registro de Entra, consentimiento de la institución y login del usuario. No se debe declarar el calendario sincronizado hasta completar ese proceso y ver eventos reales. Quedan fuera de esta entrega carpetas adicionales, buzones/calendarios compartidos, Exchange local, chats de Teams, clasificación con IA, agrupación visual por hilo y extracción semántica de acciones. Las sugerencias usan reglas locales y el borrador de tarea se revisa manualmente. Los ensayos de calendario cubren cifrado, cancelación, cambios de horario, recurrencias, reintentos, errores de permisos y su visualización en Electron con datos sintéticos.
