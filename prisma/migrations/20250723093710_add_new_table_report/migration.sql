/*
  Warnings:

  - You are about to alter the column `locationId` on the `devices` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.
  - You are about to alter the column `locationId` on the `location_status_history` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.
  - The primary key for the `locations` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `locations` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.

*/
-- DropForeignKey
ALTER TABLE `devices` DROP FOREIGN KEY `devices_locationId_fkey`;

-- DropForeignKey
ALTER TABLE `location_status_history` DROP FOREIGN KEY `location_status_history_locationId_fkey`;

-- AlterTable
ALTER TABLE `devices` ADD COLUMN `calibration` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `periode` INTEGER NOT NULL DEFAULT 60,
    MODIFY `locationId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `location_status_history` MODIFY `locationId` INTEGER NULL;

-- AlterTable
ALTER TABLE `locations` DROP PRIMARY KEY,
    MODIFY `id` INTEGER NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `sensor_logs` MODIFY `rainfall` DOUBLE NULL DEFAULT 0,
    MODIFY `waterLevel` DOUBLE NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `reports` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `deviceId` VARCHAR(191) NULL,
    `deviceCalibration` DOUBLE NOT NULL,
    `depth` DOUBLE NOT NULL,
    `rawDistance` DOUBLE NOT NULL,
    `voltase` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `devices` ADD CONSTRAINT `devices_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reports` ADD CONSTRAINT `reports_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `devices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `location_status_history` ADD CONSTRAINT `location_status_history_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
