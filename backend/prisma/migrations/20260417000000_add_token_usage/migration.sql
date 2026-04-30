-- CreateTable
CREATE TABLE "token_usage" (
    "id"               TEXT NOT NULL,
    "assessmentId"     TEXT,
    "userId"           TEXT,
    "model"            TEXT NOT NULL,
    "provider"         TEXT NOT NULL,
    "promptTokens"     INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens"      INTEGER NOT NULL DEFAULT 0,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_usage_pkey" PRIMARY KEY ("id")
);
