-- CreateTable
CREATE TABLE "PdfChunk" (
    "id" TEXT NOT NULL,
    "pdfName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PdfChunk_pkey" PRIMARY KEY ("id")
);
