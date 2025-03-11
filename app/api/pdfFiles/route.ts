import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export async function GET() {
  const pdfDirectory = path.join(process.cwd(), 'public', 'pdf');
  // Read all files ending with ".pdf" (case-insensitive)
  const files = fs.readdirSync(pdfDirectory).filter(file => file.toLowerCase().endsWith('.pdf'));
  const pdfFiles = files.map(file => ({
    name: file, // Optionally, you can format the name further
    file: `/pdf/${file}`
  }));
  
  return NextResponse.json(pdfFiles);
}
