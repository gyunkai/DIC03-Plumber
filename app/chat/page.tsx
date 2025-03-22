"use client";

import { useState, useEffect, useRef } from "react";
import { Send, ChevronLeft, ChevronRight, LogOut, User, FileText, BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

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
  const [selectedCourse, setSelectedCourse] = useState<string | null>("machine-learning");


  const courses = [
    {
      id: "machine-learning",
      name: "Machine Learning",
      lectures: Array.from({ length: 48 }, (_, i) => ({
        name: `ML Lecture ${i + 1}`,
        key: `mlpdf/lecture${i + 1}.pdf`
      }))
    },
    {
      id: "linear-algebra",
      name: "Linear Algebra",
      lectures: Array.from({ length: 28 }, (_, i) => ({
        name: `LA Lecture ${i + 1}`,
        key: `lapdf/Lecture ${i + 1}.pdf`
      }))
    },
    {
      id: "probability",
      name: "Probability and Statistics",
      lectures: Array.from({ length: 27 }, (_, i) => ({
        name: `Prob Lecture ${String(i + 1).padStart(2, '0')}`,
        key: `pbpdf/Lecture ${String(i + 1).padStart(2, '0')}.pdf`
      }))
    },
    {
      id: "calculus",
      name: "Multivariable Calculus",
      lectures: Array.from({ length: 27 }, (_, i) => ({
        name: `Calculus Lecture ${i + 1}`,
        key: `mulpdf/lecture ${i + 1}.pdf`
      }))
    }
  ];


  useEffect(() => {
    // 自动选择ML第一课
    if (courses.length > 0 && courses[0].lectures.length > 0) {
      setSelectedCourse("machine-learning");
      setSelectedPdf(courses[0].lectures[0].key);

      // 立即获取PDF URL
      (async () => {
        try {
          setPdfLoading(true);
          // 获取预签名URL
          const response = await fetch(`/api/pdf-url?key=${encodeURIComponent(courses[0].lectures[0].key)}`);

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.url) {
              setPdfUrl(data.url);
            }
          }
        } catch (error) {
          console.error("Failed to load initial PDF:", error);
        } finally {
          setPdfLoading(false);
        }
      })();
    }
  }, []);  // 只在组件挂载时运行一次

  const getCourseLectures = () => {
    if (!selectedCourse) return pdfFiles;
    const course = courses.find(c => c.id === selectedCourse);
    return course ? course.lectures : pdfFiles;
  };

  const handleCourseSelect = (courseId: string) => {
    setSelectedCourse(courseId);
    const course = courses.find(c => c.id === courseId);
    if (course && course.lectures.length > 0) {
      setSelectedPdf(course.lectures[0].key);
    }
  };

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch user info
  useEffect(() => {
    async function fetchUserInfo() {
      try {
        const response = await fetch("/api/user/profile");
        if (!response.ok) {
          router.push("/login");
          return;
        }
        const data = await response.json();
        setUser(data.user);
      } catch (error) {
        console.error("Error fetching user info:", error);
        router.push("/login");
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
        const response = await fetch("/api/pdf-list");
        if (!response.ok) throw new Error("Failed to fetch PDF list");
        const data = await response.json();
        setPdfFiles(data.files);


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
        const response = await fetch(`/api/pdf-url?key=${encodeURIComponent(selectedPdf)}`);

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
        const response = await fetch(
          `/api/chat/messages?pdfKey=${encodeURIComponent(selectedPdf)}`
        );
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
      const saveResponse = await fetch("/api/chat/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
      const completionResponse = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage.content,
          pdfName: selectedPdf,
        }),
      });
      if (!completionResponse.ok) {
        throw new Error("Failed to get bot response");
      }
      const completionData = await completionResponse.json();
      if (completionData.answer) {
        const botMessage: Message = {
          content: completionData.answer,
          sender: "bot",
        };
        setMessages((prev) => [...prev, botMessage]);
      } else {
        throw new Error("Invalid response format from bot");
      }
    } catch (error) {
      console.error("Error in chat interaction:", error);
      setMessages((prev) => [
        ...prev,
        {
          content: "Sorry, I encountered an error. Please try again.",
          sender: "bot",
        },
      ]);
    } finally {
      setSendingMessage(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });
      if (response.ok) {
        router.push("/login");
      } else {
        console.error("Logout failed");
      }
    } catch (error) {
      console.error("Error during logout:", error);
    }
  };

  // Generate PDF URL (fallback)
  const getPdfUrl = (key: string) => {
    return `/api/pdf?key=${encodeURIComponent(key)}`;
  };

  return (
    <div className="w-full h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-md border-b border-gray-200 p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Chat Interface</h1>
        {userLoading ? (
          <div className="flex items-center">
            <div className="animate-pulse bg-gray-200 h-8 w-24 rounded"></div>
          </div>
        ) : (
          <div className="flex items-center">
            <div className="flex items-center mr-4">
              <User className="h-5 w-5 text-gray-500 mr-2" />
              <span className="font-medium text-gray-700">
                {user?.name || "User"}
              </span>
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
            <h2 className="text-lg font-bold mb-4">Current Courses</h2>
            <ul className="mb-6">
              <li
                onClick={() => handleCourseSelect("machine-learning")}
                className={`p-2 mb-2 cursor-pointer rounded hover:bg-blue-50 ${selectedCourse === "machine-learning" ? "bg-blue-100" : ""
                  } flex items-center justify-between`}
              >
                <span>Machine Learning</span>
                <BookOpen className="h-4 w-4 text-gray-500" />
              </li>
            </ul>

            <h2 className="text-lg font-bold mb-4">Prerequisite Courses</h2>
            <ul className="mb-6">
              {courses.slice(1).map((course, index) => (
                <li
                  key={index}
                  onClick={() => handleCourseSelect(course.id)}
                  className={`p-2 mb-2 cursor-pointer rounded hover:bg-blue-50 ${selectedCourse === course.id ? "bg-blue-100" : ""
                    } flex items-center justify-between`}
                >
                  <span>{course.name}</span>
                  <BookOpen className="h-4 w-4 text-gray-500" />
                </li>
              ))}
            </ul>

            <h2 className="text-lg font-bold mb-2">PDF Files</h2>
            <ul className="overflow-y-auto max-h-[calc(100vh-350px)] pr-1">
              {(selectedCourse ? getCourseLectures() : pdfFiles).map((pdf, index) => (
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
            className="absolute top-10 left-5 z-10 bg-white rounded-full p-2 shadow"
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

          {/* Chat Section (50% width) */}
          <div className="w-1/2 border-l border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-white shadow-sm">
              <h2 className="text-xl font-bold text-gray-800">Chat</h2>
            </div>
            <div className="flex-1 p-4 overflow-y-auto bg-white">
              {messages.length === 0 ? (
                <div className="text-gray-500 text-center mt-4">
                  No messages yet. Start a conversation!
                </div>
              ) : (
                <>
                  {messages.map((message, index) => (
                    <div
                      key={message.id || index}
                      className={`mb-3 p-3 rounded max-w-[90%] ${message.sender === "user"
                        ? "bg-blue-100 ml-auto"
                        : "bg-gray-100 mr-auto"
                        }`}
                    >
                      <div className="prose prose-sm">
                        <ReactMarkdown
                          remarkPlugins={[remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) =>
                    e.key === "Enter" && handleSendMessage()
                  }
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
