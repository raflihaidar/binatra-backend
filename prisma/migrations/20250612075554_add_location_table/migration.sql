/*
  Warnings:

  - You are about to drop the column `location` on the `devices` table. All the data in the column will be lost.
  - Added the required column `locationId` to the `devices` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `sensor_logs` DROP FOREIGN KEY `sensor_logs_deviceCode_fkey`;

-- AlterTable
ALTER TABLE `devices` DROP COLUMN `location`,
    ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `locationId` VARCHAR(191) NOT NULL,
    MODIFY `status` ENUM('CONNECTED', 'DISCONNECTED') NOT NULL DEFAULT 'DISCONNECTED';

-- CreateTable
CREATE TABLE `locations` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `address` TEXT NULL,
    `district` VARCHAR(100) NULL,
    `city` VARCHAR(100) NULL,
    `province` VARCHAR(100) NULL,
    `latitude` DECIMAL(10, 8) NULL,
    `longitude` DECIMAL(11, 8) NULL,
    `normalLevel` DOUBLE NOT NULL DEFAULT 0,
    `alertLevel` DOUBLE NOT NULL DEFAULT 20,
    `dangerLevel` DOUBLE NOT NULL DEFAULT 40,
    `criticalLevel` DOUBLE NOT NULL DEFAULT 60,
    `currentStatus` ENUM('AMAN', 'WASPADA', 'BAHAYA') NOT NULL DEFAULT 'AMAN',
    `currentWaterLevel` DOUBLE NULL DEFAULT 0,
    `currentRainfall` DOUBLE NULL DEFAULT 0,
    `lastUpdate` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `locations_name_idx`(`name`),
    INDEX `locations_currentStatus_idx`(`currentStatus`),
    INDEX `locations_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `flood_alerts` (
    `id` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NOT NULL,
    `alertLevel` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL,
    `floodStatus` ENUM('AMAN', 'WASPADA', 'BAHAYA') NOT NULL,
    `waterLevel` DOUBLE NOT NULL,
    `rainfall` DOUBLE NULL,
    `title` VARCHAR(200) NOT NULL,
    `message` TEXT NOT NULL,
    `triggeredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `estimatedDuration` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isResolved` BOOLEAN NOT NULL DEFAULT false,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `flood_alerts_locationId_triggeredAt_idx`(`locationId`, `triggeredAt`),
    INDEX `flood_alerts_isActive_floodStatus_idx`(`isActive`, `floodStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `location_status_history` (
    `id` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NOT NULL,
    `previousStatus` ENUM('AMAN', 'WASPADA', 'BAHAYA') NOT NULL,
    `newStatus` ENUM('AMAN', 'WASPADA', 'BAHAYA') NOT NULL,
    `waterLevel` DOUBLE NULL,
    `rainfall` DOUBLE NULL,
    `changedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `duration` INTEGER NULL,
    `notes` TEXT NULL,

    INDEX `location_status_history_locationId_changedAt_idx`(`locationId`, `changedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alert_configurations` (
    `id` VARCHAR(191) NOT NULL,
    `alertWaterLevel` DOUBLE NOT NULL DEFAULT 20,
    `dangerWaterLevel` DOUBLE NOT NULL DEFAULT 40,
    `criticalWaterLevel` DOUBLE NOT NULL DEFAULT 60,
    `alertRainfall` DOUBLE NOT NULL DEFAULT 10,
    `dangerRainfall` DOUBLE NOT NULL DEFAULT 20,
    `criticalRainfall` DOUBLE NOT NULL DEFAULT 30,
    `alertCooldown` INTEGER NOT NULL DEFAULT 15,
    `dataStaleThreshold` INTEGER NOT NULL DEFAULT 30,
    `enableEmailAlerts` BOOLEAN NOT NULL DEFAULT true,
    `enableSMSAlerts` BOOLEAN NOT NULL DEFAULT false,
    `enablePushAlerts` BOOLEAN NOT NULL DEFAULT true,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `devices_isActive_idx` ON `devices`(`isActive`);

-- CreateIndex
CREATE INDEX `devices_locationId_idx` ON `devices`(`locationId`);

-- CreateIndex
CREATE INDEX `sensor_logs_timestamp_idx` ON `sensor_logs`(`timestamp`);

-- AddForeignKey
ALTER TABLE `devices` ADD CONSTRAINT `devices_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sensor_logs` ADD CONSTRAINT `sensor_logs_deviceCode_fkey` FOREIGN KEY (`deviceCode`) REFERENCES `devices`(`code`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `flood_alerts` ADD CONSTRAINT `flood_alerts_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `location_status_history` ADD CONSTRAINT `location_status_history_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
