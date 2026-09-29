CREATE TABLE "Project" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "priority" TEXT NOT NULL,
  "progress" INTEGER NOT NULL,
  "nextAction" TEXT NOT NULL,
  "waitingFor" TEXT NOT NULL,
  "lastActivityAt" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  "closedAt" TEXT
);
CREATE TABLE "Task" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "priority" TEXT NOT NULL,
  "dueDate" TEXT,
  "dueTime" TEXT,
  "source" TEXT NOT NULL,
  "sourceReference" TEXT,
  "waitingFor" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  "completedAt" TEXT,
  CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "Settings" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
  "minimizeToTray" BOOLEAN NOT NULL DEFAULT true,
  "notifications" BOOLEAN NOT NULL DEFAULT false,
  "followUpDays" INTEGER NOT NULL DEFAULT 3
);
CREATE INDEX "Project_status_idx" ON "Project"("status");
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");
CREATE INDEX "Task_status_dueDate_idx" ON "Task"("status", "dueDate");
