"use client";

import { useState, useEffect } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Define User interface
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

type AggregatedInsights = {
  bulletPoints: string[];
  graphs: {
    topicDistribution: {
      labels: string[];
      values: number[];
    };
  };
  keyInsights: string[];
};

type AnonymousSummary = {
  id: string;
  chatHistorySummary: string;
};

type DashboardData = {
  aggregatedInsights: AggregatedInsights;
  anonymousSummaries: AnonymousSummary[];
};

const mockDashboardData: DashboardData = {
  aggregatedInsights: {
    bulletPoints: [
      "Detailed derivation of the backpropagation equation is a frequent query.",
      "Students require clarity on the derivation of gradient descent formulas and its convergence proofs.",
      "Specific questions about linear algebra applications in singular value decomposition for machine learning models are common.",
    ],
    graphs: {
      topicDistribution: {
        labels: [
          "Backpropagation",
          "Gradient Descent",
          "SVD",
          "Calculus Derivations",
          "Optimization Proofs",
          "Regularization",
          "Deep Learning",
          "Loss Functions",
          "Probability Theory",
          "Ensemble Learning"
        ],
        values: [50, 35, 25, 15, 20, 30, 40, 20, 10, 15],
      },
    },
    keyInsights: [
      "Students are seeking more rigorous mathematical derivations behind popular machine learning algorithms.",
      "There is a clear demand for additional lecture content that connects theoretical math with practical implementations.",
      "Enhanced step-by-step walkthroughs for derivations could significantly improve student understanding.",
    ],
  },
  anonymousSummaries: [
    {
      id: "user1",
      chatHistorySummary:
        "User1's chat history dives deep into the derivation of the backpropagation algorithm. They questioned every step of the chain rule application in the neural network's error minimization process, seeking clarification on how the gradients are computed with respect to weights.",
    },
    {
      id: "user2",
      chatHistorySummary:
        "User2 is particularly focused on gradient descent. Their interactions revolve around understanding the convergence properties of gradient descent and the mathematical underpinnings of its update rules, including momentum and adaptive learning rate methods.",
    },
    {
      id: "user3",
      chatHistorySummary:
        "User3 raised multiple questions about the application of linear algebra in machine learning, especially in computing singular value decomposition (SVD) and its role in dimensionality reduction. They requested detailed examples linking SVD to practical data compression techniques.",
    },
    {
      id: "user4",
      chatHistorySummary:
        "User4's feedback highlights confusion over calculus-based derivations in optimization problems. They are looking for a more thorough breakdown of how derivatives and integrals are used to derive update equations for various algorithms.",
    },
    {
      id: "user5",
      chatHistorySummary:
        "User5 is interested in the theoretical aspects of machine learning. Their chat history includes questions about the convergence proofs of optimization algorithms and the assumptions behind each derivation.",
    },
    {
      id: "user6",
      chatHistorySummary:
        "User6 has been actively engaging in discussions about the mathematical models behind regularization techniques. They are particularly curious about the derivation of L1 and L2 regularization penalties and how these affect model complexity.",
    },
    {
      id: "user7",
      chatHistorySummary:
        "User7's chat history is focused on the mathematical foundations of deep learning architectures. They have asked questions about the role of activation functions, weight initialization strategies, and the impact of batch normalization on training stability.",
    },
    {
      id: "user8",
      chatHistorySummary:
        "User8's interactions revolve around the mathematical properties of loss functions in machine learning. They are interested in understanding the geometric interpretation of loss surfaces and how optimization algorithms navigate these surfaces to find minima.",
    },
    {
      id: "user9",
      chatHistorySummary:
        "User9's chat history explores the connection between probability theory and machine learning models. They have raised questions about the use of Bayes' theorem in classification tasks and the relationship between likelihood estimation and model fitting.",
    },
    {
      id: "user10",
      chatHistorySummary:
        "User10 is interested in the mathematical principles behind ensemble learning methods. Their questions focus on the aggregation strategies used in boosting and bagging algorithms and the theoretical guarantees of ensemble model performance.",
    }
  ],
};

// Modal component to display full summary
function Modal({
  summary,
  onClose,
}: {
  summary: AnonymousSummary;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-3xl w-full relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
        >
          Close
        </button>
        <h2 className="text-2xl font-semibold mb-4">Full Summary</h2>
        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
          {summary.chatHistorySummary}
        </p>
      </div>
    </div>
  );
}

