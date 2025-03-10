import os
from langchain_unstructured import UnstructuredLoader
from langchain_community.embeddings import OpenAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain.memory import ConversationBufferMemory
from langchain_community.chat_models import ChatOpenAI
from langchain.chains import ConversationalRetrievalChain

print(os.environ.get("OPENAI_API_KEY"))

def main():
    # Retrieve API key from environment variable
    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY environment variable is not set.")

    # --- Document Ingestion and Vector Store Creation ---
    # Replace the file path below with your actual document path.
    doc_path = r"D:\NYUSH Spring 2025\Plumber-git\public\pdf\Lecture1.pdf"
    loader = UnstructuredLoader(doc_path)
    documents = loader.load()

    # Generate embeddings for the document using OpenAI's embeddings API
    embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
    vector_store = FAISS.from_documents(documents, embeddings)

    # --- Set Up Conversation Memory ---
    memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)

    # --- Initialize ChatGPT Model ---
    llm = ChatOpenAI(openai_api_key=OPENAI_API_KEY, model="gpt-4o")

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
