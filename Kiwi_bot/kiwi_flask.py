import os
import glob
from flask import Flask, request, jsonify, Response, send_file
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain.memory import ConversationBufferMemory
from langchain.prompts import PromptTemplate
from langchain.schema import SystemMessage
import numpy as np
import json
from psycopg2.extras import Json
from datetime import datetime
from typing import List, Dict, Optional
import psycopg2
from psycopg2.extras import Json
from urllib.parse import urlparse
from dotenv import load_dotenv, find_dotenv
from pathlib import Path
import time
import traceback
import uuid
import openai
import tempfile
from flask_cors import CORS
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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

# Configure CORS to allow requests from Next.js development server
CORS(app, resources={
    r"/*": {
        "origins": [
            "http://localhost:3000",  # Next.js development server
            "http://127.0.0.1:3000",
        ],
        "methods": ["POST", "GET", "OPTIONS"],
        "allow_headers": ["Content-Type", "Accept"],
    }
})

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
    "Please space out paragrahs"
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

def get_relevant_chunks(query: str, pdf_name: str = None, k: int = 5, allow_fallback: bool = True) -> List[Dict]:
    query_embedding = embeddings.embed_query(query)
    
    conn = get_db_connection()
    chunks = []
    used_fallback = False

    try:
        with conn.cursor() as cursor:
            cursor.execute("SET statement_timeout = 30000;")

            # First: try within the specified PDF
            if pdf_name:
                sql = """
                SELECT id, content, "pageNumber", "pdfName", (embedding <=> %s::vector) as distance
                FROM "PdfChunk"
                WHERE "pdfName" = %s
                ORDER BY embedding <=> %s::vector
                LIMIT %s;
                """
                cursor.execute(sql, (query_embedding, pdf_name, query_embedding, k))
                rows = cursor.fetchall()

                if not rows and allow_fallback:
                    # Fallback: search across ALL PDFs
                    used_fallback = True
                    print(f"⚠️ No matches in {pdf_name}. Falling back to global search.")
                    sql = """
                    SELECT id, content, "pageNumber", "pdfName", (embedding <=> %s::vector) as distance
                    FROM "PdfChunk"
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s;
                    """
                    cursor.execute(sql, (query_embedding, query_embedding, k))
                    rows = cursor.fetchall()
            else:
                # Default to global search if no PDF name provided
                sql = """
                SELECT id, content, "pageNumber", "pdfName", (embedding <=> %s::vector) as distance
                FROM "PdfChunk"
                ORDER BY embedding <=> %s::vector
                LIMIT %s;
                """
                cursor.execute(sql, (query_embedding, query_embedding, k))
                rows = cursor.fetchall()

            for row in rows:
                id, content, page_number, pdf, distance = row
                chunks.append({
                    "id": id,
                    "content": content,
                    "metadata": {
                        "page": page_number,
                        "pdf_name": pdf,
                        "source": f"{pdf} - Page {page_number}",
                        "distance": distance
                    }
                })

    except Exception as e:
        print(f"Error in similarity search: {e}")
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

def get_document_context(query: str) -> str:
    """
    Get relevant document context for a query
    Args:
        query (str): User query
    Returns:
        str: Relevant document context
    """
    # If no document chunks are loaded, try to reload from database
    global document_chunks
    
    print(f"get_document_context called with query: {query}")
    print(f"Current document_chunks length: {len(document_chunks) if document_chunks else 0}")
    
    if not document_chunks:
        try:
            document_chunks = load_embeddings_from_db()
            print(f"Re-loaded {len(document_chunks)} document chunks from database")
        except Exception as e:
            print(f"Error re-loading document chunks: {str(e)}")
            return "No document context available."
    
    if not document_chunks:
        print("WARNING: document_chunks is still empty after reload attempt")
        return "No document context available."
        
    # Get PDF name from first chunk if available
    pdf_name = None
    if document_chunks and len(document_chunks) > 0 and 'metadata' in document_chunks[0]:
        pdf_name = document_chunks[0].get('metadata', {}).get('pdf_name')
    
    # Get relevant chunks using similarity search
    relevant_chunks, used_fallback = get_relevant_chunks(query, pdf_name)
    print(f"Found {len(relevant_chunks)} relevant chunks for query")
    
    # Format relevant chunks with page information
    formatted_chunks = []
    for i, chunk in enumerate(relevant_chunks):
        page_number = chunk['metadata'].get('page', 'unknown')
        content = chunk['content']  # ✅ Define content properly
        page_info = f"[Page {page_number}]"
        formatted_chunks.append(f"{page_info}: {content}")  # ✅ Use content properly
        print(f"Chunk {i}: Page {page_number}, Content length: {len(content)}")
    
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


