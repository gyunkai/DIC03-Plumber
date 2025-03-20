import os
from langchain_community.document_loaders import PyPDFLoader
from langchain_openai import OpenAIEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
import numpy as np
from typing import List, Dict
import json
import psycopg2
from psycopg2.extras import Json
from urllib.parse import urlparse
from dotenv import load_dotenv, find_dotenv
from pathlib import Path

# Find and load .env file
env_path = find_dotenv()
print("Found .env file at:", env_path)

# Force reload environment variables
load_dotenv(env_path, override=True)

# Print environment variables for debugging
print("Environment variables after loading:")
print("OPENAI_API_KEY:", os.getenv("OPENAI_API_KEY"))
print("DATABASE_URL3:", os.getenv("DATABASE_URL3"))

# Force set environment variables
os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY")
os.environ["DATABASE_URL3"] = os.getenv("DATABASE_URL3")

class PDFEmbeddingProcessor:
    def __init__(self, openai_api_key: str):
        """
        Initialize the PDF embedding processor
        Args:
            openai_api_key (str): OpenAI API key for embeddings
        """
        self.embeddings = OpenAIEmbeddings(openai_api_key=openai_api_key)
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len
        )
        
        # Parse database URL
        db_url = os.getenv("DATABASE_URL3")
        if not db_url:
            raise ValueError("DATABASE_URL3 environment variable is not set")
        
        parsed = urlparse(db_url)
        self.conn = psycopg2.connect(
            dbname=parsed.path[1:],  # Remove leading slash
            user=parsed.username,
            password=parsed.password,
            host=parsed.hostname,
            port=parsed.port or 5432,
            sslmode='require'  # Enable SSL for RDS
        )
        self.cur = self.conn.cursor()

    def load_pdf(self, pdf_path: str) -> List[Dict]:
        """
        Load and split PDF into chunks
        Args:
            pdf_path (str): Path to the PDF file
        Returns:
            List[Dict]: List of document chunks with metadata
        """
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF file not found: {pdf_path}")

        loader = PyPDFLoader(pdf_path)
        documents = loader.load()
        
        # Split documents into chunks
        chunks = self.text_splitter.split_documents(documents)
        
        # Convert chunks to format suitable for database storage
        processed_chunks = []
        for chunk in chunks:
            processed_chunks.append({
                "content": chunk.page_content,
                "metadata": chunk.metadata,
                "embedding": None  # Will be filled later
            })
        
        return processed_chunks

    def generate_embeddings(self, chunks: List[Dict]) -> List[Dict]:
        """
        Generate embeddings for document chunks
        Args:
            chunks (List[Dict]): List of document chunks
        Returns:
            List[Dict]: Chunks with their embeddings
        """
        texts = [chunk["content"] for chunk in chunks]
        embeddings = self.embeddings.embed_documents(texts)
        
        print(f"Generated {len(embeddings)} embeddings")
        print(f"First embedding type: {type(embeddings[0])}")
        
        for chunk, embedding in zip(chunks, embeddings):
            chunk["embedding"] = embedding
        
        return chunks

    def store_in_database(self, chunks: List[Dict], pdf_name: str):
        """
        Store chunks with embeddings in the database
        Args:
            chunks (List[Dict]): Processed chunks with embeddings
            pdf_name (str): Name of the PDF file
        """
        for chunk in chunks:
            # Check if embedding is already a list or numpy array
            embedding_value = chunk["embedding"]
            if isinstance(embedding_value, np.ndarray):
                embedding_list = embedding_value.tolist()
            else:
                # Already a list, no need to convert
                embedding_list = embedding_value
                
            self.cur.execute(
                """
                INSERT INTO "PdfChunk" (id, "pdfName", content, "pageNumber", embedding)
                VALUES (gen_random_uuid(), %s, %s, %s, %s::vector)
                """,
                (
                    pdf_name,
                    chunk["content"],
                    chunk["metadata"].get("page", 0),
                    embedding_list
                )
            )
        self.conn.commit()

    def __del__(self):
        """
        Clean up database connections
        """
        if hasattr(self, 'cur'):
            self.cur.close()
        if hasattr(self, 'conn'):
            self.conn.close()

def main():
    """
    Main function to process PDF file and store embeddings in database
    """
    # Get OpenAI API key
    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY environment variable is not set.")

    # Initialize processor
    print(OPENAI_API_KEY)
    processor = PDFEmbeddingProcessor(OPENAI_API_KEY)

    # Process PDF file
    pdf_path = "public/pdf/Lecture1.pdf"  # Path to Lecture1.pdf
    pdf_name = "Lecture1.pdf"

    try:
        # Load and process PDF
        print("Loading PDF...")
        chunks = processor.load_pdf(pdf_path)
        
        # Generate embeddings
        print("Generating embeddings...")
        chunks_with_embeddings = processor.generate_embeddings(chunks)
        
        # Store in database
        print("Storing embeddings in database...")
        processor.store_in_database(chunks_with_embeddings, pdf_name)
        
        print(f"Successfully processed PDF and stored embeddings in database")
        
    except Exception as e:
        print(f"Error processing PDF: {str(e)}")

if __name__ == "__main__":
    main() 