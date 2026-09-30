# Estado de implementación · 0.1

## Primera entrega

| Área                                                  | Estado                                                                        |
| ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| Electron + React + TypeScript + Vite                  | Implementado                                                                  |
| ESLint, Prettier, Vitest, Testing Library, Playwright | Configurados                                                                  |
| Prisma / SQLite y migración inicial                   | Implementado                                                                  |
| CRUD de proyectos y tareas                            | Implementado                                                                  |
| Relación entre proyecto y tarea                       | Implementado; eliminación protegida por clave foránea                         |
| Ficha de proyecto                                     | Contexto, tareas filtrables, origen de correo y últimas actualizaciones       |
| Tarea desde correo                                    | Borrador revisable, proyecto, fecha y deduplicación persistente por mensaje   |
| Dashboard y Mi Día                                    | Implementados con datos reales                                                |
| Próxima acción, esperando a, prioridades y avance     | Implementados                                                                 |
| Búsqueda y filtros                                    | Implementados para proyectos y tareas                                         |
| Bandeja y persistencia de preferencias                | Implementadas                                                                 |
| Seguimientos                                          | Sugerencia local derivada de tareas; sin entidad FollowUp persistida todavía  |
| Notificaciones                                        | Reuniones, vencidas y seguimientos; optativas, deduplicación entre reinicios  |
| Correo Microsoft 365                                  | OAuth, caché cifrada y sincronización incremental de la bandeja de entrada    |
| Calendario Microsoft 365                              | Agenda cifrada, permiso opcional Calendars.Read, recurrencias y enlaces Teams |
| Propuestas por correo                                 | Reglas locales de certificación/proyecto, revisión y deduplicación            |
| IA y módulos QA                                       | Pendientes                                                                    |
| Instalador, firma y autoactualización                 | Pendientes                                                                    |

## Decisiones de esta entrega

**Inicio** sigue la distribución del mockup con cinco tarjetas accionables, una línea de tiempo de tareas y eventos por hora local, proyectos compactos, correo, agenda, propuestas y asistente local. En ventanas estrechas usa dos columnas y reubica los paneles laterales. La cabecera usa una ilustración vectorial local; no muestra clima, métricas históricas o contenido ficticio. La tarjeta de atención reúne vencidas, bloqueadas y seguimientos sin duplicarlos, además de proyectos bloqueados o sin próxima acción. Los correos muestran el total local de los últimos treinta días, no un conteo ficticio de mensajes nuevos.

**Automatizaciones** permite guardar las preferencias de sincronización, avisos y bandeja desde Inicio. «Actualizar todo» ejecuta correo y agenda secuencialmente por el bloqueo compartido de cuenta y muestra fallos sin borrar la copia local. La próxima reunión actualiza su cuenta regresiva cada treinta segundos y al recuperar foco. Los avisos opcionales se revisan cada minuto: reuniones con inicio futuro dentro de diez minutos, vencidas y seguimientos una vez por día local. `ReminderReceipt` reclama cada aviso antes de entregarlo, persiste entre reinicios y guarda solo hashes y fecha; depura registros de más de treinta y dos días. Las reuniones movidas a otra hora permiten un nuevo aviso. La entrega de Windows es de mejor esfuerzo; una caída tras reclamar puede impedir ese aviso, pero evita duplicarlo.

**Reuniones** permite consultar eventos próximos o en curso, filtrar por Teams, respuesta pendiente o texto y abrir la reunión mediante su identificador validado. La preparación reúne el contexto, próxima acción y tareas abiertas del proyecto elegido manualmente; permite abrir su ficha o editar una tarea. Esa selección es temporal: no persiste una relación evento/proyecto, no guarda actas ni genera contenido con IA.

