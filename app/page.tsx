'use client';

import { useRouter } from 'next/navigation';

export default function LandingPage() {
    const router = useRouter();

    const handleStartChatting = () => {
        router.push('/LoginPage');
    };

    return (
        <div className="w-full min-h-screen bg-[#c6c7f8] flex flex-col items-center overflow-hidden">
            {/* Navbar */}
            <div className="w-full flex items-center justify-between px-8 md:px-16 py-6">
                <div className="flex items-center space-x-4">
                    <img className="w-24 md:w-36" src="/nyu-logo.png" alt="Logo"/>
                    <div className="text-white text-2xl md:text-3xl font-black font-['Poppins']">Project Kiwi</div>
                </div>
            </div>

            {/* Main Content */}
            <div className="w-full flex flex-col items-center justify-center flex-grow text-center px-4 md:px-16 space-y-6 md:space-y-8">
                <h1 className="text-white text-4xl md:text-6xl font-medium font-['Poppins']">
                    Hello, I'm{' '}
                    <span className="bg-gradient-to-r from-red-500 to-orange-400 bg-clip-text text-transparent">
                        Kiwi
                    </span>
                </h1>
                <p className="text-white text-lg md:text-2xl max-w-4xl mt-4">
                    Your AI-Powered Personal Tutor for Computer Science & Data Science
                </p>

                <button 
                    onClick={handleStartChatting}
                    className="mt-6 px-6 py-3 md:px-10 md:py-4 bg-white text-black text-lg md:text-2xl rounded-full shadow-md transition hover:bg-gray-200">
                    Start Chatting
                </button>
            </div>
        </div>
    );
}