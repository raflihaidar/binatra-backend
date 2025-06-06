/*
  Warnings:

  - You are about to drop the column `userId` on the `devices` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `devices` DROP FOREIGN KEY `devices_userId_fkey`;

-- DropIndex
DROP INDEX `devices_userId_fkey` ON `devices`;

-- AlterTable
ALTER TABLE `devices` DROP COLUMN `userId`;
