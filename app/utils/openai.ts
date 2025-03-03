import OpenAI from 'openai';

// Get API key from environment variables
const apiKey = process.env.OPENAI_API_KEY ;

// Log API key information for debugging (safely)
if (apiKey) {
    const firstFive = apiKey.substring(0, 5);
    const lastFour = apiKey.substring(apiKey.length - 4);
    console.log(`API Key loaded: ${apiKey}...${lastFour} (length: ${apiKey.length})`);
} else {
    console.log('WARNING: OpenAI API Key is not set');
}

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generate embeddings for a text using OpenAI's embedding model
 * @param text The text to generate embeddings for
 * @returns An array of embedding values
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    try {
        const response = await openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: text,
        });

        return response.data[0].embedding;
    } catch (error) {
        console.error("Error generating embedding:", error);
        throw error;
    }
}

/**
 * Generate a chat completion using OpenAI's chat model
 * @param messages Array of messages in the conversation
 * @returns The AI's response text
 */
export async function generateChatResponse(messages: { role: string; content: string }[]): Promise<string> {
    try {
        // Convert messages to the format expected by OpenAI API
        const formattedMessages = messages.map(msg => {
            // Ensure role is one of the valid types
            const validRole = ['system', 'user', 'assistant'].includes(msg.role)
                ? msg.role
                : 'user';

            return {
                role: validRole as 'system' | 'user' | 'assistant',
                content: msg.content
            };
        });

        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: formattedMessages,
            temperature: 0.7,
        });

        return response.choices[0].message.content || "I'm not sure how to respond to that.";
    } catch (error) {
        console.error("Error generating chat response:", error);
        return "Sorry, I encountered an error while processing your request.";
    }
} 