@app.route("/query", methods=["POST"])
def query():
    try:
        data = request.get_json()
        if not data or "query" not in data:
            return jsonify({"error": "Missing 'query' in request."}), 400
        print(data)
        user_input = data["query"]
        pdf_name = data.get("pdf_name")
        quiz_mode = data.get("quiz_mode", False)
        user_id = data.get("user_id", "anonymous")
        user_name = data.get("user_name", "User")
        user_email = data.get("user_email", "N/A")
        pdf_url = data.get("pdf_url")
        print(f"Query received from {user_name} (ID: {user_id}, Email: {user_email}) for PDF: {pdf_name} - Quiz mode: {quiz_mode} - URL: {pdf_url}")

        # Get user-specific memory and personalized prompt
        user_data = get_user_memory(user_id, user_name, user_email)
        memory = user_data["memory"]
        personalized_prompt = user_data["personalized_prompt"]

        # Compute document context regardless of quiz mode
        relevant_chunks, used_fallback = get_relevant_chunks(user_input, pdf_name)
        if not relevant_chunks:
            document_context = "No relevant context found."
        else:
            fallback_note = ""
            if used_fallback:
                fallback_note = (
                    "**Note:** No relevant content found in the current lecture. "
                    "The following information comes from other lectures.\n\n"
                )
            
            # Format chunks with proper page references
            formatted_chunks = []
            for chunk in relevant_chunks:
                page_number = chunk['metadata'].get('page', 'unknown')
                pdf_source = chunk['metadata'].get('pdf_name', '')
                content = chunk['content']
                page_info = f"[Page {page_number}](page://{page_number})"
                if used_fallback:
                    page_info = f"[{pdf_source} - Page {page_number}](page://{page_number})"
                formatted_chunks.append(f"{page_info}: {content}")
            
            document_context = fallback_note + "\n---\n".join(formatted_chunks)

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
                    final_prompt = (
                        f"{personalized_prompt}\n\n"
                        f"Pdf key: {pdf_url}\n\n"
                        f"Document Context:\n{document_context}\n\n"
                        f"Conversation History:\n{chat_history_str}\n\n"
                        f"User: {user_input}\n"
                        f"Assistant:"
                    )
                    
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
                    # Save the conversation into memory and update user session in DB
                    memory.chat_memory.add_user_message(user_input)
                    memory.chat_memory.add_ai_message(full_answer)
                    create_or_update_user_session(user_id, pdf_name, user_input, full_answer)
            except Exception as e:
                print(f"Error in generate function: {str(e)}")
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

        return Response(generate(), mimetype='text/event-stream')
    except Exception as e:
        print(f"Error in query function: {str(e)}")
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

# Constants
MAX_AUDIO_FILES = 10
MAX_IMAGES = 10
AUDIO_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'audio')
IMAGE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'images')

# Ensure directories exist
os.makedirs(AUDIO_DIR, exist_ok=True)
os.makedirs(IMAGE_DIR, exist_ok=True)

# Initialize OpenAI client
openai.api_key = os.getenv("OPENAI_API_KEY")

# Available voices and models
AVAILABLE_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]
AVAILABLE_MODELS = ["tts-1", "tts-1-hd"]

