-- CreateTable
CREATE TABLE "project_favorites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_favorites_projectId_idx" ON "project_favorites"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "project_favorites_userId_projectId_key" ON "project_favorites"("userId", "projectId");

-- AddForeignKey
ALTER TABLE "project_favorites" ADD CONSTRAINT "project_favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_favorites" ADD CONSTRAINT "project_favorites_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
