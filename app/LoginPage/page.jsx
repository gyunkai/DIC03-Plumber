"use client";
import { useRouter } from "next/navigation";
import React from "react";

const LoginPage = () => {
  const router = useRouter();

  const handleAccountClick = () => {
    router.push("/SignupPage");
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
          src="/image/electrician-amico-1.png"
          alt="Delivery illustration"
          className="w-2/3 md:w-1/2 object-cover"
        />
      </div>

      {/* RIGHT COLUMN */}
      <div className="w-full md:w-1/2 flex flex-col justify-center p-6">
        <p className="text-gray-500 text-base leading-6">
          If you are already a member you can login with your email address
          and password.
        </p>

        <h2 className="text-black text-2xl font-bold mt-4">Account Login</h2>

        <form className="flex flex-col gap-4 mt-4">
          <label className="flex flex-col">
            <span className="text-gray-600 font-medium">Email address</span>
            <input
              type="email"
              className="mt-1 p-2 border border-gray-400 rounded-md"
            />
          </label>

          <label className="flex flex-col">
            <span className="text-gray-600 font-medium">Password</span>
            <input
              type="password"
              className="mt-1 p-2 border border-gray-400 rounded-md"
            />
          </label>

          <div className="flex items-center gap-2">
            <input type="checkbox" className="w-4 h-4" />
            <span className="text-gray-600 font-medium">Remember me</span>
          </div>

          <button className="bg-[#c6c7f8] text-white font-medium rounded-md h-12 w-full">
            Login
          </button>

          <p className="text-gray-600 font-medium">
            Dont have an account?{" "}
            <span
              className="text-blue-600 cursor-pointer"
              onClick={handleAccountClick}
            >
              Sign up here
            </span>
          </p>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
