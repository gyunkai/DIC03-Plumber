import os
from langchain.schema import HumanMessage
from langchain_openai import ChatOpenAI  # Make sure to install langchain-openai via pip

def main():
    # Retrieve API key from environment variable
    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY environment variable is not set.")

    # Initialize ChatOpenAI Model using the new import and usage
    llm = ChatOpenAI(openai_api_key=OPENAI_API_KEY, model="gpt-3.5-turbo")

    print("Type your questions below. Type 'exit' or 'quit' to end the session.\n", flush=True)
    while True:
        query = input("User: ")
        if query.lower() in ["exit", "quit"]:
            break
        # Wrap the query in a HumanMessage and use the invoke method
        response = llm.invoke([HumanMessage(content=query)])
        print("Bot:", response.content, "\n", flush=True)

if __name__ == "__main__":
    main()