def manage_audio_files():
    """Manage audio files to maintain the maximum limit"""
    try:
        # Get all audio files
        audio_files = glob.glob(os.path.join(AUDIO_DIR, '*.mp3'))
        
        # If we're over the limit, remove the oldest files
        if len(audio_files) >= MAX_AUDIO_FILES:
            # Sort files by modification time (oldest first)
            audio_files.sort(key=os.path.getmtime)
            # Calculate how many files to remove
            files_to_remove = len(audio_files) - MAX_AUDIO_FILES + 1
            # Remove the oldest files
            for file_path in audio_files[:files_to_remove]:
                try:
                    os.remove(file_path)
                    logger.info(f"Removed old audio file: {file_path}")
                except Exception as e:
                    logger.error(f"Error removing old audio file {file_path}: {e}")
    except Exception as e:
        logger.error(f"Error managing audio files: {e}")

def manage_image_files():
    """Manage image files to maintain the maximum limit"""
    try:
        # Get all image files
        image_files = glob.glob(os.path.join(IMAGE_DIR, '*.txt'))
        
        # If we're over the limit, remove the oldest files
        if len(image_files) >= MAX_IMAGES:
            # Sort files by modification time (oldest first)
            image_files.sort(key=os.path.getmtime)
            # Calculate how many files to remove
            files_to_remove = len(image_files) - MAX_IMAGES + 1
            # Remove the oldest files
            for file_path in image_files[:files_to_remove]:
                try:
                    os.remove(file_path)
                    logger.info(f"Removed old image file: {file_path}")
                except Exception as e:
                    logger.error(f"Error removing old image file {file_path}: {e}")
    except Exception as e:
        logger.error(f"Error managing image files: {e}")

def text_to_speech(
    text: str,
    voice: str = "alloy",
    model: str = "tts-1",
    speed: float = 1.0
) -> bytes:
    """
    Convert text to speech using OpenAI's TTS API
    Args:
        text (str): Text to convert to speech
        voice (str): Voice to use (alloy, echo, fable, onyx, nova, shimmer)
        model (str): Model to use (tts-1 or tts-1-hd)
        speed (float): Speed multiplier (0.25 to 4.0)
    Returns:
        bytes: Audio data
    """
    try:
        # Validate inputs
        if voice not in AVAILABLE_VOICES:
            raise ValueError(f"Invalid voice. Must be one of: {', '.join(AVAILABLE_VOICES)}")
        if model not in AVAILABLE_MODELS:
            raise ValueError(f"Invalid model. Must be one of: {', '.join(AVAILABLE_MODELS)}")
        if not 0.25 <= speed <= 4.0:
            raise ValueError("Speed must be between 0.25 and 4.0")

        logger.info(f"Generating speech for text (length: {len(text)}) with voice: {voice}, model: {model}, speed: {speed}")
        
        response = openai.audio.speech.create(
            model=model,
            voice=voice,
            input=text,
            speed=speed
        )
        
        logger.info("Speech generation successful")
        return response.content
    except Exception as e:
        logger.error(f"Error in text_to_speech: {e}")
        raise

def generate_image(
    prompt: str,
    size: str = "1024x1024",
    quality: str = "standard",
    style: str = "vivid"
) -> str:
    """
    Generate an image using OpenAI's DALL-E API
    Args:
        prompt (str): Text description of the image to generate
        size (str): Image size (1024x1024, 1792x1024, or 1024x1792)
        quality (str): Image quality (standard or hd)
        style (str): Image style (vivid or natural)
    Returns:
        str: URL of the generated image
    """
    try:
        # Validate inputs
        valid_sizes = ["1024x1024", "1792x1024", "1024x1792"]
        if size not in valid_sizes:
            raise ValueError(f"Invalid size. Must be one of: {', '.join(valid_sizes)}")
        
        if quality not in ["standard", "hd"]:
            raise ValueError("Quality must be either 'standard' or 'hd'")
        
        if style not in ["vivid", "natural"]:
            raise ValueError("Style must be either 'vivid' or 'natural'")

        logger.info(f"Generating image for prompt: {prompt} with size: {size}, quality: {quality}, style: {style}")
        
        response = openai.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size=size,
            quality=quality,
            style=style,
            n=1
        )
        
        image_url = response.data[0].url
        logger.info("Image generation successful")
        return image_url
    except Exception as e:
        logger.error(f"Error in generate_image: {e}")
        raise

