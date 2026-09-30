import { useEffect, useRef, useState } from 'react';
import type { Project, Task, TaskInput } from '../../domain/models';
import type { MailMessage } from '../../domain/email';
import { isOpen } from '../../domain/models';
import { Icon, type IconName } from '../components/Icon';
import { ErrorNotice, Empty, Modal, Panel } from '../components/ui';
import { ProjectForm, TaskForm } from '../components/Forms';
import { ProjectList, TaskList } from '../components/Lists';
import { unwrap, useWorkspace } from '../hooks/useWorkspace';
import { Dashboard, type Actions } from '../pages/Dashboard';
import { Settings } from '../pages/Settings';
import { Emails } from '../pages/Emails';
import { ProjectDetail } from '../pages/ProjectDetail';
import { Calendar } from '../pages/Calendar';
import { Agenda } from '../components/Agenda';
import { ActivitySuggestions } from '../components/ActivitySuggestions';

const navigation: { name: string; icon: IconName; future?: boolean }[] = [
  { name: 'Inicio', icon: 'home' },
  { name: 'Mi Día', icon: 'day' },
  { name: 'Proyectos', icon: 'folder' },
  { name: 'Tareas', icon: 'check' },
  { name: 'Correos', icon: 'mail' },
  { name: 'Calendario', icon: 'calendar' },
  { name: 'Reuniones', icon: 'people', future: true },
  { name: 'Certificaciones', icon: 'shield', future: true },
  { name: 'Reportes', icon: 'chart', future: true },
  { name: 'Configuración', icon: 'settings' },
];
type Editor =
  | { kind: 'project'; item?: Project }
  | { kind: 'task'; item?: Task; initial?: TaskInput }
  | { kind: 'emailTask'; mailId: string; initial: TaskInput };
