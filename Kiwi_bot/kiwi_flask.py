import os
import glob
from flask import Flask, request, jsonify
from langchain_community.document_loaders import PyPDFLoader
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain.memory import ConversationBufferMemory
from langchain.prompts import PromptTemplate
from langchain.schema import SystemMessage

# Initialize Flask app
app = Flask(__name__)

# ---------- Global Setup ----------
# Check for API key
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY environment variable is not set.")

# Folder containing PDFs
folder_path = r"D:\NYUSH Spring 2025\Plumber-git\public\pdf"

if not os.path.exists(folder_path):
    raise FileNotFoundError(f"Folder not found: {folder_path}")

# Load PDF documents
pdf_files = glob.glob(os.path.join(folder_path, "*.pdf"))
all_documents = []
print("Starting to load documents...")
for doc_path in pdf_files:
    print(f"Loading document: {doc_path}")
    if not os.path.exists(doc_path):
        print(f"File does not exist: {doc_path}")
        continue
    loader = PyPDFLoader(doc_path)
    documents = loader.load()
    print(f"Loaded {len(documents)} document(s) from {doc_path}.")
    all_documents.extend(documents)

print(f"Total loaded documents: {len(all_documents)}")

# Create embeddings and vector store
print("Creating embeddings and vector store...")
embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
vector_store = FAISS.from_documents(all_documents, embeddings)
retriever = vector_store.as_retriever()
print("Vector store created.")

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

def safety_check(answer):
    check_prompt = (
        "You are a safety evaluator. Review the following answer and determine if it reveals "
        "too much sensitive or internal information. Reply with 'SAFE' if it is acceptable or 'BLOCK' "
        "if it discloses too much. Answer only with one word: either 'SAFE' or 'BLOCK'.\n\n"
        f"Answer: {answer}"
    )
    safety_response = llm.invoke(check_prompt)
    verdict = safety_response.get("content", "").strip() if isinstance(safety_response, dict) else safety_response.content.strip()
    return verdict.upper()

def get_safe_answer(initial_answer, max_attempts=3):
    attempt = 0
    answer_text = initial_answer

    while attempt < max_attempts:
        verdict = safety_check(answer_text)
        if verdict == "SAFE":
            break
        else:
            # Create a prompt instructing the model to produce a revised safe answer
            revision_prompt = (
                "Your previous answer revealed too much sensitive or detailed information. "
                "Please provide a revised answer that conveys the necessary information safely without revealing "
                "any sensitive or internal details."
            )
            # Optionally, you could include context from the original query if needed
            revised_response = llm.invoke(revision_prompt)
            answer_text = revised_response.get("content", "") if isinstance(revised_response, dict) else revised_response.content
            attempt += 1

    return answer_text

def get_document_context(query, retriever):
    docs = retriever.invoke(query)
    return "\n---\n".join([doc.page_content for doc in docs])

# ---------- Flask Endpoint ----------
@app.route("/query", methods=["POST"])
def query():
    data = request.get_json()
    print("User:", data["query"], flush=True)
    if not data or "query" not in data:
        return jsonify({"error": "Missing 'query' in JSON payload."}), 400

    user_input = data["query"]

    # Retrieve document context for the query
    document_context = get_document_context(user_input, retriever)

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

if __name__ == "__main__":
    app.run(debug=True)