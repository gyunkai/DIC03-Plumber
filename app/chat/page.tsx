"use client";

import { useState, useEffect, useRef } from "react";
import { Send, LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import "katex/dist/katex.min.css";
import "highlight.js/styles/default.css";

type Message = {
  id?: string;
  content: string;
  sender: "user" | "bot";
  timestamp?: Date;
};

type PdfFile = {
  name: string;
  key: string;
  lastModified?: Date;
  size?: number;
};

interface UserInfo {
  id: string;
  name: string;
  email: string;
}

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pdfFiles, setPdfFiles] = useState<PdfFile[]>([]);
  const [selectedPdf, setSelectedPdf] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    async function fetchUserInfo() {
      try {
        const response = await fetch('/api/user/profile');
        if (!response.ok) {
          router.push('/login');
          return;
        }
        const data = await response.json();
        setUser(data.user);
      } catch (error) {
        console.error('Error fetching user info:', error);
        router.push('/login');
      } finally {
        setUserLoading(false);
      }
    }
    fetchUserInfo();
  }, [router]);

  useEffect(() => {
    async function fetchPdfList() {
      try {
        setLoading(true);
        const response = await fetch('/api/pdf-list');
        if (!response.ok) throw new Error('Failed to fetch PDF list');
        const data = await response.json();
        setPdfFiles(data.files);
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

  useEffect(() => {
    async function fetchPdfUrl() {
      if (!selectedPdf) return;
      try {
        setPdfLoading(true);
        setPdfUrl(null);
        const response = await fetch(`/api/pdf-url/${selectedPdf}`);
        if (!response.ok) throw new Error('Failed to fetch PDF URL');
        const data = await response.json();
        if (data.success && data.url) {
          setPdfUrl(data.url);
        }
      } catch (error) {
        console.error("Error fetching PDF URL:", error);
      } finally {
        setPdfLoading(false);
      }
    }
    fetchPdfUrl();
  }, [selectedPdf]);

  useEffect(() => {
    async function loadChatMessages() {
      if (!selectedPdf) return;
      try {
        const response = await fetch(`/api/chat/messages?pdfKey=${encodeURIComponent(selectedPdf)}`);
        if (!response.ok) {
          console.error("Failed to load chat messages");
          return;
        }
        const data = await response.json();
        if (data.success && Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      } catch (error) {
        console.error("Error loading chat messages:", error);
      }
    }
    loadChatMessages();
  }, [selectedPdf]);

  const handleSendMessage = async () => {
    if (input.trim() === "" || sendingMessage) return;
    const userMessage: Message = { content: input, sender: "user" };
    setMessages([...messages, userMessage]);
    setInput("");
    setSendingMessage(true);

    try {
      const saveResponse = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: userMessage.content,
          sender: userMessage.sender,
          pdfKey: selectedPdf,
        }),
      });
      if (!saveResponse.ok) {
        console.error("Failed to save user message");
      }
      const completionResponse = await fetch('/api/chat/completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          pdfKey: selectedPdf,
        }),
      });
      if (!completionResponse.ok) {
        throw new Error("Failed to get bot response");
      }
      const completionData = await completionResponse.json();
      if (completionData.success && completionData.message) {
        setMessages(prev => [...prev, completionData.message]);
      }
    } catch (error) {
      console.error("Error in chat interaction:", error);
      setMessages(prev => [...prev, {
        content: "Sorry, I encountered an error. Please try again.",
        sender: "bot"
      }]);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (response.ok) {
        router.push('/login');
      } else {
        console.error('Logout failed');
      }
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const getPdfUrl = (key: string) => {
    return `/api/pdf/${key}`;
  };

  return (
    <div className="w-full h-screen bg-white rounded-3xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Project Kiwi</h1>
        {userLoading ? (
          <div className="flex items-center">
            <div className="animate-pulse bg-gray-200 h-8 w-24 rounded"></div>
          </div>
        ) : (
          <div className="flex items-center">
            <div className="flex items-center mr-4">
              <User className="h-5 w-5 text-gray-500 mr-2" />
              <span className="font-medium">{user?.name || 'User'}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center text-red-500 hover:text-red-700"
            >
              <LogOut className="h-5 w-5 mr-1" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* PDF Viewer Area - 50% width */}
        <div className="w-[50%] p-4 overflow-hidden flex flex-col">
          {/* File selection dropdown */}
          <div className="flex items-center mb-4">
            <h2 className="text-lg font-bold mr-4">Select PDF:</h2>
            <select
              className="border border-gray-300 rounded p-2"
              value={selectedPdf || ""}
              onChange={(e) => setSelectedPdf(e.target.value)}
            >
              {pdfFiles.map((pdf, index) => (
                <option key={index} value={pdf.key}>
                  {pdf.name}
                </option>
              ))}
            </select>
          </div>
          <h2 className="text-lg font-bold mb-2">PDF Viewer</h2>
          <div className="flex-1 h-[calc(100vh-200px)] relative">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <p>Loading PDF files...</p>
              </div>
            ) : pdfLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                <p className="ml-3">Loading PDF...</p>
              </div>
            ) : selectedPdf && pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="w-full h-full border-0"
                title="PDF Viewer"
                onLoad={() => console.log("PDF loaded successfully")}
              />
            ) : selectedPdf ? (
              <iframe
                src={getPdfUrl(selectedPdf)}
                className="w-full h-full border-0"
                title="PDF Viewer"
                onLoad={() => console.log("PDF loaded successfully (fallback)")}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p>No PDF files available</p>
              </div>
            )}
          </div>
        </div>

        {/* Chat Area - 50% width */}
        <div className="w-[50%] border-l border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-bold">Chat</h2>
          </div>
          <div className="flex-1 p-4 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="text-gray-500 text-center mt-4">
                No messages yet. Start a conversation!
              </div>
            ) : (
              <>
                {messages.map((message, index) => (
                  <div
                    key={message.id || index}
                    className={`mb-3 p-3 rounded ${message.sender === "user"
                      ? "bg-blue-100 ml-auto"
                      : "bg-gray-100"
                      } max-w-[90%] ${message.sender === "user" ? "ml-auto" : "mr-auto"}`}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex, rehypeHighlight]}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
          <div className="p-4 border-t border-gray-200">
            <div className="flex">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Type your question..."
                disabled={sendingMessage}
                className="flex-1 border border-gray-300 rounded-l-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
              <button
                onClick={handleSendMessage}
                disabled={sendingMessage}
                className="bg-blue-500 text-white px-4 py-2 rounded-r-md hover:bg-blue-600 disabled:bg-blue-300 flex items-center justify-center"
              >
                {sendingMessage ? (
                  <div className="w-5 h-5 border-t-2 border-white rounded-full animate-spin"></div>
                ) : (
                  <Send size={20} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
