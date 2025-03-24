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

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

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
        ],
        values: [50, 35, 25, 15],
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
    // ... add more entries to simulate real-life scenarios
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

  useEffect(() => {
    // Simulate API call
    const timer = setTimeout(() => {
      setDashboardData(mockDashboardData);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

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
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800">Professor Dashboard</h1>
        <p className="mt-2 text-gray-600">
          A comprehensive view of student interactions and learning insights in our math-intensive machine learning class.
        </p>
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

      {/* Modal for full summary view */}
      {selectedSummary && (
        <Modal summary={selectedSummary} onClose={() => setSelectedSummary(null)} />
      )}
    </div>
  );
}
