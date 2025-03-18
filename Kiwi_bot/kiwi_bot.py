import os
import glob
import time
from langchain_community.document_loaders import PyPDFLoader
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain.memory import ConversationBufferMemory
from langchain.prompts import PromptTemplate
from langchain.schema import SystemMessage

def get_document_context(query, retriever, k=3):
    """Fetch relevant documents based on the query."""
    docs = retriever.invoke(query)[:k]
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

    # Load PDFs (No Chunking Changes)
    pdf_files = glob.glob(os.path.join(folder_path, "*.pdf"))
    all_documents = []
    
    print("Loading documents...", flush=True)
    for doc_path in pdf_files:
        print(f"Loading: {doc_path}", flush=True)
        loader = PyPDFLoader(doc_path)
        documents = loader.load()
        all_documents.extend(documents)

    print(f"Total loaded documents: {len(all_documents)}", flush=True)

    # Keep FAISS Embedding Process Unchanged
    print("Creating embeddings and vector store...", flush=True)
    embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
    vector_store = FAISS.from_documents(all_documents, embeddings)
    retriever = vector_store.as_retriever()
    print("Vector store created.", flush=True)

    print("Setting up conversation memory...", flush=True)
    memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)

    # ---- Define Agents ----
    system_prompts = {
        "answer": (
            "You are Kiwi, an AI assistant specializing in Introduction to Programming. "
            "Answer programming-related questions using the provided documents. "
            "Please also provide the page number of the info if possible."
        ),
        "quiz": (
            "You are QuizBot, an AI that generates programming exercises and quizzes. "
            "Create coding problems, multiple-choice questions, and coding challenges. "
            "Please use the provided document to generate the quiz. "
            "Don't reveal the answers until the student answers. "
            "Don't generate too many questions at once; do only 1 at a time."
        )
    }

    memory.chat_memory.messages.append(SystemMessage(content=system_prompts["answer"]))

    print("Initializing Chat Models...", flush=True)
    llm = {
        "answer": ChatOpenAI(openai_api_key=OPENAI_API_KEY, model="gpt-4o"),
        "quiz": ChatOpenAI(openai_api_key=OPENAI_API_KEY, model="gpt-4o")
    }

    prompt_templates = {
        "answer": PromptTemplate(
            input_variables=["system_prompt", "document_context", "chat_history", "user_input"],
            template=(
                "{system_prompt}\n\n"
                "Document Context:\n{document_context}\n\n"
                "Conversation History:\n{chat_history}\n\n"
                "User: {user_input}\n"
                "Assistant:"
            )
        ),
        "quiz": PromptTemplate(
            input_variables=["system_prompt", "document_context", "user_input"],
            template=(
                "{system_prompt}\n\n"
                "Using the provided document, generate a **single** multiple-choice quiz question:\n"
                "{document_context}\n\n"
                "Ensure the question has four choices (A, B, C, D) but do **not** reveal the answer yet.\n"
                "QuizBot:"
            )
        ),
        "quiz_evaluation": PromptTemplate(
            input_variables=["system_prompt", "document_context", "quiz_question", "user_answer"],
            template=(
                "{system_prompt}\n\n"
                "Quiz Question:\n{quiz_question}\n\n"
                "User's Answer: {user_answer}\n\n"
                "Check if the answer is correct and provide an explanation."
            )
        )
    }

    print("Setup complete. Type 'answer [question]' or 'quiz [topic]'.\n", flush=True)
    
    quiz_active = False
    last_quiz_question = ""

    while True:
        user_input = input("User: ")
        if user_input.lower() in ["exit", "quit"]:
            break

        # If the user is answering a quiz question
        if quiz_active and user_input.upper() in ["A", "B", "C", "D"]:
            agent = "quiz"
            system_prompt = system_prompts["quiz"]

            full_prompt = prompt_templates["quiz_evaluation"].format(
                system_prompt=system_prompt,
                document_context="",
                quiz_question=last_quiz_question,
                user_answer=user_input
            )

            try:
                response = llm["quiz"].invoke(full_prompt)
                answer_text = response.get("content", "") if isinstance(response, dict) else response.content
                print("QuizBot:", answer_text, "\n", flush=True)
                
                quiz_active = False  # Reset quiz mode
                continue
            except Exception as e:
                print(f"Error: {e}", flush=True)
                continue

        # Determine the agent based on user input
        elif user_input.lower().startswith("answer "):
            agent = "answer"
            query = user_input[7:]  # Remove "answer " prefix
        elif user_input.lower().startswith("quiz "):
            agent = "quiz"
            query = user_input[5:]  # Remove "quiz " prefix
        else:
            print("Please start your query with 'answer' or 'quiz'.", flush=True)
            continue

        try:
            document_context = get_document_context(query, retriever)

            chat_history = "\n".join(
                [msg.content for msg in memory.chat_memory.messages if isinstance(msg, SystemMessage) is False]
            ) if agent == "answer" else ""

            full_prompt = prompt_templates[agent].format(
                system_prompt=system_prompts[agent],
                document_context=document_context,
                chat_history=chat_history if agent == "answer" else "",
                user_input=query
            )

            response = None
            for _ in range(3):  # Retry mechanism for API call
                try:
                    response = llm[agent].invoke(full_prompt)
                    break
                except Exception as e:
                    print(f"API error: {e}. Retrying...", flush=True)
                    time.sleep(2)

            if not response:
                print("Bot: Sorry, I couldn't process your request at the moment.\n", flush=True)
                continue

            answer_text = response.get("content", "") if isinstance(response, dict) else response.content
            print(f"{agent.capitalize()}Bot:", answer_text, "\n", flush=True)

            if agent == "answer":
                memory.chat_memory.add_user_message(query)
                memory.chat_memory.add_ai_message(answer_text)
            elif agent == "quiz":
                quiz_active = True
                last_quiz_question = answer_text  # Store quiz question for answer checking

        except Exception as e:
            print(f"Error: {e}", flush=True)

if __name__ == "__main__":
    main()
