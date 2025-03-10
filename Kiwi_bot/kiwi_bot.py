import os
# Updated import for PyPDFLoader
from langchain_community.document_loaders import PyPDFLoader
# Updated import for OpenAIEmbeddings
from langchain.chains import (
    create_history_aware_retriever,
    create_retrieval_chain,
)
from langchain_openai import ChatOpenAI, OpenAIEmbeddings  
from langchain_community.vectorstores import FAISS
from langchain.memory import ConversationBufferMemory
from langchain.chains import ConversationalRetrievalChain

def main():
    # Retrieve API key from environment variable
    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY environment variable is not set.")
    
    # --- Document Ingestion ---
    print("Loading document...", flush=True)
    doc_path = r"D:\NYUSH Spring 2025\Plumber-git\Proposals\main.pdf"
    if not os.path.exists(doc_path):
        print("File does not exist!")
    else:
        print("File exists, proceeding...")

    loader = PyPDFLoader(doc_path)
    documents = loader.load()
    print(f"Loaded {len(documents)} document(s).", flush=True)
    
    # --- Create Embeddings & Vector Store ---
    print("Creating embeddings and vector store...", flush=True)
    embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
    vector_store = FAISS.from_documents(documents, embeddings)
    print("Vector store created.", flush=True)
    
    # --- Setup Conversation Memory ---
    print("Setting up conversation memory...", flush=True)
    memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)
    
    # --- Initialize Chat Model ---
    print("Initializing Chat Model...", flush=True)
    llm = ChatOpenAI(openai_api_key=OPENAI_API_KEY, model="gpt-4o")
    
    # --- Build the Conversational Retrieval Chain (RAG) ---
    print("Building Conversational Retrieval Chain...", flush=True)
    chain = ConversationalRetrievalChain.from_llm(
        llm=llm,
        retriever=vector_store.as_retriever(),
        memory=memory
    )
    print("Setup complete.\n", flush=True)
    
    # --- Chat Loop ---
    print("Type your questions below. Type 'exit' or 'quit' to end the session.\n", flush=True)
    while True:
        query = input("User: ")
        if query.lower() in ["exit", "quit"]:
            break
        # Use the new .invoke() method instead of __call__
        response = chain.invoke(input=query)
        print("Bot:", response, "\n", flush=True)

if __name__ == "__main__":
    main()
