import os
from langchain_community.document_loaders import PyPDFLoader
from langchain_openai import OpenAIEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
import numpy as np
from typing import List, Dict
import json
import psycopg2
from psycopg2.extras import Json

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
        self.conn = psycopg2.connect(
            dbname=os.getenv("DATABASE_NAME"),
            user=os.getenv("DATABASE_USER"),
            password=os.getenv("DATABASE_PASSWORD"),
            host=os.getenv("DATABASE_HOST", "localhost"),
            port=os.getenv("DATABASE_PORT", "5432")
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
            self.cur.execute(
                """
                INSERT INTO "PDFChunk" ("pdfName", content, "pageNumber", embedding)
                VALUES (%s, %s, %s, %s)
                """,
                (
                    pdf_name,
                    chunk["content"],
                    chunk["metadata"].get("page", 0),
                    Json(chunk["embedding"].tolist())
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