@app.route('/tts', methods=['POST'])
def generate_speech():
    """Generate speech from text using OpenAI TTS"""
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({'error': 'Missing text in request'}), 400

        text = data['text']
        voice = data.get('voice', 'alloy')
        model = data.get('model', 'tts-1')
        speed = float(data.get('speed', 1.0))

        # Generate speech
        audio_data = text_to_speech(text, voice, model, speed)

        # Create a temporary file to store the audio
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as temp_file:
            temp_file.write(audio_data)
            temp_file_path = temp_file.name

        # Return the audio file
        return send_file(
            temp_file_path,
            mimetype='audio/mpeg',
            as_attachment=True,
            download_name='speech.mp3'
        )

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error generating speech: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        # Clean up the temporary file
        if 'temp_file_path' in locals():
            try:
                os.unlink(temp_file_path)
            except Exception as e:
                logger.error(f"Error cleaning up temp file: {e}")

@app.route('/tts/stream', methods=['POST'])
def stream_speech():
    """Stream speech generation for real-time playback"""
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({'error': 'Missing text in request'}), 400

        text = data['text']
        voice = data.get('voice', 'alloy')
        model = data.get('model', 'tts-1')
        speed = float(data.get('speed', 1.0))

        # Generate speech
        audio_data = text_to_speech(text, voice, model, speed)
        logger.info(f"Generated audio data size: {len(audio_data)} bytes")

        # Save audio file for debugging
        try:
            # Manage existing audio files before saving new one
            manage_audio_files()
            
            # Generate filename with timestamp
            timestamp = int(time.time())
            filename = f"tts_{timestamp}.mp3"
            file_path = os.path.join(AUDIO_DIR, filename)
            
            # Save the audio file
            with open(file_path, 'wb') as f:
                f.write(audio_data)
            logger.info(f"Saved audio file: {file_path}")
        except Exception as e:
            logger.error(f"Error saving audio file: {e}")
            # Continue even if saving fails

        # Create a response with the audio data
        response = Response(
            audio_data,
            mimetype='audio/mpeg',
            headers={
                'Content-Type': 'audio/mpeg',
                'Cache-Control': 'no-cache',
                'Access-Control-Allow-Origin': '*'
            }
        )
        
        return response

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error streaming speech: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/tts/voices', methods=['GET'])
def get_available_voices():
    """Get list of available voices"""
    return jsonify({
        'voices': AVAILABLE_VOICES,
        'models': AVAILABLE_MODELS
    })

@app.route('/image/generate', methods=['POST'])
def create_image():
    """Generate an image from text using OpenAI DALL-E"""
    try:
        data = request.get_json()
        if not data or 'prompt' not in data:
            return jsonify({'error': 'Missing prompt in request'}), 400

        prompt = data['prompt']
        size = data.get('size', '1024x1024')
        quality = data.get('quality', 'standard')
        style = data.get('style', 'vivid')

        # Generate image
        image_url = generate_image(prompt, size, quality, style)

        # Save image URL to a file for reference
        try:
            # Manage existing image files before saving new one
            manage_image_files()
            
            # Generate filename with timestamp
            timestamp = int(time.time())
            filename = f"image_{timestamp}.txt"
            file_path = os.path.join(IMAGE_DIR, filename)
            
            # Save the image URL
            with open(file_path, 'w') as f:
                f.write(f"Prompt: {prompt}\n")
                f.write(f"URL: {image_url}\n")
                f.write(f"Size: {size}\n")
                f.write(f"Quality: {quality}\n")
                f.write(f"Style: {style}\n")
            logger.info(f"Saved image reference: {file_path}")
        except Exception as e:
            logger.error(f"Error saving image reference: {e}")
            # Continue even if saving fails

        return jsonify({
            'url': image_url,
            'prompt': prompt,
            'size': size,
            'quality': quality,
            'style': style
        })

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error generating image: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/image/sizes', methods=['GET'])
def get_available_sizes():
    """Get list of available image sizes"""
    return jsonify({
        'sizes': ["1024x1024", "1792x1024", "1024x1792"],
        'qualities': ["standard", "hd"],
        'styles': ["vivid", "natural"]
    })

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'openai_api_configured': bool(openai.api_key)
    })

