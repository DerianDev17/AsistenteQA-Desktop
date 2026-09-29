# QA Assistant Desktop — Development Specification
Version: 0.1
Repository: qa-assistant-desktop
Primary platform: Windows Desktop

## 1. Product goal
Build a desktop assistant for Derian Nazareno that centralizes daily QA/production work:
- Projects and requirements
- Tasks and next actions
- Email-derived work items
- Calendar and meetings
- Follow-ups
- Daily summaries
- Contextual assistant
- Future QA-specific automation

The application must feel like a personal operational assistant, not like another Jira clone.

Core questions the app must answer:
1. What do I need to do today?
2. What changed since yesterday?
3. What is blocked?
4. Who am I waiting for?
5. What might I be forgetting?

## 2. Initial scope

### MVP 1
- Dashboard
- My Day
- Projects / Requirements
- Tasks
- Next action
- Waiting for
- Priorities
- Due dates
- Notifications
- System tray
- Local persistence
- Search / filtering

### MVP 2
- Email synchronization
- Email thread grouping
- Email classification
- Detect email that requires action
- Suggest task from email
- Link email to project
- Detect unanswered / pending follow-up

### MVP 3
- Calendar synchronization
- Meetings
- Meeting reminders
- Meeting brief
- Morning summary
- End-of-day summary

### MVP 4
- Contextual AI assistant
- Project summaries
- Thread summaries
- Action extraction
- Natural-language queries

### Future scope
- QA certifications
- Test cases
- Evidence
- Defects
- Logs
- ISO8583
- SQL validations
- Incident timelines
- Automated reports

## 3. Technology stack

Use:
- Electron
- React
- TypeScript
- Vite
- Node.js
- Prisma ORM
- SQLite
- Vitest
- React Testing Library
- Playwright
- ESLint
- Prettier

Avoid introducing new frameworks or libraries without a clear need.

## 4. Architecture

Use a layered architecture:

Presentation
    ↓
Application
    ↓
Domain
    ↓
Infrastructure

### 4.1 Domain
Must not depend on Electron, React, Prisma, Gmail, Microsoft Graph, filesystem, or external APIs.

Main entities:
- Project
- Task
- Email
- Meeting
- FollowUp
- DailySummary
- Note
- DocumentReference

### 4.2 Application
Contains use cases such as:
- CreateProject
- UpdateProject
- CloseProject
- CreateTask
- CompleteTask
- LinkTaskToProject
- LinkEmailToProject
- DetectFollowUp
- GenerateDailySummary
- GenerateMeetingBrief

### 4.3 Infrastructure
Contains:
- Prisma / SQLite repositories
- Email providers
- Calendar providers
- Notification adapters
- Credential storage
- AI provider integration
- Filesystem adapters

### 4.4 Presentation
Contains:
- React pages
- Components
- Hooks
- Stores
- View models
- UI state

## 5. Recommended folder structure

src/
  main/
    main.ts
    preload.ts
    ipc/
    scheduler/
    notifications/

  renderer/
    app/
    pages/
    components/
    hooks/
    stores/
    styles/

  domain/
    projects/
    tasks/
    emails/
    meetings/
    followups/
    summaries/

  application/
    projects/
    tasks/
    emails/
    meetings/
    assistant/

  infrastructure/
    database/
    email/
    calendar/
    ai/
    security/

prisma/
  schema.prisma

tests/
  unit/
  integration/
  e2e/

docs/

## 6. Functional model

### Project
Fields:
- id
- name
- code
- description
- type
- status
- priority
- progress
- nextAction
- waitingFor
- lastActivityAt
- createdAt
- updatedAt
- closedAt

Suggested project statuses:
- NEW
- ANALYSIS
- PLANNED
- IN_PROGRESS
- IN_QA
- WAITING_THIRD_PARTY
- BLOCKED
- PENDING
- COMPLETED
- CANCELLED

