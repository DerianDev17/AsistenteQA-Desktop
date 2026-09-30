# QA Assistant Desktop

Aplicación de escritorio para Windows con núcleo local de proyectos/tareas e integración opcional de correo y calendario Microsoft 365. Los proyectos y tareas funcionan sin cuenta ni conexión a servicios externos.

## Iniciar

Requisitos: Windows 10/11, Node.js 22.20 o superior compatible y npm. La instalación inicial necesita internet para descargar dependencias, Electron y Prisma.

```powershell
npm ci
npm run dev
```

Para ejecutar la compilación:

```powershell
npm run build
npm start
```

La base se crea y migra automáticamente. La interfaz debe abrirse desde Electron: abrir el HTML o el servidor Vite en un navegador no proporciona acceso a los datos.

Al arrancar se muestra un estado de carga. Si la interfaz no se descarga o tarda más de 15 segundos, aparece **Reintentar carga**; si falla una vista, aparece **Reintentar vista**. Estas acciones conservan los datos locales. La aplicación permite recargar su propia pantalla y sigue bloqueando la navegación externa. Las pruebas E2E comprueban también el servidor de desarrollo, una descarga fallida y su recuperación.

## Funciones disponibles

- Inicio interactivo inspirado en el mockup: línea de tiempo de tareas y agenda, proyectos, correo, asistente local y próxima reunión con cuenta regresiva.
- Tarjetas con navegación, revisión de pendientes que requieren atención y acciones para completar tareas, abrir proyectos y entrar a Teams.
- Crear, editar y eliminar proyectos y tareas; vincular tareas con proyectos.
- Estados, prioridades, fechas, horas, avance, próxima acción y esperando a.
- Completar y reactivar tareas; finalizar y reactivar proyectos.
- Mi Día muestra tareas de hoy, vencidas y bloqueadas, excluyendo completadas y canceladas.
- Agenda de Microsoft 365 en Inicio, Mi Día y Calendario, con invitaciones pendientes, cambios de horario y enlaces de Teams.
- Reuniones próximas o en curso, filtros por Teams/respuesta y preparación local con el contexto y las tareas abiertas del proyecto elegido.
- Propuestas revisables desde correos de certificación o proyecto, con asociación sugerida a un proyecto activo y exclusión de tareas ya creadas.
- Búsqueda por proyecto/tarea y filtros de estado. `Ctrl+K` enfoca el buscador.
- Señalización de proyectos activos sin próxima acción.
- Seguimientos derivados de tareas en espera de terceros, con umbral configurable.
- Bandeja del sistema: cerrar oculta la ventana; doble clic vuelve a abrirla; **Salir** cierra el proceso.
- Preferencias persistentes para bandeja, notificaciones y días de seguimiento.
- Automatizaciones configurables desde Inicio: sincronización conjunta de correo/agenda cada cinco minutos, recordatorios y funcionamiento en la bandeja.
- Avisos opcionales de reuniones diez minutos antes, vencidas y seguimientos diarios. Se revisan cada minuto mientras la app está abierta y se deduplican entre reinicios. Los recibos guardan hashes sin títulos ni contenido importado.
- SQLite local: los datos se conservan al reiniciar y funcionan sin internet.

La eliminación requiere confirmación. Los proyectos con tareas vinculadas no se pueden eliminar: hay que desvincular las tareas o finalizar el proyecto para conservar el historial. Los proyectos finalizados no generan sugerencias de seguimiento; sus tareas pendientes siguen visibles hasta completarlas o cancelarlas explícitamente.

No se cargan datos ficticios. El resumen y las sugerencias son deterministas; las integraciones requieren autorización real en Microsoft.

## Conectar Microsoft 365

Abre **Correos**, registra el client ID y tenant ID de Microsoft Entra y pulsa **Conectar y sincronizar**. La pantalla incluye instrucciones de registro. Consulta la [guía de Microsoft 365](docs/MICROSOFT365.md) para crear el registro o solicitarlo a TI.

La conexión utiliza OAuth con PKCE y permiso delegado `Mail.Read`. Sincroniza los últimos 30 días de la bandeja de entrada, manualmente o cada cinco minutos, sin enviar correo ni modificar Outlook. Tokens y contenido del correo se cifran con el almacén seguro del sistema. La cuenta solo se conecta después de completar el login real en Microsoft.