@app.route('/image/context', methods=['POST'])
def generate_image_from_context():
    """Generate an image based on conversation context and query"""
    try:
        data = request.get_json()
        if not data or "query" not in data:
            return jsonify({"error": "Missing 'query' in request."}), 400

        user_input = data["query"]
        pdf_name = data.get("pdf_name")
        user_id = data.get("user_id", "anonymous")
        user_name = data.get("user_name", "User")
        user_email = data.get("user_email", "N/A")

        # Get user-specific memory and personalized prompt
        user_data = get_user_memory(user_id, user_name, user_email)
        memory = user_data["memory"]
        personalized_prompt = user_data["personalized_prompt"]

        # Get document context
        relevant_chunks, used_fallback = get_relevant_chunks(user_input, pdf_name)
        if not relevant_chunks:
            document_context = "No relevant context found."
        else:
            fallback_note = ""
            if used_fallback:
                fallback_note = (
                    "**Note:** No relevant content found in the current lecture. "
                    "The following information comes from other lectures.\n\n"
                )
            
            # Format chunks with proper page references
            formatted_chunks = []
            for chunk in relevant_chunks:
                page_number = chunk['metadata'].get('page', 'unknown')
                pdf_source = chunk['metadata'].get('pdf_name', '')
                content = chunk['content']
                page_info = f"[Page {page_number}](page://{page_number})"
                if used_fallback:
                    page_info = f"[{pdf_source} - Page {page_number}](page://{page_number})"
                formatted_chunks.append(f"{page_info}: {content}")
            
            document_context = fallback_note + "\n---\n".join(formatted_chunks)

        # Get conversation history
        chat_history_str = "\n".join(
            msg.content for msg in memory.chat_memory.messages if not isinstance(msg, SystemMessage)
        )

        # Create a prompt for image generation that includes context
        image_prompt = f"""Based on the following conversation and document context, generate a detailed image description:

Document Context:
{document_context}

Conversation History:
{chat_history_str}

User Query:
{user_input}

Create a detailed, vivid description for an image that would help illustrate or explain the concepts being discussed. 
The description should be specific and detailed, focusing on visual elements that would make the image informative and engaging.
"""

        # Generate image using the context-aware prompt
        try:
            # Get image parameters from request or use defaults
            size = data.get('size', '1024x1024')
            quality = data.get('quality', 'standard')
            style = data.get('style', 'vivid')

            # Generate the image
            image_url = generate_image(image_prompt, size, quality, style)

            # Save image reference
            try:
                manage_image_files()
                timestamp = int(time.time())
                filename = f"image_{timestamp}.txt"
                file_path = os.path.join(IMAGE_DIR, filename)
                
                with open(file_path, 'w') as f:
                    f.write(f"Context Prompt: {image_prompt}\n")
                    f.write(f"URL: {image_url}\n")
                    f.write(f"Size: {size}\n")
                    f.write(f"Quality: {quality}\n")
                    f.write(f"Style: {style}\n")
                logger.info(f"Saved image reference: {file_path}")
            except Exception as e:
                logger.error(f"Error saving image reference: {e}")

            return jsonify({
                'url': image_url,
                'prompt': image_prompt,
                'size': size,
                'quality': quality,
                'style': style
            })

        except Exception as e:
            logger.error(f"Error generating image: {e}")
            return jsonify({'error': str(e)}), 500

    except Exception as e:
        logger.error(f"Error in image generation from context: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('FLASK_PORT', 5002))
    app.run(host='0.0.0.0', port=port, debug=True)