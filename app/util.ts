import OpenAI from 'openai';
import { PDFDocument } from 'pdf-lib';
import { readFile } from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Get the absolute path to the project root directory
const rootDir = path.resolve(process.cwd(), '..');
const envPath = path.join(rootDir, '.env');

// Load environment variables from .env file
dotenv.config({ path: envPath });

// Initialize OpenAI configuration
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Prisma client with remote RDS connection
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL3
        }
    }
});

// ... rest of the code remains the same ... 