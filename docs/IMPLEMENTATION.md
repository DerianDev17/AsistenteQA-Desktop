# Estado de implementación · 0.1

## Primera entrega

| Área                                                  | Estado                                                                       |
| ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| Electron + React + TypeScript + Vite                  | Implementado                                                                 |
| ESLint, Prettier, Vitest, Testing Library, Playwright | Configurados                                                                 |
| Prisma / SQLite y migración inicial                   | Implementado                                                                 |
| CRUD de proyectos y tareas                            | Implementado                                                                 |
| Relación entre proyecto y tarea                       | Implementado; eliminación protegida por clave foránea                        |
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
- El dashboard no muestra cifras inventadas de correos, clima o reuniones. El panel lateral identifica explícitamente su resumen como local.
- Un proyecto con tareas no se borra en cascada. Se exige desvincular o eliminar las tareas primero.
- Los datos de tareas actualizan `lastActivityAt` del proyecto dentro de la misma transacción.
- El calendario del sistema local determina Mi Día y se refresca cada minuto o al recuperar el foco.
- SQLite es el sistema de registro; no hay localStorage ni duplicado en memoria como persistencia.
- La carga inicial consulta todas las tareas y proyectos. Paginación e índices adicionales se evaluarán antes de importar datos externos de gran volumen.
- Los errores operativos no imprimen payloads ni errores crudos de Prisma.

## Próximo bloque recomendado

1. Ficha detallada de proyecto con historial de tareas y actividad.
2. Seguimientos persistentes con aplazamiento, confirmación y deduplicación de avisos entre reinicios.
3. Backup/exportación y restauración desde la aplicación, con pruebas de recuperación.
4. Instalador Windows, recursos de marca y validación de rutas/migración en la aplicación empaquetada.
5. Completar el registro/consentimiento real de Microsoft 365, validar el buzón institucional y después ampliar a calendario, agrupación visual por hilo y sugerencias de tareas. La conexión, cifrado y sincronización básica de correo ya están implementados; ver [guía de conexión](MICROSOFT365.md).

La primera entrega es ejecutable desde el repositorio; no constituye una release instalable para distribución corporativa.
