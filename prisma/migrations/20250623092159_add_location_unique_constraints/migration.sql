/*
  Warnings:

  - A unique constraint covering the columns `[name,city,district]` on the table `locations` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[latitude,longitude]` on the table `locations` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `devices` DROP FOREIGN KEY `devices_locationId_fkey`;

-- DropForeignKey
ALTER TABLE `location_status_history` DROP FOREIGN KEY `location_status_history_locationId_fkey`;

-- AlterTable
ALTER TABLE `location_status_history` MODIFY `locationId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `locations_name_city_district_key` ON `locations`(`name`, `city`, `district`);

-- CreateIndex
CREATE UNIQUE INDEX `locations_latitude_longitude_key` ON `locations`(`latitude`, `longitude`);

-- AddForeignKey
ALTER TABLE `devices` ADD CONSTRAINT `devices_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `location_status_history` ADD CONSTRAINT `location_status_history_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
