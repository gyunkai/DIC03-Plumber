"use client";

import { useState, useEffect } from "react";
import { Send, ChevronLeft, ChevronRight } from "lucide-react";

type Messages = {
  text: string;
  sender: "user" | "bot";
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Messages[]>([]);
  const [input, setInput] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);

  // List of PDF files stored in the public folder
  const pdfFiles = [
    { name: "Lecture 1", file: "/pdf/Lecture1.pdf", id: "Lecture1.pdf" },
    { name: "Lecture 2", file: "/pdf/Lecture2.pdf", id: "Lecture2.pdf" },
  ];

  const [selectedPdf, setSelectedPdf] = useState(pdfFiles[0].file);
  const [selectedPdfId, setSelectedPdfId] = useState(pdfFiles[0].id);

  // Load PDF embeddings when a new PDF is selected
  const loadPdfEmbeddings = async (pdfId: string) => {
    setLoadingPdf(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pdfName: pdfId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to load PDF embeddings');
      }

      // Add system message to indicate PDF was loaded
      setMessages(prev => [...prev, {
        text: `PDF "${pdfId}" loaded successfully. You can now ask questions about it.`,
        sender: "bot"
      }]);
    } catch (error) {
      console.error('Error loading PDF embeddings:', error);
      setMessages(prev => [...prev, {
        text: "Failed to load PDF embeddings. You may still be able to chat, but responses might not be based on the selected document.",
        sender: "bot"
      }]);
    } finally {
      setLoadingPdf(false);
    }
  };

  // Handle PDF selection
  const handleSelectPdf = (pdfFile: string, pdfId: string) => {
    setSelectedPdf(pdfFile);
    setSelectedPdfId(pdfId);
    loadPdfEmbeddings(pdfId);
  };

  // Load initial PDF embeddings
  useEffect(() => {
    loadPdfEmbeddings(selectedPdfId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSendMessage = async () => {
    if (input.trim() === "") return;

    const userMessage: Messages = { text: input, sender: "user" };
    setMessages([...messages, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          pdfName: selectedPdfId, // Include the current PDF ID
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      setMessages(prev => [...prev, { text: data.answer, sender: "bot" }]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, { text: "Sorry, I encountered an error. Please try again.", sender: "bot" }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full h-screen bg-white rounded-3xl overflow-hidden flex flex-col">
      <div className="flex flex-1 flex-col md:flex-row">
        {/* Left Sidebar: Collapsible PDF File Selector */}
        <div
          className={`border-r border-gray-200 p-4 transition-all duration-300 ${isSidebarOpen ? "w-full md:w-[200px]" : "w-0 md:w-[50px]"
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
                    onClick={() => handleSelectPdf(pdf.file, pdf.id)}
                    className={`p-2 mb-2 cursor-pointer rounded hover:bg-blue-50 ${selectedPdf === pdf.file ? "bg-blue-100" : ""
                      }`}
                  >
                    {pdf.name}
                    {loadingPdf && selectedPdfId === pdf.id && (
                      <span className="ml-2 text-xs text-blue-500">Loading...</span>
                    )}
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
                className={`mb-2 p-3 rounded-lg ${msg.sender === "user"
                  ? "bg-blue-100 self-end"
                  : "bg-gray-100 self-start"
                  }`}
              >
                {msg.text}
              </div>
            ))}
            {isLoading && (
              <div className="bg-gray-100 self-start p-3 rounded-lg">
                Thinking...
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div className="mt-auto p-4">
            <div className="w-full flex items-center bg-gray-100 p-3 rounded-xl">
              <input
                className="w-full bg-transparent outline-none text-lg"
                placeholder="Type message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                disabled={isLoading || loadingPdf}
              />
              <button
                className="p-2"
                onClick={handleSendMessage}
                disabled={isLoading || loadingPdf}
              >
                <Send size={24} className={`${isLoading || loadingPdf ? "text-gray-400" : "text-gray-600"}`} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
