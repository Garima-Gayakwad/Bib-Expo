/*
  Warnings:

  - You are about to drop the column `passwordHash` on the `Volunteer` table. All the data in the column will be lost.
  - You are about to drop the column `username` on the `Volunteer` table. All the data in the column will be lost.
  - The `role` column on the `Volunteer` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `name` to the `Volunteer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `password` to the `Volunteer` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'VOLUNTEER');

-- AlterTable
ALTER TABLE "Volunteer" DROP COLUMN "passwordHash",
DROP COLUMN "username",
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "password" TEXT NOT NULL,
DROP COLUMN "role",
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'VOLUNTEER';
