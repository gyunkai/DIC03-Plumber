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
import argparse

# 加载环境变量但会被显式API密钥覆盖
load_dotenv()

logging.basicConfig(level=logging.INFO)

# 显式设置OpenAI API密钥
OPENAI_API_KEY = "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"

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
                    (id, "pdfName", content, "pageNumber", embedding, "pdfPath")
                VALUES 
                    (gen_random_uuid(), %s, %s, %s, %s::vector, %s)
                """,
                (
                    sanitized_pdf_name,
                    sanitized_content,
                    chunk["metadata"].get("page", 0),
                    embedding,
                    sanitized_pdf_path
                )
            )
        self.conn.commit()
        
    def delete_existing_chunks(self, pdf_path=None):
        """删除数据库中已存在的PDF块，可以指定特定的PDF路径或删除所有"""
        try:
            if pdf_path:
                logging.info(f"删除PDF路径为'{pdf_path}'的现有chunks...")
                self.cur.execute('DELETE FROM "PdfChunk" WHERE "pdfPath" = %s', (pdf_path,))
            else:
                logging.info("删除所有现有chunks...")
                self.cur.execute('DELETE FROM "PdfChunk"')
            
            self.conn.commit()
            affected_rows = self.cur.rowcount
            logging.info(f"已删除{affected_rows}条记录")
            return affected_rows
        except Exception as e:
            self.conn.rollback()
            logging.error(f"删除操作失败: {e}")
            return 0

    def close(self):
        self.cur.close()
        self.conn.close()

def main():
    parser = argparse.ArgumentParser(description='PDF Embedding Processor')
    parser.add_argument('--reembed-all', action='store_true', help='重新嵌入所有PDF，包括已经嵌入过的')
    parser.add_argument('--delete-all', action='store_true', help='删除所有现有的PDF嵌入')
    parser.add_argument('--limit', type=int, default=0, help='限制处理的PDF数量，用于测试，默认为0表示处理所有')
    parser.add_argument('--append-only', action='store_true', help='只添加嵌入，不删除现有数据，即使是处理相同的PDF')
    args = parser.parse_args()

    # 使用显式设置的API密钥，而不是从环境变量获取
    # OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
    # if not OPENAI_API_KEY:
    #     raise ValueError("OPENAI_API_KEY not set")
    logging.info(f"使用显式设置的OpenAI API密钥")

    bucket_name = os.getenv("AWS_S3_BUCKET_NAME")
    if not bucket_name:
        raise ValueError("AWS_S3_BUCKET_NAME not set")

    processor = PDFEmbeddingProcessor(OPENAI_API_KEY)

    try:
        # 如果指定了删除所有选项
        if args.delete_all:
            processor.delete_existing_chunks()
            
        logging.info(f"从桶'{bucket_name}'获取所有PDF...")
        pdf_keys = processor.fetch_all_pdf_keys(bucket_name)

        if not pdf_keys:
            logging.warning("桶中未找到PDF文件。")
            return

        # 只过滤出以public/lapdf和public/mlpdf开头的PDF路径
        pdf_keys = [key for key in pdf_keys if key.startswith('public/lapdf') or key.startswith('public/mlpdf')]
        logging.info(f"过滤后剩余{len(pdf_keys)}个符合条件的PDF文件")

        if not pdf_keys:
            logging.warning("没有找到以public/lapdf或public/mlpdf开头的PDF文件。")
            return

        # 如果不是重新嵌入所有PDF，则只处理新的PDF
        if not args.reembed_all:
            # 获取数据库中已嵌入的PDF
            processor.cur.execute('SELECT DISTINCT "pdfPath" FROM "PdfChunk";')
            embedded_pdf_paths = {row[0] for row in processor.cur.fetchall()}
            
            # 过滤出未嵌入的PDF
            pdf_keys_to_process = [key for key in pdf_keys if key not in embedded_pdf_paths]
            
            if not pdf_keys_to_process:
                logging.info("所有符合条件的PDF都已经嵌入。")
                return
                
            logging.info(f"找到{len(pdf_keys_to_process)}个新PDF需要嵌入。")
        else:
            # 如果是重新嵌入所有PDF，则处理所有PDF
            pdf_keys_to_process = pdf_keys
            logging.info(f"将重新嵌入所有{len(pdf_keys_to_process)}个符合条件的PDF。")

        # 如果设置了限制参数，只处理指定数量的PDF
        if args.limit > 0:
            pdf_keys_to_process = pdf_keys_to_process[:args.limit]
            logging.info(f"根据限制参数，只处理前{args.limit}个PDF进行测试。")

        for s3_key in tqdm(pdf_keys_to_process, desc="总体进度"):
            logging.info(f"处理'{s3_key}'...")
            
            # 如果是重新嵌入，且不是只追加模式，则先删除现有的chunks
            if args.reembed_all and not args.append_only:
                processor.delete_existing_chunks(s3_key)
            
            # 从S3获取PDF到本地进行嵌入
            pdf_local_path = processor.fetch_pdf_from_s3(bucket_name, s3_key)

            chunks = processor.load_pdf(pdf_local_path)
            chunks_with_embeddings = processor.generate_embeddings(chunks)

            processor.store_in_database(
                chunks_with_embeddings, 
                pdf_name=os.path.basename(s3_key),
                pdf_path=s3_key
            )

            # 清理下载的PDF文件
            if os.path.exists(pdf_local_path):
                os.remove(pdf_local_path)

            time.sleep(1)  # 尊重API速率限制

        logging.info("PDF处理和嵌入成功完成！")

    except Exception as e:
        logging.error(f"错误: {e}", exc_info=True)
    finally:
        processor.close()


if __name__ == "__main__":
    main()