### Task
Fields:
- id
- projectId
- title
- description
- status
- priority
- dueDate
- dueTime
- source
- sourceReference
- waitingFor
- createdAt
- updatedAt
- completedAt

Statuses:
- PENDING
- IN_PROGRESS
- WAITING
- BLOCKED
- COMPLETED
- CANCELLED

Priorities:
- HIGH
- MEDIUM
- LOW

Sources:
- MANUAL
- EMAIL
- CALENDAR
- MEETING
- PROJECT
- AI
- SYSTEM

### Email
Fields:
- id
- providerId
- threadId
- subject
- sender
- recipients
- receivedAt
- bodyPreview
- summary
- category
- requiresAction
- requiresReply
- projectId
- processedAt

### Meeting
Fields:
- id
- providerId
- projectId
- title
- description
- startAt
- endAt
- organizer
- meetingUrl
- summary

### FollowUp
Fields:
- id
- projectId
- taskId
- emailId
- waitingFor
- startedAt
- lastContactAt
- nextReminderAt
- status

### DailySummary
Fields:
- id
- date
- morningSummary
- eveningSummary
- completedTasks
- pendingTasks
- newTasks
- blockedTasks
- generatedAt

## 7. Core product rules

### 7.1 Next Action
Every active project should have a next action whenever possible.

A project without a next action should be visibly flagged.

### 7.2 Waiting For
The app should make it clear who currently owns the next move:
- USER
- QA
- DEVELOPMENT
- INFRASTRUCTURE
- PROVIDER
- ENTITY
- PRODUCT
- SECURITY
- OTHER

### 7.3 Email to task
Do not automatically convert every email into a task.

Initial behavior:
- Detect possible action
- Suggest task
- User can Create / Edit / Ignore

Only later, after confidence is measured, allow opt-in automation.

### 7.4 Follow-up detection
Example rule:
- task.status == WAITING
- waitingFor != USER
- no meaningful update for configurable N days
=> suggest follow-up

### 7.5 AI use
AI must interpret real application data.
AI must never be the system of record.

Do not allow the assistant to invent:
- projects
- dates
- meetings
- email messages
- owners
- statuses

## 8. Security requirements

Never store in plain text:
- passwords
- access tokens
- refresh tokens
- PIN
- PIN Block
- ZPK
- ZMK
- CVV / CVV2
- full PAN
- production credentials

Use secure OS credential storage for secrets.

Do not store production secrets in:
- SQLite
- localStorage
- JSON files
- repository
- .env committed to Git

Before sending content to an AI provider, sanitize sensitive data:
- PAN -> masked
- PIN block -> [PIN_BLOCK_REDACTED]
- keys -> [KEY_REDACTED]
- passwords -> [CREDENTIAL_REDACTED]
- auth headers -> [TOKEN_REDACTED]

## 9. Electron security

Required:
- contextIsolation: true
- nodeIntegration: false
- use preload + contextBridge
- validate all IPC payloads
- do not expose generic filesystem access to renderer
- do not expose unrestricted shell execution
- do not expose database directly to renderer

Renderer
  ↓
preload
  ↓
contextBridge
  ↓
IPC
  ↓
main process
  ↓
application/infrastructure

## 10. UI principles

The interface should:
- be desktop-first
- support dark mode
- prioritize scanability
- use cards for summaries
- avoid visual overload
- make current priorities obvious
- show status, next action, waiting-for, and last update
- use compact but readable tables
- keep critical actions within one or two clicks

Main navigation:
- Inicio
- Mi Día
- Proyectos
- Tareas
- Correos
- Calendario
- Reuniones
- Certificaciones
- Reportes
- Configuración

## 11. Dashboard requirements

Display:
- activities today
- items requiring attention
- active projects
- meetings today
- new emails
- important emails
- project status
- calendar today
- pending follow-ups
- weekly metrics
- recent documents
- assistant panel

## 12. Testing requirements

Every feature must be testable.

Required test levels:

### Unit tests
Test:
- domain rules
- use cases
- validators
- mappers
- pure utilities

