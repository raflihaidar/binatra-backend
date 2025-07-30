/*
  Warnings:

  - You are about to drop the `reports` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `rainfall` on table `sensor_logs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `waterLevel` on table `sensor_logs` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `reports` DROP FOREIGN KEY `reports_deviceId_fkey`;

-- AlterTable
ALTER TABLE `sensor_logs` ADD COLUMN `depth` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `deviceCalibration` DOUBLE NOT NULL DEFAULT 0,
    MODIFY `rainfall` DOUBLE NOT NULL DEFAULT 0,
    MODIFY `waterLevel` DOUBLE NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE `reports`;
