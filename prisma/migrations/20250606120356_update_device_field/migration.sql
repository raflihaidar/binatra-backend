/*
  Warnings:

  - You are about to drop the column `name` on the `devices` table. All the data in the column will be lost.
  - You are about to drop the column `deviceId` on the `sensor_logs` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[code]` on the table `devices` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `code` to the `devices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `deviceCode` to the `sensor_logs` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `sensor_logs` DROP FOREIGN KEY `sensor_logs_deviceId_fkey`;

-- DropIndex
DROP INDEX `devices_name_key` ON `devices`;

-- DropIndex
DROP INDEX `sensor_logs_deviceId_timestamp_idx` ON `sensor_logs`;

-- AlterTable
ALTER TABLE `devices` DROP COLUMN `name`,
    ADD COLUMN `code` VARCHAR(100) NOT NULL,
    ADD COLUMN `description` TEXT NULL;

-- AlterTable
ALTER TABLE `sensor_logs` DROP COLUMN `deviceId`,
    ADD COLUMN `deviceCode` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `devices_code_key` ON `devices`(`code`);

-- CreateIndex
CREATE INDEX `sensor_logs_deviceCode_timestamp_idx` ON `sensor_logs`(`deviceCode`, `timestamp`);

-- AddForeignKey
ALTER TABLE `sensor_logs` ADD CONSTRAINT `sensor_logs_deviceCode_fkey` FOREIGN KEY (`deviceCode`) REFERENCES `devices`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;
