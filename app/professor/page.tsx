"use client";

import { useEffect, useState } from "react";

type AnalyzedQuestion = {
  id: string;
  studentName?: string;
  timestamp: string;
  question: string;
  topic: string;
  summary: string;
  complexity: "Basic" | "Intermediate" | "Advanced";
};

// Mock data pretending to be from backend
const mockQuestions: AnalyzedQuestion[] = [
  {
    id: "q1",
    studentName: "Alice",
    timestamp: "2025-03-21T14:22:00Z",
    question: "What is the difference between BFS and DFS?",
    topic: "Graph Algorithms",
    summary: "Confused about traversal order and data structure choice",
    complexity: "Intermediate",
  },
  {
    id: "q2",
    studentName: "Bob",
    timestamp: "2025-03-21T16:10:00Z",
    question: "Why do we need dynamic programming when recursion already works?",
    topic: "Dynamic Programming",
    summary: "Does not understand memoization benefits over plain recursion",
    complexity: "Advanced",
  },
  {
    id: "q3",
    studentName: "Charlie",
    timestamp: "2025-03-21T17:45:00Z",
    question: "What is a pointer?",
    topic: "Memory Management",
    summary: "Needs help understanding basic pointers and references",
    complexity: "Basic",
  },
];

export default function ProfessorPage() {
    const [questions, setQuestions] = useState<AnalyzedQuestion[]>([]);
    const [loading, setLoading] = useState(true);
  
    useEffect(() => {
      // Simulate API call with timeout
      const timer = setTimeout(() => {
        setQuestions(mockQuestions);
        setLoading(false);
      }, 800);
  
      return () => clearTimeout(timer);
    }, []);
  
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <h1 className="text-3xl font-bold mb-6">🧑‍🏫 Professor Dashboard</h1>
  
        {loading ? (
          <p className="text-gray-600">Loading student questions...</p>
        ) : questions.length === 0 ? (
          <p className="text-gray-600">No questions found.</p>
        ) : (
          <div className="space-y-4">
            {questions.map((q) => (
              <div
                key={q.id}
                className="bg-white p-4 rounded-xl shadow-sm border border-gray-200"
              >
                <div className="flex justify-between text-sm text-gray-500 mb-1">
                  <span>{q.studentName || "Anonymous"}</span>
                  <span>{new Date(q.timestamp).toLocaleString()}</span>
                </div>
                <p className="text-lg font-medium text-gray-800 mb-1">
                  {q.question}
                </p>
                <div className="text-sm text-gray-700">
                  <p><strong>Topic:</strong> {q.topic}</p>
                  <p><strong>LLM Summary:</strong> {q.summary}</p>
                </div>
                <span className="inline-block mt-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  Complexity: {q.complexity}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  