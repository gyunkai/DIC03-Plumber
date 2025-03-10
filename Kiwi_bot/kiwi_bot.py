import os
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
    
    print("Loading document...", flush=True)
    doc_path = r"D:\NYUSH Spring 2025\Plumber-git\Proposals\main.pdf"
    if not os.path.exists(doc_path):
        print("File does not exist!")
        return
    print("File exists, proceeding...")

    loader = PyPDFLoader(doc_path)
    documents = loader.load()
    print(f"Loaded {len(documents)} document(s).", flush=True)
    
    print("Creating embeddings and vector store...", flush=True)
    embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
    vector_store = FAISS.from_documents(documents, embeddings)
    retriever = vector_store.as_retriever()
    print("Vector store created.", flush=True)
    
    print("Setting up conversation memory...", flush=True)
    memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)
    
    system_prompt = (
        "You are Kiwi, a helpful AI assistant. Always remember personal details provided by the user, "
        "especially their name. If the user states 'My name is ...', store it, and when asked, reply with the name they've provided."
        "Here you are tasked with answering question based on the document provided which is for Introduction to Programming."
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
        
        memory.chat_memory.add_user_message(user_input)
        memory.chat_memory.add_ai_message(answer_text)

if __name__ == "__main__":
    main()
