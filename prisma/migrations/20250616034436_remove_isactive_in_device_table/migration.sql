/*
  Warnings:

  - You are about to drop the column `isActive` on the `devices` table. All the data in the column will be lost.
  - You are about to drop the `alert_configurations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `flood_alerts` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `flood_alerts` DROP FOREIGN KEY `flood_alerts_locationId_fkey`;

-- DropIndex
DROP INDEX `devices_isActive_idx` ON `devices`;

-- AlterTable
ALTER TABLE `devices` DROP COLUMN `isActive`;

-- DropTable
DROP TABLE `alert_configurations`;

-- DropTable
DROP TABLE `flood_alerts`;
