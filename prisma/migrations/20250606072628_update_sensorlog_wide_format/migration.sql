/*
  Warnings:

  - You are about to drop the column `sensorType` on the `sensor_logs` table. All the data in the column will be lost.
  - You are about to drop the column `unit` on the `sensor_logs` table. All the data in the column will be lost.
  - You are about to drop the column `value` on the `sensor_logs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `sensor_logs` DROP COLUMN `sensorType`,
    DROP COLUMN `unit`,
    DROP COLUMN `value`,
    ADD COLUMN `rainfall` DOUBLE NULL,
    ADD COLUMN `waterLevel` DOUBLE NULL;

-- CreateIndex
CREATE INDEX `sensor_logs_deviceId_timestamp_idx` ON `sensor_logs`(`deviceId`, `timestamp`);
