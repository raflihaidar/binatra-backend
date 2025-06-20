/*
  Warnings:

  - You are about to drop the column `alertLevel` on the `locations` table. All the data in the column will be lost.
  - You are about to drop the column `criticalLevel` on the `locations` table. All the data in the column will be lost.
  - You are about to drop the column `dangerLevel` on the `locations` table. All the data in the column will be lost.
  - You are about to drop the column `normalLevel` on the `locations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `location_status_history` MODIFY `previousStatus` ENUM('AMAN', 'WASPADA', 'SIAGA', 'BAHAYA') NOT NULL,
    MODIFY `newStatus` ENUM('AMAN', 'WASPADA', 'SIAGA', 'BAHAYA') NOT NULL;

-- AlterTable
ALTER TABLE `locations` DROP COLUMN `alertLevel`,
    DROP COLUMN `criticalLevel`,
    DROP COLUMN `dangerLevel`,
    DROP COLUMN `normalLevel`,
    ADD COLUMN `amanMax` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `bahayaMin` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `siagaMax` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `siagaMin` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `waspadaMax` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `waspadaMin` DOUBLE NOT NULL DEFAULT 0,
    MODIFY `currentStatus` ENUM('AMAN', 'WASPADA', 'SIAGA', 'BAHAYA') NOT NULL DEFAULT 'AMAN';