type Deletion = { kind: 'project'; item: Project } | { kind: 'task'; item: Task };
export function App() {
  const { data, error, refresh, mutate } = useWorkspace();
  const [page, setPage] = useState('Inicio');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [deletion, setDeletion] = useState<Deletion | null>(null);
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const navigate = (next: string) => {
    setPage(next);
    setSearch('');
    setFilter('all');
    setActionError('');
  };
  const perform = async (run: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setActionError('');
    try {
      await run();
      setNotice(message);
    } catch (reason) {
      setActionError(
        reason instanceof Error ? reason.message : 'No se pudo completar la operación.',
      );
    } finally {
      setBusy(false);
    }
  };
  const actions: Actions = {
    openProject: (project) => {
      setProjectId(project.id);
      navigate('Detalle de proyecto');
    },
    taskFromEmail: (message: MailMessage) =>
      void perform(async () => {
        const draft = await unwrap(window.qa.mail.taskDraft(message.id));
        if (draft.existing) {
          setEditor({ kind: 'task', item: draft.existing });
        } else {
          setEditor({ kind: 'emailTask', mailId: message.id, initial: draft.input });
        }
      }, 'Revisa la tarea antes de guardar. Si ya existía, se abrió para editar.'),
    editProject: (item) => setEditor({ kind: 'project', item }),
    deleteProject: (item) => {
      setActionError('');
      setDeletion({ kind: 'project', item });
    },
    editTask: (item) => setEditor({ kind: 'task', item }),
    deleteTask: (item) => {
      setActionError('');
      setDeletion({ kind: 'task', item });
    },
    completeTask: (task) =>
      void perform(
        () => mutate(window.qa.tasks.complete(task.id)),
        'Tarea completada. Buen avance.',
      ),
    newProject: () => setEditor({ kind: 'project' }),
    newTask: () => setEditor({ kind: 'task' }),
    navigate,
    busy,
  };
  const query = search.trim().toLocaleLowerCase('es');
  const matches = (...values: string[]) => values.join(' ').toLocaleLowerCase('es').includes(query);
  const projects =
    data?.projects.filter(
      (project) =>
        matches(project.name, project.code, project.description, project.nextAction) &&
        (filter === 'all' ||
          (filter === 'open'
            ? isOpen(project)
            : filter === 'closed'
              ? !isOpen(project)
              : project.status === 'BLOCKED')),
    ) ?? [];
  const sourceTasks = page === 'Mi Día' && !query ? data?.overview.today : data?.tasks;
  const tasks =
    sourceTasks?.filter(
      (task) =>
        matches(
          task.title,
          task.description,
          data?.projects.find((project) => project.id === task.projectId)?.name ?? '',
        ) &&
        (filter === 'all' ||
          (filter === 'open'
            ? isOpen(task)
            : filter === 'closed'
              ? !isOpen(task)
              : task.status === 'BLOCKED')),
    ) ?? [];
  const date = new Intl.DateTimeFormat('es-EC', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(data ? new Date(`${data.today}T12:00:00`) : new Date());
  const future = navigation.find((item) => item.name === page)?.future;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">
            <Icon name="robot" size={30} />
          </span>
          <div>
            <strong>QA Assistant</strong>
            <small>Tu espacio de trabajo inteligente</small>
          </div>
        </div>
        <span className="nav-label">MI ESPACIO</span>
        <nav aria-label="Navegación principal">
          {navigation.map((item) => (
            <button
              key={item.name}
              className={`nav-item ${page === item.name ? 'active' : ''}`}
              aria-current={page === item.name ? 'page' : undefined}
              onClick={() => navigate(item.name)}
            >
              <Icon name={item.icon} />
              <span>{item.name}</span>
              {item.future && <span className="future-dot" title="Próximamente" />}
              {item.name === 'Tareas' && !!data?.overview.overdue.length && (
                <span className="nav-count">{data.overview.overdue.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-status">
            <span className="dot teal" />
            Modo local <span>v0.1</span>
          </div>
          <div className="profile">
            <div className="avatar">DN</div>
            <div>
              <strong>Derian Nazareno</strong>
              <small>QA Analyst</small>
            </div>
            <Icon name="shield" size={17} />
          </div>
        </div>
      </aside>
      <main>
        <div className="topbar">
          <div className="breadcrumb">
            Mi espacio <span>/</span> <strong>{page}</strong>
          </div>
          <label className="search">
            <Icon name="search" size={17} />
            <input
              ref={searchRef}
              aria-label="Buscar proyectos y tareas"
              placeholder="Buscar proyectos, tareas…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setFilter('all');
              }}
            />
            <kbd>Ctrl K</kbd>
          </label>
          <span className="local-pill">
            <span className="dot teal" />
            Guardado local
          </span>
        </div>
        <div className="main-content">
          <header className="hero">
            <div className="hero-copy">
              <span className="eyebrow">TU CENTRO DE OPERACIONES QA</span>
              <h1>
                {page === 'Inicio' && !query ? (
                  <>
                    <span className="sun">
                      <Icon name="sun" size={33} />
                    </span>
                    Hola, Derian
                  </>
                ) : query ? (
                  'Resultados de búsqueda'
                ) : (
                  page
                )}
              </h1>
              <p>
                {query
                  ? `Proyectos y tareas que coinciden con «${search}»`
                  : page === 'Inicio'
                    ? 'Un día organizado empieza con el siguiente paso.'
                    : page === 'Mi Día'
                      ? 'Tus actividades de hoy, vencidas y bloqueadas, en un solo lugar.'
                      : page === 'Proyectos'
                        ? 'Contexto, avances y próximos pasos de cada requerimiento.'
                        : page === 'Tareas'
                          ? 'Organiza tus pendientes y conserva cada avance.'
                          : 'Tu asistente, a tu manera.'}
              </p>
              <span className="hero-date">{date}</span>
            </div>
            <div className="hero-actions">
              <button className="secondary" onClick={actions.newProject} disabled={!data}>
                <Icon name="folder" size={17} />
                Nuevo proyecto
              </button>
              <button className="primary" onClick={actions.newTask} disabled={!data}>
                <Icon name="plus" size={18} />
                Nueva tarea
              </button>
            </div>
          </header>
          {error && (
            <>
              <ErrorNotice message={error} />
              <button className="secondary" onClick={() => void refresh()}>
                Reintentar
              </button>
            </>
          )}
          {actionError && !deletion && <ErrorNotice message={actionError} />}
          {notice && (
            <div className="toast" role="status">
              {notice}
              <button aria-label="Descartar aviso" onClick={() => setNotice('')}>
                <Icon name="close" size={14} />
              </button>
            </div>
          )}
          {!data && !error && (
            <div className="loading" role="status">
              Abriendo tu espacio de trabajo…
            </div>
          )}
          {data && (
            <>
              {!query && page === 'Inicio' && <Dashboard data={data} actions={actions} />}
              {!query && page === 'Mi Día' && (
                <>
                  <Agenda
                    day={data.today}
                    onMail={() => navigate('Correos')}
                    onCalendar={() => navigate('Calendario')}
                  />
                  <ActivitySuggestions onReview={actions.taskFromEmail} busy={busy} />
                </>
              )}
              {!query && page === 'Calendario' && (
                <Calendar today={data.today} onMail={() => navigate('Correos')} />
              )}
              {(query || ['Proyectos', 'Tareas', 'Mi Día'].includes(page)) && (
                <>
                  <div className="filter-bar">
                    <div className="segmented" role="group" aria-label="Filtrar por estado">
                      {[
                        ['all', 'Todos'],
                        ['open', 'Activos'],
                        ['closed', 'Finalizados'],
                        ['blocked', 'Bloqueados'],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          aria-pressed={filter === value}
                          onClick={() => setFilter(value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <span className="muted">
                      {page === 'Mi Día'
                        ? 'Las tareas completadas se conservan en Tareas.'
                        : 'Abre un proyecto para ver su ficha o una tarea para editarla.'}
                    </span>
                  </div>
                  {(query || page === 'Proyectos') && (
                    <Panel title={`Proyectos · ${projects.length}`} icon="folder">
                      <ProjectList
                        projects={projects}
                        onOpen={actions.openProject}
                        onEdit={actions.editProject}
                        onDelete={actions.deleteProject}
                      />
                    </Panel>
                  )}
                  {(query || page !== 'Proyectos') && (
                    <Panel
                      title={`${page === 'Mi Día' ? 'Tareas de hoy' : 'Tareas'} · ${tasks.length}`}
                      icon="check"
                    >
                      <TaskList
                        tasks={tasks}
                        projects={data.projects}
                        today={data.today}
                        onEdit={actions.editTask}
                        onDelete={actions.deleteTask}
                        onComplete={actions.completeTask}
                        busy={busy}
                      />
                    </Panel>
                  )}
                </>
              )}
              {!query && page === 'Correos' && <Emails onCreateTask={actions.taskFromEmail} />}
              {!query &&
                page === 'Detalle de proyecto' &&
                (() => {
                  const project = data.projects.find((item) => item.id === projectId);
                  return project ? (
                    <ProjectDetail
                      key={project.id}
                      project={project}
                      tasks={data.tasks}
                      today={data.today}
                      actions={actions}
                      onBack={() => navigate('Proyectos')}
                      onNewTask={() =>
                        setEditor({
                          kind: 'task',
                          initial: {
                            title: '',
                            description: '',
                            projectId: project.id,
                            status: 'PENDING',
                            priority: 'MEDIUM',
                            dueDate: data.today,
                            dueTime: null,
                            waitingFor: 'USER',
                          },
                        })
                      }
                    />
                  ) : (
                    <Empty title="El proyecto ya no está disponible">
                      <button className="text-button" onClick={() => navigate('Proyectos')}>
                        Volver a proyectos
                      </button>
                    </Empty>
                  );
                })()}
              {!query && page === 'Configuración' && (
                <Settings
                  settings={data.settings}
                  onSave={async (settings) => {
                    await mutate(window.qa.settings.save(settings));
                  }}
                />
              )}
              {!query && future && (
                <Panel title={page} icon={navigation.find((item) => item.name === page)!.icon}>
                  <Empty
                    title="Este módulo llegará en una próxima fase"
                    icon={navigation.find((item) => item.name === page)!.icon}
                  >
                    Ya puedes trabajar con proyectos, tareas y Mi Día. Las integraciones externas se
                    habilitarán al implementar y configurar su conexión.
                  </Empty>
                </Panel>
              )}
            </>
          )}
          <footer className="page-footer">
            <span>QA Assistant Desktop</span>
            <span>Menos pendientes en tu cabeza. Más claridad en tu día.</span>
          </footer>
        </div>
      </main>
      {editor?.kind === 'project' && (
        <ProjectForm
          project={editor.item}
          onClose={() => setEditor(null)}
          onSave={async (input) => {
            await mutate(
              editor.item
                ? window.qa.projects.update(editor.item.id, input)
                : window.qa.projects.create(input),
            );
            setEditor(null);
            setNotice('Proyecto guardado.');
          }}
        />
      )}
      {(editor?.kind === 'task' || editor?.kind === 'emailTask') && data && (
        <TaskForm
          task={editor.kind === 'task' ? editor.item : undefined}
          initial={editor.initial}
          context={
            editor.kind === 'emailTask'
              ? 'Revisa el título, el proyecto y la fecha. Al guardar, el texto aprobado se copia a tus tareas locales, que no están cifradas. El cuerpo del correo no se copia. No incluyas información sensible.'
              : undefined
          }
          projects={data.projects}
          today={data.today}
          onClose={() => setEditor(null)}
          onSave={async (input) => {
            if (editor.kind === 'emailTask') {
              const result = await mutate(window.qa.mail.createTask(editor.mailId, input));
              setEditor(null);
              setNotice(
                result.created
                  ? 'Tarea creada desde correo. Disponible en Tareas y en el proyecto elegido; aparecerá en Mi Día según su fecha y estado.'
                  : 'Ese correo ya tiene una tarea. Se conservó la tarea existente sin duplicarla.',
              );
              return;
            }
            await mutate(
              editor.item
                ? window.qa.tasks.update(editor.item.id, input)
                : window.qa.tasks.create(input),
            );
            setEditor(null);
            setNotice('Tarea guardada.');
          }}
        />
      )}
      {deletion && (
        <Modal
          title={deletion.kind === 'project' ? 'Eliminar proyecto' : 'Eliminar tarea'}
          onClose={() => {
            setDeletion(null);
            setActionError('');
          }}
          busy={busy}
        >
          <div className="confirm-content">
            <p>
              Se eliminará «{deletion.kind === 'project' ? deletion.item.name : deletion.item.title}
              ». Esta acción no se puede deshacer.
            </p>
            {deletion.kind === 'project' && (
              <p className="muted">
                Solo puedes eliminar proyectos sin tareas vinculadas. También puedes cambiar su
                estado a Completado para conservar el historial.
              </p>
            )}
            {actionError && <ErrorNotice message={actionError} />}
          </div>
          <div className="form-footer">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                setDeletion(null);
                setActionError('');
              }}
            >
              Cancelar
            </button>
            <button
              className="danger"
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  await mutate(
                    deletion.kind === 'project'
                      ? window.qa.projects.delete(deletion.item.id)
                      : window.qa.tasks.delete(deletion.item.id),
                  );
                  setDeletion(null);
                }, 'Registro eliminado.')
              }
            >
              {busy ? 'Eliminando…' : 'Confirmar eliminación'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
