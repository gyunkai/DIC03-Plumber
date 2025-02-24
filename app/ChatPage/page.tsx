"use client";

import { useState } from "react";
import { Send } from "lucide-react";

type Messages = {
    text : string;
    sender : "user" | "bot";
};

export default function ChatPage() {
    const [messages, setMessages] = useState<Messages[]>([]);
    const [input, setInput] = useState("");

    const handleSendMessage = () => {
        if (input.trim() === "") return;
        const userMessage: Messages = { text: input, sender: "user" };
        const botResponse: Messages = { text: `Hello! You said: "${input}"`, sender: "bot" };
        
        setMessages([...messages, userMessage, botResponse]);
        setInput("");
    };

    return (
        <div className="w-full h-screen bg-white rounded-3xl overflow-hidden flex flex-col">
            <div className="flex flex-1 flex-col md:flex-row">
                {/* Sidebar */}
                <div className="w-full md:w-[327px] h-auto md:h-full bg-white border-r border-gray-200 flex flex-col justify-between p-4">
                    <div>
                        <button className="w-full p-3 bg-black text-white rounded-xl text-center">New Chat</button>
                        <div className="mt-4">
                            <div className="p-3 rounded-lg flex items-center gap-2 bg-gray-100">
                                <span className="text-sm">For Loops Explanation</span>
                            </div>
                            <div className="p-3 rounded-lg flex items-center gap-2 bg-gray-100 mt-2">
                                <span className="text-sm">Lists and Tuples Comparison</span>
                            </div>
                        </div>
                    </div>
                    <div className="p-3 rounded-lg flex items-center gap-2 bg-gray-100">
                        <img src="https://ui-avatars.com/api/?name=Kenny+Su&background=random" alt="User Avatar" className="w-10 h-10 rounded-full" />
                        <span className="text-xl">Kenny Su</span>
                    </div>
                </div>
                
                {/* Chat Area */}
                <div className="flex-1 flex flex-col p-4 relative">
                    {/* NYU Logo */}
                    {messages.length === 0 && (
                        <div className="absolute top-[40%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                        <img src="/nyu-logo.png" alt="NYU Logo" className="w-40 h-auto object-contain" /></div>
                    )}
                    
                    {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {messages.map((msg, index) => (
                            <div key={index} className={`mb-2 p-3 rounded-lg ${msg.sender === "user" ? "bg-blue-100 self-end" : "bg-gray-100 self-start"}`}>
                                {msg.text}
                            </div>
                        ))}
                    </div>
                    
                    {/* Chat Input */}
                    <div className="mt-auto p-4">
                        <div className="w-full flex items-center bg-gray-100 p-3 rounded-xl">
                            <input
                                className="w-full bg-transparent outline-none text-lg"
                                placeholder="Type message"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                            />
                            <button className="p-2" onClick={handleSendMessage}>
                                <Send size={24} className="text-gray-600"/>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
