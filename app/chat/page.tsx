"use client";

import { useState, useEffect, useRef } from "react";

import {
  Send,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  FileText,
  BookOpen,
} from "lucide-react";
import { useRouter } from "next/navigation";
import MarkdownWithPageLinks from "@/components/MarkdownWithPageLinks";
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

  const [selectedCourse, setSelectedCourse] = useState<string | null>(
    "machine-learning"
  );

  // ── NEW: Quiz Mode States ─────────────────────────
    // Quiz mode states (replace the hard-coded ones with dynamic ones)
  const [isQuizMode, setIsQuizMode] = useState(false);
  const [quizQuestion, setQuizQuestion] = useState("");
  const [quizOptions, setQuizOptions] = useState<string[]>([]);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [quizFeedback, setQuizFeedback] = useState("");
  const QuizAnswer = "Paris";
  const explanation = "Paris is the capital and largest city of France.";
  // ── End NEW: Quiz Mode States ───────────────────────

  // ── NEW: Handle Quiz Answer Click ───────────────────
  // Function to generate a quiz question via Kiwi Bot (backend builds the quiz prompt)
      const handleGenerateQuizQuestion = async () => {
        if (!user || !selectedPdf) {
          console.warn("User info or PDF not loaded; cannot generate quiz.");
          return;
        }

        try {
          // Instead of building the prompt here, we simply send a quiz_mode flag
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              // You can send a placeholder message if needed
              message: "Generate a quiz question",
              pdfName: selectedPdf,
              quiz_mode: true, // Tell backend to use quiz mode prompt
              userId: user.id,
              userName: user.name,
              userEmail: user.email,
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to generate quiz question");
          }

          const data = await response.json();
          console.log("Quiz response data:", data);

          const botAnswerRaw = data.answer; // The raw response including formatting
          console.log("botAnswerRaw:", botAnswerRaw);

          // Remove code block markers if present
          const botAnswerClean = botAnswerRaw
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

          console.log("botAnswerClean:", botAnswerClean);

          let parsed;
          try {
            parsed = JSON.parse(botAnswerClean);
          } catch (err) {
            console.error("Quiz Bot response was not valid JSON after cleaning. Response:", botAnswerClean);
            setQuizQuestion("Error: Could not parse quiz question.");
            return;
          }

          // Update quiz states with the parsed data
          setQuizQuestion(parsed.question || "No question provided");
          setQuizOptions(parsed.options || []);
          setCorrectAnswer(parsed.answer || "");
          setQuizFeedback("");
        } catch (error) {
          console.error("Error generating quiz question:", error);
        }
      };

      // Function to check the quiz answer
      const handleQuizAnswer = (selectedOption: string) => {
        // For options formatted as "A. Option text"
        if (selectedOption.charAt(0).toUpperCase() === correctAnswer.toUpperCase()) {
          setQuizFeedback("Correct!");
        } else {
          setQuizFeedback(`Incorrect! The correct answer is ${correctAnswer}.`);
        }
      };


  // ── NEW: Session History ─────────────────────────
  const [showHistoryModal, setShowHistoryModal] = useState(false);

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

        key: `lapdf/Lecture ${i + 1}.pdf`,
      })),
    },
    {
      id: "probability",
      name: "Probability and Statistics",
      lectures: Array.from({ length: 27 }, (_, i) => ({

        name: `Prob Lecture ${String(i + 1).padStart(2, "0")}`,
        key: `pbpdf/Lecture ${String(i + 1).padStart(2, "0")}.pdf`,
      })),
    },
    {
      id: "calculus",
      name: "Multivariable Calculus",
      lectures: Array.from({ length: 27 }, (_, i) => ({
        name: `Calculus Lecture ${i + 1}`,

        key: `mulpdf/lecture ${i + 1}.pdf`,
      })),
    },
  ];


  // Fetch Chat history 

  const [sessionHistory, setSessionHistory] = useState<any[]>([]);

  const fetchSessionHistory = async () => {
    if (!user?.id) return;
    try {
      const response = await fetch("/api/session-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
      });
  
      const data = await response.json();
      setSessionHistory(data.sessions || []);
    } catch (error) {
      console.error("Error fetching session history:", error);
    }
  };
  // Load session messages
  const handleLoadSessionMessages = async (sessionId: string) => {
    console.log("\uD83D\uDD0D Selected session:", sessionId);
  
    try {
      const response = await fetch(`/api/session/${sessionId}/messages`);
      if (!response.ok) {
        throw new Error("Failed to fetch session messages");
      }
  
      const data = await response.json();
  
      // Optional: Update UI with session metadata like pdf
      if (data.metadata?.pdfname) {
        setSelectedPdf(`mlpdf/${data.metadata.pdfname}`); // match your logic
      }
  
      const formattedMessages = (data.messages || []).map((msg: any) => ({
        sender: msg.sender,
        content: msg.message,
        timestamp: msg.timestamp ? new Date(msg.timestamp) : undefined,
      }));
  
      setMessages(formattedMessages);
      setShowHistoryModal(false);
    } catch (error) {
      console.error("Error loading session messages:", error);
    }
  };

  
  useEffect(() => {
    // Auto-select first lecture of machine-learning course.
    if (courses.length > 0 && courses[0].lectures.length > 0) {
      setSelectedCourse("machine-learning");
      setSelectedPdf(courses[0].lectures[0].key);
      (async () => {
        try {
          setPdfLoading(true);
          const response = await fetch(
            `/api/pdf-url?key=${encodeURIComponent(courses[0].lectures[0].key)}`
          );
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

  }, []);

  const getCourseLectures = () => {
    if (!selectedCourse) return pdfFiles;
    const course = courses.find((c) => c.id === selectedCourse);
    return course ? course.lectures : pdfFiles;
  };

  const handleCourseSelect = (courseId: string) => {
    setSelectedCourse(courseId);

    const course = courses.find((c) => c.id === courseId);
    if (course && course.lectures.length > 0) {
      setSelectedPdf(course.lectures[0].key);
    }
  };

  // Scroll to bottom when messages update.
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);


  // Fetch user info from backend.
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
        console.log("🔍 API /api/user/profile returned:", data);
        console.log("🔍 API /api/user/profile returned:", user?.id);

        fetchSessionHistory(); // Fetch session history after user info
      } catch (error) {
        console.error("Error fetching user info:", error);
        router.push("/login");  
      } finally {
        setUserLoading(false);
      }
    }
    fetchUserInfo();
  }, [router]);

  // Get PDF files list from backend.
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

  // FIRST: fetch and set the user (but don’t call fetchSessionHistory here)
