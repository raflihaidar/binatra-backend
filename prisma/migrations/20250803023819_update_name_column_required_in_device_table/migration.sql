/*
  Warnings:

  - Made the column `name` on table `devices` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `devices` MODIFY `name` VARCHAR(255) NOT NULL;
