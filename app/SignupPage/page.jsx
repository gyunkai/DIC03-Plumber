"use client";
import { useRouter } from "next/navigation";
import React from "react";

const SignUpPage = () => {
  const router = useRouter();

  const handleContinue = () => {
    // Adjust this route to whatever page you want to go after signup
    router.push("/ChatPage");
  };

  return (
    <div className="flex w-full min-h-screen">
      {/* LEFT COLUMN */}
      <div className="relative w-full md:w-1/2 flex flex-col items-center justify-center bg-[#c6c7f8] p-6">
        {/* NYU Logo in upper-left */}
        <img
          src="/image/nyu-logo.png"
          alt="NYU logo"
          className="absolute top-4 left-4 w-40 h-auto object-contain"
        />

        {/* Main illustration */}
        <img
          src="/image/delivery-rafiki-2.png"
          alt="Delivery illustration"
          className="w-2/3 md:w-1/2 object-cover"
        />
      </div>

      {/* RIGHT COLUMN */}
      <div className="w-full md:w-1/2 flex flex-col justify-center p-6">
        <h2 className="text-black text-2xl font-bold mt-4">Account Signup</h2>
        <p className="text-gray-500 text-base leading-6 mt-2">
          Become a member and enjoy exclusive promotions.
        </p>

        <form className="flex flex-col gap-4 mt-6">
          {/* Full Name */}
          <label className="flex flex-col">
            <span className="text-gray-600 font-medium">Full Name</span>
            <input
              type="text"
              className="mt-1 p-2 border border-gray-400 rounded-md"
              placeholder="Enter your full name"
            />
          </label>

          {/* Email Address */}
          <label className="flex flex-col">
            <span className="text-gray-600 font-medium">Email Address</span>
            <input
              type="email"
              className="mt-1 p-2 border border-gray-400 rounded-md"
              placeholder="Enter your email"
            />
          </label>

          {/* Password */}
          <label className="flex flex-col">
            <span className="text-gray-600 font-medium">Password</span>
            <input
              type="password"
              className="mt-1 p-2 border border-gray-400 rounded-md"
              placeholder="Enter a password"
            />
          </label>

          {/* Confirm Password */}
          <label className="flex flex-col">
            <span className="text-gray-600 font-medium">Confirm Password</span>
            <input
              type="password"
              className="mt-1 p-2 border border-gray-400 rounded-md"
              placeholder="Re-enter your password"
            />
          </label>

          {/* Continue Button */}
          <button
            type="button"
            onClick={handleContinue}
            className="bg-[#c6c7f8] text-white font-medium rounded-md h-12 w-full"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
};

export default SignUpPage;
