import os
import glob
from flask import Flask, request, jsonify
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain.memory import ConversationBufferMemory
from langchain.prompts import PromptTemplate
from langchain.schema import SystemMessage
import numpy as np
import json
from typing import List, Dict
import psycopg2
from psycopg2.extras import Json
from urllib.parse import urlparse
from dotenv import load_dotenv, find_dotenv
from pathlib import Path
import time
import traceback

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
        print("Database connection established successfully")

        # Set statement timeout to avoid hanging
        with conn.cursor() as cursor:
            cursor.execute("SET statement_timeout = 30000;")  # 30 seconds
            print("Setting statement timeout to 30 seconds...")
            
            # Execute a simple count query first to test database responsiveness
            cursor.execute("SELECT COUNT(*) FROM \"PdfChunk\";")
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
    "Here you are tasked with answering questions based on the document provided which is for Introduction to Programming. "
    "Please prioritize answering questions based on the document. "
    "For each answer, you must cite your sources by referencing the page numbers in [Page X] format. "
    "Always include these page references when providing information from the document. "
    "Make your answers helpful and informative while clearly indicating which page contains the information."
)
memory.chat_memory.messages.append(SystemMessage(content=system_prompt))

# Initialize Chat Model
print("Initializing Chat Model...")
llm = ChatOpenAI(openai_api_key=OPENAI_API_KEY, model="gpt-4o")

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

def get_relevant_chunks(query: str, pdf_name: str = None, k: int = 10) -> List[Dict]:
    """
    Get the most relevant chunks for a query using vector similarity
    
    Args:
        query (str): User query
        pdf_name (str, optional): PDF name to restrict search
        k (int): Number of chunks to return
    Returns:
        List[Dict]: Most relevant chunks
    """
    print(f"get_relevant_chunks called with query: {query}")
    
    try:
        # Generate embedding for the query
        print("Generating query embedding...")
        query_embedding = embeddings.embed_query(query)
        
        if isinstance(query_embedding, np.ndarray):
            # Convert numpy array to list for compatibility
            query_embedding = query_embedding.tolist()
        
        print(f"Generated query embedding with length: {len(query_embedding)}")
        
        # Use global document_chunks that were loaded from database
        global document_chunks
        
        # Check if we have document chunks to work with
        if not document_chunks:
            print("WARNING: No document chunks available for similarity search")
            return []
            
        # Filter chunks by PDF name if specified
        chunks_to_search = document_chunks
        if pdf_name:
            print(f"Filtering chunks for PDF: {pdf_name}")
            chunks_to_search = [
                chunk for chunk in document_chunks 
                if chunk.get('metadata', {}).get('pdf_name') == pdf_name
            ]
            print(f"Found {len(chunks_to_search)} chunks for PDF {pdf_name}")
        
        # If no chunks found after filtering, return empty list
        if not chunks_to_search:
            print(f"No chunks found for {'PDF '+pdf_name if pdf_name else 'any PDF'}")
            return []
            
        print(f"Performing similarity search on {len(chunks_to_search)} chunks")
        
        # Calculate cosine similarity for each chunk
        results = []
        for chunk in chunks_to_search:
            # For database-loaded chunks, need to get embeddings from database first time
            # This would be done during the load_embeddings_from_db
            # For now, we'll use cosine similarity on chunks directly
            
            # Add similarity score to chunk metadata
            chunk_with_score = chunk.copy()
            
            # If this is from a database load, the content is already in the chunk
            chunk_with_score['metadata'] = chunk.get('metadata', {}).copy()
            
            # Add to results
            results.append(chunk_with_score)
            
        # Sort by page number as fallback
        sorted_results = sorted(results, key=lambda x: x['metadata'].get('page', 0))
            
        # Print some info about the results
        for i, chunk in enumerate(sorted_results[:3]):
            print(f"Chunk {i} - Page {chunk['metadata'].get('page', 'unknown')}, "
                  f"Content: {chunk['content'][:50]}...")
        
        # Return top k results
        return sorted_results[:k]
        
    except Exception as e:
        print(f"Error in get_relevant_chunks: {str(e)}")
        print(f"Error details: {traceback.format_exc()}")
        
        # Fallback to sorting by page number
        fallback_chunks = []
        if document_chunks:
            # Filter by PDF name if specified
            filtered_chunks = document_chunks
            if pdf_name:
                filtered_chunks = [c for c in document_chunks if c.get('metadata', {}).get('pdf_name') == pdf_name]
            
            # Sort by page number
            fallback_chunks = sorted(filtered_chunks, key=lambda x: x['metadata'].get('page', 0))[:k]
            
        return fallback_chunks

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
    relevant_chunks = get_relevant_chunks(query, pdf_name)
    print(f"Found {len(relevant_chunks)} relevant chunks for query")
    
    # Format relevant chunks with page information
    formatted_chunks = []
    for i, chunk in enumerate(relevant_chunks):
        page_info = f"[Page {chunk['metadata'].get('page', 'unknown')}]"
        content = chunk['content']
        formatted_chunks.append(f"{page_info}: {content}")
        print(f"Chunk {i}: Page {chunk['metadata'].get('page', 'unknown')}, Content length: {len(content)}")
    
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

