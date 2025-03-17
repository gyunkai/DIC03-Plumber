"use client";

import { useState, useEffect, useRef } from "react";
import { Send, ChevronLeft, ChevronRight, LogOut, User, FileText } from "lucide-react";
import { useRouter } from "next/navigation";

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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

  // Scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Get user information
  useEffect(() => {
    async function fetchUserInfo() {
      try {
        const response = await fetch('/api/user/profile');
        if (!response.ok) {
          // If not authenticated, redirect to login page
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

  // Fetch PDF URL when selected PDF changes
  useEffect(() => {
    async function fetchPdfUrl() {
      if (!selectedPdf) return;

      try {
        setPdfLoading(true);
        setPdfUrl(null);

        // Get pre-signed URL for the PDF
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

  // Load chat messages when PDF changes
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
      // Save user message to database
      const saveResponse = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: userMessage.content,
          sender: userMessage.sender,
          pdfKey: selectedPdf,
        }),
      });

      if (!saveResponse.ok) {
        console.error("Failed to save user message");
      }

      // Get bot response
      const completionResponse = await fetch('/api/chat/completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
      // Add a fallback bot message if there's an error
      setMessages(prev => [...prev, {
        content: "Sorry, I encountered an error. Please try again.",
        sender: "bot"
      }]);
    } finally {
      setSendingMessage(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      if (response.ok) {
        // Redirect to login page after successful logout
        router.push('/login');
      } else {
        console.error('Logout failed');
      }
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  // Generate PDF URL (fallback to direct API if pre-signed URL fails)
  const getPdfUrl = (key: string) => {
    return `/api/pdf/${key}`;
  };

  return (
    <div className="w-full h-screen bg-white rounded-3xl overflow-hidden flex flex-col">
      {/* Header with user info and logout button */}
      <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Chat Interface</h1>

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
                    } flex items-center`}
                >
                  <FileText className="h-4 w-4 mr-2 text-gray-500" />
                  {pdf.name}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Main content area - now using flex row layout */}
        <div className="flex-1 flex flex-row overflow-hidden">
          {/* Sidebar toggle button */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="absolute top-20 left-4 z-10 bg-white rounded-full p-2 shadow"
          >
            {isSidebarOpen ? <ChevronLeft /> : <ChevronRight />}
          </button>

          {/* PDF viewer - now takes 70% of the width */}
          <div className="w-[70%] p-4 overflow-hidden flex flex-col">
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

          {/* Chat area - now takes 30% of the width and full height */}
          <div className="w-[30%] border-l border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-bold">Chat</h2>
            </div>

            {/* Messages container - takes all available height except input area */}
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
                        } max-w-[90%] ${message.sender === "user" ? "ml-auto" : "mr-auto"
                        }`}
                    >
                      {message.content}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input area - fixed at bottom */}
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
    </div>
  );
}
