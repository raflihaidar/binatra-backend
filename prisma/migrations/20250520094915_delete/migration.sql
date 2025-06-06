/*
  Warnings:

  - You are about to drop the `alerts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `device_status` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `alerts` DROP FOREIGN KEY `alerts_deviceId_fkey`;

-- DropForeignKey
ALTER TABLE `device_status` DROP FOREIGN KEY `device_status_deviceId_fkey`;

-- DropTable
DROP TABLE `alerts`;

-- DropTable
DROP TABLE `device_status`;
