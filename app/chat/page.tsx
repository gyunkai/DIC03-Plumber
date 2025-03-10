"use client";

import { useState } from "react";
import { Send, ChevronLeft, ChevronRight } from "lucide-react";

type Messages = {
  text: string;
  sender: "user" | "bot";
};

export default function chat() {
  const [messages, setMessages] = useState<Messages[]>([]);
  const [input, setInput] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // List of PDF files stored in the public folder
  const pdfFiles = [
    { name: "Lecture 1", file: "/pdf/Lecture1.pdf" },
    { name: "Lecture 2", file: "/pdf/Lecture2.pdf" },
  ];

  const [selectedPdf, setSelectedPdf] = useState(pdfFiles[0].file);

  const handleSendMessage = () => {
    if (input.trim() === "") return;
    const userMessage: Messages = { text: input, sender: "user" };
    const botResponse: Messages = {
      text: `Hello! You said: "${input}"`,
      sender: "bot",
    };

    setMessages([...messages, userMessage, botResponse]);
    setInput("");
  };

  return (
    <div className="w-full h-screen bg-white rounded-3xl overflow-hidden flex flex-col">
      <div className="flex flex-1 flex-col md:flex-row">
        {/* Left Sidebar: Collapsible PDF File Selector */}
        <div
          className={`border-r border-gray-200 p-4 transition-all duration-300 ${
            isSidebarOpen ? "w-full md:w-[200px]" : "w-0 md:w-[50px]"
          } overflow-hidden`}
        >
          <div className="flex justify-end mb-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              {isSidebarOpen ? (
                <ChevronLeft size={24} className="text-gray-600" />
              ) : (
                <ChevronRight size={24} className="text-gray-600" />
              )}
            </button>
          </div>
          {isSidebarOpen && (
            <>
              <h2 className="text-lg font-bold mb-4">Select a PDF</h2>
              <ul>
                {pdfFiles.map((pdf, index) => (
                  <li
                    key={index}
                    onClick={() => setSelectedPdf(pdf.file)}
                    className={`p-2 mb-2 cursor-pointer rounded hover:bg-blue-50 ${
                      selectedPdf === pdf.file ? "bg-blue-100" : ""
                    }`}
                  >
                    {pdf.name}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Main Content: PDF Viewer */}
        <div className="flex-1 h-full bg-white flex flex-col p-4">
          <h2 className="text-lg font-bold mb-2">PDF Viewer</h2>
          <div className="flex-1">
            <iframe
              src={selectedPdf}
              className="w-full h-full"
              title="PDF Viewer"
            />
          </div>
        </div>

        {/* Right Sidebar: Chat Window */}
        <div className="w-full md:w-[300px] h-auto md:h-full bg-white border-l border-gray-200 flex flex-col p-4">
          {/* Chat Header with NYU Logo */}
          <div className="flex items-center justify-center mb-4">
            <img
              src="/image/nyu-logo.png"
              alt="NYU Logo"
              className="w-24 h-auto object-contain"
            />
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`mb-2 p-3 rounded-lg ${
                  msg.sender === "user"
                    ? "bg-blue-100 self-end"
                    : "bg-gray-100 self-start"
                }`}
              >
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
                onKeyDown={(e) =>
                  e.key === "Enter" && handleSendMessage()
                }
              />
              <button className="p-2" onClick={handleSendMessage}>
                <Send size={24} className="text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
