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
    return psycopg2.connect(
        dbname=os.getenv("DATABASE_NAME"),
        user=os.getenv("DATABASE_USER"),
        password=os.getenv("DATABASE_PASSWORD"),
        host=os.getenv("DATABASE_HOST", "localhost"),
        port=os.getenv("DATABASE_PORT", "5432")
    )

# Load embeddings from database
def load_embeddings_from_db(pdf_name: str = None) -> List[Dict]:
    """
    Load embeddings from database
    Args:
        pdf_name (str, optional): Filter by PDF name
    Returns:
        List[Dict]: List of document chunks with embeddings
    """
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        if pdf_name:
            cur.execute(
                """
                SELECT content, "pageNumber", embedding
                FROM "PDFChunk"
                WHERE "pdfName" = %s
                """,
                (pdf_name,)
            )
        else:
            cur.execute(
                """
                SELECT content, "pageNumber", embedding
                FROM "PDFChunk"
                """
            )
        
        db_chunks = cur.fetchall()
        
        chunks = []
        for chunk in db_chunks:
            chunks.append({
                "content": chunk[0],
                "metadata": {"page": chunk[1]},
                "embedding": np.array(chunk[2])
            })
        
        return chunks
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
    "Please prioritize answering questions based on the document."
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

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """
    Calculate cosine similarity between two vectors
    Args:
        a (np.ndarray): First vector
        b (np.ndarray): Second vector
    Returns:
        float: Cosine similarity score
    """
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def get_relevant_chunks(query: str, chunks: List[Dict], k: int = 3) -> List[Dict]:
    """
    Get the most relevant chunks for a query using cosine similarity
    Args:
        query (str): User query
        chunks (List[Dict]): List of document chunks with embeddings
        k (int): Number of chunks to return
    Returns:
        List[Dict]: Most relevant chunks
    """
    # Generate embedding for the query
    query_embedding = embeddings.embed_query(query)
    
    # Calculate similarities and get top k chunks
    similarities = [(chunk, cosine_similarity(query_embedding, chunk["embedding"])) 
                   for chunk in chunks]
    similarities.sort(key=lambda x: x[1], reverse=True)
    
    return [chunk for chunk, _ in similarities[:k]]

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
    if not document_chunks:
        try:
            document_chunks = load_embeddings_from_db()
            print(f"Re-loaded {len(document_chunks)} embeddings from database")
        except Exception as e:
            print(f"Error re-loading embeddings: {str(e)}")
            return "No document context available."
    
    relevant_chunks = get_relevant_chunks(query, document_chunks)
    
    # Format relevant chunks with page information
    formatted_chunks = []
    for chunk in relevant_chunks:
        page_info = f"[Page {chunk['metadata'].get('page', 'unknown')}]"
        formatted_chunks.append(f"{page_info}: {chunk['content']}")
    
    return "\n---\n".join(formatted_chunks)

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
    verdict = safety_response.get("content", "").strip() if isinstance(safety_response, dict) else safety_response.content.strip()
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
    data = request.get_json()
    print("User:", data["query"], flush=True)
    if not data or "query" not in data:
        return jsonify({"error": "Missing 'query' in JSON payload."}), 400

    user_input = data["query"]

    # Get document context using embeddings
    document_context = get_document_context(user_input)

    # Get conversation history (excluding the system message)
    chat_history = "\n".join(
        [msg.content for msg in memory.chat_memory.messages if msg.__class__.__name__ != "SystemMessage"]
    )

    # Format the prompt for the LLM
    full_prompt = prompt_template.format(
        system_prompt=system_prompt,
        document_context=document_context,
        chat_history=chat_history,
        user_input=user_input
    )

    # Get the response from the language model
    response = llm.invoke(full_prompt)
    initial_answer = response.get("content", "") if isinstance(response, dict) else response.content

    # Run the safety check loop to potentially reprompt for a safer answer
    safe_answer = get_safe_answer(initial_answer)

    # Update conversation memory
    memory.chat_memory.add_user_message(user_input)
    memory.chat_memory.add_ai_message(safe_answer)
    print("Bot:", safe_answer, flush=True)
    return jsonify({"answer": safe_answer})

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

if __name__ == "__main__":
    app.run(debug=True)