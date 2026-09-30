CREATE TABLE "ReminderReceipt" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "deliveredAt" TEXT NOT NULL
);
CREATE INDEX "ReminderReceipt_deliveredAt_idx" ON "ReminderReceipt"("deliveredAt");
