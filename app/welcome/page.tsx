"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

// Fallback loader while search parameters are being parsed (Next.js Suspense requirement)
function WelcomeFallback() {
  return (
    <main className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-[#ffeef2] via-[#fff0f5] to-[#fce4ec]">
      <div className="w-12 h-12 rounded-full border-4 border-pink-200 border-t-pink-500 animate-spin"></div>
    </main>
  );
}

function WelcomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const user = searchParams.get("user") || "";
  
  const [showLetter, setShowLetter] = useState(false);
  const [isLetterHovered, setIsLetterHovered] = useState(false);

  // Setup personalized messages based on who logged in
  const isAgata = user.toLowerCase().includes("agata");
  const isOtavio = user.toLowerCase().includes("otavio");

  const getGreeting = () => {
    if (isAgata) return "Welcome home, Ágata!";
    if (isOtavio) return "Welcome back, Otávio!";
    return "Welcome back, sweet heart!";
  };

  const getSubtext = () => {
    if (isAgata) {
      return "Otávio created this magical cozy place just for you! Click the surprise button below to open a special note.";
    }
    if (isOtavio) {
      return "Ágata created this cozy place to remind you how much you are loved! Click below to open a surprise.";
    }
    return "You have entered your happy, sweet space. Click the surprise button below to open your love note.";
  };

  const getLoveNote = () => {
    if (isAgata) {
      return "Dear Ágata,\n\nEvery single day with you feels like a dream. Thank you for being the sweetest, most wonderful person in my life. You make my world shine brighter than all the twinkling stars combined. I love you to infinity and beyond! 💖\n\nForever yours,\nOtávio";
    }
    if (isOtavio) {
      return "Dear Otávio,\n\nThis is just a little surprise to tell you that you are my favorite person in the entire world. Thank you for all the laughs, hugs, and beautiful moments we share together. I love you so much! 💖\n\nWith all my love,\nÁgata";
    }
    return "Dear sweet heart,\n\nYou are loved, appreciated, and cherished. Keep shining and spreading your beautiful light in the world!\n\n💖";
  };

  // Define floating hearts and stars specifically for the welcome screen
  const welcomeHearts = [
    { id: 101, left: "5%", size: "w-8 h-8", anim: "animate-float-heart-1", color: "text-pink-300/30" },
    { id: 102, left: "20%", size: "w-6 h-6", anim: "animate-float-heart-3", color: "text-rose-300/25" },
    { id: 103, left: "35%", size: "w-12 h-12", anim: "animate-float-heart-2", color: "text-pink-400/20" },
    { id: 104, left: "60%", size: "w-7 h-7", anim: "animate-float-heart-4", color: "text-rose-400/20" },
    { id: 105, left: "75%", size: "w-10 h-10", anim: "animate-float-heart-1", color: "text-pink-300/25" },
    { id: 106, left: "90%", size: "w-8 h-8", anim: "animate-float-heart-3", color: "text-rose-300/35" },
  ];

  const welcomeStars = [
    { id: 201, left: "10%", top: "15%", size: "w-5 h-5", anim: "animate-twinkle-1", color: "text-pink-400/30" },
    { id: 202, left: "85%", top: "25%", size: "w-6 h-6", anim: "animate-twinkle-2", color: "text-rose-400/25" },
    { id: 203, left: "25%", top: "70%", size: "w-4 h-4", anim: "animate-twinkle-3", color: "text-pink-400/30" },
    { id: 204, left: "70%", top: "80%", size: "w-5 h-5", anim: "animate-twinkle-1", color: "text-rose-400/35" },
  ];

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-[#ffeef2] via-[#fff0f5] to-[#fce4ec]">
      
      {/* Background clouds, hearts and stars */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Floating clouds */}
        <div className="absolute top-[10%] left-[8%] text-pink-200/25 animate-float-slow w-32 h-20">
          <svg className="w-full h-full fill-current" viewBox="0 0 24 24">
            <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
          </svg>
        </div>
        <div className="absolute bottom-[15%] right-[10%] text-pink-200/25 animate-float-medium w-36 h-24">
          <svg className="w-full h-full fill-current" viewBox="0 0 24 24">
            <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
          </svg>
        </div>

        {/* Hearts */}
        {welcomeHearts.map((heart) => (
          <div
            key={heart.id}
            className={`absolute bottom-[-60px] ${heart.left} ${heart.size} ${heart.color} ${heart.anim}`}
          >
            <svg className="w-full h-full fill-current" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
        ))}

        {/* Stars */}
        {welcomeStars.map((star) => (
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

      {/* Main card container */}
      <div className="w-[440px] max-w-[95%] p-8 md:p-10 rounded-3xl bg-white/70 backdrop-blur-xl border border-white/50 shadow-[0_20px_50px_rgba(251,180,189,0.35)] relative z-10 transition-all duration-500 hover:shadow-[0_25px_60px_rgba(251,180,189,0.45)] animate-float-medium text-center">
        
        {/* Cute Mascot Bunny: Celebrating State */}
        <div className="w-40 h-40 mx-auto -mt-24 md:-mt-28 mb-4 relative z-20">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 200 160">
            {/* Left Ear: Happy wiggle */}
            <g className="animate-wiggle-ear-left origin-[80px_80px]">
              <path
                d="M75,80 C60,40 50,15 65,10 C80,5 85,30 85,80 Z"
                fill="#ffffff"
                stroke="#ffccd5"
                strokeWidth="3.5"
                strokeLinejoin="round"
              />
              <path
                d="M75,75 C65,45 58,23 66,20 C74,17 78,35 79,75 Z"
                fill="#ffb6c1"
                opacity="0.85"
              />
            </g>

            {/* Right Ear: Happy wiggle */}
            <g className="animate-wiggle-ear-right origin-[120px_80px]">
              <path
                d="M125,80 C140,40 150,15 135,10 C120,5 115,30 115,80 Z"
                fill="#ffffff"
                stroke="#ffccd5"
                strokeWidth="3.5"
                strokeLinejoin="round"
              />
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

            {/* Cheek Blush: Bright blush */}
            <ellipse
              cx="64"
              cy="114"
              rx="9.5"
              ry="6"
              fill="#ff6b8b"
              opacity="0.8"
              className="animate-blush-pulse"
            />
            <ellipse
              cx="136"
              cy="114"
              rx="9.5"
              ry="6"
              fill="#ff6b8b"
              opacity="0.8"
              className="animate-blush-pulse"
            />

            {/* Face Elements */}
            <g className="translate-y-[-2px]">
              {/* Happy eyes: curved arches */}
              <path
                d="M 73 106 Q 79 99 85 106"
                fill="none"
                stroke="#4a2e35"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <path
                d="M 115 106 Q 121 99 127 106"
                fill="none"
                stroke="#4a2e35"
                strokeWidth="3.5"
                strokeLinecap="round"
              />

              {/* Nose */}
              <polygon points="98,110 102,110 100,112.5" fill="#f43f5e" />

              {/* Happy wide smile */}
              <path
                d="M 95 114 Q 100 122 105 114 Z"
                fill="#ff6b8b"
                stroke="#4a2e35"
                strokeWidth="1.5"
              />
            </g>

            {/* Celebrating Left Paw: Waving up */}
            <g className="translate-x-[4px] translate-y-[-14px] rotate-[-20deg]">
              <circle
                cx="70"
                cy="142"
                r="8"
                fill="#ffffff"
                stroke="#ffccd5"
                strokeWidth="3.5"
              />
            </g>

            {/* Celebrating Right Paw: Waving up */}
            <g className="translate-x-[-4px] translate-y-[-14px] rotate-[20deg]">
              <circle
                cx="130"
                cy="142"
                r="8"
                fill="#ffffff"
                stroke="#ffccd5"
                strokeWidth="3.5"
              />
            </g>
          </svg>
        </div>

        {/* Page Content */}
        {!showLetter ? (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h1 className="text-2xl font-bold text-pink-600 mb-3 flex items-center justify-center gap-1.5">
                {getGreeting()}
                <span className="animate-heartbeat-slow inline-block">
                  <svg className="w-5 h-5 fill-pink-400" viewBox="0 0 24 24">
                    <path d="M12 8a3 3 0 0 0 3-3 3 3 0 0 0-6 0 3 3 0 0 0 3 3zm0 8a3 3 0 0 0-3 3 3 3 0 0 0 6 0 3 3 0 0 0-3-3zm-4-4a3 3 0 0 0-3-3 3 3 0 0 0 0 6 3 3 0 0 0 3-3zm8 0a3 3 0 0 0 3-3 3 3 0 0 0 0 6 3 3 0 0 0-3-3zm-4-2a2 2 0 1 1-0.001 4.001A2 2 0 0 1 12 10z" />
                  </svg>
                </span>
              </h1>
              <p className="text-sm text-pink-500/85 leading-relaxed">
                {getSubtext()}
              </p>
            </div>

            {/* Action Surprise Button */}
            <button
              onClick={() => setShowLetter(true)}
              onMouseEnter={() => setIsLetterHovered(true)}
              onMouseLeave={() => setIsLetterHovered(false)}
              className="w-full py-3.5 bg-gradient-to-r from-pink-400 via-pink-500 to-rose-400 text-white text-sm font-bold rounded-2xl shadow-[0_10px_20px_rgba(244,63,94,0.2)] hover:from-pink-500 hover:to-rose-500 hover:scale-[1.03] hover:shadow-[0_12px_24px_rgba(244,63,94,0.35)] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
            >
              Open Surprise
              <svg className={`w-4 h-4 fill-current text-white transition-transform duration-300 ${isLetterHovered ? 'scale-125 rotate-12' : ''}`} viewBox="0 0 24 24">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
              </svg>
            </button>
          </div>
        ) : (
          /* Hand-written letter overlay */
          <div className="space-y-6 animate-fade-in text-left">
            <div className="p-5 rounded-2xl bg-[#fffcf9] border-2 border-dashed border-pink-200 shadow-inner relative overflow-hidden">
              {/* Envelope liner pattern */}
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-pink-300 via-rose-300 to-pink-300"></div>
              
              {/* Cute heart watermark */}
              <div className="absolute bottom-4 right-4 opacity-[0.03] text-pink-500 pointer-events-none">
                <svg className="w-32 h-32 fill-current" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </div>

              <p className="text-xs font-semibold text-[#6e585e] leading-relaxed whitespace-pre-line font-serif italic">
                {getLoveNote()}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowLetter(false)}
                className="flex-1 py-3 border border-pink-200 text-pink-500 text-xs font-semibold rounded-2xl hover:bg-pink-50 active:scale-[0.98] transition-all cursor-pointer"
              >
                Close Note
              </button>
              
              <button
                onClick={() => router.push("/")}
                className="flex-1 py-3 bg-gradient-to-r from-pink-400 to-rose-400 text-white text-xs font-bold rounded-2xl hover:from-pink-500 hover:to-rose-500 active:scale-[0.98] transition-all cursor-pointer"
              >
                Go Back / Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function WelcomePage() {
  return (
    <Suspense fallback={<WelcomeFallback />}>
      <WelcomeContent />
    </Suspense>
  );
}