export default function ProfessorDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<AnonymousSummary | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Get token from cookie
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return null;
    };

    const token = getCookie('authToken');

    if (!token) {
      // If no token, redirect to login page
      router.push('/login');
      return;
    }

    // Parse token to get user info
    try {
      // Simple JWT payload parsing (without signature validation)
      const payload = JSON.parse(atob(token.split('.')[1]));
      setUser({
        id: payload.id,
        name: payload.name,
        email: payload.email,
        role: payload.role
      });
    } catch (error) {
      console.error('Failed to parse token:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }, [router]);

  const handleLogout = () => {
    // Clear cookie
    document.cookie = 'authToken=; path=/; max-age=0';
    // Redirect to login page
    router.push('/login');
  };

  useEffect(() => {
    // Simulate API call
    const timer = setTimeout(() => {
      setDashboardData(mockDashboardData);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-gray-600 text-lg">Loading dashboard data...</p>
      </div>
    );
  }

  const { aggregatedInsights, anonymousSummaries } = dashboardData;

  const barChartData = {
    labels: aggregatedInsights.graphs.topicDistribution.labels,
    datasets: [
      {
        label: "Questions",
        data: aggregatedInsights.graphs.topicDistribution.values,
        backgroundColor: "rgba(59, 130, 246, 0.5)",
        borderColor: "rgba(59, 130, 246, 1)",
        borderWidth: 1,
      },
    ],
  };

  // A helper to truncate text if it's too long
  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-50 p-6">
      {/* Header with user info and logout */}
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-gray-800">Professor Dashboard</h1>
          <p className="mt-2 text-gray-600">
            A comprehensive view of student interactions and learning insights
          </p>
        </div>
        <div className="flex items-center">
          {user && (
            <span className="text-gray-700 mr-4">
              Welcome, {user.name} ({user.email})
            </span>
          )}
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Aggregated Insights */}
      <section className="mb-12">
        <h2 className="text-3xl font-semibold text-gray-800 mb-6">Aggregated Insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Bullet Points */}
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
            <h3 className="text-2xl font-medium text-gray-700 mb-4">Key Bullet Points</h3>
            <ul className="list-disc list-inside space-y-2">
              {aggregatedInsights.bulletPoints.map((point, index) => (
                <li key={index} className="text-gray-600">
                  {point}
                </li>
              ))}
            </ul>
          </div>

          {/* Topic Distribution Chart */}
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
            <h3 className="text-2xl font-medium text-gray-700 mb-4">Topic Distribution</h3>
            <Bar
              data={barChartData}
              options={{
                responsive: true,
                plugins: {
                  legend: { position: "top" },
                  title: { display: true, text: "Topic Distribution" },
                },
              }}
            />
          </div>
        </div>
        {/* Overall Key Insights */}
        <div className="mt-8 bg-white p-6 rounded-xl shadow-md border border-gray-200">
          <h3 className="text-2xl font-medium text-gray-700 mb-4">Overall Key Insights</h3>
          <ul className="list-disc list-inside space-y-2">
            {aggregatedInsights.keyInsights.map((insight, index) => (
              <li key={index} className="text-gray-600">
                {insight}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Anonymous Student Summaries */}
      <section>
        <h2 className="text-3xl font-semibold text-gray-800 mb-6">Anonymous Student Summaries</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {anonymousSummaries.map((summary) => (
            <div
              key={summary.id}
              className="bg-white p-6 rounded-xl shadow-md border border-gray-200 flex flex-col justify-between"
            >
              <p className="text-gray-700 leading-relaxed mb-4">
                {truncateText(summary.chatHistorySummary, 200)}
              </p>
              <button
                onClick={() => setSelectedSummary(summary)}
                className="mt-auto self-end text-blue-600 hover:underline"
              >
                View Full
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Admin Functions */}
      <section className="mt-12">
        <h2 className="text-3xl font-semibold text-gray-800 mb-6">Admin Functions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
            <h3 className="text-xl font-medium text-gray-700 mb-2">User Management</h3>
            <p className="text-gray-600 mb-4">Manage users and permissions</p>
            <Link
              href="/professor/users"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Manage Users
            </Link>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
            <h3 className="text-xl font-medium text-gray-700 mb-2">Course Management</h3>
            <p className="text-gray-600 mb-4">Create and manage courses</p>
            <Link
              href="/professor/courses"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Manage Courses
            </Link>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
            <h3 className="text-xl font-medium text-gray-700 mb-2">System Settings</h3>
            <p className="text-gray-600 mb-4">Configure system settings</p>
            <Link
              href="/professor/settings"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              System Settings
            </Link>
          </div>
        </div>
      </section>

      {/* Modal for full summary view */}
      {selectedSummary && (
        <Modal summary={selectedSummary} onClose={() => setSelectedSummary(null)} />
      )}
    </div>
  );
}