### Integration tests
Test:
- repositories
- Prisma / SQLite
- IPC handlers
- provider adapters with mocks/fakes

### Component tests
Test:
- user-visible UI behavior
- forms
- validation
- loading / empty / error states

### E2E tests
Test critical workflows:
- app launch
- create project
- create task
- link task to project
- complete task
- daily view updates
- persistence after restart

## 13. Quality gates

Before a change is considered complete, all applicable checks must pass:

1. npm run lint
2. npm run typecheck
3. npm run test
4. npm run test:integration
5. npm run test:e2e for critical flows or affected E2E areas
6. npm run build

No commit is allowed with:
- failing tests
- lint errors
- type errors
- known build errors
- debug-only code
- temporary files
- credentials
- commented-out abandoned implementation
- unexplained TODOs

## 14. Definition of Done

A story is DONE only when:
- implementation is complete
- behavior matches acceptance criteria
- unit tests exist where logic was added
- integration tests exist where boundaries changed
- UI state is tested where applicable
- lint passes
- typecheck passes
- tests pass
- build passes
- no secrets or temp files are present
- code is formatted
- repository working tree is clean after commit
- documentation is updated when behavior or architecture changes

## 15. Git strategy

Use a clean, atomic commit history.

Each commit should represent one logical change.

Examples:
- feat(projects): add project creation use case
- feat(tasks): add task persistence
- test(tasks): cover task completion rules
- refactor(ipc): isolate task IPC validation
- fix(dashboard): handle projects with no next action
- docs(architecture): document email sync flow

Do not create commits like:
- changes
- update
- fix stuff
- wip
- final
- various

Do not mix unrelated changes in the same commit.

Good sequence:
1. feat(domain): add task entity and validation
2. feat(database): add task prisma model and repository
3. feat(tasks): add create-task use case
4. feat(ui): add task creation form
5. test(tasks): add create-task integration coverage

If one implementation naturally requires tests to prove the same behavior, tests may be included in the same atomic commit.

## 16. Repository cleanliness

Before every commit:
- remove debug logs
- remove temp files
- remove generated artifacts not meant for Git
- ensure no .env secrets are tracked
- check git status
- review git diff
- stage only intended files
- run required checks
- commit only after success

After commit:
- git status must be clean

## 17. Initial development order

Sprint 1:
1. Bootstrap Electron + React + TypeScript
2. Configure lint / format / typecheck
3. Configure tests
4. Configure Prisma + SQLite
5. Add Project model
6. Add Task model
7. Build basic dashboard
8. CRUD Project
9. CRUD Task
10. My Day
11. System Tray
12. Local persistence

Sprint 2:
- Project detail
- Next action
- Waiting for
- Priorities
- Dynamic dashboard
- Follow-ups
- Windows notifications
- Filters
- Search

Sprint 3:
- Email sync
- Thread grouping
- Email classification
- Action detection
- Task suggestion

Sprint 4:
- Calendar
- Meetings
- Meeting brief
- Morning summary
- End-of-day summary

Sprint 5:
- Contextual AI assistant

## 18. Non-functional requirements

- Fast local startup
- Graceful offline behavior
- No data loss on restart
- Resilient sync
- Retry with backoff for external services
- Clear error messages
- Structured logs
- No silent failures
- Configurable schedules
- Maintainable code
- High cohesion
- Low coupling
- Strong typing
- Minimal use of `any`

## 19. Observability

Use structured logging.

Log:
- app lifecycle
- sync start/end
- sync errors
- database migration errors
- IPC validation errors
- scheduler execution
- external provider failures

Do not log:
- passwords
- tokens
- PAN
- PIN blocks
- keys
- full sensitive email bodies unless explicitly required and protected

## 20. Engineering principle

Do not optimize for "code completed".
Optimize for:
- correct behavior
- maintainability
- testability
- clean architecture
- clear history
- recoverability
- security
- understandable commits
