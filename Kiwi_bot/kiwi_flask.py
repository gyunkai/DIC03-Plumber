import os
import glob
from flask import Flask, request, jsonify, Response
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain.memory import ConversationBufferMemory
from langchain.prompts import PromptTemplate
from langchain.schema import SystemMessage
import numpy as np
import json
from psycopg2.extras import Json
from datetime import datetime
from typing import List, Dict
import psycopg2
from psycopg2.extras import Json
from urllib.parse import urlparse
from dotenv import load_dotenv, find_dotenv
from pathlib import Path
import time
import traceback
import uuid

import re

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

# Initialize Flask app
app = Flask(__name__)

# ---------- Global Setup ----------
# Check for API key
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY environment variable is not set.")

# Initialize embeddings
embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)

# Initialize global document chunks
document_chunks = []

# Initialize database connection
def get_db_connection():
    """
    Create a database connection
    Returns:
        psycopg2.connection: Database connection
    """
    try:
        # Parse database URL
        db_url = os.getenv("DATABASE_URL3")
        if not db_url:
            print("ERROR: DATABASE_URL3 environment variable is not set")
            raise ValueError("DATABASE_URL3 environment variable is not set")
        
        print(f"Connecting to database with URL: {db_url[:20]}...")
        parsed = urlparse(db_url)
        
        # Try to connect to the database
        conn = psycopg2.connect(
            dbname=parsed.path[1:],  # Remove leading slash
            user=parsed.username,
            password=parsed.password,
            host=parsed.hostname,
            port=parsed.port or 5432,
            sslmode='require'  # Enable SSL for RDS
        )
        print("Database connection established successfully")
        return conn
    except Exception as e:
        print(f"ERROR: Failed to connect to database: {str(e)}")
        # Retry without SSL
        try:
            print("Retrying connection without SSL...")
            conn = psycopg2.connect(
                dbname=parsed.path[1:],  # Remove leading slash
                user=parsed.username,
                password=parsed.password,
                host=parsed.hostname,
                port=parsed.port or 5432,
                sslmode='prefer'  # Try to use SSL, but not required
            )
            print("Database connection established successfully (without SSL requirement)")
            return conn
        except Exception as retry_e:
            print(f"ERROR: Failed retry connection: {str(retry_e)}")
            raise


def create_or_update_user_session(user_id, pdf_name, user_input, bot_response):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Check if session exists and is active
            cursor.execute("""
                SELECT id, "conversationhistory" FROM "UserSession"
                WHERE "userId" = %s AND "sessionEndTime" IS NULL
                ORDER BY "sessionStartTime" DESC
                LIMIT 1
            """, (user_id,))

            session = cursor.fetchone()

            message_entry_user = {
                "timestamp": datetime.utcnow().isoformat(),
                "sender": "user",
                "message": user_input
            }
            message_entry_bot = {
                "timestamp": datetime.utcnow().isoformat(),
                "sender": "bot",
                "message": bot_response
            }

            if session:
                session_id, conversation_history = session
                conversation_history.append(message_entry_user)
                conversation_history.append(message_entry_bot)

                cursor.execute("""
                    UPDATE "UserSession"
                    SET "conversationhistory" = %s
                    WHERE id = %s
                """, (Json(conversation_history), session_id))

                print(f"Updated existing session {session_id}")

            else:
                # Create new session if none exists
                session_id = str(uuid.uuid4())
                conversation_history = [message_entry_user, message_entry_bot]

                cursor.execute("""
                    INSERT INTO "UserSession" (id, "userId", "pdfname", "conversationhistory", "sessionStartTime")
                    VALUES (%s, %s, %s, %s, %s)
                """, (session_id, user_id, pdf_name, Json(conversation_history), datetime.utcnow()))

                print(f"Created new session {session_id}")

        conn.commit()
    except Exception as e:
        print(f"Error in session management: {e}")
        traceback.print_exc()
    finally:
        conn.close()

