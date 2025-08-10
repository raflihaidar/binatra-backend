/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `devices` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `devices` ADD COLUMN `name` VARCHAR(255) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `devices_name_key` ON `devices`(`name`);
