"use client";
import React, { useState } from "react";

const AdminUserProfilePage: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  // Handle file upload logic (to be integrated with your backend)
  const handleUpload = () => {
    if (!selectedFile) return;
    // TODO: integrate with your Prisma backend (e.g. using an API route)
    alert(`File "${selectedFile.name}" is ready to be uploaded.`);
  };

  return (
    <div className="flex min-h-screen">
      {/* LEFT SIDEBAR */}
      <aside className="w-64 bg-gray-100 flex flex-col justify-between p-4">
        {/* User Profile */}
        <div>
          <div className="flex flex-col items-center mb-8">
            {/* Placeholder avatar; replace with a real user image if available */}
            <img
              src="https://ui-avatars.com/api/?name=User+Name&background=random"
              alt="User Avatar"
              className="w-20 h-20 rounded-full mb-2"
            />
            <div className="font-semibold text-lg">User Name</div>
          </div>
        </div>

        {/* NYU Logo at bottom */}
        <div className="flex items-center justify-center">
          <img
            src="/nyu-logo.png"
            alt="NYU Logo"
            className="w-20 h-auto object-contain"
          />
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-semibold mb-6">Your Classes</h1>

        {/* Class cards in a responsive grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Example card #1 */}
          <div className="border border-gray-200 rounded-lg p-4 shadow-sm">
            <h2 className="font-semibold text-lg">Introduction to Computer Programming</h2>
            <p className="text-sm text-gray-600 mb-3">CSCI-SHU 101</p>
            <button className="bg-gray-800 text-white py-1 px-3 rounded">
              Get Started
            </button>
          </div>

          {/* Example card #2 */}
          <div className="border border-gray-200 rounded-lg p-4 shadow-sm">
            <h2 className="font-semibold text-lg">Data Structures</h2>
            <p className="text-sm text-gray-600 mb-3">CSCI-SHU 210</p>
            <button className="bg-gray-800 text-white py-1 px-3 rounded">
              Get Started
            </button>
          </div>

          {/* Example card #3 */}
          <div className="border border-gray-200 rounded-lg p-4 shadow-sm">
            <h2 className="font-semibold text-lg">Algorithms</h2>
            <p className="text-sm text-gray-600 mb-3">CSCI-SHU 220</p>
            <button className="bg-gray-800 text-white py-1 px-3 rounded">
              Get Started
            </button>
          </div>

          {/* Example card #4 */}
          <div className="border border-gray-200 rounded-lg p-4 shadow-sm">
            <h2 className="font-semibold text-lg">Machine Learning</h2>
            <p className="text-sm text-gray-600 mb-3">CSCI-SHU 360</p>
            <button className="bg-gray-800 text-white py-1 px-3 rounded">
              Get Started
            </button>
          </div>

          {/* Example card #5 */}
          <div className="border border-gray-200 rounded-lg p-4 shadow-sm">
            <h2 className="font-semibold text-lg">Computer Architecture</h2>
            <p className="text-sm text-gray-600 mb-3">CENG-SHU 201</p>
            <button className="bg-gray-800 text-white py-1 px-3 rounded">
              Get Started
            </button>
          </div>

          {/* Example card #6 */}
          <div className="border border-gray-200 rounded-lg p-4 shadow-sm">
            <h2 className="font-semibold text-lg">Operating Systems</h2>
            <p className="text-sm text-gray-600 mb-3">CSCI-SHU 370</p>
            <button className="bg-gray-800 text-white py-1 px-3 rounded">
              Get Started
            </button>
          </div>
        </div>

        {/* File Upload Section */}
        <div className="mb-4">
          <label className="block font-semibold mb-2 text-lg">
            Upload File
          </label>
          <input type="file" onChange={handleFileChange} />
          {selectedFile && (
            <p className="mt-2 text-sm text-gray-600">
              Selected: {selectedFile.name}
            </p>
          )}
          <button
            className="bg-blue-600 text-white py-2 px-4 rounded mt-3"
            onClick={handleUpload}
          >
            Upload
          </button>
        </div>
      </main>
    </div>
  );
};

export default AdminUserProfilePage;