- Las fechas límite son fechas civiles `YYYY-MM-DD`, sin conversión UTC. La hora es `HH:mm`; la regla RN-005 considera vencimiento por fecha. Las marcas de creación, modificación y cierre son instantes ISO UTC.
- Un proyecto activo sin próxima acción se señala; no se impide guardarlo. Se exceptúan proyectos bloqueados y esperando tercero según RN-001.
- Completar una tarea es idempotente. Reactivarla limpia `completedAt`. Finalizar un proyecto establece avance 100; reactivarlo limpia `closedAt`.
- Finalizar un proyecto no cambia automáticamente las tareas vinculadas. Los seguimientos de proyectos cerrados se excluyen según RN-009.
- Los seguimientos se calculan usando `updatedAt` de la tarea y el umbral de días completos transcurridos. No se envían mensajes.
- El dashboard consulta el correo sincronizado: total local, cinco mensajes recientes, vista previa, estado y actualización manual. Se refresca cada cinco segundos y al recuperar el foco. Los errores del correo no bloquean proyectos ni tareas. El panel lateral resume tareas y agenda y permite abrir la siguiente tarea; los mensajes todavía no generan tareas automáticamente.
- Un proyecto con tareas no se borra en cascada. Se exige desvincular o eliminar las tareas primero.
- Los datos de tareas actualizan `lastActivityAt` del proyecto dentro de la misma transacción.
- El calendario del sistema local determina Mi Día y se refresca cada minuto o al recuperar el foco.
- Inicio cuenta tareas abiertas del día y todos los eventos del día en «Actividades de hoy». «Reuniones hoy» excluye reservas de todo el día. Mi Día conserva tareas y agenda como secciones separadas. Calendario permite filtrar por fecha y consultar el período descargado. No se aceptan invitaciones ni se escribe en Outlook.
- Calendario usa una instantánea completa de `calendarView` del calendario principal: desde medianoche local siete días atrás hasta medianoche local de hoy más 31 días (final exclusivo). Las ocurrencias y excepciones recurrentes se reciben expandidas; cancelados, rechazados y series maestras se excluyen. El horario se solicita en UTC y se muestra en la zona del equipo.
- Solo una descarga completa reemplaza la agenda cifrada por cuenta en `CalendarCache`; cambios y eliminaciones no se acumulan. Fallos de red, permisos, paginación o límites conservan la copia anterior. El correo y el calendario comparten una exclusión de operaciones y caché MSAL para evitar carreras; al desconectar se eliminan ambas copias importadas.
- Las sugerencias inspeccionan como máximo 150 correos locales y muestran diez propuestas. Usan asunto/vista previa, palabras de certificación o acciones de proyecto y coincidencia de nombre/código de proyectos activos; no usan IA. Una coincidencia única preselecciona proyecto; las ambiguas requieren elegir. No inventan fechas ni crean tareas sin revisión. Todavía no se persiste una decisión de descartar propuestas.
- SQLite es el sistema de registro; no hay localStorage ni duplicado en memoria como persistencia.
- La carga inicial consulta todas las tareas y proyectos. Paginación e índices adicionales se evaluarán antes de importar datos externos de gran volumen.
- Los errores operativos no imprimen payloads ni errores crudos de Prisma.

## Próximo bloque recomendado

1. Historial persistente de cambios de proyecto. La ficha ya muestra sus tareas y la última actualización de cada una; no es un registro de auditoría.
2. Seguimientos persistentes con aplazamiento y confirmación. La deduplicación de avisos entre reinicios ya está implementada.
3. Backup/exportación y restauración desde la aplicación, con pruebas de recuperación.
4. Instalador Windows, recursos de marca y validación de rutas/migración en la aplicación empaquetada.
5. Ampliar correo a agrupación visual por hilo, clasificación configurable y descarte persistente de sugerencias. Cada cuenta requiere consentimiento de correo y calendario; las pruebas automatizadas utilizan datos sintéticos y no prueban consentimiento real de la institución. Ver [guía de conexión](MICROSOFT365.md).

La primera entrega es ejecutable desde el repositorio; no constituye una release instalable para distribución corporativa.
