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
  Menu,
  Image as ImageIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import MarkdownWithPageLinks from "@/components/MarkdownWithPageLinks";
import AudioPlayer from "../../components/AudioPlayer";
import GeneratedImage from "@/components/GeneratedImage";

type Message = {
  id?: string;
  content: string;
  sender: "user" | "bot";
  timestamp?: Date;
  image?: {
    url: string;
    prompt: string;
  };
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
  const [currentPageNumber, setCurrentPageNumber] = useState<number>(1);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [selectedCourse, setSelectedCourse] = useState<string | null>(
    "machine-learning"
  );

  // ── NEW: Quiz Mode States ─────────────────────────
  // Quiz mode states (replace the hard-coded ones with dynamic ones)
  const [isQuizMode, setIsQuizMode] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [quizFeedback, setQuizFeedback] = useState<{
    isCorrect?: boolean;
    answer?: string;
    explanation?: string;
  }>({});
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [quizError, setQuizError] = useState("");
  // Quiz settings
  const [quizNumQuestions, setQuizNumQuestions] = useState(3);
  const [quizDifficulty, setQuizDifficulty] = useState<
    "easy" | "medium" | "hard"
  >("medium");
  const [showQuizSettings, setShowQuizSettings] = useState(true);
  // ── End NEW: Quiz Mode States ───────────────────────

  // ── NEW: Handle Quiz Answer Click ───────────────────
  // This function checks if the selected answer is correct.
  const handleQuizAnswer = (selectedOption: string) => {
    if (!quizQuestions || quizQuestions.length === 0) return;

    const currentQuestion = quizQuestions[currentQuestionIndex];
    if (selectedOption === currentQuestion.correctAnswer) {
      setQuizFeedback({
        isCorrect: true,
        answer: currentQuestion.correctAnswer,
        explanation: currentQuestion.explanation,
      });
    } else {
      setQuizFeedback({
        isCorrect: false,
        answer: currentQuestion.correctAnswer,
        explanation: currentQuestion.explanation,
      });
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
        key: `mlpdf/lecture${i + 1}.pdf`,
      })),
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

  // FIRST: fetch and set the user (but don't call fetchSessionHistory here)
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
          pdfname: selectedPdf.split("/").pop(), // just filename
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

  // 添加监视currentPageNumber变化的useEffect
  useEffect(() => {
    console.log("currentPageNumber状态已更新:", currentPageNumber);
  }, [currentPageNumber]);

  const handleSendMessage = async () => {
    console.log("🚀 开始执行handleSendMessage函数");
    console.log("📄 当前页码状态:", currentPageNumber, typeof currentPageNumber);
    if (input.trim() === "" || sendingMessage) return;
    console.log("输入有效，继续执行");

    const userMessage: Message = { content: input, sender: "user" };
    setMessages([...messages, userMessage]);
    setInput("");
    setSendingMessage(true);
    console.log("设置用户消息状态完成");

    try {
      // 检查是否为图片请求，简化判断逻辑
      const isImageRequest = input.toLowerCase().includes("image");
      console.log("是否为图片请求:", isImageRequest);

      if (isImageRequest) {
        console.log("处理图片请求...");
        // Generate image using context
        const response = await fetch("/api/image/context", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: input,
            pdfName: selectedPdf,
            userId: user?.id,
            userName: user?.name,
            userEmail: user?.email,
            pageNumber: currentPageNumber,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to generate image");
        }

        const data = await response.json();
        console.log("Image generation response:", data); // Add this for debugging

        // Add image message to chat
        const imageMessage: Message = {
          content: "Here's the generated image based on our conversation:",
          sender: "bot",
          image: {
            url: data.url,
            prompt: data.prompt,
          },
        };

        setMessages((prev) => [...prev, imageMessage]);
      } else {
        console.log("处理普通聊天请求...");
        // Regular chat message handling
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
        console.log("用户消息已保存");

        // Create a new bot message placeholder
        const botMessage: Message = {
          content: "",
          sender: "bot",
        };
        setMessages((prev) => [...prev, botMessage]);
        console.log("添加机器人消息占位符");

        // Send the message to the streaming endpoint
        const requestData = {
          message: userMessage.content,
          pdfUrl: pdfUrl,
          pdfName: selectedPdf,
          userId: user?.id,
          userName: user?.name,
          userEmail: user?.email,
          pageNumber: Number(currentPageNumber),
        };

        // 查看发送到后端的数据格式
        console.log("📤 发送到后端的数据:", JSON.stringify(requestData));
        console.log("🔢 pageNumber的值和类型:", requestData.pageNumber, typeof requestData.pageNumber);

        const response = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestData),
        });
        console.log("后端响应状态:", response.status);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to get bot response");
        }

        // Create a reader for the response stream
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Failed to get response reader");
        }

        // Create a buffer to store the complete message
        let buffer = "";
        let lastMessageContent = "";

        // Read the stream
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Convert the chunk to text
          const text = new TextDecoder().decode(value);
          buffer += text;

          // Process complete SSE messages
          const messages = buffer.split('\n\n');
          // Keep the last incomplete message in the buffer
          buffer = messages.pop() || "";

          for (const message of messages) {
            if (message.startsWith('data: ')) {
              try {
                const data = JSON.parse(message.slice(6));
                if (data.error) {
                  throw new Error(data.error);
                }
                if (data.answer) {
                  lastMessageContent += data.answer;
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    if (lastMessage.sender === "bot") {
                      lastMessage.content = lastMessageContent;
                      return newMessages;
                    }
                    return prev;
                  });
                }
              } catch (error) {
                console.error("Error parsing streaming data:", error);
                throw error;
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.error("Error in chat interaction:", error);
      setMessages((prev) => [
        ...prev,
        {
          content: `Error: ${error.message || "An unexpected error occurred. Please try again."}`,
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

  // ── NEW: Toggle Quiz Mode ──
  // Toggles between chat mode and quiz mode and clears previous quiz feedback.
  const toggleQuizMode = () => {
    const newQuizMode = !isQuizMode;
    setIsQuizMode(newQuizMode);
    setQuizFeedback({});

    // Clear existing quiz questions when entering quiz mode
    if (newQuizMode) {
      setQuizQuestions([]);
      setQuizError("");
    }
  };

  // ── NEW: Generate Quiz Function ──
  // Calls the backend API to generate quiz questions.
  const generateQuiz = async () => {
    if (!selectedPdf) return;

    setGeneratingQuiz(true);
    setQuizError("");

    try {
      console.log(
        `Generating quiz - PDF: ${selectedPdf}, Questions: ${quizNumQuestions}, Difficulty: ${quizDifficulty}`
      );

      const response = await fetch("/api/quiz", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pdfKey: selectedPdf,
          numberOfQuestions: quizNumQuestions,
          difficulty: quizDifficulty,
        }),
      });

      const data = await response.json();
      console.log("Quiz API response:", data);

      if (response.ok && data.success) {
        console.log(
          `Successfully generated ${data.quiz.length} quiz questions`
        );
        setQuizQuestions(data.quiz);
        setCurrentQuestionIndex(0);
        setQuizFeedback({});
      } else {
        setQuizError(data.error || "Failed to generate quiz questions");
        console.error("Quiz generation error:", data.error);
      }
    } catch (error) {
      console.error("Error generating quiz:", error);
      setQuizError("Error connecting to quiz service");
    } finally {
      setGeneratingQuiz(false);
    }
  };

  // ── Generate Single Quiz Question Function ──
  // For handling single quiz question generation
  const handleGenerateQuizQuestion = async () => {
    if (!user || !selectedPdf) {
      console.warn("User info or PDF not loaded; cannot generate quiz.");
      return;
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Generate a quiz question",
          pdfName: selectedPdf,
          quiz_mode: true,
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate quiz question");
      }

      const data = await response.json();
      const botAnswerRaw = data.answer;

      // Remove code block markers if present
      const botAnswerClean = botAnswerRaw
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      try {
        const parsed = JSON.parse(botAnswerClean);
        setQuizQuestions([
          {
            question: parsed.question || "No question provided",
            options: parsed.options || [],
            correctAnswer: parsed.answer || "",
            explanation: parsed.explanation || "",
          },
        ]);
        setCurrentQuestionIndex(0);
        setQuizFeedback({});
      } catch (err) {
        console.error(
          "Quiz Bot response was not valid JSON after cleaning. Response:",
          botAnswerClean
        );
        setQuizError("Error: Could not parse quiz question.");
      }
    } catch (error) {
      console.error("Error generating quiz question:", error);
      setQuizError("Error generating quiz question");
    }
  };

  // ── NEW: Next Question Function ──
  // Moves to the next question in the quiz.
  const handleNextQuestion = () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setQuizFeedback({});
    }
  };

  // ── NEW: Previous Question Function ──
  // Moves to the previous question in the quiz.
  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setQuizFeedback({});
    }
  };

  // 在页面组件中添加一个全局的消息监听器
  useEffect(() => {
    // 监听PDF.js查看器发来的页面变化事件
    const handlePageChange = (event: MessageEvent) => {
      console.log("🔔 收到消息事件:", event.data);

      if (event.data && event.data.type === "PDF_PAGE_CHANGE") {
        console.log("📄 收到PDF页面变化事件:", event.data);

        // 更新当前页码状态
        const pageNumber = Number(event.data.page);
        if (!isNaN(pageNumber) && pageNumber > 0) {
          setCurrentPageNumber(pageNumber);
          console.log("✅ 已更新当前页码状态:", pageNumber, typeof pageNumber);
        } else {
          console.error("❌ 无效的页码:", event.data.page);
        }
      }
    };

    console.log("📌 设置PDF页面变化监听器 - 当前选中PDF:", selectedPdf);
    window.addEventListener("message", handlePageChange);

    return () => {
      console.log("🗑️ 清除PDF页面变化监听器");
      window.removeEventListener("message", handlePageChange);
    };
  }, [selectedPdf]);

  // 监控页码状态变化
  useEffect(() => {
    console.log("🔄 currentPageNumber状态已更新:", currentPageNumber, typeof currentPageNumber);
  }, [currentPageNumber]);

  // 修改PDF加载完成处理函数，将脚本注入到iframe中
  const handlePdfLoad = () => {
    console.log("PDF.js viewer loaded");
    setPdfLoading(false);

    // 设置初始页码为1
    console.log("主动设置初始页码为1");
    setCurrentPageNumber(1);

    try {
      // 获取iframe元素
      const iframe = document.getElementById('pdfjs-iframe') as HTMLIFrameElement;

      if (!iframe || !iframe.contentWindow || !iframe.contentDocument) {
        console.error("无法获取PDF iframe或其内容");
        return;
      }

      console.log("成功获取PDF iframe");

      // 创建脚本元素
      const script = document.createElement("script");
      script.src = `/js/pdf-page-direct-listener.js?t=${new Date().getTime()}`;

      // 将脚本添加到iframe的文档中，而不是主文档
      iframe.contentDocument.body.appendChild(script);

      console.log("已将PDF页面监听脚本注入到iframe中");

      return () => {
        try {
          if (iframe && iframe.contentDocument) {
            const scriptElement = iframe.contentDocument.querySelector('script[src*="pdf-page-direct-listener.js"]');
            if (scriptElement && scriptElement.parentNode) {
              scriptElement.parentNode.removeChild(scriptElement);
            }
          }
        } catch (e) {
          console.error("移除iframe中的脚本时出错:", e);
        }
      };
    } catch (e) {
      console.error("在iframe中添加脚本时出错:", e);
    }
  };

  // 添加一个测试页码更新的函数
  const testPageChange = () => {
    const randomPage = Math.floor(Math.random() * 10) + 1;
    console.log("🧪 测试页码更新 - 发送随机页码:", randomPage);

    // 手动触发一个页码更新事件
    const testEvent = {
      type: "PDF_PAGE_CHANGE",
      page: randomPage,
      total: 100
    };

    window.postMessage(testEvent, "*");
  };

  return (
    <div className="w-full h-screen bg-gray-50 flex flex-col">
      {/* HEADER */}
      <div className="bg-white shadow-md border-b border-gray-200 p-4 flex justify-between items-center">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold text-gray-800 mr-4">Chat Interface</h1>
          <button
            onClick={testPageChange}
            className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
          >
            测试页码更新
          </button>
          <span className="ml-2 text-sm text-gray-500">当前页码: {currentPageNumber}</span>
        </div>
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
                          {session.conversationhistory.map(
                            (msg: any, i: number) => (
                              <div key={i} className="mb-1">
                                <strong className="capitalize">
                                  {msg.sender}:
                                </strong>{" "}
                                {msg.message}
                                {msg.timestamp && (
                                  <span className="ml-2 text-gray-400 text-[10px]">
                                    (
                                    {new Date(
                                      msg.timestamp
                                    ).toLocaleTimeString()}
                                    )
                                  </span>
                                )}
                              </div>
                            )
                          )}
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
              {(selectedCourse ? getCourseLectures() : pdfFiles).map(
                (pdf, index) => (
                  <li
                    key={index}
                    onClick={() => setSelectedPdf(pdf.key)}
                    className={`p-2 mb-2 cursor-pointer rounded hover:bg-blue-50 ${selectedPdf === pdf.key ? "bg-blue-100" : ""
                      } flex items-center`}
                  >
                    <FileText className="h-4 w-4 mr-2 text-gray-500" />
                    {pdf.name}
                  </li>
                )
              )}
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
            <div className="p-4 border-b border-gray-200 bg-white shadow-sm flex justify-between items-center">
              <div className="flex items-center">
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="p-2 rounded-md text-gray-500 hover:bg-gray-100 mr-2"
                  aria-label="Toggle sidebar"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <h2 className="text-xl font-bold text-gray-800">PDF Viewer</h2>
              </div>
            </div>
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
                        if (!pdfUrl) return "";
                        // Use our proxy to access the PDF from the same origin
                        const proxyUrl = `/api/pdf-proxy?url=${encodeURIComponent(
                          pdfUrl
                        )}`;
                        // Add parameters to support communication and disable same-origin restrictions
                        return `/pdfjs/web/viewer.html?file=${encodeURIComponent(
                          proxyUrl
                        )}&disableXfa=true&embedded=true`;
                      })()}
                      className="w-full h-full border-0"
                      name="pdfjs-viewer"
                      id="pdfjs-iframe"
                      onLoad={handlePdfLoad}
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
            {/* Chat header */}
            <div className="p-4 border-b border-gray-200 bg-white shadow-sm flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">Chat</h2>
              <button
                onClick={toggleQuizMode}
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                {isQuizMode ? "Exit Quiz Mode" : "Enter Quiz Mode"}
              </button>
            </div>
            {isQuizMode ? (
              // Quiz Mode UI Block
              <div className="flex-1 p-4 overflow-y-auto bg-white">
                <h2 className="text-lg font-bold mb-4">Quiz Mode</h2>

                {/* Collapsible Settings Panel */}
                <div className="mb-5">
                  <button
                    onClick={() => setShowQuizSettings(!showQuizSettings)}
                    className="w-full flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200 text-blue-800 font-medium hover:bg-blue-100 transition-colors"
                  >
                    <div className="flex items-center">
                      <span>Settings</span>
                      {!showQuizSettings && (
                        <span className="ml-2 text-xs text-blue-600 bg-blue-100 py-0.5 px-2 rounded-full">
                          {quizNumQuestions} questions • {quizDifficulty}{" "}
                          difficulty
                        </span>
                      )}
                    </div>
                    <svg
                      className={`w-5 h-5 transition-transform duration-200 ${showQuizSettings ? "rotate-180" : ""
                        }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {showQuizSettings && (
                    <div className="mt-3 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between mb-1.5">
                            <label className="text-sm font-medium text-gray-700">
                              Number of Questions:
                            </label>
                            <span className="text-sm font-semibold text-blue-700">
                              {quizNumQuestions}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="10"
                            step="1"
                            value={quizNumQuestions}
                            onChange={(e) =>
                              setQuizNumQuestions(Number(e.target.value))
                            }
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            aria-label="Number of quiz questions"
                          />
                          <div className="flex justify-between mt-1 text-xs text-gray-500">
                            <span>1</span>
                            <span>5</span>
                            <span>10</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1.5 text-gray-700">
                            Difficulty Level:
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {["easy", "medium", "hard"].map((level) => (
                              <button
                                key={level}
                                onClick={() =>
                                  setQuizDifficulty(
                                    level as "easy" | "medium" | "hard"
                                  )
                                }
                                className={`py-1.5 px-2 rounded-md capitalize text-sm text-center
                                  ${quizDifficulty === level
                                    ? "bg-blue-600 text-white font-medium"
                                    : "bg-gray-50 border border-gray-300 text-gray-700 hover:bg-gray-100"
                                  } transition-colors`}
                              >
                                {level}
                              </button>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            generateQuiz();
                            setShowQuizSettings(false);
                          }}
                          className="w-full mt-2 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium flex items-center justify-center"
                        >
                          {generatingQuiz ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                              Generating...
                            </>
                          ) : (
                            "Generate Quiz"
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {quizError ? (
                  <div className="p-4 bg-red-100 text-red-700 rounded-md mb-4">
                    <p>{quizError}</p>
                  </div>
                ) : quizQuestions.length === 0 ? (
                  <div className="p-4 bg-gray-50 rounded-md text-center">
                    <p className="text-gray-500">
                      Configure your quiz settings and click "Generate Quiz" to
                      begin.
                    </p>
                  </div>
                ) : (
                  <div className="mt-2">
                    <div className="mb-3 flex justify-between items-center">
                      <span className="text-sm text-gray-600 font-medium">
                        Question {currentQuestionIndex + 1} of{" "}
                        {quizQuestions.length}
                      </span>
                      <button
                        onClick={() => setShowQuizSettings(!showQuizSettings)}
                        className="text-xs py-1 px-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md transition-colors"
                      >
                        {showQuizSettings ? "Hide Settings" : "Show Settings"}
                      </button>
                    </div>

                    <div className="p-5 bg-blue-50 rounded-lg mb-4 shadow-sm">
                      <p className="font-medium text-lg mb-4 text-gray-800">
                        {quizQuestions[currentQuestionIndex]?.question}
                      </p>
                      <div className="flex flex-col gap-3 mt-4">
                        {quizQuestions[currentQuestionIndex]?.options.map(
                          (option: string, idx: number) => {
                            const labels = ["A", "B", "C", "D"];
                            return (
                              <button
                                key={idx}
                                onClick={() => handleQuizAnswer(option)}
                                className="p-4 rounded-lg bg-white hover:bg-blue-100 text-left border border-gray-200 transition-colors flex items-start"
                              >
                                <span className="inline-flex items-center justify-center bg-blue-100 text-blue-800 rounded-full h-6 w-6 min-w-6 mr-3 font-medium">
                                  {labels[idx]}
                                </span>
                                <span>{option}</span>
                              </button>
                            );
                          }
                        )}
                      </div>
                    </div>

                    {quizFeedback.answer && (
                      <div className="mt-4 rounded-lg border border-gray-200 mb-4 overflow-hidden">
                        <div
                          className={`p-3 ${quizFeedback.isCorrect
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                            } font-medium`}
                        >
                          {quizFeedback.isCorrect ? "Correct!" : "Incorrect!"}
                        </div>
                        <div className="p-4">
                          <div className="mb-2">
                            <span className="font-medium">Correct answer:</span>{" "}
                            {quizFeedback.answer}
                          </div>
                          <div>
                            <span className="font-medium">Explanation:</span>{" "}
                            {quizFeedback.explanation}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between mt-4">
                      <button
                        onClick={handlePreviousQuestion}
                        disabled={currentQuestionIndex === 0}
                        className={`px-4 py-2 rounded-md ${currentQuestionIndex === 0
                          ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                          } transition-colors`}
                      >
                        Previous
                      </button>
                      <button
                        onClick={handleNextQuestion}
                        disabled={
                          currentQuestionIndex === quizQuestions.length - 1
                        }
                        className={`px-4 py-2 rounded-md ${currentQuestionIndex === quizQuestions.length - 1
                          ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                          } transition-colors`}
                      >
                        Next
                      </button>
                    </div>
                  </div>
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
                          <div className="flex items-start gap-2">
                            <div className="prose prose-sm flex-1">
                              <MarkdownWithPageLinks content={message.content} />
                              {message.image && (
                                <div className="mt-2">
                                  <GeneratedImage
                                    url={message.image.url}
                                    prompt={message.image.prompt}
                                    className="max-w-md"
                                  />
                                </div>
                              )}
                            </div>
                            {message.sender === "bot" && !message.image && (
                              <AudioPlayer text={message.content} />
                            )}
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
