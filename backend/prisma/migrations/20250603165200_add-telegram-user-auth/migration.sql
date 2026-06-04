-- CreateIndex
CREATE INDEX IF NOT EXISTS "TelegramBot_tenantId" ON "telegram_bots"("tenantId");
CREATE INDEX IF NOT EXISTS "TelegramBot_isActive" ON "telegram_bots"("isActive");

-- CreateTable
CREATE TABLE IF NOT EXISTS "telegram_users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "telegramBotId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "authorizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "telegram_users_userId_key" ON "telegram_users"("userId");
CREATE INDEX IF NOT EXISTS "telegram_users_tenantId" ON "telegram_users"("tenantId");
CREATE INDEX IF NOT EXISTS "telegram_users_telegramBotId" ON "telegram_users"("telegramBotId");
CREATE INDEX IF NOT EXISTS "telegram_users_telegramUserId" ON "telegram_users"("telegramUserId");
CREATE INDEX IF NOT EXISTS "telegram_users_isActive" ON "telegram_users"("isActive");

-- AddForeignKey
ALTER TABLE "telegram_users" ADD CONSTRAINT "telegram_users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "telegram_users" ADD CONSTRAINT "telegram_users_telegramBotId_fkey" FOREIGN KEY ("telegramBotId") REFERENCES "telegram_bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "telegram_users" ADD CONSTRAINT "telegram_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;