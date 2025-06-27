/*
  Warnings:

  - A unique constraint covering the columns `[locationId]` on the table `devices` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `devices_locationId_key` ON `devices`(`locationId`);
