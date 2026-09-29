# Estado de implementación · 0.1

## Primera entrega

| Área                                                  | Estado                                                                       |
| ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| Electron + React + TypeScript + Vite                  | Implementado                                                                 |
| ESLint, Prettier, Vitest, Testing Library, Playwright | Configurados                                                                 |
| Prisma / SQLite y migración inicial                   | Implementado                                                                 |
| CRUD de proyectos y tareas                            | Implementado                                                                 |
| Relación entre proyecto y tarea                       | Implementado; eliminación protegida por clave foránea                        |
| Ficha de proyecto                                     | Contexto, tareas filtrables, origen de correo y últimas actualizaciones      |
| Tarea desde correo                                    | Borrador revisable, proyecto, fecha y deduplicación persistente por mensaje  |
| Dashboard y Mi Día                                    | Implementados con datos reales                                               |
| Próxima acción, esperando a, prioridades y avance     | Implementados                                                                |
| Búsqueda y filtros                                    | Implementados para proyectos y tareas                                        |
| Bandeja y persistencia de preferencias                | Implementadas                                                                |
| Seguimientos                                          | Sugerencia local derivada de tareas; sin entidad FollowUp persistida todavía |
| Notificaciones                                        | Recordatorio básico de vencidas, opcional                                    |
| Correo Microsoft 365                                  | OAuth, caché cifrada y sincronización incremental de la bandeja de entrada   |
| Calendario, IA y módulos QA                           | Pendientes                                                                   |
| Instalador, firma y autoactualización                 | Pendientes                                                                   |

## Decisiones de esta entrega

- Las fechas límite son fechas civiles `YYYY-MM-DD`, sin conversión UTC. La hora es `HH:mm`; la regla RN-005 considera vencimiento por fecha. Las marcas de creación, modificación y cierre son instantes ISO UTC.
- Un proyecto activo sin próxima acción se señala; no se impide guardarlo. Se exceptúan proyectos bloqueados y esperando tercero según RN-001.
- Completar una tarea es idempotente. Reactivarla limpia `completedAt`. Finalizar un proyecto establece avance 100; reactivarlo limpia `closedAt`.
- Finalizar un proyecto no cambia automáticamente las tareas vinculadas. Los seguimientos de proyectos cerrados se excluyen según RN-009.
- Los seguimientos se calculan usando `updatedAt` de la tarea y el umbral de días completos transcurridos. No se envían mensajes.
- El dashboard consulta el correo sincronizado: total local, cinco mensajes recientes, vista previa, estado y actualización manual. Se refresca cada cinco segundos y al recuperar el foco. Los errores del correo no bloquean proyectos ni tareas. El panel lateral conserva su resumen de actividades locales; los mensajes todavía no generan tareas automáticamente.
- Un proyecto con tareas no se borra en cascada. Se exige desvincular o eliminar las tareas primero.
- Los datos de tareas actualizan `lastActivityAt` del proyecto dentro de la misma transacción.
- El calendario del sistema local determina Mi Día y se refresca cada minuto o al recuperar el foco.
- SQLite es el sistema de registro; no hay localStorage ni duplicado en memoria como persistencia.
- La carga inicial consulta todas las tareas y proyectos. Paginación e índices adicionales se evaluarán antes de importar datos externos de gran volumen.
- Los errores operativos no imprimen payloads ni errores crudos de Prisma.

## Próximo bloque recomendado

1. Historial persistente de cambios de proyecto. La ficha ya muestra sus tareas y la última actualización de cada una; no es un registro de auditoría.
2. Seguimientos persistentes con aplazamiento, confirmación y deduplicación de avisos entre reinicios.
3. Backup/exportación y restauración desde la aplicación, con pruebas de recuperación.
4. Instalador Windows, recursos de marca y validación de rutas/migración en la aplicación empaquetada.
5. Ampliar correo a agrupación visual por hilo, clasificación y detección de acciones; añadir calendario. Ya puedes crear una tarea desde la vista previa de un correo, revisar su título y elegir proyecto/fecha. La conexión institucional fue completada por el usuario; las pruebas automatizadas utilizan datos sintéticos. Ver [guía de conexión](MICROSOFT365.md).

La primera entrega es ejecutable desde el repositorio; no constituye una release instalable para distribución corporativa.
