"use client";

import { useState, useEffect } from "react";
import { Send, ChevronLeft, ChevronRight } from "lucide-react";

type Messages = {
  text: string;
  sender: "user" | "bot";
};

type PdfFile = {
  name: string;
  key: string;
  lastModified?: Date;
  size?: number;
};

export default function chat() {
  const [messages, setMessages] = useState<Messages[]>([]);
  const [input, setInput] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [pdfFiles, setPdfFiles] = useState<PdfFile[]>([]);
  const [selectedPdf, setSelectedPdf] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Get PDF files list
  useEffect(() => {
    async function fetchPdfList() {
      try {
        setLoading(true);
        const response = await fetch('/api/pdf-list');
        if (!response.ok) throw new Error('Failed to fetch PDF list');
        const data = await response.json();
        setPdfFiles(data.files);

        // If there are PDF files, select the first one
        if (data.files.length > 0) {
          setSelectedPdf(data.files[0].key);
        }
      } catch (error) {
        console.error("Error fetching PDF list:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchPdfList();
  }, []);

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

  // Generate PDF URL
  const getPdfUrl = (key: string) => {
    return `/api/pdf/${key}`;
  };

  return (
    <div className="w-full h-screen bg-white rounded-3xl overflow-hidden flex flex-col">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div
          className={`bg-gray-50 transition-all duration-300 ${isSidebarOpen ? "w-64" : "w-0"
            } overflow-hidden`}
        >
          <div className="p-4">
            <h2 className="text-lg font-bold mb-2">PDF Files</h2>
            <ul>
              {pdfFiles.map((pdf, index) => (
                <li
                  key={index}
                  onClick={() => setSelectedPdf(pdf.key)}
                  className={`p-2 mb-2 cursor-pointer rounded hover:bg-blue-50 ${selectedPdf === pdf.key ? "bg-blue-100" : ""
                    }`}
                >
                  {pdf.name}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Sidebar toggle button */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="absolute top-4 left-4 z-10 bg-white rounded-full p-2 shadow"
          >
            {isSidebarOpen ? <ChevronLeft /> : <ChevronRight />}
          </button>

          {/* PDF viewer */}
          <div className="flex-1 p-4 overflow-hidden flex flex-col">
            <h2 className="text-lg font-bold mb-2">PDF Viewer</h2>
            <div className="flex-1 h-[calc(100vh-150px)]">
              {loading ? (
                <div className="flex-1 flex items-center justify-center">
                  <p>Loading PDF files...</p>
                </div>
              ) : selectedPdf ? (
                <iframe
                  src={getPdfUrl(selectedPdf)}
                  className="w-full h-full border-0"
                  title="PDF Viewer"
                />
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p>No PDF files available</p>
                </div>
              )}
            </div>
          </div>

          {/* Chat area */}
          <div className="border-t border-gray-200 p-4">
            <div className="mb-4 max-h-40 overflow-y-auto">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`mb-2 p-2 rounded ${message.sender === "user"
                    ? "bg-blue-100 ml-auto"
                    : "bg-gray-100"
                    } max-w-[80%] ${message.sender === "user" ? "ml-auto" : "mr-auto"
                    }`}
                >
                  {message.text}
                </div>
              ))}
            </div>
            <div className="flex">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Type your question..."
                className="flex-1 border border-gray-300 rounded-l-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSendMessage}
                className="bg-blue-500 text-white px-4 py-2 rounded-r-md hover:bg-blue-600"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
