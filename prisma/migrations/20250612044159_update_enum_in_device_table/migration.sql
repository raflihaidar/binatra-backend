/*
  Warnings:

  - You are about to alter the column `status` on the `devices` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(0))` to `Enum(EnumId(0))`.

*/
-- AlterTable
ALTER TABLE `devices` MODIFY `status` ENUM('CONNECTED', 'DISCONNECTED') NOT NULL DEFAULT 'CONNECTED';
