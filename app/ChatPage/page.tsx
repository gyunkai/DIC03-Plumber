import { Send } from "lucide-react";

export default function ChatPage() {
    return (
        <div className="w-full h-screen bg-white rounded-3xl overflow-hidden flex flex-col">
            <div className="flex flex-1 flex-col md:flex-row">
                {/* Sidebar */}
                <div className="w-full md:w-[327px] h-auto md:h-full bg-white border-r border-gray-200 flex flex-col justify-between p-4">
                    <div>
                        <button className="w-full p-3 bg-black text-white rounded-xl text-center">New Chat</button>
                        <div className="mt-4">
                            <div className="p-3 rounded-lg flex items-center gap-2 bg-gray-100">
                                <span className="text-sm">For Loops Explanation</span>
                            </div>
                            <div className="p-3 rounded-lg flex items-center gap-2 bg-gray-100 mt-2">
                                <span className="text-sm">Lists and Tuples Comparison</span>
                            </div>
                        </div>
                    </div>
                    <div className="p-3 rounded-lg flex items-center gap-2 bg-gray-100">
                        <img src="https://ui-avatars.com/api/?name=Kenny+Su&background=random" alt="User Avatar" className="w-10 h-10 rounded-full" />
                        <span className="text-xl">Kenny Su</span>
                    </div>
                </div>
                
                {/* Chat Area */}
                <div className="flex-1 flex flex-col p-4 relative">
                    {/* NYU Logo */}
                    <div className="absolute top-[40%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                        <img src="/nyu-logo.png" alt="NYU Logo" className="w-40 h-auto object-contain" />
                    </div>
                    
                    {/* Chat Input */}
                    <div className="mt-auto p-4">
                        <div className="w-full flex flex-wrap justify-center gap-4 mb-4">
                            <div className="bg-gray-100 p-2 rounded-lg">“Explain recursion with an example.”</div>
                            <div className="bg-gray-100 p-2 rounded-lg">“Write a prime checker in Python.”</div>
                            <div className="bg-gray-100 p-2 rounded-lg">“Difference between list and tuple?”</div>
                        </div>
                        <div className="w-full flex items-center bg-gray-100 p-3 rounded-xl">
                            <input className="w-full bg-transparent outline-none text-lg" placeholder="Type message" />
                            <button className="p-2">
                                <Send size={24} className="text-gray-600"/>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
