/*
  Warnings:

  - You are about to drop the column `isActive` on the `devices` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `devices` DROP COLUMN `isActive`;

-- CreateIndex
CREATE INDEX `devices_status_idx` ON `devices`(`status`);

-- CreateIndex
CREATE INDEX `devices_lastSeen_idx` ON `devices`(`lastSeen`);