Desde la vista previa de un mensaje puedes **Crear tarea desde correo**, revisar el borrador y elegir proyecto y fecha. El cuerpo del mensaje no se copia y no se guarda nada hasta pulsar **Guardar tarea**. Repetir la acción abre la tarea existente. El texto aprobado se almacena como tarea local sin cifrado; el correo original sigue cifrado. Abre el nombre de un proyecto para consultar su ficha, filtrar tareas y revisar sus últimas actualizaciones.

Para reuniones, añade **Microsoft Graph → Permisos delegados → Calendars.Read** al registro de Entra y pulsa **Autorizar calendario** en la app. Los eventos del calendario principal aparecen como actividades de agenda, sin crear tareas duplicadas ni aceptar invitaciones. Se consultan siete días anteriores, hoy y los treinta días siguientes. La autorización de calendario es adicional a la conexión de correo.

## Datos y seguridad

En Windows, la ubicación predeterminada es `%APPDATA%\QA Assistant Desktop\workspace.db` (directorio `userData` de Electron). Los ensayos usan directorios temporales independientes mediante `QA_USER_DATA_DIR`.

Para una copia manual, cierra la aplicación con **Salir** y copia la carpeta de datos completa. Para restaurarla, cierra la aplicación antes de sustituir esa carpeta. No copies solamente el `.db` mientras la aplicación esté abierta: SQLite utiliza archivos WAL auxiliares.

El renderer funciona con `contextIsolation`, `sandbox` y sin `nodeIntegration`. El preload expone operaciones concretas; el proceso principal valida datos, ventana, frame y URL. Se bloquean navegación externa, ventanas emergentes y permisos del navegador. Los errores internos se convierten a mensajes seguros y los logs registran códigos, no el contenido de proyectos o tareas.

El texto de proyectos y tareas se almacena localmente sin cifrado. No introduzcas secretos, datos de tarjetas ni material de producción en sus campos libres. Las credenciales y el contenido importado de Microsoft 365 sí se almacenan cifrados; consulta su alcance en la guía de conexión.

## Validar

```powershell
npm run lint
npm run typecheck
npm run test
npm run test:integration
npm run test:e2e
npm run build
npm run format:check
```

La prueba E2E abre ventanas reales de Electron con datos temporales; no modifica la base personal. Verifica creación, edición, relación proyecto/tarea, completar una actividad, búsqueda, protección ante eliminación, bandeja, preferencias y persistencia tras reinicio. La captura del dashboard se guarda en `test-results/`, ignorado por Git.

## Estructura

| Carpeta                       | Responsabilidad                                                  |
| ----------------------------- | ---------------------------------------------------------------- |
| `src/domain`                  | Modelos, validación, reglas de Mi Día y contratos de repositorio |
| `src/application`             | Casos de uso del espacio local                                   |
| `src/infrastructure/database` | Prisma, repositorios y aplicación de migraciones                 |
| `src/main`                    | Electron, preload, IPC, bandeja y notificaciones                 |
| `src/renderer`                | React, formularios, navegación y estilos                         |
| `src/shared`                  | API tipada del preload                                           |
| `prisma`                      | Esquema y migraciones SQLite versionadas                         |
| `tests`                       | Pruebas unitarias, componentes, integración y E2E                |

Las dependencias están fijadas en `package-lock.json`. Prisma 6.19.3 conserva su motor Node-API sin exigir compilar un driver SQLite para Electron. Se fija `deepmerge-ts` 8.0.2 mediante override para corregir la alerta transitiva de la CLI de Prisma; la generación del cliente y los ensayos verifican esa combinación.

El ejecutor de migraciones usa `_qa_migrations` con checksum y transacción, y no depende de la CLI al iniciar. Incluye el SQL de `prisma/migrations` en el bundle. Antes de futuras migraciones sobre una base ya versionada crea una copia mediante `VACUUM INTO`. Las migraciones nuevas deben registrarse en `src/infrastructure/database/client.ts`; nunca modifiques una migración aplicada. No uses `prisma migrate deploy` sobre la base de la aplicación: este MVP utiliza su propio historial de migración.

## Siguientes entregas

Ver [estado de implementación](docs/IMPLEMENTATION.md). Correo, agenda de Microsoft 365 y propuestas locales de actividades están implementados. El módulo de certificaciones, los reportes, la IA, el instalador firmado, actualización automática y copia/restauración desde la interfaz todavía no están implementados.

Documentación funcional original: `QA_Assistant_Desktop_Documentacion_V0.1.docx`, `qa-assistant-desktop.spec`, `qa-assistant-desktop.agent` y `ARCHITECTURE.md`.
