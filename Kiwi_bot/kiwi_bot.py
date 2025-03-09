import os
from langchain.document_loaders import UnstructuredFileLoader
from langchain.embeddings.openai import OpenAIEmbeddings
from langchain.vectorstores import FAISS
from langchain.memory import ConversationBufferMemory
from langchain.chat_models import ChatOpenAI
from langchain.chains import ConversationalRetrievalChain

def main():
    # Retrieve API key from environment variable
    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY environment variable is not set.")

    # --- Document Ingestion and Vector Store Creation ---
    # Replace the file path below with your actual document path.
    doc_path = "path/to/your/document.pdf"
    loader = UnstructuredFileLoader(doc_path)
    documents = loader.load()

    # Generate embeddings for the document using OpenAI's embeddings API
    embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
    vector_store = FAISS.from_documents(documents, embeddings)

    # --- Set Up Conversation Memory ---
    memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)

    # --- Initialize ChatGPT Model ---
    llm = ChatOpenAI(openai_api_key=OPENAI_API_KEY, model="gpt-3.5-turbo")

    # --- Build the Conversational Retrieval Chain ---
    qa_chain = ConversationalRetrievalChain.from_llm(
        llm=llm,
        retriever=vector_store.as_retriever(),
        memory=memory
    )

    # --- Chat Loop ---
    print("Type your questions below. Type 'exit' or 'quit' to end the session.\n")
    while True:
        query = input("User: ")
        if query.lower() in ["exit", "quit"]:
            break
        response = qa_chain({"question": query})
        print("Bot:", response["answer"], "\n")

if __name__ == "__main__":
    main()
