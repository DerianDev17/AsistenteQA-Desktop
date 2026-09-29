CREATE TABLE "MailMessage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "receivedAt" TEXT NOT NULL,
  "content" BLOB NOT NULL
);
CREATE UNIQUE INDEX "MailMessage_accountId_providerId_key" ON "MailMessage"("accountId", "providerId");
CREATE INDEX "MailMessage_accountId_receivedAt_id_idx" ON "MailMessage"("accountId", "receivedAt", "id");
