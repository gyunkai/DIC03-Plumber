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
    """
    Create or update the user session, saving the chat history.
    Maintains session continuity even if the user switches PDFs, avoiding session recreation.
    Args:
        user_id (str): User ID
        pdf_name (str): PDF name
        user_input (str): User input
        bot_response (str): Bot response
    """
    if not user_id:
        print("User ID not provided, cannot save session")
        return
        
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 检查是否存在活跃会话
            cursor.execute("""
                SELECT id, "conversationhistory", "pdfname" FROM "UserSession"
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
                session_id, conversation_history, existing_pdf = session
                
                # 如果会话中的PDF与当前不同，记录PDF切换信息
                if existing_pdf != pdf_name:
                    pdf_switch_message = {
                        "timestamp": datetime.utcnow().isoformat(),
                        "sender": "system",
                        "message": f"Switched document: from {existing_pdf} to {pdf_name}"
                    }
                    conversation_history.append(pdf_switch_message)
                    
                    # 更新会话中的PDF名称
                    cursor.execute("""
                        UPDATE "UserSession"
                        SET "pdfname" = %s
                        WHERE id = %s
                    """, (pdf_name, session_id))
                
                # 添加新消息
                conversation_history.append(message_entry_user)
                conversation_history.append(message_entry_bot)

                cursor.execute("""
                    UPDATE "UserSession"
                    SET "conversationhistory" = %s
                    WHERE id = %s
                """, (Json(conversation_history), session_id))

                print(f"Updating existing session {session_id}, now has {len(conversation_history)} messages")

            else:
                # 创建新会话
                session_id = str(uuid.uuid4())
                conversation_history = [message_entry_user, message_entry_bot]

                cursor.execute("""
                    INSERT INTO "UserSession" (id, "userId", "pdfname", "conversationhistory", "sessionStartTime")
                    VALUES (%s, %s, %s, %s, %s)
                """, (session_id, user_id, pdf_name, Json(conversation_history), datetime.utcnow()))

                print(f"Created new session {session_id}")

        conn.commit()
    except Exception as e:
        print(f"Session management error: {e}")
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
    "For each answer, cite your sources from the pages using the format [lecture7.pdf · p8](https://8?file=ml/pdf/lecture7.pdf) — this will be converted into clickable links."
    "The user might ask about content on a specific page of the document, look through it and answer them accordingly. You have access to that page since it is provided."
    "Always include these page references when providing information from the document. "
    "Make your answers helpful and informative while clearly indicating which page contains the information."
    "You have access to both the current document the user is reading AND relevant content from other lecture documents. "
    "Use this to provide more comprehensive answers that connect concepts across different lectures. "
    "Clearly label information as coming from the 'current document' or from 'related documents', so the user understands the source."
    "When referencing content from other documents, make sure to specify both the document name and page number."
    "**If relevant information exists in other documents, combine it with the current one to give the most comprehensive answer.**"
    "This comprehensive approach helps users build a deeper understanding of course concepts by seeing how they relate across different materials."
)

user_memories = {}

def get_user_memory(user_id: str, user_name: str = "User", user_email: str = "N/A"):
    """
    Get or create user's conversation memory. Conversation memory persists throughout the session,
    even if the user switches PDFs, chat history will not be lost.
    
    Args:
        user_id (str): User ID
        user_name (str): User name
        user_email (str): User email
        
    Returns:
        dict: Dictionary containing user memory and personalized prompt
    """
    # 如果用户ID不在内存中，则创建新的记忆对象
    if user_id not in user_memories:
        print(f"Creating new user memory object: {user_id}")
        user_memories[user_id] = {
            "memory": ConversationBufferMemory(memory_key="chat_history", return_messages=True),
            "personalized_prompt": (
                f"{system_prompt}\n\n"
                f"The user's name is {user_name}. "
                f"The user's email address is {user_email}. "
                f"The user's unique ID is {user_id}."
            ),
            "last_access": datetime.utcnow()
        }
        # 初始化记忆对象，添加系统提示
        user_memories[user_id]["memory"].chat_memory.messages.append(
            SystemMessage(content=user_memories[user_id]["personalized_prompt"])
        )
        
        # 尝试从数据库加载历史对话
        try:
            conn = get_db_connection()
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT "conversationhistory" FROM "UserSession"
                    WHERE "userId" = %s AND "sessionEndTime" IS NULL
                    ORDER BY "sessionStartTime" DESC
                    LIMIT 1
                """, (user_id,))
                
                session = cursor.fetchone()
                if session and session[0]:
                    conversation_history = session[0]
                    print(f"Loaded {len(conversation_history)} conversation history entries from database")
                    
                    # 将对话历史添加到记忆对象中
                    for entry in conversation_history:
                        if entry["sender"] == "user":
                            user_memories[user_id]["memory"].chat_memory.add_user_message(entry["message"])
                        elif entry["sender"] == "bot":
                            user_memories[user_id]["memory"].chat_memory.add_ai_message(entry["message"])
            conn.close()
        except Exception as e:
            print(f"Failed to load conversation history: {e}")
    else:
        # 更新最后访问时间
        user_memories[user_id]["last_access"] = datetime.utcnow()

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
    获取与查询相关的文档块，同时结合当前PDF和其他PDF中的内容
    
    Args:
        query (str): 用户查询
        pdf_name (str, optional): PDF名称过滤 (已弃用)
        pdf_path (str, optional): PDF路径过滤
        k (int): 返回的结果数量
        allow_fallback (bool): 如果在指定PDF中找不到，是否回退到全局搜索
        use_ann (bool): 是否使用近似最近邻搜索加速查询
    
    Returns:
        Tuple[List[Dict], bool]: 相关文档块列表和是否使用了回退策略
    """
    query_embedding = embeddings.embed_query(query)
    
    conn = get_db_connection()
    chunks = []
    used_fallback = False
    current_pdf_chunks = []
    other_pdf_chunks = []

    try:
        with conn.cursor() as cursor:
            cursor.execute("SET statement_timeout = 30000;")

            # 选择距离操作符
            distance_op = "<=>"  # cosine distance
            
            # 1. 首先在当前PDF中搜索
            if pdf_path:
                try:
                    sql = f"""
                    SELECT id, content, "pageNumber", "pdfName", "pdfPath", (embedding {distance_op} %s::vector) as distance
                    FROM "PdfChunk"
                    WHERE "pdfPath" = %s
                    ORDER BY distance
                    LIMIT %s;
                    """
                    cursor.execute(sql, (query_embedding, pdf_path, k))
                    rows = cursor.fetchall()
                    
                    # 处理当前PDF的结果
                    for row in rows:
                        # 确保行数据完整
                        if len(row) >= 6:
                            id, content, page_number, pdf, pdf_path, distance = row
                            current_pdf_chunks.append({
                                "id": id,
                                "content": content,
                                "metadata": {
                                    "page": page_number,
                                    "pdf_name": pdf,
                                    "pdf_path": pdf_path,
                                    "source": f"{pdf} - Page {page_number}",
                                    "distance": distance,
                                    "is_current_pdf": True
                                }
                            })
                        else:
                            print(f"Warning: Incomplete row data: {row}")
                except Exception as e:
                    print(f"Current PDF search error: {e}")
                    traceback.print_exc()
            
            # 2. 无论如何，总是尝试搜索其他PDF
            try:
                if pdf_path:
                    sql = f"""
                    SELECT id, content, "pageNumber", "pdfName", "pdfPath", (embedding {distance_op} %s::vector) as distance
                    FROM "PdfChunk"
                    WHERE "pdfPath" != %s
                    ORDER BY distance
                    LIMIT %s;
                    """
                    cursor.execute(sql, (query_embedding, pdf_path, k))
                else:
                    sql = f"""
                    SELECT id, content, "pageNumber", "pdfName", "pdfPath", (embedding {distance_op} %s::vector) as distance
                    FROM "PdfChunk"
                    ORDER BY distance
                    LIMIT %s;
                    """
                    cursor.execute(sql, (query_embedding, k))
                    
                rows = cursor.fetchall()
                
                # 处理其他PDF的结果
                for row in rows:
                    # 确保行数据完整
                    if len(row) >= 6:
                        id, content, page_number, pdf, pdf_path, distance = row
                        other_pdf_chunks.append({
                            "id": id,
                            "content": content,
                            "metadata": {
                                "page": page_number,
                                "pdf_name": pdf,
                                "pdf_path": pdf_path,
                                "source": f"{pdf} - Page {page_number}",
                                "distance": distance,
                                "is_current_pdf": False
                            }
                        })
                    else:
                        print(f"Warning: Incomplete row data: {row}")
            except Exception as e:
                print(f"Other PDF search error: {e}")
                traceback.print_exc()

    except Exception as e:
        print(f"Error in similarity search: {e}")
        traceback.print_exc()
    finally:
        conn.close()
    
    # 3. 合并结果，平衡当前PDF与其他PDF的结果
    # 确保至少包含一些其他PDF的内容
    if len(current_pdf_chunks) > 0 and len(other_pdf_chunks) > 0:
        # 确保结果中至少有30%是其他PDF的内容
        min_other_chunks = max(k // 3, 3)  # 至少3条或三分之一
        
        if len(other_pdf_chunks) > min_other_chunks:
            other_pdf_chunks = other_pdf_chunks[:min_other_chunks]
            
        # 剩余的slots用当前PDF的结果填充
        remaining_slots = k - len(other_pdf_chunks)
        if len(current_pdf_chunks) > remaining_slots:
            current_pdf_chunks = current_pdf_chunks[:remaining_slots]
            
        # 先添加当前PDF的内容，再添加其他PDF的内容
        chunks = current_pdf_chunks + other_pdf_chunks
    else:
        # 如果只有一种类型的结果，就全部使用
        chunks = current_pdf_chunks + other_pdf_chunks
        
    # 按相似度重新排序
    chunks.sort(key=lambda x: x['metadata'].get('distance', 1.0))
    
    # 如果使用了非当前PDF的内容，标记为使用了回退
    if other_pdf_chunks and len(other_pdf_chunks) > 0:
        used_fallback = True
    
    # 保证返回指定数量的结果
    return chunks[:k], used_fallback


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
    Get document context relevant to the query
    
    Args:
        query (str): User query
        pdf_name (str, optional): PDF name filter (no longer used)
        pdf_path (str, optional): PDF path filter
        use_ann (bool): Whether to use approximate nearest neighbor search (no longer used)
    
    Returns:
        str: Relevant document context
    """
    print(f"Getting document context: query='{query}', PDF path='{pdf_path}'")
    
    # 1. Get relevant document chunks - limit quantity to prevent exceeding context window
    max_chunks = 15  # Reduced from 30 to 15
    relevant_chunks, used_fallback = get_relevant_chunks(query, None, pdf_path, k=max_chunks, allow_fallback=True)
    
    # If no relevant content found
    if not relevant_chunks:
        return "No relevant document content found."
    
    # 2. Format relevant document chunks
    formatted_chunks = []
    
    # If fallback strategy was used, add notice
    if used_fallback:
        fallback_note = "**Note:** No exact matches found in current document. Showing related content from other documents.\n\n"
        formatted_chunks.append(fallback_note)
    
    # Format each document chunk, add page links
    for chunk in relevant_chunks:
        page_number = chunk['metadata'].get('page', 'unknown')
        content = chunk['content']
        doc_path = chunk['metadata'].get('pdf_path', '')
        doc_name = chunk['metadata'].get('pdf_name', '')
        
        # Create page link with clickable format, using inline mode
        source_name = os.path.basename(doc_path) if doc_path else doc_name
        
        # Use inline prefix to indicate opening in current page
        # Process PDF path to remove public/ prefix
        clean_path = doc_path
        if clean_path and clean_path.startswith('public/'):
            clean_path = clean_path[7:]  # Remove public/ prefix
            
        # Ensure slashes in the link are forward slashes
        if clean_path:
            clean_path = clean_path.replace('\\', '/')
            
        # Add 1 to page number to match what user sees
        display_page = page_number + 1 if isinstance(page_number, int) else page_number
            
        # Add quotes to ensure special characters are escaped
        page_info = f"[{source_name} - Page {display_page}](https://{display_page}?file={clean_path})"
        
        # Add to formatted chunks
        formatted_chunks.append(f"{page_info}: {content}")
    
    # 3. Combine and return final result
    result = "\n---\n".join(formatted_chunks)
    
    # 4. If result is too long, truncate it
    if len(result) > 10000:  # About 3000 tokens
        print(f"Document context too long ({len(result)} characters), truncating...")
        result = result[:10000] + "\n\n[Content too long, truncated]"
    
    print(f"Found {len(relevant_chunks)} relevant document chunks, total length: {len(result)} characters")
    
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

