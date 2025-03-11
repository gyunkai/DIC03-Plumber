import os
import glob
from langchain_community.document_loaders import PyPDFLoader
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain.memory import ConversationBufferMemory
from langchain.prompts import PromptTemplate
from langchain.schema import SystemMessage
# Import RunnableSequence if using newer versions
# from langchain.runnables import RunnableSequence

def get_document_context(query, retriever):
    docs = retriever.invoke(query)
    return "\n---\n".join([doc.page_content for doc in docs])

def main():
    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY environment variable is not set.")
    
    
    folder_path = r"D:\NYUSH Spring 2025\Plumber-git\public\pdf"
    

    if not os.path.exists(folder_path):
        print("File does not exist!")
        return
    print("File exists, proceeding...")

    # Get a list of all PDF files in the folder
    pdf_files = glob.glob(os.path.join(folder_path, "*.pdf"))

    # List to hold all loaded documents
    all_documents = []


    print("Starting to load documents...", flush=True)

    for doc_path in pdf_files:
        print(f"Loading document: {doc_path}", flush=True)
        
        if not os.path.exists(doc_path):
            print(f"File does not exist: {doc_path}")
            continue

        # Create the loader for the current file
        loader = PyPDFLoader(doc_path)
        
        # Load the document (or documents, if split by pages/sections)
        documents = loader.load()
        print(f"Loaded {len(documents)} document(s) from {doc_path}.", flush=True)
        
        # Append the loaded documents to the list
        all_documents.extend(documents)

    print(f"Total loaded documents: {len(all_documents)}", flush=True)
    
    print("Creating embeddings and vector store...", flush=True)
    embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)

    vector_store = FAISS.from_documents(all_documents, embeddings)
    retriever = vector_store.as_retriever()
    print("Vector store created.", flush=True)
    
    print("Setting up conversation memory...", flush=True)
    memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)
    
    
    system_prompt = (
        "You are Kiwi, a helpful AI assistant. Always remember personal details provided by the user, "
        "especially their name. If the user states 'My name is ...', store it, and when asked, reply with the name they've provided."
        "Here you are tasked with answering question based on the document provided which is for Introduction to Programming."
        "Please prioritize answering questions based on the document."
    )
    memory.chat_memory.messages.append(SystemMessage(content=system_prompt))
    
    print("Initializing Chat Model...", flush=True)
    llm = ChatOpenAI(openai_api_key=OPENAI_API_KEY, model="gpt-4o")
    
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
    
    # If using the older LLMChain:
    # conversation_chain = LLMChain(llm=llm, prompt=prompt_template)
    #
    # Or, if updating to the new runnable sequence (check latest docs):
    # conversation_chain = RunnableSequence([prompt_template, llm])
    
    print("Setup complete.\n", flush=True)
        
    print("Type your questions below. Type 'exit' or 'quit' to end the session.\n", flush=True)
    while True:
        user_input = input("User: ")
        if user_input.lower() in ["exit", "quit"]:
            break
        
        document_context = get_document_context(user_input, retriever)
        
        chat_history = "\n".join(
            [msg.content for msg in memory.chat_memory.messages if msg.__class__.__name__ != "SystemMessage"]
        )
        
        full_prompt = prompt_template.format(
            system_prompt=system_prompt,
            document_context=document_context,
            chat_history=chat_history,
            user_input=user_input
        )
        
        # Use invoke instead of direct call if available:
        response = llm.invoke(full_prompt)
        
        # Extract the answer text from the response:
        answer_text = response.get("content", "") if isinstance(response, dict) else response.content
        
        print("Bot:", answer_text, "\n", flush=True)
        # print(memory)
        
        memory.chat_memory.add_user_message(user_input)
        memory.chat_memory.add_ai_message(answer_text)

if __name__ == "__main__":
    main()
