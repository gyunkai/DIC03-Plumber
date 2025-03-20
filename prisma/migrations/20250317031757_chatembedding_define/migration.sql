/*
  Warnings:

  - The `embedding` column on the `ChatEmbedding` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "ChatEmbedding" DROP COLUMN "embedding",
ADD COLUMN     "embedding" DOUBLE PRECISION[];
