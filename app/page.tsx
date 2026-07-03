"use client";

import React, { useState, useEffect } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isButtonHovered, setIsButtonHovered] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [showForgotModal, setShowForgotModal] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    // Simple email regex validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    // Two mock logins to surprise her
    const validLogins = [
      { email: "otavio@email.com", password: "agata" },
      { email: "agata@email.com", password: "otavio" }
    ];

    const matched = validLogins.find(
      (login) => login.email.toLowerCase() === email.toLowerCase() && login.password === password
    );

    if (!matched) {
      setError("Incorrect code! Try again, sweet heart.");
      return;
    }

    setError("");
    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setIsSuccess(true);
    }, 2000);
  };

  // Define floating hearts configuration
  const floatingHearts = [
    { id: 1, left: "8%", size: "w-6 h-6", anim: "animate-float-heart-1", color: "text-pink-300/35" },
    { id: 2, left: "22%", size: "w-10 h-10", anim: "animate-float-heart-2", color: "text-rose-300/25" },
    { id: 3, left: "38%", size: "w-5 h-5", anim: "animate-float-heart-3", color: "text-pink-400/20" },
    { id: 4, left: "50%", size: "w-8 h-8", anim: "animate-float-heart-4", color: "text-rose-400/20" },
    { id: 5, left: "68%", size: "w-9 h-9", anim: "animate-float-heart-1", color: "text-pink-300/30" },
    { id: 6, left: "82%", size: "w-6 h-6", anim: "animate-float-heart-2", color: "text-rose-300/40" },
    { id: 7, left: "93%", size: "w-7 h-7", anim: "animate-float-heart-3", color: "text-pink-400/25" },
  ];

  // Twinkling stars configuration
  const floatingStars = [
    { id: 1, left: "15%", top: "20%", size: "w-4 h-4", anim: "animate-twinkle-1", color: "text-pink-400/40" },
    { id: 2, left: "80%", top: "15%", size: "w-5 h-5", anim: "animate-twinkle-2", color: "text-pink-400/30" },
    { id: 3, left: "7%", top: "65%", size: "w-3 h-3", anim: "animate-twinkle-3", color: "text-rose-400/35" },
    { id: 4, left: "85%", top: "75%", size: "w-4 h-4", anim: "animate-twinkle-1", color: "text-rose-400/40" },
    { id: 5, left: "50%", top: "8%", size: "w-5 h-5", anim: "animate-twinkle-3", color: "text-pink-400/25" },
  ];

  return (
    <main className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-[#ffeef2] via-[#fff0f5] to-[#fce4ec]">
      {/* Floating Elements Background */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Floating Clouds */}
        <div className="absolute top-[12%] left-[6%] text-pink-200/30 animate-float-slow w-24 h-16">
          <svg className="w-full h-full fill-current" viewBox="0 0 24 24">
            <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
          </svg>
        </div>
        <div className="absolute bottom-[18%] right-[8%] text-pink-200/30 animate-float-medium w-28 h-20">
          <svg className="w-full h-full fill-current" viewBox="0 0 24 24">
            <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
          </svg>
        </div>

        {/* Floating Hearts */}
        {floatingHearts.map((heart) => (
          <div
            key={heart.id}
            className={`absolute bottom-[-50px] ${heart.left} ${heart.size} ${heart.color} ${heart.anim}`}
          >
            <svg className="w-full h-full fill-current" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
        ))}

        {/* Twinkling Stars */}
        {floatingStars.map((star) => (
          <div
            key={star.id}
            className={`absolute ${star.left} ${star.top} ${star.size} ${star.color} ${star.anim}`}
          >
            <svg className="w-full h-full fill-current" viewBox="0 0 24 24">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
          </div>
        ))}
      </div>

      {/* Login Card */}
      <div className="w-[420px] max-w-[95%] p-8 md:p-10 rounded-3xl bg-white/70 backdrop-blur-xl border border-white/50 shadow-[0_20px_50px_rgba(251,180,189,0.3)] relative z-10 transition-all duration-500 hover:shadow-[0_25px_60px_rgba(251,180,189,0.4)] animate-float-medium">

        {/* Animated Interactive Bunny Mascot */}
        <div className="w-40 h-40 mx-auto -mt-24 md:-mt-28 mb-4 relative z-20">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 200 160">
            {/* Left Ear */}
            <g
              className={`transition-all duration-500 origin-[80px_80px] ${isPasswordFocused && !showPassword
                ? "rotate-[-18deg] translate-x-[-4px] translate-y-[2px]"
                : isLoading
                  ? "animate-wiggle-ear-left"
                  : "animate-float-slow"
                }`}
            >
              {/* Outer Ear */}
              <path
                d="M75,80 C60,40 50,15 65,10 C80,5 85,30 85,80 Z"
                fill="#ffffff"
                stroke="#ffccd5"
                strokeWidth="3.5"
                strokeLinejoin="round"
              />
              {/* Inner Ear */}
              <path
                d="M75,75 C65,45 58,23 66,20 C74,17 78,35 79,75 Z"
                fill="#ffb6c1"
                opacity="0.85"
              />
            </g>

            {/* Right Ear */}
            <g
              className={`transition-all duration-500 origin-[120px_80px] ${isPasswordFocused && !showPassword
                ? "rotate-[18deg] translate-x-[4px] translate-y-[2px]"
                : isLoading
                  ? "animate-wiggle-ear-right"
                  : "animate-float-medium"
                }`}
            >
              {/* Outer Ear */}
              <path
                d="M125,80 C140,40 150,15 135,10 C120,5 115,30 115,80 Z"
                fill="#ffffff"
                stroke="#ffccd5"
                strokeWidth="3.5"
                strokeLinejoin="round"
              />
              {/* Inner Ear */}
              <path
                d="M125,75 C135,45 142,23 134,20 C126,17 122,35 121,75 Z"
                fill="#ffb6c1"
                opacity="0.85"
              />
            </g>

            {/* Head */}
            <ellipse
              cx="100"
              cy="105"
              rx="50"
              ry="38"
              fill="#ffffff"
              stroke="#ffccd5"
              strokeWidth="4"
            />

            {/* Cheek Blush */}
            <ellipse
              cx="64"
              cy="114"
              rx={isButtonHovered ? "9" : "6.5"}
              ry={isButtonHovered ? "5.5" : "4"}
              fill="#ffa6c9"
              opacity={isButtonHovered ? "0.9" : "0.55"}
              className="transition-all duration-300 animate-blush-pulse"
            />
            <ellipse
              cx="136"
              cy="114"
              rx={isButtonHovered ? "9" : "6.5"}
              ry={isButtonHovered ? "5.5" : "4"}
              fill="#ffa6c9"
              opacity={isButtonHovered ? "0.9" : "0.55"}
              className="transition-all duration-300 animate-blush-pulse"
            />

            {/* Dynamic Face Elements */}
            <g
              className={`transition-transform duration-300 ${isEmailFocused ? "translate-y-[2.5px]" : "translate-y-0"
                }`}
            >
              {/* Eyes */}
              {isSuccess ? (
                <>
                  {/* Happy closed arched eyes on success */}
                  <path
                    d="M 74 107 Q 79 101 84 107"
                    fill="none"
                    stroke="#4a2e35"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 116 107 Q 121 101 126 107"
                    fill="none"
                    stroke="#4a2e35"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </>
              ) : isPasswordFocused && !showPassword ? (
                <>
                  {/* Shy closed/squinting eyes when covered */}
                  <path
                    d="M 75 107 Q 80 109 85 107"
                    fill="none"
                    stroke="#4a2e35"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 115 107 Q 120 109 125 107"
                    fill="none"
                    stroke="#4a2e35"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </>
              ) : isPasswordFocused && showPassword ? (
                <>
                  {/* Peeking: left closed, right wide open! */}
                  <path
                    d="M 75 108 Q 80 105 85 108"
                    fill="none"
                    stroke="#4a2e35"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <g className="animate-bunny-blink">
                    <circle cx="120" cy="106" r="5" fill="#4a2e35" />
                    <circle cx="121.5" cy="104.5" r="1.5" fill="#ffffff" />
                  </g>
                </>
              ) : (
                <>
                  {/* Standard Idle / Email focused eyes */}
                  <g className="animate-bunny-blink">
                    <circle cx="80" cy="106" r="5" fill="#4a2e35" />
                    <circle cx="81.5" cy="104.5" r="1.5" fill="#ffffff" />
                  </g>
                  <g className="animate-bunny-blink">
                    <circle cx="120" cy="106" r="5" fill="#4a2e35" />
                    <circle cx="121.5" cy="104.5" r="1.5" fill="#ffffff" />
                  </g>
                </>
              )}

              {/* Nose */}
              <polygon
                points="98,111 102,111 100,113.5"
                fill="#f43f5e"
              />

              {/* Mouth */}
              {isSuccess ? (
                /* Wide smile */
                <path
                  d="M 96 116 Q 100 122 104 116"
                  fill="#f43f5e"
                  stroke="#4a2e35"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              ) : isLoading ? (
                /* Surprised 'o' */
                <circle cx="100" cy="117.5" r="3" fill="#4a2e35" />
              ) : isButtonHovered ? (
                /* Sweet tongue open smile */
                <path
                  d="M 95 115 Q 100 121 105 115 Z"
                  fill="#ff6b8b"
                  stroke="#4a2e35"
                  strokeWidth="1.5"
                />
              ) : (
                /* Default cat mouth (w) */
                <path
                  d="M 96 115 Q 98 117.5 100 115 Q 102 117.5 104 115"
                  fill="none"
                  stroke="#4a2e35"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              )}
            </g>

            {/* Left Paw */}
            <g
              className={`transition-all duration-500 ${isPasswordFocused
                ? "translate-x-[11px] translate-y-[-35px] scale-[1.05]"
                : isSuccess
                  ? "translate-x-[4px] translate-y-[-12px] rotate-[-20deg]"
                  : isLoading
                    ? "translate-x-0 translate-y-[-6px] rotate-[-5deg]"
                    : "translate-x-0 translate-y-0"
                }`}
            >
              <circle
                cx="70"
                cy="142"
                r="8"
                fill="#ffffff"
                stroke="#ffccd5"
                strokeWidth="3.5"
              />
              <path
                d="M67,140 Q70,138 73,140"
                fill="none"
                stroke="#ffccd5"
                strokeWidth="1.5"
              />
            </g>

            {/* Right Paw */}
            <g
              className={`transition-all duration-500 ${isPasswordFocused && !showPassword
                ? "translate-x-[-11px] translate-y-[-35px] scale-[1.05]"
                : isPasswordFocused && showPassword
                  ? "translate-x-[-2px] translate-y-[-10px] rotate-[18deg]" // peeking
                  : isSuccess
                    ? "translate-x-[-4px] translate-y-[-12px] rotate-[20deg]"
                    : isLoading
                      ? "translate-x-0 translate-y-[-6px] rotate-[5deg]"
                      : "translate-x-0 translate-y-0"
                }`}
            >
              <circle
                cx="130"
                cy="142"
                r="8"
                fill="#ffffff"
                stroke="#ffccd5"
                strokeWidth="3.5"
              />
              <path
                d="M127,140 Q130,138 133,140"
                fill="none"
                stroke="#ffccd5"
                strokeWidth="1.5"
              />
            </g>
          </svg>
        </div>

        {/* Content Header */}
        <div className="text-center mb-8 relative z-10">
          <h1 className="text-2xl font-bold text-pink-600 mb-2 flex items-center justify-center gap-1.5">
            {isSuccess ? (
              <span className="flex items-center gap-1.5">
                Sweet Success!
                <svg className="w-5 h-5 fill-pink-500 animate-heartbeat-slow" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                Login
                <span className="animate-heartbeat-slow inline-block">
                  <svg className="w-5 h-5 fill-pink-400" viewBox="0 0 24 24">
                    <path d="M12 8a3 3 0 0 0 3-3 3 3 0 0 0-6 0 3 3 0 0 0 3 3zm0 8a3 3 0 0 0-3 3 3 3 0 0 0 6 0 3 3 0 0 0-3-3zm-4-4a3 3 0 0 0-3-3 3 3 0 0 0 0 6 3 3 0 0 0 3-3zm8 0a3 3 0 0 0 3-3 3 3 0 0 0 0 6 3 3 0 0 0-3-3zm-4-2a2 2 0 1 1-0.001 4.001A2 2 0 0 1 12 10z" />
                  </svg>
                </span>
              </span>
            )}
          </h1>
          <p className="text-sm text-pink-500/80">
            {isSuccess
              ? "Yay! Welcoming you with warm hugs..."
              : "Enter your details to access your happy place."}
          </p>
        </div>

        {/* Error Dialog */}
        {error && (
          <div className="mb-5 p-3 rounded-2xl bg-rose-50 border border-rose-100 text-rose-500 text-xs text-center font-medium animate-bounce relative z-10 flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5 fill-none stroke-current stroke-[2.5] text-rose-400 shrink-0" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Success screen overlay */}
        {isSuccess ? (
          <div className="flex flex-col items-center justify-center py-6 text-center animate-fade-in">
            <div className="w-20 h-20 rounded-full bg-pink-100 flex items-center justify-center mb-4 border-2 border-pink-200">
              <svg className="w-10 h-10 fill-pink-500 animate-heartbeat-slow" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </div>
            <p className="text-pink-600 font-semibold mb-6">Logging you in...</p>
            <button
              onClick={() => setIsSuccess(false)}
              className="px-6 py-2.5 rounded-full text-xs font-semibold text-pink-500 border border-pink-200 hover:bg-pink-50 transition-colors"
            >
              Reset Demo
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
            {/* Email Input */}
            <div className="relative">
              <label className="block text-xs font-semibold text-pink-600/80 mb-1.5 ml-1">
                Email Address
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-4 text-pink-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setIsEmailFocused(true)}
                  onBlur={() => setIsEmailFocused(false)}
                  placeholder="name@example.com"
                  required
                  className="w-full pl-11 pr-4 py-3 bg-pink-50/30 border border-pink-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 focus:bg-white transition-all text-pink-700 placeholder-pink-300"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="relative">
              <label className="block text-xs font-semibold text-pink-600/80 mb-1.5 ml-1">
                Password
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-4 text-pink-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setIsPasswordFocused(true)}
                  onBlur={() => setIsPasswordFocused(false)}
                  placeholder="Your secret code"
                  required
                  className="w-full pl-11 pr-12 py-3 bg-pink-50/30 border border-pink-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 focus:bg-white transition-all text-pink-700 placeholder-pink-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 text-pink-400 hover:text-pink-600 transition-colors"
                >
                  {showPassword ? (
                    /* Closed eye icon */
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    /* Open eye icon */
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember me & Forgot Password */}
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={() => setRememberMe(!rememberMe)}
                className="flex items-center gap-2 group text-xs font-semibold text-pink-600/80 hover:text-pink-700 transition-colors focus:outline-none"
              >
                <span className={`w-5 h-5 flex items-center justify-center rounded-lg border border-pink-200 bg-pink-50/20 transition-all duration-300 ${rememberMe ? 'scale-110 bg-pink-100/50 border-pink-300' : 'group-hover:scale-105'
                  }`}>
                  <svg className={`w-3.5 h-3.5 transition-all duration-300 ${rememberMe ? 'fill-pink-500 scale-100' : 'fill-none stroke-pink-400/40 opacity-40 scale-75'
                    }`} viewBox="0 0 24 24">
                    <path strokeWidth="2" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                </span>
                Remember me
              </button>

              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-xs font-semibold text-pink-600/70 hover:text-pink-700 hover:scale-[1.02] transition-all cursor-pointer focus:outline-none"
              >
                Forgot secret?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              onMouseEnter={() => setIsButtonHovered(true)}
              onMouseLeave={() => setIsButtonHovered(false)}
              className="w-full py-3.5 bg-gradient-to-r from-pink-400 via-pink-400 to-rose-400 text-white text-sm font-bold rounded-2xl shadow-[0_10px_20px_rgba(244,63,94,0.2)] hover:from-pink-500 hover:to-rose-500 hover:scale-[1.02] hover:shadow-[0_12px_24px_rgba(244,63,94,0.35)] active:scale-[0.98] transition-all duration-300 disabled:opacity-85 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <svg className="w-5 h-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Sending Love...
                </>
              ) : (
                <span className="flex items-center gap-1.5">
                  Let's Go!
                  <svg className="w-4 h-4 fill-current text-white animate-heartbeat-slow" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                </span>
              )}
            </button>
          </form>
        )}
      </div>

      {/* Forgot Password Surprise Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-pink-950/20 backdrop-blur-xs animate-fade-in">
          <div className="w-[360px] max-w-full p-6 rounded-3xl bg-white border border-pink-100 shadow-[0_20px_50px_rgba(251,180,189,0.45)] text-center relative animate-float-medium">
            {/* Close Button */}
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute top-4 right-4 text-pink-400 hover:text-pink-600 transition-colors focus:outline-none cursor-pointer"
            >
              <svg className="w-5 h-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Cute lock heart icon */}
            <div className="w-16 h-16 mx-auto rounded-full bg-pink-50 border border-pink-100 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 fill-pink-500 animate-heartbeat-slow" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </div>

            <h3 className="text-lg font-bold text-pink-700 mb-2">Lost your secret key?</h3>
            <p className="text-sm text-pink-600/90 leading-relaxed mb-6">
              Hint: The password is the name of the person you love the most in the entire world!
              <svg className="w-4 h-4 fill-current text-pink-500 inline-block ml-1 animate-heartbeat-slow align-middle" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </p>

            <button
              onClick={() => setShowForgotModal(false)}
              className="w-full py-2.5 bg-gradient-to-r from-pink-400 to-rose-400 text-white font-bold rounded-2xl shadow-sm hover:from-pink-500 hover:to-rose-500 transition-all duration-300 cursor-pointer"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
