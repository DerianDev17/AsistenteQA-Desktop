# QA Assistant Desktop

Primera entrega del núcleo local de la aplicación para Windows. Implementa el Sprint 1 de la documentación y algunas funciones locales del Sprint 2. No requiere cuentas, claves ni conexión a servicios externos.

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

## Funciones disponibles

- Dashboard con cifras reales, actividades de hoy, proyectos y resumen local.
- Crear, editar y eliminar proyectos y tareas; vincular tareas con proyectos.
- Estados, prioridades, fechas, horas, avance, próxima acción y esperando a.
- Completar y reactivar tareas; finalizar y reactivar proyectos.
- Mi Día muestra tareas de hoy, vencidas y bloqueadas, excluyendo completadas y canceladas.
- Búsqueda por proyecto/tarea y filtros de estado. `Ctrl+K` enfoca el buscador.
- Señalización de proyectos activos sin próxima acción.
- Seguimientos derivados de tareas en espera de terceros, con umbral configurable.
- Bandeja del sistema: cerrar oculta la ventana; doble clic vuelve a abrirla; **Salir** cierra el proceso.
- Preferencias persistentes para bandeja, notificaciones y días de seguimiento.
- Notificación opcional de tareas vencidas, como máximo una por día durante cada ejecución. Se revisa cada minuto; reiniciar puede permitir un nuevo aviso ese mismo día.
- SQLite local: los datos se conservan al reiniciar y funcionan sin internet.

La eliminación requiere confirmación. Los proyectos con tareas vinculadas no se pueden eliminar: hay que desvincular las tareas o finalizar el proyecto para conservar el historial. Los proyectos finalizados no generan sugerencias de seguimiento; sus tareas pendientes siguen visibles hasta completarlas o cancelarlas explícitamente.

No se cargan datos ficticios. El resumen es determinista; no simula respuestas de IA ni una conexión de correo/calendario.

## Datos y seguridad

En Windows, la ubicación predeterminada es `%APPDATA%\QA Assistant Desktop\workspace.db` (directorio `userData` de Electron). Los ensayos usan directorios temporales independientes mediante `QA_USER_DATA_DIR`.

Para una copia manual, cierra la aplicación con **Salir** y copia la carpeta de datos completa. Para restaurarla, cierra la aplicación antes de sustituir esa carpeta. No copies solamente el `.db` mientras la aplicación esté abierta: SQLite utiliza archivos WAL auxiliares.

El renderer funciona con `contextIsolation`, `sandbox` y sin `nodeIntegration`. El preload expone operaciones concretas; el proceso principal valida datos, ventana, frame y URL. Se bloquean navegación externa, ventanas emergentes y permisos del navegador. Los errores internos se convierten a mensajes seguros y los logs registran códigos, no el contenido de proyectos o tareas.

Esta versión almacena texto de productividad local sin cifrado y no tiene almacén de credenciales. No introduzcas secretos, datos de tarjetas ni material de producción en los campos libres. La sanitización de integraciones y el almacén seguro de credenciales pertenecen a las siguientes fases.

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

Ver [estado de implementación](docs/IMPLEMENTATION.md). Correo, calendario, reuniones, certificaciones y reportes aparecen como módulos pendientes. La IA, el instalador firmado, actualización automática y copia/restauración desde la interfaz todavía no están implementados.

Documentación funcional original: `QA_Assistant_Desktop_Documentacion_V0.1.docx`, `qa-assistant-desktop.spec`, `qa-assistant-desktop.agent` y `ARCHITECTURE.md`.