def generate_quiz_question(user_input, personalized_prompt, document_context):
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
        pdf_path = data.get("pdf_url")  # 获取pdf_path参数
        if not pdf_path:
            pdf_path = data.get("pdf_path")  # 尝试备用参数名
        page_number = data.get("pageNumber")  # 获取当前页码
        quiz_mode = data.get("quiz_mode", False)
        user_id = data.get("user_id", "anonymous")
        user_name = data.get("user_name", "User")
        user_email = data.get("user_email", "N/A")
        pdf_url = data.get("pdf_url")
        use_ann = data.get("use_ann", True)
        reset_context = data.get("reset_context", False)  # 添加是否重置上下文的参数
        
        if page_number is not None:
            page_number = page_number - 1  # 页码调整
        
        # 记录更详细的阅读信息
        reading_info = ""
        if pdf_path:
            reading_info += f"PDF路径: {pdf_path}"
            
        if page_number:
            reading_info += f", 当前页码: {page_number}"
            
        print(f"Query received from {user_name} (ID: {user_id}, Email: {user_email}) - {reading_info} - Quiz mode: {quiz_mode}")
        print(f"请求数据: {data}")  # 打印完整请求数据以便调试

        # 如果需要重置上下文，先删除现有记忆 -> If context reset is requested, delete existing memory first
        if reset_context and user_id in user_memories:
            print(f"Resetting conversation context for user {user_id}")
            del user_memories[user_id]
            
        # Get user-specific memory and personalized prompt
        user_data = get_user_memory(user_id, user_name, user_email)
        memory = user_data["memory"]
        personalized_prompt = user_data["personalized_prompt"]

        # 增强个性化提示，包含当前阅读的文档和页码信息
        if pdf_path or page_number:
            context_info = f"\n\nThe user is currently reading "
            if pdf_path:
                context_info += f"the document at path '{pdf_path}'"
                
            if page_number:
                context_info += f" on page {page_number}"
            
            context_info += "."
            personalized_prompt += context_info

        # 获取文档上下文
        document_context = ""
        
        # 1. 先尝试精准查询当前页
        exact_context = None
        if pdf_path and page_number is not None:
            try:
                # 确保pdf_path有正确的前缀
                if pdf_path and not pdf_path.startswith('public/'):
                    pdf_path_with_prefix = 'public/' + pdf_path
                else:
                    pdf_path_with_prefix = pdf_path
                    
                conn = get_db_connection()
                with conn.cursor() as cursor:
                    # 先列出示例路径以便调试
                    cursor.execute('SELECT "pdfPath" FROM "PdfChunk" LIMIT 10')
                    paths = cursor.fetchall()
                    print(f"Incoming path: '{pdf_path}'")
                    print(f"Path after adding prefix: '{pdf_path_with_prefix}'")
                    print(f"Database paths: {paths}")
                    
                    print(f"Query parameters: pdf_path={pdf_path_with_prefix}, page_number={page_number}, Types: {type(pdf_path_with_prefix)}, {type(page_number)}")
                    cursor.execute("""
                        SELECT content
                        FROM "PdfChunk"
                        WHERE "pdfPath" = %s AND "pageNumber" = %s
                        LIMIT 1
                    """, (pdf_path_with_prefix, page_number))
                    row = cursor.fetchone()
                conn.close()

                if row:
                    # 确保路径格式正确 - 移除public/前缀
                    clean_path = pdf_path
                    if clean_path and clean_path.startswith('public/'):
                        clean_path = clean_path[7:]  # 移除public/前缀
                    
                    # 确保链接中使用正斜杠
                    if clean_path:
                        clean_path = clean_path.replace('\\', '/')
                    
                    # 页码+1以匹配用户看到的页码
                    display_page = page_number + 1 if isinstance(page_number, int) else page_number
                    
                    exact_context = f"[{os.path.basename(pdf_path)} - Page {display_page}](https://{display_page}?file={clean_path}): {row[0]}"
                else:
                    exact_context = f"No content found at {pdf_path_with_prefix} page {page_number}."
            except Exception as e:
                print(f"Error fetching exact page: {e}")
                traceback.print_exc()
                exact_context = "Error fetching page content."

        # 2. 再做向量相似度检索（跨所有 PDF）
        # 确保向量检索也使用正确的路径前缀
        search_pdf_path = None
        if pdf_path:
            # 首先尝试提取基本文件名，避免路径格式不一致的问题
            base_name = os.path.basename(pdf_path)
            # 检查是否需要添加前缀
            if not pdf_path.startswith('public/'):
                search_pdf_path = 'public/' + pdf_path
            else:
                search_pdf_path = pdf_path
                
            print(f"原始路径: {pdf_path}, 基本文件名: {base_name}, 搜索路径: {search_pdf_path}")
            
        # 使用指定的PDF路径进行搜索，同时允许回退到全局搜索
        # 限制检索数量以避免上下文长度过长
        max_chunks = 15  # 减少从30到15
        sim_chunks, used_fallback = get_relevant_chunks(user_input, None, search_pdf_path, k=max_chunks, allow_fallback=True, use_ann=use_ann)
        
        # 格式化向量搜索结果
        similar_contexts = []
        current_pdf_contexts = []
        other_pdf_contexts = []
        
        # 如果有结果，添加引导性说明 -> If there are results, add an introductory note
        if sim_chunks:
            fallback_note = "**Query results include content from multiple documents:**\\n\\n"
            
        for chunk in sim_chunks:
            p = chunk['metadata']['page']
            p_path = chunk['metadata'].get('pdf_path', 'Unknown')
            p_name = chunk['metadata'].get('pdf_name', 'Unknown')
            is_current_pdf = chunk['metadata'].get('is_current_pdf', False)
            content = chunk['content']
            
            # 获取文档名称，优先使用文件名，没有则使用PDF名称
            doc_name = os.path.basename(p_path) if p_path else p_name
            
            # 确保路径格式正确 - 移除public/前缀
            clean_path = p_path
            if clean_path and clean_path.startswith('public/'):
                clean_path = clean_path[7:]  # 移除public/前缀
            
            # 确保链接中使用正斜杠
            if clean_path:
                clean_path = clean_path.replace('\\', '/')
            
            # 将页码+1，使其与用户看到的页码一致
            display_page = p + 1 if isinstance(p, int) else p
            
            # 添加可点击的页面链接
            page_info = f"[{doc_name} - Page {display_page}](https://{display_page}?file={clean_path})"
            
            # 根据来源分类
            if is_current_pdf:
                current_pdf_contexts.append(f"{page_info}: {content}")
            else:
                other_pdf_contexts.append(f"{page_info}: {content}")
            
        # 如果有当前PDF的内容，先添加 -> If there is content from the current PDF, add it first
        if current_pdf_contexts:
            similar_contexts.append("**Current document content:**\\n" + "\\n---\\n".join(current_pdf_contexts))
        
        # 如果有其他PDF的内容，再添加，并确保它们有明显的标注 -> If there is content from other PDFs, add it next, ensuring clear labeling
        if other_pdf_contexts:
            # 根据文件名分组 -> Group by filename
            grouped_contexts = {}
            for ctx in other_pdf_contexts:
                # 提取文件名
                match = re.search(r'\[(.*?) -', ctx)
                if match:
                    file_name = match.group(1)
                    grouped_contexts.setdefault(file_name, []).append(ctx)
            
            # 添加每组内容 -> Add content for each group
            for file_name, contexts in grouped_contexts.items():
                similar_contexts.append(f"**Related document [{file_name}] content:**\\n" + "\\n---\\n".join(contexts))
            
        sim_section = fallback_note + "\\n\\n".join(similar_contexts) if similar_contexts else "No related content."

        # 3. 合并成最终 document_context -> Merge into the final document_context
        if exact_context:
            document_context = (
                f"**Current page content**:\n{exact_context}\n\n"
                f"**Related passages from all documents**:\n{sim_section}"
            )
        else:
            document_context = sim_section

        # 如果真一条都没，就给个提示 -> If truly nothing was found, provide a hint
        if not document_context.strip():
            document_context = "No relevant context found."

        def generate():
            try:
                if quiz_mode:
                    # Use the quiz generation tool with context
                    answer_text = generate_quiz_question(user_input, personalized_prompt, document_context)
                    yield f"data: {json.dumps({'answer': answer_text})}\n\n"
                else:
                    # 更新系统提示，包含文档内容
                    if document_context:
                        system = f"""You are a professional assistant named Kiwi. You will answer the user's questions about the following documents:

{document_context}

Please adhere to the following requirements:
1. If content from multiple documents is provided, analyze the relevant information from all documents comprehensively, paying special attention to connections, additions, and conflicts between documents.
2. When there are conflicts between different documents, clearly point out these conflicts and explain the viewpoints from each source.
3. Answer based solely on the document content; do not use your own knowledge.
4. If the document content does not contain relevant information, honestly state that you cannot answer.
5. When citing specific documents, clearly indicate the document name as the source of the information.
6. Provide answers that are as comprehensive, accurate, and clearly structured as possible.
7. If the user's question is outside the scope of the documents, politely decline to answer.

Remember, integrating relevant information from different documents is very important. Clearly indicate the source of each piece of information to provide the user with a more complete and reliable answer."""
                    else:
                        system = f"""You are a professional assistant named Kiwi. Please do your best to answer the user's questions.

If you cannot answer based on the available information, honestly inform the user and suggest they provide more relevant information or upload related documents."""
                    
                    # 构建最终提示，不包含对话历史
                    final_prompt = f"{system}\\n\\n"
                    
                    if pdf_path:
                        final_prompt += f"PDF Path: {pdf_path}\n"
                    if page_number:
                        final_prompt += f"Current Page: {page_number}\n"
                    if pdf_url:
                        final_prompt += f"PDF URL: {pdf_url}\n"
                        
                    final_prompt += f"\nDocument Context:\n{document_context}\n\n"
                    # 移除对话历史部分
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
                                len(sentence_buffer) > 80):  # 降低阈值以更频繁发送
                                
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
                    
                    # 发送完成信号
                    yield f"data: {json.dumps({'complete': True, 'answer_length': len(full_answer)})}\n\n"
                    
                    print("Streaming complete. Final answer:", full_answer)
                    
                    # 确定要保存的PDF名称
                    pdf_to_save = os.path.basename(pdf_path) if pdf_path else "unknown"
                        
                    # 不再保存对话历史
                    # memory.chat_memory.add_user_message(user_input)
                    # memory.chat_memory.add_ai_message(full_answer)
                    # create_or_update_user_session(user_id, pdf_to_save, user_input, full_answer)
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
    Load document chunks for a specified PDF file
    """
    data = request.get_json()
    if not data or ("pdf_path" not in data and "pdf_name" not in data):
        return jsonify({"error": "Missing 'pdf_path' or 'pdf_name' parameter in request"}), 400

    # 优先使用pdf_path，兼容旧版本 -> Prioritize pdf_path, compatible with older versions
    pdf_path = data.get("pdf_path")
    pdf_name = data.get("pdf_name")
    
    # 添加路径前缀处理
    if pdf_path and not pdf_path.startswith('public/'):
        pdf_path = 'public/' + pdf_path
    
    try:
        conn = get_db_connection()
        chunks = []
        
        with conn.cursor() as cursor:
            if pdf_path:
                # 通过路径查询
                cursor.execute("""
                    SELECT id, content, "pageNumber", "pdfPath", "pdfName"
                    FROM "PdfChunk"
                    WHERE "pdfPath" = %s
                    ORDER BY "pageNumber"
                    LIMIT 100
                """, (pdf_path,))
                target = pdf_path
            else:
                # 通过名称查询(兼容旧版)
                cursor.execute("""
                    SELECT id, content, "pageNumber", "pdfPath", "pdfName"
                    FROM "PdfChunk"
                    WHERE "pdfName" = %s
                    ORDER BY "pageNumber"
                    LIMIT 100
                """, (pdf_name,))
                target = pdf_name
            
            rows = cursor.fetchall()
            
            for row in rows:
                id, content, page_number, path, name = row
                chunks.append({
                    "id": id,
                    "content": content,
                    "metadata": {
                        "page": page_number,
                        "pdf_path": path,
                        "pdf_name": name,
                        "source": f"{path} - Page {page_number}"
                    }
                })
        
        conn.close()
        
        # 按页码排序 -> Sort by page number
        chunks.sort(key=lambda x: x['metadata']['page'])
        
        return jsonify({
            "status": "success", 
            "message": f"Loaded {len(chunks)} document chunks for: {target}"
        })
    except Exception as e:
        print(f"Error loading PDF: {str(e)}")
        traceback.print_exc()
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
    Accepts parameters:
        - pdf_path: Path to the PDF file
        - num_questions: Number of questions to generate (default: 1)
        - difficulty: Question difficulty (easy, medium, hard)
    Returns:
        - quiz: List of quiz questions including options, correct answer, and explanation
    """
    """
    Generate quiz questions based on a PDF document
    Accepts parameters:
        - pdf_path: Path to the PDF file
        - num_questions: Number of questions to generate (default: 1)
        - difficulty: Question difficulty (easy, medium, hard)
    Returns:
        - quiz: List of quiz questions including options, correct answer, and explanation
    """
    try:
        # 获取并验证输入数据 -> Get and validate input data
        data = request.get_json()
        if not data:
            return jsonify({"error": "Missing request data"}), 400
            
        if "pdf_path" not in data:
            return jsonify({"error": "Missing 'pdf_path' parameter"}), 400

        pdf_path = data["pdf_path"]
        # 添加路径前缀处理 -> Add path prefix handling
        if pdf_path and not pdf_path.startswith('public/'):
            pdf_path = 'public/' + pdf_path
            
        num_questions = int(data.get("num_questions", 1))
        difficulty = data.get("difficulty", "medium").lower()
        
        # 验证难度级别 -> Validate difficulty level
        if difficulty not in ["easy", "medium", "hard"]:
            difficulty = "medium"
        
        print(f"Received quiz request - PDF Path: {pdf_path}, Num Questions: {num_questions}, Difficulty: {difficulty}")
        
        # 获取文档块 -> Get document chunks
        try:
            chunks_result = get_relevant_chunks("Key concepts and information", None, pdf_path, k=15)
            
            # 正确处理返回值 -> Correctly handle return value
            if isinstance(chunks_result, tuple):
                chunks, used_fallback = chunks_result
            else:
                chunks = chunks_result
                used_fallback = False
                
            if not chunks:
                return jsonify({
                    "error": f"Could not find PDF content for: {pdf_path}"
                }), 404
                
            print(f"Found {len(chunks)} content chunks for quiz generation")
        except Exception as chunk_error:
            print(f"Error getting document chunks: {str(chunk_error)}")
            print(traceback.format_exc())
            return jsonify({
                "error": f"Failed to get document content: {str(chunk_error)}"
            }), 500
        
        # 编译文档上下文 -> Compile document context
        document_context = "\n---\n".join(
            f"[{chunk['metadata']['pdf_path']} - Page {chunk['metadata']['page']}]: {chunk['content']}"
            for chunk in chunks
        )
        
        # 创建测验生成提示 -> Create quiz generation prompt
        quiz_prompt = f"""Based on the following document content, create {num_questions} multiple-choice questions at {difficulty} difficulty level.
        
Content:
{document_context}

Each question should:
1. Create a clear and specific {difficulty} difficulty question about the content.
2. Provide 4 options (labeled A, B, C, D).
3. Indicate which option is correct.
4. Provide a concise explanation of why the answer is correct.

Difficulty Guide:
- Easy: Basic recall of explicit facts from the text, direct questions with obvious answers.
- Medium: Conceptual understanding, requiring some analysis or connection of different ideas.
- Hard: Application of concepts, requiring deeper understanding, analysis, and critical thinking.

Please return in a valid JSON array format with the following structure:
[
  {{
    "question": "Question text",
    "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
    "correctAnswer": "Option X",
    "explanation": "Why this is the correct answer"
  }}
]

Only generate specific questions about the provided content. If the content is insufficient, you may return fewer questions.
"""

        # 使用LLM生成测验 -> Generate quiz using LLM
        try:
            print("Sending quiz generation prompt to LLM...")
            response = llm.invoke(quiz_prompt)
            response_text = response.content.strip()
            print(f"Received LLM response ({len(response_text)} characters)")
        except Exception as llm_error:
            print(f"Error calling LLM: {str(llm_error)}")
            print(traceback.format_exc())
            return jsonify({
                "error": f"AI model error: {str(llm_error)}"
            }), 500
        
        # 从响应中提取JSON (处理潜在的格式问题) -> Extract JSON from response (handle potential formatting issues)
        try:
            print("Parsing LLM response as JSON...")
            json_match = re.search(r'\[[\s\S]*\]', response_text)
            if json_match:
                json_str = json_match.group(0)
                quiz_data = json.loads(json_str)
                print(f"Successfully parsed quiz data: {len(quiz_data)} questions")
            else:
                # JSON提取失败的后备方案 -> Fallback if JSON extraction fails
                print("Could not extract JSON from response")
                return jsonify({
                    "error": "Could not generate correctly formatted quiz questions"
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