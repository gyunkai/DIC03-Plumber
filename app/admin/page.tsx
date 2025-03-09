"use client";
import React, { useState } from "react";

interface ClassInfo {
  title: string;
  code: string;
}

const Admin: React.FC = () => {
  const classes: ClassInfo[] = [
    { title: "Introduction to Computer Programming", code: "CSCI-SHU 11" },
    { title: "Introduction to Computer and Data Science", code: "CSCI-SHU 101" },
    { title: "Data Structures", code: "CSCI-SHU 210" },
    { title: "Algorithms", code: "CSCI-SHU 220" },
    { title: "Computer Architecture", code: "CENG-SHU 201" },
    { title: "Operating Systems", code: "CSCI-SHU 370" },
  ];

  const [selectedFiles, setSelectedFiles] = useState<{ [key: number]: File | null }>({});

  const handleFileChange = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles((prev) => ({ ...prev, [idx]: e.target.files[0] }));
    }
  };

  const handleUpload = (idx: number) => {
    const file = selectedFiles[idx];
    if (!file) return;
    alert(`File "${file.name}" for class "${classes[idx].title}" is ready to be uploaded.`);
    // Here you can integrate with your backend API route.
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-72 bg-white shadow-md flex flex-col p-6">
        <div className="flex flex-col items-center mb-8">
          <img
            src="https://ui-avatars.com/api/?name=Admin+User&background=random"
            alt="Admin Avatar"
            className="w-24 h-24 rounded-full"
          />
          <h2 className="mt-4 text-xl font-bold">Admin User</h2>
        </div>
        <nav className="flex flex-col space-y-4">
          <a href="#" className="text-gray-700 hover:text-blue-600">
            Dashboard
          </a>
          <a href="#" className="text-gray-700 hover:text-blue-600">
            Classes
          </a>
          <a href="#" className="text-gray-700 hover:text-blue-600">
            Students
          </a>
          <a href="#" className="text-gray-700 hover:text-blue-600">
            Settings
          </a>
        </nav>
        <div className="mt-auto">
          <img
            src="/image/nyu-logo.png"
            alt="NYU Logo"
            className="w-32 h-auto mx-auto"
          />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-10 overflow-auto">
        <header className="mb-10">
          <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-500 mt-2">Manage your classes and files</p>
        </header>

        {/* Classes Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Classes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {classes.map((cls, idx) => (
              <div key={idx} className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold mb-2">{cls.title}</h3>
                <p className="text-gray-600 mb-4">{cls.code}</p>
                <div className="mb-4">
                  <input
                    type="file"
                    onChange={(e) => handleFileChange(idx, e)}
                    className="mb-2"
                  />
                  {selectedFiles[idx] && (
                    <p className="text-gray-600 text-sm mb-2">
                      Selected: {selectedFiles[idx]?.name}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleUpload(idx)}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Upload File
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Admin;
