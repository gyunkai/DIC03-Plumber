import os
# --- Document Ingestion ---
from langchain_community.document_loaders import PyPDFLoader
# --- Embeddings & Vector Store ---
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import ChatPromptTemplate

# --- New Conversational Chain Imports ---
from langchain.chains import (
    create_history_aware_retriever,
    create_retrieval_chain,
)
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

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
        return
    loader = PyPDFLoader(doc_path)
    documents = loader.load()
    print(f"Loaded {len(documents)} document(s).", flush=True)
    
    # --- Create Embeddings & Vector Store ---
    print("Creating embeddings and vector store...", flush=True)
    embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
    vector_store = FAISS.from_documents(documents, embeddings)
    # Get the retriever from the vector store.
    retriever = vector_store.as_retriever()
    print("Vector store created.", flush=True)
    
    # --- Initialize Chat Model ---
    print("Initializing Chat Model...", flush=True)
    llm = ChatOpenAI(openai_api_key=OPENAI_API_KEY)
    
    # --- Step 1: Create History-Aware Retriever ---
    contextualize_q_system_prompt = (
        "Given a chat history and the latest user question "
        "which might reference context in the chat history, "
        "formulate a standalone question which can be understood "
        "without the chat history. Do NOT answer the question, just "
        "reformulate it if needed and otherwise return it as is."
    )

    contextualize_q_prompt = ChatPromptTemplate.from_messages(
        [
            ("system", contextualize_q_system_prompt),
            MessagesPlaceholder("chat_history"),
            ("human", "{input}"),
        ]
    )
    
    history_aware_retriever = create_history_aware_retriever(
        llm=llm, 
        retriever=retriever, 
        prompt=contextualize_q_prompt
    )
    
    # --- Step 2: Setup the QA Chain ---
    qa_system_prompt = (
        "You are an assistant for question-answering tasks. Use "
        "the following pieces of retrieved context to answer the "
        "question. If you don't know the answer, just say that you "
        "don't know. Use three sentences maximum and keep the answer "
        "concise."
    )
    
    qa_template = (
    "You are an assistant for question-answering tasks. Use "
    "the following pieces of retrieved context to answer the "
    "question. If you don't know the answer, just say that you "
    "don't know. Use three sentences maximum and keep the answer "
    "concise.\n\n"
    "Question: {input}\n\n"
    "Context: {context}\n\n"
    "Answer:"
    )
    qa_prompt = ChatPromptTemplate.from_template(qa_template)

    qa_chain = create_retrieval_chain(
        retriever=history_aware_retriever,
        combine_docs_chain=create_stuff_documents_chain(llm=llm, prompt=qa_prompt)
    )
    
    # --- Step 3: Conversational Loop with Chat History ---
    chat_history = []  # Initialize empty chat history
    print("Type your questions below. Type 'exit' or 'quit' to end the session.\n", flush=True)
    while True:
        user_input = input("User: ")
        if user_input.lower() in ["exit", "quit"]:
            break
        # Run the QA chain, passing both the input and chat history.
        result = qa_chain.invoke({"input": user_input, "chat_history": chat_history})


        print("Assistant:", result['answer'], "\n", flush=True)
        # Update the chat history with the latest interaction.
        chat_history.append((user_input, result))

if __name__ == "__main__":
    main()
