import os
from langchain.schema import HumanMessage
from langchain_openai import ChatOpenAI  # Ensure you have updated package installed: pip install -U langchain-openai
from langchain.memory import ConversationBufferMemory
from langchain.chains import ConversationChain

def main():
    # Retrieve API key from environment variable
    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY environment variable is not set.")

    # Initialize the ChatOpenAI model
    llm = ChatOpenAI(openai_api_key=OPENAI_API_KEY, model="gpt-4o")

    # Set up conversation memory; the memory_key "chat_history" will hold prior conversation turns
    memory = ConversationBufferMemory(memory_key="history", return_messages=True)

    # Create a ConversationChain that uses the LLM and memory
    conversation = ConversationChain(llm=llm, memory=memory)

    print("Type your questions below. Type 'exit' or 'quit' to end the session.\n", flush=True)
    while True:
        query = input("User: ")
        if query.lower() in ["exit", "quit"]:
            break
        # Use the conversation chain to get a response; this chain automatically incorporates memory
        response = conversation.predict(input=query)
        print("Bot:", response, "\n", flush=True)

if __name__ == "__main__":
    main()
