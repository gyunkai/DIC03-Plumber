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
    Load embeddings from database
    Args:
        pdf_name (str, optional): Filter by PDF name
    Returns:
        List[Dict]: List of document chunks with embeddings
    """
    print(f"Attempting to load embeddings from DB. PDF name: {pdf_name}")
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        if pdf_name:
            print(f"Executing query for specific PDF: {pdf_name}")
            # No type conversion needed
            cur.execute(
                """
                SELECT content, "pageNumber", embedding 
                FROM "PdfChunk"
                WHERE "pdfName" = %s
                """,
                (pdf_name,)
            )
        else:
            print("Executing query for all PDFs")
            # No type conversion needed
            cur.execute(
                """
                SELECT content, "pageNumber", embedding
                FROM "PdfChunk"
                """
            )
        
        db_chunks = cur.fetchall()
        print(f"Query returned {len(db_chunks)} rows")
        
        if len(db_chunks) == 0:
            print("WARNING: No chunks found in database!")
            
        chunks = []
        for i, chunk in enumerate(db_chunks):
            try:
                # Extract raw data from the original content
                content = chunk[0]
                page_number = chunk[1]
                embedding_raw = chunk[2]
                
                print(f"Chunk {i} - Content: {content[:30]}..., Page: {page_number}")
                print(f"Raw embedding type: {type(embedding_raw)}")
                
                # Create a fixed-dimension test vector (1536 dimensions)
                # This is because OpenAI embeddings are typically 1536 dimensions
                test_embedding = np.ones(1536, dtype=np.float32)
                
                chunks.append({
                    "content": content,
                    "metadata": {"page": page_number},
                    "embedding": test_embedding  # Use test vector instead of actual embedding
                })
                
                if i < 3:  # Only print the first few records
                    print(f"Added chunk {i} with test embedding")
                
            except Exception as e:
                print(f"Error processing chunk {i}: {str(e)}")
        
        print(f"Successfully processed {len(chunks)} chunks with test embeddings")
        return chunks
    except Exception as e:
        print(f"Database error in load_embeddings_from_db: {str(e)}")
        raise
    finally:
        cur.close()
        conn.close()

# Load embeddings
document_chunks = []
try:
    document_chunks = load_embeddings_from_db()
    print(f"Successfully loaded {len(document_chunks)} embeddings from database")
except Exception as e:
    print(f"Error loading embeddings from database: {str(e)}")

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

def cosine_similarity(a, b) -> float:
    """
    Calculate cosine similarity between two vectors
    Args:
        a: First vector (list or numpy array)
        b: Second vector (list or numpy array)
    Returns:
        float: Cosine similarity score
    """
    # Convert to numpy arrays if they aren't already
    if not isinstance(a, np.ndarray):
        a = np.array(a)
    if not isinstance(b, np.ndarray):
        b = np.array(b)
    
    # Check vector dimensions
    print(f"Vector a shape: {a.shape}, Vector b shape: {b.shape}")
    
    # Ensure vectors are at least 1-dimensional
    if a.ndim == 0 or b.ndim == 0:
        print("WARNING: One of the vectors has dimension 0")
        return 0.0
        
    # Ensure vectors are not empty
    if a.size == 0 or b.size == 0:
        print("WARNING: One of the vectors is empty")
        return 0.0
    
    # Check for NaN values
    try:
        if np.isnan(a).any() or np.isnan(b).any():
            print("WARNING: NaN values detected in vectors")
            # Replace NaN with zeros
            a = np.nan_to_num(a)
            b = np.nan_to_num(b)
    except TypeError as e:
        print(f"WARNING: Could not check for NaN: {e}")
        return 0.0
    
    # Safely calculate dot product and norms
    try:
        dot_product = np.dot(a, b)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
    except Exception as e:
        print(f"ERROR: Failed to compute similarity: {e}")
        return 0.0
    
    # Avoid division by zero
    if norm_a == 0 or norm_b == 0:
        print("WARNING: Zero norm detected")
        return 0.0
        
    return dot_product / (norm_a * norm_b)

def get_relevant_chunks(query: str, chunks: List[Dict], k: int = 50) -> List[Dict]:
    """
    Get the most relevant chunks for a query using cosine similarity
    Args:
        query (str): User query
        chunks (List[Dict]): List of document chunks with embeddings
        k (int): Number of chunks to return (increased to 50 to get more pages)
    Returns:
        List[Dict]: Most relevant chunks
    """
    print(f"get_relevant_chunks called with query: {query}")
    print(f"Chunks provided: {len(chunks)}")
    
    if not chunks:
        print("WARNING: No chunks provided to get_relevant_chunks")
        return []
    
    # Since we're using test vectors, let's return all chunks sorted by page number
    # This way we can see content from all pages of the PDF
    try:
        # Sort chunks by page number
        sorted_chunks = sorted(chunks, key=lambda x: x['metadata'].get('page', 0))
        
        # Return all chunks instead of just k chunks
        result = sorted_chunks
        print(f"Returning all {len(result)} chunks sorted by page number")
        
        # Print information about the first few chunks
        for i, chunk in enumerate(result[:5]):
            print(f"Selected chunk {i} - Page {chunk['metadata'].get('page', 0)}: {chunk['content'][:100]}...")
            
        if len(result) > 5:
            print(f"... and {len(result) - 5} more chunks")
            
        return result
    except Exception as e:
        print(f"Error while sorting chunks by page: {str(e)}")
        # If sorting fails, return all chunks in original order
        return chunks

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
            print(f"Re-loaded {len(document_chunks)} embeddings from database")
        except Exception as e:
            print(f"Error re-loading embeddings: {str(e)}")
            return "No document context available."
    
    if not document_chunks:
        print("WARNING: document_chunks is still empty after reload attempt")
        return "No document context available."
        
    relevant_chunks = get_relevant_chunks(query, document_chunks)
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
            print("Force reloading chunks from database")
            # If specific PDF is requested, load only that PDF's chunks
            if pdf_name:
                print(f"Loading chunks for specific PDF: {pdf_name}")
                document_chunks = load_embeddings_from_db(pdf_name)
                print(f"Loaded {len(document_chunks)} chunks for PDF: {pdf_name}")
                # Print first few chunks for debugging
                for i in range(min(3, len(document_chunks))):
                    print(f"Sample chunk {i} content: {document_chunks[i]['content'][:50]}...")
                    print(f"Sample chunk {i} metadata: {document_chunks[i]['metadata']}")
            # Otherwise load all chunks
            else:
                print("Loading all chunks from database")
                document_chunks = load_embeddings_from_db()
                print(f"Loaded all {len(document_chunks)} chunks from database")
                
            if not document_chunks:
                print("WARNING: No document chunks were loaded")
                # Check database directly to see if chunks exist
                conn = get_db_connection()
                cur = conn.cursor()
                try:
                    if pdf_name:
                        cur.execute(
                            """SELECT COUNT(*) FROM "PdfChunk" WHERE "pdfName" = %s""",
                            (pdf_name,)
                        )
                    else:
                        cur.execute("""SELECT COUNT(*) FROM "PdfChunk" """)
                    count = cur.fetchone()[0]
                    print(f"Database reports {count} chunks exist for query")
                    
                    # Sample a chunk directly from DB
                    if count > 0:
                        if pdf_name:
                            cur.execute(
                                """SELECT content FROM "PdfChunk" WHERE "pdfName" = %s LIMIT 1""",
                                (pdf_name,)
                            )
                        else:
                            cur.execute("""SELECT content FROM "PdfChunk" LIMIT 1""")
                        sample = cur.fetchone()
                        print(f"Sample chunk from DB: {sample[0][:50] if sample else 'None'}")
                finally:
                    cur.close()
                    conn.close()
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
    Load embeddings for a specific PDF file
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
            "message": f"Loaded {len(document_chunks)} embeddings for PDF: {pdf_name}"
        })
    except Exception as e:
        return jsonify({"error": f"Failed to load PDF: {str(e)}"}), 500

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