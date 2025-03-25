import os
import boto3
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.document_loaders import PyMuPDFLoader  # <-- use this instead!
from langchain_openai import OpenAIEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
import psycopg2
from urllib.parse import urlparse
from dotenv import load_dotenv
import tempfile
import logging
from tqdm import tqdm
import time

load_dotenv()

logging.basicConfig(level=logging.INFO)

class PDFEmbeddingProcessor:
    def __init__(self, openai_api_key: str):
        self.embeddings = OpenAIEmbeddings(openai_api_key=openai_api_key)
        self.text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

        db_url = os.getenv("DATABASE_URL3")
        parsed = urlparse(db_url)
        self.conn = psycopg2.connect(
            dbname=parsed.path[1:],
            user=parsed.username,
            password=parsed.password,
            host=parsed.hostname,
            port=parsed.port or 5432,
            sslmode='require'
        )
        self.cur = self.conn.cursor()

        self.s3 = boto3.client('s3')

    def fetch_all_pdf_keys(self, bucket_name: str, prefix: str = ''):
        paginator = self.s3.get_paginator('list_objects_v2')
        pdf_keys = []

        for page in paginator.paginate(Bucket=bucket_name, Prefix=prefix):
            for item in page.get('Contents', []):
                key = item['Key']
                if key.lower().endswith('.pdf'):
                    pdf_keys.append(key)

        return pdf_keys

    def fetch_pdf_from_s3(self, bucket_name: str, key: str) -> str:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
            self.s3.download_fileobj(bucket_name, key, tmp_file)
            return tmp_file.name

    def load_pdf(self, pdf_path: str):
        try:
            loader = PyMuPDFLoader(pdf_path)
            documents = loader.load()
            return self.text_splitter.split_documents(documents)
        except Exception as e:
            logging.error(f"Failed to load {pdf_path}: {e}")
            return []  # Return empty list if loading fails

    def generate_embeddings(self, chunks):
        embeddings = []
        for chunk in tqdm(chunks, desc="Generating embeddings", leave=False):
            embedding = self.embeddings.embed_documents([chunk.page_content])[0]
            embeddings.append({
                "content": chunk.page_content,
                "metadata": chunk.metadata,
                "embedding": embedding
            })
            time.sleep(0.2)  # Sleep to avoid API rate limits
        return embeddings

    def store_in_database(self, chunks, pdf_name, pdf_path):
        for chunk in tqdm(chunks, desc=f"Storing '{pdf_name}'", leave=False):
            embedding = chunk["embedding"]
            
            # Sanitize content by removing NUL characters
            sanitized_content = chunk["content"].replace('\x00', '')
            
            # Sanitize pdf_name and pdf_path just in case
            sanitized_pdf_name = pdf_name.replace('\x00', '')
            sanitized_pdf_path = pdf_path.replace('\x00', '')
            
            self.cur.execute(
                """
                INSERT INTO "PdfChunk" 
                    ("pdfPath", id, "pdfName", content, "pageNumber", embedding)
                VALUES 
                    (%s, gen_random_uuid(), %s, %s, %s, %s::vector)
                """,
                (
                    sanitized_pdf_path,
                    sanitized_pdf_name,
                    sanitized_content,
                    chunk["metadata"].get("page", 0),
                    embedding
                )
            )
        self.conn.commit()



    def close(self):
        self.cur.close()
        self.conn.close()

def main():
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY not set")

    bucket_name = os.getenv("AWS_S3_BUCKET_NAME")
    if not bucket_name:
        raise ValueError("AWS_S3_BUCKET_NAME not set")

    processor = PDFEmbeddingProcessor(OPENAI_API_KEY)

    try:
        logging.info(f"Fetching all PDFs from bucket '{bucket_name}'...")
        pdf_keys = processor.fetch_all_pdf_keys(bucket_name)

        if not pdf_keys:
            logging.warning("No PDFs found in bucket.")
            return

        # Get already embedded PDFs from the database
        processor.cur.execute('SELECT DISTINCT "pdfPath" FROM "PdfChunk";')
        embedded_pdf_paths = {row[0] for row in processor.cur.fetchall()}

        # Filter out already embedded PDFs
        new_pdf_keys = [key for key in pdf_keys if key not in embedded_pdf_paths]

        if not new_pdf_keys:
            logging.info("All PDFs have already been embedded.")
            return

        logging.info(f"{len(new_pdf_keys)} new PDFs found to embed.")

        for s3_key in tqdm(new_pdf_keys, desc="Overall progress"):
            logging.info(f"Embedding '{s3_key}'...")
            
            # Fetch PDF locally for embedding
            pdf_local_path = processor.fetch_pdf_from_s3(bucket_name, s3_key)

            chunks = processor.load_pdf(pdf_local_path)
            chunks_with_embeddings = processor.generate_embeddings(chunks)

            processor.store_in_database(
                chunks_with_embeddings, 
                pdf_name=os.path.basename(s3_key),
                pdf_path=s3_key
            )

            # Clean up the downloaded PDF file
            if os.path.exists(pdf_local_path):
                os.remove(pdf_local_path)

            time.sleep(1)  # To respect rate limits

        logging.info("New PDFs processed and embeddings inserted successfully!")

    except Exception as e:
        logging.error(f"Error: {e}", exc_info=True)
    finally:
        processor.close()


if __name__ == "__main__":
    main()