useEffect(() => {
  async function fetchUserInfo() {
    try {
      const response = await fetch("/api/user/profile");
      if (!response.ok) return router.push("/login");
      const data = await response.json();
      setUser(data.user); // just set user
    } catch (err) {
      console.error("Failed to fetch user info", err);
      router.push("/login");
    } finally {
      setUserLoading(false);
    }
  }

  fetchUserInfo();
}, [router]);

// SECOND: once user is loaded, trigger session history fetch
useEffect(() => {
  if (user?.id) {
    console.log("📦 Fetching session history for user:", user.id);
    fetchSessionHistory();
  }
}, [user]); // ⬅️ only runs when user is set

  // Fetch PDF URL when selected PDF changes.
  useEffect(() => {
    async function fetchPdfUrl() {
      if (!selectedPdf) return;
      try {
        setPdfLoading(true);
        setPdfUrl(null);

        const response = await fetch(
          `/api/pdf-url?key=${encodeURIComponent(selectedPdf)}`
        );
        if (!response.ok) throw new Error("Failed to fetch PDF URL");
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

  // Load chat messages when selected PDF changes.
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

  const handleNewSession = async () => {
    if (!user || !selectedPdf) return;
  
    try {
      const response = await fetch("/api/session/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          pdfName: selectedPdf.split("/").pop(), // just filename
        }),
      });
  
      if (response.ok) {
        const data = await response.json();
        setMessages([]); // reset UI
        fetchSessionHistory(); // refresh session list
      } else {
        console.error("Failed to start new session");
      }
    } catch (err) {
      console.error("Error creating new session:", err);
    }
  };
  

  const handleSendMessage = async () => {
    if (input.trim() === "" || sendingMessage) return;
    const userMessage: Message = { content: input, sender: "user" };
    setMessages([...messages, userMessage]);
    setInput("");
    setSendingMessage(true);
    try {

      const saveResponse = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: userMessage.content,
          sender: userMessage.sender,
          pdfKey: selectedPdf,
        }),
      });
      if (!saveResponse.ok) {
        console.error("Failed to save user message");
      }

      console.log("🔍 Sending message with user info:", {
        userId: user?.id,
        userName: user?.name,
        userEmail: user?.email,
      });

      const completionResponse = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          pdfName: selectedPdf,
          userId: user?.id,
          userName: user?.name,
          userEmail: user?.email,
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


  const getPdfUrl = (key: string) => {
    return `/api/pdf?key=${encodeURIComponent(key)}`;
  };

  // ── NEW: Handle Quiz Answer Click ──
  

  // ── NEW: Toggle Quiz Mode ──
  // Toggles between chat mode and quiz mode and clears previous quiz feedback.
  const toggleQuizMode = () => {
    setIsQuizMode((prev) => {
      if (prev) {
        // We're leaving quiz mode: clear quiz data
        setQuizQuestion("");
        setQuizOptions([]);
        setCorrectAnswer("");
      }
      return !prev;
    });
    setQuizFeedback("");
  };
  

  // 在页面组件中添加一个全局的消息监听器
  useEffect(() => {
    // 监听PDF.js查看器发来的页面变化事件
    const handlePageChange = (event: MessageEvent) => {
      if (event.data && event.data.type === 'PDF_PAGE_CHANGE') {
        // Log page change event with detailed information (English)
        console.log(`[PDF Event] Page changed: ${event.data.page}/${event.data.total} for PDF: ${selectedPdf}`);

        // 发送当前页码信息到后端
        if (selectedPdf) {
          console.log(`[PDF Backend] Sending current page data to backend - PDF: ${selectedPdf}, Page: ${event.data.page}/${event.data.total}`);

          fetch('/api/current-page', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              pdfKey: selectedPdf,
              currentPage: event.data.page,
              totalPages: event.data.total
            })
          })
            .then(response => {
              // Log response status (English)
              console.log(`[PDF Backend] Server responded with status: ${response.status} ${response.ok ? '(Success)' : '(Failed)'}`);
              return response.json();
            })
            .then(data => {
              // Log response data (English)
              console.log('[PDF Backend] Response data:', data);
            })
            .catch(error => {
              console.error('[PDF Backend] Error sending page info to backend:', error);
            });
        }
      }
    };

    window.addEventListener('message', handlePageChange);

    return () => {
      window.removeEventListener('message', handlePageChange);
    };
  }, [selectedPdf]);

  return (
    <div className="w-full h-screen bg-gray-50 flex flex-col">
      {/* HEADER */}
      <div className="bg-white shadow-md border-b border-gray-200 p-4 flex justify-between items-center">
        {/* ── NEW: Upper Left Quiz Mode Toggle Button ── */}
        <div className="flex items-center">
            <button
              onClick={toggleQuizMode}
              className="mr-2 px-2 py-1 bg-blue-500 text-white rounded"
            >
              {isQuizMode ? "Quit Quiz Mode" : "Quiz Mode"}
            </button>
            {isQuizMode && (
              <button
                onClick={handleGenerateQuizQuestion}
                className="mr-2 px-2 py-1 bg-green-500 text-white rounded"
              >
                Generate Quiz Question
              </button>
            )}
          </div>
        <h1 className="text-2xl font-bold text-gray-800">Chat Interface</h1>
        {/* User info and logout button */}
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
            <button
                onClick={() => setShowHistoryModal(true)}
                className="flex items-center text-blue-600 hover:text-blue-800 mr-4"
              >
                <FileText className="h-5 w-5 mr-1" />
                <span>History</span>
              </button>

          </div>
        )}
      </div>
        
      {/* SESSION HISTORY MODAL */}
        {showHistoryModal && (
        <div className="fixed top-0 right-0 w-96 h-full bg-white shadow-lg z-50 border-l border-gray-300 overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Session History</h2>
            <button
              onClick={() => setShowHistoryModal(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

    {/* New Session Button */}
    <button
      onClick={handleNewSession}
      className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 mb-4 ml-4"
    >
      Start New Session
    </button>

        <div className="p-4 space-y-4">
          {sessionHistory.length === 0 ? (
            <p className="text-gray-500">No session history available.</p>
          ) : (
            sessionHistory.map((session, idx) => {
              // Debug log for each session object
              console.log("🔍 Session object:", session);
              return (
                <div
                  key={idx}
                  // Ensure we're passing the correct field; if your schema uses "id", use that.
                  onClick={() => {
                    console.log("🧪 Selected session id:", session.id);
                    handleLoadSessionMessages(session.id);
                  }}
                  className="border rounded-md p-3 hover:bg-gray-50 cursor-pointer"
                >
                  <div className="text-sm mb-1">
                    <strong>PDF:</strong> {session.pdfname}
                  </div>
                  <div className="text-xs text-gray-600">
                    <strong>Started:</strong>{" "}
                    {new Date(session.sessionStartTime).toLocaleString()}
                  </div>
                  {session.sessionEndTime && (
                    <div className="text-xs text-gray-600">
                      <strong>Ended:</strong>{" "}
                      {new Date(session.sessionEndTime).toLocaleString()}
                    </div>
                  )}
                  {/* Conversation Preview */}
                  {Array.isArray(session.conversationhistory) &&
                    session.conversationhistory.length > 0 && (
                      <div className="mt-2 bg-gray-50 p-2 rounded text-xs max-h-40 overflow-y-auto">
                        <div className="mb-1 font-semibold text-gray-700">
                          Conversation:
                        </div>
                        {session.conversationhistory.map((msg: any, i: number) => (
                          <div key={i} className="mb-1">
                            <strong className="capitalize">{msg.sender}:</strong>{" "}
                            {msg.message}
                            {msg.timestamp && (
                              <span className="ml-2 text-gray-400 text-[10px]">
                                (
                                {new Date(msg.timestamp).toLocaleTimeString()}
                                )
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              );
            })
          )}
        </div>
      </div>
)}


      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
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

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 flex flex-row overflow-hidden">
          {/* Sidebar toggle button */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="absolute top-10 left-5 z-10 bg-white rounded-full p-2 shadow"
          >
            {isSidebarOpen ? <ChevronLeft /> : <ChevronRight />}
          </button>

          {/* PDF VIEWER (70% width) */}
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
                <div className="w-full h-full flex flex-col">
                  <div className="bg-gray-100 p-2 flex items-center justify-between">
                    <span className="text-sm">PDF: {selectedPdf}</span>
                  </div>

                  <div className="flex-1 overflow-hidden">
                    {/* PDF viewer using PDF.js with proxy to avoid CORS issues */}
                    <iframe
                      src={(() => {
                        if (!pdfUrl) return '';
                        // Use our proxy to access the PDF from the same origin
                        const proxyUrl = `/api/pdf-proxy?url=${encodeURIComponent(pdfUrl)}`;
                        // Add parameters to support communication and disable same-origin restrictions
                        return `/pdfjs/web/viewer.html?file=${encodeURIComponent(proxyUrl)}&disableXfa=true&embedded=true`;
                      })()}
                      className="w-full h-full border-0"
                      name="pdfjs-viewer"
                      id="pdfjs-iframe"
                      onLoad={() => {
                        console.log("PDF.js viewer loaded");
                        setPdfLoading(false);

                        // Load the page listener script after iframe is loaded
                        const script = document.createElement('script');
                        script.src = `/js/pdf-page-direct-listener.js?t=${new Date().getTime()}`; // Add timestamp to prevent caching
                        document.body.appendChild(script);

                        // Clean up on unmount
                        return () => {
                          try {
                            if (script && script.parentNode) {
                              script.parentNode.removeChild(script);
                            }
                          } catch (e) {
                            console.error('Error removing script:', e);
                          }
                        };
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p>No PDF selected</p>
                </div>
              )}
            </div>
          </div>


          {/* CHAT / QUIZ SECTION (50% width) */}
          <div className="w-1/2 border-l border-gray-200 flex flex-col">
            {/* Chat header (removed duplicated quiz toggle here) */}
            <div className="p-4 border-b border-gray-200 bg-white shadow-sm">
              <h2 className="text-xl font-bold text-gray-800">Chat</h2>
            </div>
            {isQuizMode ? (
            <div className="flex-1 p-4 overflow-y-auto bg-white">
              {quizQuestion ? (
                <>
                  <p className="mb-4 font-semibold">{quizQuestion}</p>
                  <div className="flex flex-col gap-2">
                    {quizOptions.map((option, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleQuizAnswer(option)}
                        className="p-3 rounded-lg bg-gray-100 hover:bg-blue-50 text-left"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  {quizFeedback && (
                    <div className="mt-4 p-3 rounded-lg bg-gray-100">
                      {quizFeedback}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-gray-500">
                  Click "Generate Quiz Question" to start a quiz!
                </p>
              )}
            </div>
          ) : (
              // Existing Chat UI Block
              <>
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
                          <MarkdownWithPageLinks content={message.content} />
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}