def update_user_reading_progress(user_id, pdf_path, page_number):
    """
    更新用户的阅读进度，记录用户正在阅读的PDF和页码
    
    Args:
        user_id (str): 用户ID
        pdf_path (str): PDF路径 
        page_number (int): 当前页码
    """
    if not user_id or not pdf_path or page_number is None:
        print("缺少更新阅读进度所需的参数")
        return
    
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            # 首先检查该用户对该文档是否已有阅读记录
            cursor.execute("""
                SELECT id FROM "UserInteraction" 
                WHERE "userId" = %s AND "contentRef" = %s AND "type" = 'reading_progress'
                LIMIT 1
            """, (user_id, pdf_path))
            
            record = cursor.fetchone()
            current_time = datetime.utcnow()
            
            if record:
                # 更新现有记录
                record_id = record[0]
                cursor.execute("""
                    UPDATE "UserInteraction"
                    SET "data" = %s, "updatedAt" = %s
                    WHERE id = %s
                """, (Json({"current_page": page_number, "last_read": current_time.isoformat()}), current_time, record_id))
                print(f"更新用户 {user_id} 的阅读进度: {pdf_path} 第 {page_number} 页")
            else:
                # 创建新记录
                record_id = str(uuid.uuid4())
                cursor.execute("""
                    INSERT INTO "UserInteraction" (id, "userId", "type", "contentRef", "data", "createdAt", "updatedAt")
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (
                    record_id, 
                    user_id, 
                    'reading_progress', 
                    pdf_path, 
                    Json({"current_page": page_number, "last_read": current_time.isoformat()}),
                    current_time,
                    current_time
                ))
                print(f"创建用户 {user_id} 的阅读进度: {pdf_path} 第 {page_number} 页")
            
            conn.commit()
    except Exception as e:
        print(f"更新阅读进度时出错: {e}")
        traceback.print_exc()
    finally:
        conn.close()

# Load embeddings from database
def load_embeddings_from_db(pdf_name: str = None) -> List[Dict]:
    """
    Load document chunks from database without performing similarity search.
    This function only loads the chunks and returns them.
    
    Args:
        pdf_name (str, optional): Filter by PDF name
    Returns:
        List[Dict]: List of document chunks
    """
    start_time = time.time()
    document_chunks = []
    
    print(f"Loading document chunks for PDF: {pdf_name}")
    conn = None
    try:
        # Establish database connection
        conn = get_db_connection()
        conn.autocommit = True
        # print("Database connection established successfully")

        # Set statement timeout to avoid hanging
        with conn.cursor() as cursor:
            cursor.execute("SET statement_timeout = 30000;")  # 30 seconds
            # print("Setting statement timeout to 30 seconds...")
            
            # Execute a simple count query first to test database responsiveness
            # cursor.execute("SELECT COUNT(*) FROM \"PdfChunk\";")
            total_chunks = cursor.fetchone()[0]
            print(f"Found {total_chunks} total chunks in database. Query took {time.time() - start_time:.2f} seconds")
            
            # Load chunks by page order
            if pdf_name:
                sql = """
                SELECT id, content, "pageNumber" 
                FROM "PdfChunk" 
                WHERE "pdfName" = %s
                ORDER BY "pageNumber"
                LIMIT 100;
                """
                cursor.execute(sql, (pdf_name,))
            else:
                # If no PDF name specified, get chunks from all PDFs
                sql = """
                SELECT id, content, "pageNumber", "pdfName" 
                FROM "PdfChunk" 
                ORDER BY "pdfName", "pageNumber"
                LIMIT 100;
                """
                cursor.execute(sql)
            
            query_start = time.time()
            print(f"Executing page order query...")
            
            rows = cursor.fetchall()
            query_time = time.time() - query_start
            print(f"Query completed in {query_time:.2f} seconds, found {len(rows)} chunks")
            
            # Process query results
            for row in rows:
                if pdf_name:
                    id, content, page_number = row
                    pdf = pdf_name
                else:
                    id, content, page_number, pdf = row
                
                document_chunks.append({
                    "id": id,
                    "content": content,
                    "metadata": {
                        "page": page_number,
                        "pdf_name": pdf,
                        "source": f"{pdf} - Page {page_number}",
                    }
                })
            
            # Sort by page number
            document_chunks.sort(key=lambda x: x['metadata']['page'])
            print(f"Processed {len(document_chunks)} chunks. Total processing took {time.time() - start_time:.2f} seconds")
            
    except Exception as e:
        print(f"⚠️ Database error: {e}")
        print(f"Error details: {traceback.format_exc()}")
        # Return empty list in case of error
        print("No chunks were loaded due to an error.")
        # Return empty list, not None
        return []
    finally:
        # Ensure database connection is closed
        if conn:
            conn.close()
            print("Database connection closed")

    return document_chunks

# Load embeddings
# document_chunks = []
# try:
#     document_chunks, metadata = load_embeddings_from_db()
#     print(f"Successfully loaded {len(document_chunks)} embeddings from database")
# except Exception as e:
#     print(f"Error loading embeddings from database: {str(e)}")

# Setup conversation memory
memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)
# Define system prompt and add it to memory
system_prompt = (
    "You are Kiwi, a helpful AI assistant. Always remember personal details provided by the user, "
    "especially their name. If the user states 'My name is ...', store it, and when asked, reply with the name they've provided. "
    "Here you are tasked with answering questions based on the document provided which is for the course which will be provided with. "
    "Please prioritize answering questions based on the document. But then give them more context for better understanding based on the document as well. "
    "For each answer, cite your sources from the pages using the format [Page X](page://X) — this will be converted into clickable links, start counting from 1."
    "The user might ask about content on a specific page of the document, look through it and answer them accordingly. You have access to that page since it is provided."
    "Always include these page references when providing information from the document. "
    "Make your answers helpful and informative while clearly indicating which page contains the information."
    "If no relevant content is found in the current document, you may reference content from other lectures if available, and clearly indicate which lecture and page it came from."

)

user_memories = {}

def get_user_memory(user_id: str, user_name: str = "User", user_email: str = "N/A"):
    if user_id not in user_memories:
        user_memories[user_id] = {
            "memory": ConversationBufferMemory(memory_key="chat_history", return_messages=True),
            "personalized_prompt": (
                f"{system_prompt}\n\n"
                f"The user's name is {user_name}. "
                f"The user's email address is {user_email}. "
                f"The user's unique ID is {user_id}."
            )
        }
        # Initialize memory with system prompt
        user_memories[user_id]["memory"].chat_memory.messages.append(
            SystemMessage(content=user_memories[user_id]["personalized_prompt"])
        )

    return user_memories[user_id]

# Initialize Chat Model
print("Initializing Chat Model...")
llm = ChatOpenAI(openai_api_key=OPENAI_API_KEY, model="gpt-4")

# Create the prompt template
prompt_template = PromptTemplate(
    input_variables=["system_prompt", "document_context", "chat_history", "user_input"],
    template=(
        "{system_prompt}\n\n"
        "Document Context:\n"
        "{document_context}\n\n"
        "Conversation History:\n"
        "{chat_history}\n\n"
        "User: {user_input}\n"
        "Assistant:"
    )
)

def get_relevant_chunks(query: str, pdf_name: str = None, pdf_path: str = None, k: int = 5, allow_fallback: bool = True, use_ann: bool = True) -> List[Dict]:
    """
    获取与查询相关的文档块
    
    Args:
        query (str): 用户查询
        pdf_name (str, optional): PDF名称过滤
        pdf_path (str, optional): PDF路径过滤 (新增)
        k (int): 返回的结果数量
        allow_fallback (bool): 如果在指定PDF中找不到，是否回退到全局搜索
        use_ann (bool): 是否使用近似最近邻搜索加速查询 (新增)
    
    Returns:
        Tuple[List[Dict], bool]: 相关文档块列表和是否使用了回退策略
    """
    query_embedding = embeddings.embed_query(query)
    
    conn = get_db_connection()
    chunks = []
    used_fallback = False

    try:
        with conn.cursor() as cursor:
            cursor.execute("SET statement_timeout = 30000;")

            # 准备基础SQL查询，根据use_ann参数决定使用近似最近邻或精确搜索
            if use_ann:
                # 使用HNSW索引的近似最近邻查询
                distance_op = "<=>"  # cosine distance
                order_by = f"embedding {distance_op} %s::vector"
                print("使用近似最近邻搜索")
            else:
                # 传统精确搜索
                distance_op = "<=>"
                order_by = f"embedding {distance_op} %s::vector"
                print("使用精确向量搜索")

            # 首先：尝试在特定的PDF中查询
            if pdf_path:
                # 新增：通过pdfPath查询
                sql = f"""
                SELECT id, content, "pageNumber", "pdfName", "pdfPath", (embedding {distance_op} %s::vector) as distance
                FROM "PdfChunk"
                WHERE "pdfPath" = %s
                ORDER BY {order_by}
                LIMIT %s;
                """
                cursor.execute(sql, (query_embedding, pdf_path, query_embedding, k))
            elif pdf_name:
                # 保持原有功能：通过pdfName查询
                sql = f"""
                SELECT id, content, "pageNumber", "pdfName", "pdfPath", (embedding {distance_op} %s::vector) as distance
                FROM "PdfChunk"
                WHERE "pdfName" = %s
                ORDER BY {order_by}
                LIMIT %s;
                """
                cursor.execute(sql, (query_embedding, pdf_name, query_embedding, k))
            else:
                # 全局搜索
                sql = f"""
                SELECT id, content, "pageNumber", "pdfName", "pdfPath", (embedding {distance_op} %s::vector) as distance
                FROM "PdfChunk"
                ORDER BY {order_by}
                LIMIT %s;
                """
                cursor.execute(sql, (query_embedding, query_embedding, k))
                
            rows = cursor.fetchall()

            # 若未找到结果且允许回退，则尝试全局搜索
            if not rows and allow_fallback and (pdf_name or pdf_path):
                used_fallback = True
                print(f"⚠️ 在指定PDF中未找到匹配。回退到全局搜索。")
                sql = f"""
                SELECT id, content, "pageNumber", "pdfName", "pdfPath", (embedding {distance_op} %s::vector) as distance
                FROM "PdfChunk"
                ORDER BY {order_by}
                LIMIT %s;
                """
                cursor.execute(sql, (query_embedding, query_embedding, k))
                rows = cursor.fetchall()

            for row in rows:
                id, content, page_number, pdf, pdf_path, distance = row
                chunks.append({
                    "id": id,
                    "content": content,
                    "metadata": {
                        "page": page_number,
                        "pdf_name": pdf,
                        "pdf_path": pdf_path,
                        "source": f"{pdf} - Page {page_number}",
                        "distance": distance
                    }
                })

    except Exception as e:
        print(f"Error in similarity search: {e}")
        traceback.print_exc()
    finally:
        conn.close()

    return chunks, used_fallback


def get_fallback_chunks(pdf_name: str = None, k: int = 10) -> List[Dict]:
    """
    Get chunks sorted by page number as a fallback when similarity search fails
    
    Args:
        pdf_name (str, optional): PDF name to filter
        k (int): Number of chunks to return
    Returns:
        List[Dict]: Chunks sorted by page number
    """
    print("Using fallback: retrieving chunks sorted by page number")
    global document_chunks
    
    # If document_chunks is empty, try to load from database
    if not document_chunks:
        try:
            document_chunks = load_embeddings_from_db(pdf_name)
        except Exception as e:
            print(f"Error loading fallback chunks: {str(e)}")
            return []  # Return empty list if all fails
    
    # Filter by PDF name if specified
    filtered_chunks = document_chunks
    if pdf_name and document_chunks:
        filtered_chunks = [c for c in document_chunks if c.get('metadata', {}).get('pdf_name') == pdf_name]
    
    # Sort by page number
    sorted_chunks = sorted(filtered_chunks, key=lambda x: x['metadata'].get('page', 0))
    
    # Return limited number of chunks
    return sorted_chunks[:k]

def get_document_context(query: str, pdf_name: str = None, pdf_path: str = None, use_ann: bool = True) -> str:
    """
    Get relevant document context for a query
    Args:
        query (str): User query
        pdf_name (str, optional): PDF name filter
        pdf_path (str, optional): PDF path filter
        use_ann (bool): Whether to use approximate nearest neighbor search
    Returns:
        str: Relevant document context
    """
    # If no document chunks are loaded, try to reload from database
    global document_chunks
    
    print(f"get_document_context called with query: {query}")
    print(f"Filters - PDF Name: {pdf_name}, PDF Path: {pdf_path}")
    print(f"Current document_chunks length: {len(document_chunks) if document_chunks else 0}")
    
    # 根据是否有pdf_path选择加载方式
    if not document_chunks or pdf_path:
        try:
            # 如果指定了pdf_path，则不使用内存中的chunks，而是直接查询数据库
            if pdf_path:
                print(f"Querying directly with pdf_path: {pdf_path}")
                # 直接通过get_relevant_chunks进行查询，不使用document_chunks
                relevant_chunks, used_fallback = get_relevant_chunks(query, None, pdf_path, k=5, allow_fallback=True, use_ann=use_ann)
                
                # 格式化结果
                formatted_chunks = []
                for i, chunk in enumerate(relevant_chunks):
                    page_number = chunk['metadata'].get('page', 'unknown')
                    content = chunk['content']
                    pdf_path_info = chunk['metadata'].get('pdf_path', '')
                    
                    # 生成页面信息
                    page_info = f"[{pdf_path_info} - Page {page_number}]"
                    formatted_chunks.append(f"{page_info}: {content}")
                    print(f"Chunk {i}: Path {pdf_path_info}, Page {page_number}, Content length: {len(content)}")
                
                result = "\n---\n".join(formatted_chunks)
                print(f"Found {len(relevant_chunks)} chunks via direct pdf_path query. Total context length: {len(result)} characters")
                return result
            else:
                # 否则从数据库加载到内存
                document_chunks = load_embeddings_from_db(pdf_name)
                print(f"Re-loaded {len(document_chunks)} document chunks from database")
        except Exception as e:
            print(f"Error re-loading document chunks: {str(e)}")
            traceback.print_exc()
            return "No document context available."
    
    if not document_chunks and not pdf_path:
        print("WARNING: document_chunks is still empty after reload attempt")
        return "No document context available."
    
    # 如果没有指定任何过滤条件，可以从document_chunks中获取
    if not pdf_name and not pdf_path and document_chunks and len(document_chunks) > 0:
        if 'metadata' in document_chunks[0]:
            pdf_name = document_chunks[0].get('metadata', {}).get('pdf_name')
    
    # 使用document_chunks和pdf_name进行查询
    relevant_chunks, used_fallback = get_relevant_chunks(query, pdf_name, None, k=5, allow_fallback=True, use_ann=use_ann)
    print(f"Found {len(relevant_chunks)} relevant chunks for query")
    
    # Format relevant chunks with page information
    formatted_chunks = []
    for i, chunk in enumerate(relevant_chunks):
        page_number = chunk['metadata'].get('page', 'unknown')
        content = chunk['content']
        pdf_path_info = chunk['metadata'].get('pdf_path', '')
        pdf_name_info = chunk['metadata'].get('pdf_name', '')
        
        # 生成页面信息，如果有PDF路径则包含路径信息
        if pdf_path_info:
            page_info = f"[{pdf_path_info} - Page {page_number}]"
        else:
            page_info = f"[Page {page_number}]"
            
        formatted_chunks.append(f"{page_info}: {content}")
        print(f"Chunk {i}: Path {pdf_path_info}, Page {page_number}, Content length: {len(content)}")
    
    result = "\n---\n".join(formatted_chunks)
    print(f"Total context length: {len(result)} characters")
    return result

def safety_check(answer: str) -> str:
    """
    Check if the answer is safe to return
    Args:
        answer (str): Answer to check
    Returns:
        str: Safety verdict
    """
    check_prompt = (
        "You are a safety evaluator. Review the following answer and determine if it reveals "
        "too much sensitive or internal information. Reply with 'SAFE' if it is acceptable or 'BLOCK' "
        "if it discloses too much. Answer only with one word: either 'SAFE' or 'BLOCK'.\n\n"
        f"Answer: {answer}"
    )
    safety_response = llm.invoke(check_prompt)
    verdict = safety_response.get("content", "") if isinstance(safety_response, dict) else safety_response.content.strip()
    return verdict.upper()

def get_safe_answer(initial_answer: str, max_attempts: int = 3) -> str:
    """
    Get a safe answer after checking and potentially revising
    Args:
        initial_answer (str): Initial answer to check
        max_attempts (int): Maximum number of revision attempts
    Returns:
        str: Safe answer
    """
    attempt = 0
    answer_text = initial_answer

    while attempt < max_attempts:
        verdict = safety_check(answer_text)
        if verdict == "SAFE":
            break
        else:
            revision_prompt = (
                "Your previous answer revealed too much sensitive or detailed information. "
                "Please provide a revised answer that conveys the necessary information safely without revealing "
                "any sensitive or internal details."
            )
            revised_response = llm.invoke(revision_prompt)
            answer_text = revised_response.get("content", "") if isinstance(revised_response, dict) else revised_response.content
            attempt += 1

    return answer_text

def generate_quiz_question(user_input, personalized_prompt, pdf_name, document_context):
    # Define quiz-specific instructions
    quiz_instructions = (
        "You are Kiwi, a quiz master assistant. Based on the provided document context, generate a single multiple-choice quiz question. Generate new quizes to aid in learning and retention.\n\n"
        "Don't give pointless factual questions like what is on X page, but rather questions that require understanding and reasoning.\n\n"
        "Provide 4 options labeled A, B, C, D and indicate the correct answer.\n\n"
        "Return a valid JSON object in the following exact format:\n"
        "{\n"
        '  "question": "Your quiz question here?",\n'
        '  "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],\n'
        '  "answer": "B"\n'
        "}\n\n"
        "Return only the JSON and nothing else."
    )

    # If no document context is available, provide a fallback.
    if not document_context or document_context.strip() == "":
        document_context = "No specific document context available. Please assume general Machine Learning topics."

    # Append an explicit instruction so that Kiwi Bot does not ask for additional input.
    appended_context = (
        "IMPORTANT: Use ONLY the document context provided below to generate the quiz question. "
        "Do not ask for further clarification or additional content."
    )

    # Combine the personalized prompt, quiz instructions, appended context, document context, and user input.
    final_prompt = (
        f"{personalized_prompt}\n\n"
        f"Quiz Mode Instructions:\n{quiz_instructions}\n\n"
        f"{appended_context}\n\n"
        f"Document Context:\n{document_context}\n\n"
        f"User Input: {user_input}"
    )

    print("Final quiz prompt for LLM:")
    print(final_prompt)
    
    response = llm.invoke(final_prompt)
    answer_text = response.content.strip()
    return answer_text

def create_vector_index():
    """
    在数据库中创建或更新向量索引以加速查询
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 检查是否已存在索引
            cursor.execute("""
                SELECT indexname FROM pg_indexes 
                WHERE tablename = 'PdfChunk' AND indexname = 'pdf_chunk_embedding_idx'
            """)
            
            index_exists = cursor.fetchone() is not None
            
            if not index_exists:
                print("Creating HNSW vector index for faster similarity search...")
                # 创建HNSW索引，这是一种近似最近邻索引，能显著加速向量搜索
                cursor.execute("""
                    CREATE INDEX pdf_chunk_embedding_idx 
                    ON "PdfChunk" USING hnsw (embedding vector_cosine_ops)
                    WITH (m = 16, ef_construction = 64);
                """)
                conn.commit()
                print("HNSW vector index created successfully.")
            else:
                print("Vector index already exists.")
                
            # 添加pdfPath的索引
            cursor.execute("""
                SELECT indexname FROM pg_indexes 
                WHERE tablename = 'PdfChunk' AND indexname = 'pdf_chunk_path_idx'
            """)
            
            path_index_exists = cursor.fetchone() is not None
            
            if not path_index_exists:
                print("Creating index on pdfPath column...")
                cursor.execute("""
                    CREATE INDEX pdf_chunk_path_idx ON "PdfChunk" ("pdfPath");
                """)
                conn.commit()
                print("pdfPath index created successfully.")
            else:
                print("pdfPath index already exists.")
                
    except Exception as e:
        conn.rollback()
        print(f"Error creating vector index: {str(e)}")
        traceback.print_exc()
    finally:
        conn.close()

# 应用启动时尝试创建向量索引
try:
    create_vector_index()
except Exception as e:
    print(f"Warning: Failed to create vector index: {str(e)}")

@app.route("/query", methods=["POST"])
def query():
    try:
        data = request.get_json()
        if not data or "query" not in data:
            return jsonify({"error": "Missing 'query' in request."}), 400
        print(data)
        user_input = data["query"]
        pdf_name = data.get("pdf_name")
        pdf_path = data.get("pdf_url")  # 获取pdf_path参数
        page_number = data.get("pageNumber")  # 获取当前页码
        quiz_mode = data.get("quiz_mode", False)
        user_id = data.get("user_id", "anonymous")
        user_name = data.get("user_name", "User")
        user_email = data.get("user_email", "N/A")
        pdf_url = data.get("pdf_url")
        use_ann = data.get("use_ann", True)
        
        # 记录更详细的阅读信息
        reading_info = ""
        if pdf_path:
            reading_info += f"PDF路径: {pdf_path}"
        elif pdf_name:
            reading_info += f"PDF名称: {pdf_name}"
            
        if page_number:
            reading_info += f", 当前页码: {page_number}"
            
        print(f"Query received from {user_name} (ID: {user_id}, Email: {user_email}) - {reading_info} - Quiz mode: {quiz_mode}")

   
        if user_id != "anonymous" and pdf_path and page_number is not None:
            update_user_reading_progress(user_id, pdf_path, page_number)

        # Get user-specific memory and personalized prompt
        user_data = get_user_memory(user_id, user_name, user_email)
        memory = user_data["memory"]
        personalized_prompt = user_data["personalized_prompt"]

        # 增强个性化提示，包含当前阅读的文档和页码信息
        if pdf_path or page_number:
            context_info = f"\n\nThe user is currently reading "
            if pdf_path:
                context_info += f"the document at path '{pdf_path}'"
            elif pdf_name:
                context_info += f"the document '{pdf_name}'"
                
            if page_number:
                context_info += f" on page {page_number}"
            
            context_info += "."
            personalized_prompt += context_info

        # 1. 先尝试精准查询当前页
        exact_context = None
        if pdf_path and page_number is not None:
            try:
                conn = get_db_connection()
                with conn.cursor() as cursor:
                    cursor.execute("""
                        SELECT content
                        FROM "PdfChunk"
                        WHERE "pdfPath" = %s AND "pageNumber" = %s
                        LIMIT 1
                    """, (pdf_path, page_number))
                    row = cursor.fetchone()
                conn.close()

                if row:
                    exact_context = f"[{os.path.basename(pdf_path)} - Page {page_number}]: {row[0]}"
                else:
                    exact_context = f"No content found at {pdf_path} page {page_number}."
            except Exception as e:
                print(f"Error fetching exact page: {e}")
                exact_context = "Error fetching page content."

        # 2. 再做向量相似度检索（跨所有 PDF）
        sim_chunks, _ = get_relevant_chunks(user_input, None, None, k=5, allow_fallback=True, use_ann=use_ann)
        similar_contexts = []
        for chunk in sim_chunks:
            p = chunk['metadata']['page']
            p_name = chunk['metadata'].get('pdf_name', 'Unknown')
            p_path = chunk['metadata'].get('pdf_path', 'Unknown')
            content = chunk['content']
            source_info = p_path if p_path and p_path != 'Unknown' else p_name
            similar_contexts.append(f"[{source_info} - Page {p}]: {content}")
        sim_section = "\n---\n".join(similar_contexts) if similar_contexts else "No related content found."

        # 3. 合并成最终 document_context
        if exact_context:
            document_context = (
                f"**Current page content**:\n{exact_context}\n\n"
                f"**Related passages from all documents**:\n{sim_section}"
            )
        else:
            document_context = sim_section

        # 如果真一条都没，就给个提示
        if not document_context.strip():
            document_context = "No relevant context found."

        def generate():
            try:
                if quiz_mode:
                    # Use the quiz generation tool with context
                    answer_text = generate_quiz_question(user_input, personalized_prompt, pdf_name, document_context)
                    yield f"data: {json.dumps({'answer': answer_text})}\n\n"
                else:
                    chat_history_str = "\n".join(
                        msg.content for msg in memory.chat_memory.messages if not isinstance(msg, SystemMessage)
                    )
                    
                    # 构建包含文档详细信息的最终提示
                    final_prompt = f"{personalized_prompt}\n\n"
                    
                    if pdf_path:
                        final_prompt += f"PDF Path: {pdf_path}\n"
                    if pdf_name:
                        final_prompt += f"PDF Name: {pdf_name}\n"
                    if page_number:
                        final_prompt += f"Current Page: {page_number}\n"
                    if pdf_url:
                        final_prompt += f"PDF URL: {pdf_url}\n"
                        
                    final_prompt += f"\nDocument Context:\n{document_context}\n\n"
                    final_prompt += f"Conversation History:\n{chat_history_str}\n\n"
                    final_prompt += f"User: {user_input}\n"
                    final_prompt += f"Assistant:"
                    
                    # Use streaming for the LLM response
                    response = llm.stream(final_prompt)
                    full_answer = ""
                    sentence_buffer = ""
                    
                    print("Starting streaming response...")
                    for chunk in response:
                        if chunk.content:
                            print(f"Received chunk: '{chunk.content}'")
                            sentence_buffer += chunk.content
                            
                            # Check if we have a complete sentence or meaningful chunk
                            if (chunk.content.endswith('.') or 
                                chunk.content.endswith('!') or 
                                chunk.content.endswith('?') or 
                                chunk.content.endswith('\n') or
                                len(sentence_buffer) > 100):  # Send if buffer gets too large
                                
                                if sentence_buffer.strip():
                                    print(f"Yielding sentence: '{sentence_buffer}'")
                                    full_answer += sentence_buffer
                                    yield f"data: {json.dumps({'answer': sentence_buffer})}\n\n"
                                    sentence_buffer = ""
                    
                    # Send any remaining content
                    if sentence_buffer.strip():
                        print(f"Yielding final chunk: '{sentence_buffer}'")
                        full_answer += sentence_buffer
                        yield f"data: {json.dumps({'answer': sentence_buffer})}\n\n"
                    
                    print("Streaming complete. Final answer:", full_answer)
                    
                    # 确定要保存的PDF名称，优先使用pdf_name，如果没有则使用pdf_path的文件名
                    pdf_to_save = pdf_name
                    if not pdf_to_save and pdf_path:
                        pdf_to_save = os.path.basename(pdf_path)
                        
                    # Save the conversation into memory and update user session in DB
                    memory.chat_memory.add_user_message(user_input)
                    memory.chat_memory.add_ai_message(full_answer)
                    create_or_update_user_session(user_id, pdf_to_save, user_input, full_answer)
            except Exception as e:
                print(f"Error in generate function: {str(e)}")
                traceback.print_exc()
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

        return Response(generate(), mimetype='text/event-stream')
    except Exception as e:
        print(f"Error in query function: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500



@app.route("/load_pdf", methods=["POST"])
def load_pdf():
    """
    Load document chunks for a specific PDF file
    """
    data = request.get_json()
    if not data or "pdf_name" not in data:
        return jsonify({"error": "Missing 'pdf_name' in JSON payload."}), 400

    pdf_name = data["pdf_name"]
    
    try:
        global document_chunks
        document_chunks = load_embeddings_from_db(pdf_name)
        return jsonify({
            "status": "success", 
            "message": f"Loaded {len(document_chunks)} document chunks for PDF: {pdf_name}"
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Failed to load PDF: {str(e)}"
        }), 500

@app.route("/session_history", methods=["POST"])
def session_history():
    data = request.get_json()
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "Missing user_id"}), 400

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT id, "pdfname", "conversationhistory", "sessionStartTime", "sessionEndTime"
                FROM "UserSession"
                WHERE "userId" = %s
                ORDER BY "sessionStartTime" DESC
                LIMIT 5
            """, (user_id,))
            rows = cursor.fetchall()

        sessions = []
        for row in rows:
            sessions.append({
                "session_id": row[0],
                "pdf_name": row[1],
                "conversation_history": row[2],
                "session_start": row[3],
                "session_end": row[4],
            })

        return jsonify({"sessions": sessions})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/", methods=["GET"])
def home():
    """
    Home endpoint for testing the server
    """
    return jsonify({
        "status": "ok",
        "message": "Kiwi Bot API is running",
        "endpoints": {
            "/query": "POST - Send queries to the bot",
            "/load_pdf": "POST - Load a specific PDF",
            "/": "GET - Server status"
        }
    })

@app.route("/test", methods=["POST"])
def test():
    """
    Simple test endpoint that doesn't require database access
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Empty request data"}), 400
            
        query = data.get("query", "No query provided")
        return jsonify({
            "status": "ok",
            "received": query,
            "response": f"Echo: {query}"
        })
    except Exception as e:
        return jsonify({"error": f"Test error: {str(e)}"}), 500