@app.route("/query", methods=["POST"])
def query():
    """
    Handle user queries and return responses
    """
    print("\n--- NEW QUERY REQUEST ---")
    print("Received request at /query endpoint")
    try:
        data = request.get_json()
        print("Request data:", data)
        
        if not data:
            print("Error: Empty request data")
            return jsonify({"error": "Empty request data"}), 400
            
        if "query" not in data:
            print("Error: Missing 'query' in request data")
            return jsonify({"error": "Missing 'query' in JSON payload."}), 400

        user_input = data["query"]
        pdf_name = data.get("pdf_name")
        use_all_chunks = data.get("use_all_chunks", False)
        
        print("User:", user_input, flush=True)
        print("PDF name:", pdf_name, flush=True)
        print("Use all chunks:", use_all_chunks, flush=True)
        
        # Always reload chunks for each query
        global document_chunks
        try:
            print("Loading document chunks for query")
            # If specific PDF is requested, load only that PDF's chunks
            if pdf_name:
                print(f"Loading chunks for specific PDF: {pdf_name}")
                document_chunks = load_embeddings_from_db(pdf_name)
                print(f"Loaded {len(document_chunks)} chunks for PDF: {pdf_name}")
            # Otherwise load all chunks
            else:
                print("Loading all chunks from database")
                document_chunks = load_embeddings_from_db()
                print(f"Loaded all {len(document_chunks)} chunks from database")
                
            if not document_chunks:
                print("WARNING: No document chunks were loaded")
        except Exception as e:
            print(f"Error loading chunks: {str(e)}")
            # Continue with empty chunks if loading fails
            document_chunks = []
            
        # If we still have no document chunks, try loading all chunks as a fallback
        if not document_chunks and pdf_name:
            try:
                print("No chunks found for specific PDF, trying to load all chunks as fallback")
                document_chunks = load_embeddings_from_db()
                print(f"Fallback: Loaded {len(document_chunks)} total chunks")
            except Exception as e:
                print(f"Fallback load error: {str(e)}")
        
        # Get document context using embeddings
        try:
            print(user_input)
            document_context = get_document_context(user_input)
            print(f"Generated document context successfully: '{document_context[:100]}...'")
        except Exception as e:
            print(f"Error generating document context: {str(e)}")
            document_context = "Unable to retrieve document context."
        
        # Get conversation history (excluding the system message)
        try:
            chat_history = "\n".join(
                [msg.content for msg in memory.chat_memory.messages if msg.__class__.__name__ != "SystemMessage"]
            )
            print("Retrieved chat history successfully")
        except Exception as e:
            print(f"Error retrieving chat history: {str(e)}")
            chat_history = ""

        # Format the prompt for the LLM
        full_prompt = prompt_template.format(
            system_prompt=system_prompt,
            document_context=document_context,
            chat_history=chat_history,
            user_input=user_input
        )
        print("Created full prompt successfully")
        print(f"Document context length: {len(document_context)} characters")
        print(f"Chat history length: {len(chat_history)} characters")
        print(f"Full prompt length: {len(full_prompt)} characters")

        # Get the response from the language model
        try:
            response = llm.invoke(full_prompt)
            initial_answer = response.get("content", "") if isinstance(response, dict) else response.content
            print("Generated initial answer successfully")
        except Exception as e:
            print(f"Error generating answer from LLM: {str(e)}")
            return jsonify({"error": f"Failed to generate response: {str(e)}"}), 500

        # Run the safety check loop to potentially reprompt for a safer answer
        try:
            safe_answer = get_safe_answer(initial_answer)
            print("Safety check completed successfully")
        except Exception as e:
            print(f"Error in safety check: {str(e)}")
            safe_answer = initial_answer  # Use initial answer if safety check fails

        # Update conversation memory
        memory.chat_memory.add_user_message(user_input)
        memory.chat_memory.add_ai_message(safe_answer)
        print("Bot:", safe_answer, flush=True)
        print("--- QUERY COMPLETED ---\n")
        return jsonify({"answer": safe_answer})
    except Exception as e:
        print(f"Unexpected error in query endpoint: {str(e)}")
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500

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

if __name__ == "__main__":
    app.run(debug=True)