@app.route("/generate_quiz", methods=["POST"])
def generate_quiz():
    """
    Generate quiz questions based on a PDF document
    Accepts:
        - pdf_name: Name of the PDF file
        - num_questions: Number of questions to generate (default: 1)
        - difficulty: Difficulty level of the questions (easy, medium, hard)
    Returns:
        - quiz: List of quiz questions with options, correct answers, and explanations
    """
    try:
        # Get and validate input data
        data = request.get_json()
        if not data:
            return jsonify({"error": "Missing request body"}), 400
            
        if "pdf_name" not in data:
            return jsonify({"error": "Missing 'pdf_name' in request."}), 400

        pdf_name = data["pdf_name"]
        num_questions = int(data.get("num_questions", 1))
        difficulty = data.get("difficulty", "medium").lower()
        
        # Validate difficulty
        if difficulty not in ["easy", "medium", "hard"]:
            difficulty = "medium"
        
        print(f"Received quiz request - PDF: {pdf_name}, Questions: {num_questions}, Difficulty: {difficulty}")
        
        # Get document chunks
        try:
            chunks_result = get_relevant_chunks("Important concepts and information", pdf_name, k=15)
            
            # Handle the tuple return value correctly
            if isinstance(chunks_result, tuple):
                chunks, used_fallback = chunks_result
            else:
                chunks = chunks_result
                used_fallback = False
                
            if not chunks:
                return jsonify({
                    "error": f"No content found for PDF: {pdf_name}"
                }), 404
                
            print(f"Found {len(chunks)} chunks of content for quiz generation")
        except Exception as chunk_error:
            print(f"Error getting document chunks: {str(chunk_error)}")
            print(traceback.format_exc())
            return jsonify({
                "error": f"Error retrieving document content: {str(chunk_error)}"
            }), 500
        
        # Compile document context
        document_context = "\n---\n".join(
            f"[Page {chunk['metadata']['page']}]: {chunk['content']}"
            for chunk in chunks
        )
        
        # Create quiz generation prompt
        quiz_prompt = f"""Based on the following content from a lecture, create {num_questions} {difficulty}-level multiple-choice quiz question(s).
        
CONTENT:
{document_context}

For each question:
1. Create a clear, specific question about the content with {difficulty} difficulty
2. Provide 4 options (labeled A, B, C, D)
3. Indicate which option is correct
4. Provide a concise explanation of why the correct answer is correct

Difficulty Guidelines:
- Easy: Basic recall of explicit facts from the text, straightforward questions with obvious answers
- Medium: Understanding of concepts, requiring some analysis or connection between ideas
- Hard: Application of concepts, requiring deeper understanding, analysis, and critical thinking

Format your response as a valid JSON array with this structure:
[
  {{
    "question": "Question text",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "Option X",
    "explanation": "Why this is correct"
  }}
]

Only generate questions specifically about the provided content. If the content is insufficient, return fewer questions.
"""

        # Generate quiz using the LLM
        try:
            print("Sending quiz generation prompt to LLM...")
            response = llm.invoke(quiz_prompt)
            response_text = response.content.strip()
            print(f"Received response from LLM ({len(response_text)} characters)")
        except Exception as llm_error:
            print(f"Error invoking LLM: {str(llm_error)}")
            print(traceback.format_exc())
            return jsonify({
                "error": f"AI model error: {str(llm_error)}"
            }), 500
        
        # Extract JSON from the response (handle potential formatting issues)
        try:
            print("Parsing LLM response as JSON...")
            json_match = re.search(r'\[[\s\S]*\]', response_text)
            if json_match:
                json_str = json_match.group(0)
                quiz_data = json.loads(json_str)
                print(f"Successfully parsed quiz data: {len(quiz_data)} questions")
            else:
                # Fallback if JSON extraction fails
                print("Failed to extract JSON from response")
                return jsonify({
                    "error": "Failed to generate properly formatted quiz questions"
                }), 500
        except json.JSONDecodeError as json_error:
            print(f"JSON parsing error: {str(json_error)}")
            print(f"Response text: {response_text}")
            return jsonify({
                "error": f"Error parsing generated quiz: {str(json_error)}"
            }), 500
        
        return jsonify({
            "quiz": quiz_data
        })
        
    except Exception as e:
        print(f"Error generating quiz: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            "error": f"Failed to generate quiz: {str(e)}"
        }), 500

if __name__ == "__main__":
    app.run(debug=True)