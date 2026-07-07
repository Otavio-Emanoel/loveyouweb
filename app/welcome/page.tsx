"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

// Fallback loader while search parameters are being parsed (Next.js Suspense requirement)
function WelcomeFallback() {
  return (
    <main className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-[#ffeef2] via-[#fff0f5] to-[#fce4ec]">
      <div className="w-12 h-12 rounded-full border-4 border-pink-200 border-t-pink-500 animate-spin"></div>
    </main>
  );
}

interface ChecklistItem {
  id: number;
  text: string;
  checked: boolean;
}

interface ConfettiItem {
  id: number;
  x: number;
  y: number;
  tx: string;
  ty: string;
  rot: string;
  scale: number;
}

function WelcomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const user = searchParams.get("user") || "";
  
  const [showDashboard, setShowDashboard] = useState(false);
  const [isHoveredOpen, setIsHoveredOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("widgets");

  // Local storage auto-save states
  const [loveProgress, setLoveProgress] = useState(100);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [memoryText, setMemoryText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveIndicator, setSaveIndicator] = useState("");
  const [complimentIndex, setComplimentIndex] = useState(0);

  // Confetti particles state
  const [confetti, setConfetti] = useState<ConfettiItem[]>([]);

  // Refs for tracking debounced auto-saves
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Relationship check
  const isAgata = user.toLowerCase().includes("agata");
  const isOtavio = user.toLowerCase().includes("otavio");

  const getPartnerName = () => {
    if (isAgata) return "Otávio";
    if (isOtavio) return "Ágata";
    return "your partner";
  };

  const getGreeting = () => {
    if (isAgata) return "Welcome home, Ágata!";
    if (isOtavio) return "Welcome back, Otávio!";
    return "Welcome back, sweet heart!";
  };

  const getSubtext = () => {
    if (isAgata) {
      return "Otávio created this magical cozy place just for you! Click the surprise button below to enter your secret love dashboard.";
    }
    if (isOtavio) {
      return "Ágata created this cozy place to remind you how much you are loved! Click below to enter your secret love dashboard.";
    }
    return "You have entered your happy, sweet space. Click the surprise button below to open your love dashboard.";
  };

  const getLoveNote = () => {
    if (isAgata) {
      return "Dear Ágata,\n\nEvery single day with you feels like a dream. Thank you for being the sweetest, most wonderful person in my life. You make my world shine brighter than all the twinkling stars combined. I love you to infinity and beyond!\n\nForever yours,\nOtávio";
    }
    if (isOtavio) {
      return "Dear Otávio,\n\nThis is just a little surprise to tell you that you are my favorite person in the entire world. Thank you for all the laughs, hugs, and beautiful moments we share together. I love you so much!\n\nWith all my love,\nÁgata";
    }
    return "Dear sweet heart,\n\nYou are loved, appreciated, and cherished. Keep shining and spreading your beautiful light in the world!\n\n💖";
  };

  const agataCompliments = [
    "The most beautiful girl in the universe!",
    "My absolute favorite reason to smile!",
    "Warm like hot chocolate on a cold winter day!",
    "Super smart, cute, and funny!",
    "My forever and ever!"
  ];

  const otavioCompliments = [
    "My handsome boy!",
    "The kindest and most caring person!",
    "My favorite place in the world is in your arms!",
    "The one who makes my heart beat faster!",
    "My love, forever and ever!"
  ];

  const getComplimentList = () => {
    if (isAgata) return agataCompliments;
    if (isOtavio) return otavioCompliments;
    return [
      "You make the world a warmer place!",
      "A bundle of pure joy and happiness!",
      "A sparkling star in a dark sky!",
      "Loved more than words can say!"
    ];
  };

  const currentCompliments = getComplimentList();

  // Load local storage states on mount
  useEffect(() => {
    const savedLove = localStorage.getItem("love_progress");
    if (savedLove !== null) {
      setLoveProgress(parseInt(savedLove));
    }

    const savedMemory = localStorage.getItem("love_memory");
    if (savedMemory !== null) {
      setMemoryText(savedMemory);
    }

    const savedChecklist = localStorage.getItem("love_checklist");
    if (savedChecklist !== null) {
      setChecklist(JSON.parse(savedChecklist));
    } else {
      const defaults = [
        { id: 1, text: "Bake a sweet cake together", checked: false },
        { id: 2, text: "Watch a sunset cuddling", checked: false },
        { id: 3, text: "Late night movie marathon", checked: false },
        { id: 4, text: "Write each other a cute letter", checked: false },
      ];
      setChecklist(defaults);
      localStorage.setItem("love_checklist", JSON.stringify(defaults));
    }
  }, []);

  // Clean up older confetti to prevent DOM overflow
  useEffect(() => {
    if (confetti.length === 0) return;
    const timeout = setTimeout(() => {
      setConfetti((prev) => prev.slice(8));
    }, 1500);
    return () => clearTimeout(timeout);
  }, [confetti]);

  // Confetti Trigger Functions
  const triggerConfetti = (e: React.MouseEvent) => {
    const newConfetti = Array.from({ length: 8 }).map((_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 150;
      const tx = `${Math.cos(angle) * speed}px`;
      const ty = `${-150 - Math.random() * 150}px`;
      const rot = `${(Math.random() - 0.5) * 360}deg`;
      return {
        id: Date.now() + i + Math.random(),
        x: e.clientX,
        y: e.clientY,
        tx,
        ty,
        rot,
        scale: 0.6 + Math.random() * 0.8,
      };
    });
    setConfetti((prev) => [...prev, ...newConfetti]);
  };

  const triggerConfettiAtCenter = () => {
    const x = typeof window !== "undefined" ? window.innerWidth / 2 : 500;
    const y = typeof window !== "undefined" ? window.innerHeight / 2 : 350;
    const newConfetti = Array.from({ length: 12 }).map((_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 150 + Math.random() * 200;
      const tx = `${Math.cos(angle) * speed}px`;
      const ty = `${-180 - Math.random() * 180}px`;
      const rot = `${(Math.random() - 0.5) * 360}deg`;
      return {
        id: Date.now() + i + Math.random(),
        x,
        y,
        tx,
        ty,
        rot,
        scale: 0.6 + Math.random() * 0.8,
      };
    });
    setConfetti((prev) => [...prev, ...newConfetti]);
  };

  // Love meter level text
  const getLoveLevelText = () => {
    if (loveProgress === 0) return "Did we fight? Let's talk!";
    if (loveProgress < 30) return "A cute start!";
    if (loveProgress < 60) return "A lot! You fill my heart.";
    if (loveProgress < 85) return "To the moon and back!";
    if (loveProgress < 100) return "Infinity and beyond!";
    return "Break the scale! Pure infinite love!";
  };

  // Handlers for inputs
  const handleLoveSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setLoveProgress(val);
    localStorage.setItem("love_progress", val.toString());
    
    // Shoot hearts occasionally when sliding
    if (val % 8 === 0) {
      const rect = e.target.getBoundingClientRect();
      const x = rect.left + (rect.width * (val / 100));
      const y = rect.top;
      const fakeEvent = { clientX: x, clientY: y } as React.MouseEvent;
      triggerConfetti(fakeEvent);
    }
  };

  const handleToggleCheck = (id: number) => {
    const updated = checklist.map((item) => {
      if (item.id === id) {
        if (!item.checked) {
          triggerConfettiAtCenter();
        }
        return { ...item, checked: !item.checked };
      }
      return item;
    });
    setChecklist(updated);
    localStorage.setItem("love_checklist", JSON.stringify(updated));
  };

  const handleAddChecklist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistItem.trim()) return;
    
    const newItem: ChecklistItem = {
      id: Date.now(),
      text: newChecklistItem.trim(),
      checked: false,
    };
    const updated = [...checklist, newItem];
    setChecklist(updated);
    localStorage.setItem("love_checklist", JSON.stringify(updated));
    setNewChecklistItem("");
    triggerConfettiAtCenter();
  };

  const handleDeleteChecklist = (id: number) => {
    const updated = checklist.filter((item) => item.id !== id);
    setChecklist(updated);
    localStorage.setItem("love_checklist", JSON.stringify(updated));
  };

  const handleMemoryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setMemoryText(text);
    localStorage.setItem("love_memory", text);
    
    setIsSaving(true);
    setSaveIndicator("Writing memory...");

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      setIsSaving(false);
      setSaveIndicator("Saved in memory card!");
      setTimeout(() => setSaveIndicator(""), 2000);
    }, 1000);
  };

  const handleNextCompliment = () => {
    setComplimentIndex((prev) => (prev + 1) % currentCompliments.length);
    triggerConfettiAtCenter();
  };

  // Define floating hearts and stars specifically for the welcome screen background
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
    <main 
      className="min-h-screen w-full flex flex-col items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-[#ffeef2] via-[#fff0f5] to-[#fce4ec]"
      onClick={triggerConfetti}
    >
      {/* Click Confetti Emitter Rendering */}
      {confetti.map((c) => (
        <div
          key={c.id}
          className="absolute animate-confetti pointer-events-none z-50 text-pink-500/80"
          style={{
            left: `${c.x}px`,
            top: `${c.y}px`,
            "--tx": c.tx,
            "--ty": c.ty,
            "--rot": c.rot,
            transform: `scale(${c.scale})`,
          } as React.CSSProperties}
        >
          <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </div>
      ))}

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

      {/* Main Card Container: Animates size smoothly from single card (440px) to dashboard (960px) */}
      <div 
        onClick={(e) => e.stopPropagation()} // Prevents clicks on dashboard from firing full screen click confetti
        className={`transition-all duration-500 ease-in-out ${
          showDashboard ? "w-[960px] max-w-[95%] p-6 md:p-8" : "w-[440px] max-w-[95%] p-8 md:p-10"
        } rounded-3xl bg-white/70 backdrop-blur-xl border border-white/50 shadow-[0_20px_50px_rgba(251,180,189,0.35)] relative z-10 hover:shadow-[0_25px_60px_rgba(251,180,189,0.45)] text-center`}
      >
        
        {/* Mascot Bunny sitting on top border */}
        <div className="w-40 h-40 mx-auto -mt-24 md:-mt-28 mb-3 relative z-20">
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

            {/* Cheek Blush */}
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
              <polygon points="98,110 102,110 100,112.5" fill="#f43f5e" />
              <path
                d="M 95 114 Q 100 122 105 114 Z"
                fill="#ff6b8b"
                stroke="#4a2e35"
                strokeWidth="1.5"
              />
            </g>

            {/* Waving Paws fixed to rotate from correct shoulder socket */}
            {/* Left Paw */}
            <g className="animate-paw-wave-left">
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
            <g className="animate-paw-wave-right">
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

        {/* Content Router */}
        {!showDashboard ? (
          /* Welcome Intro Page */
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

            <button
              onClick={() => {
                setShowDashboard(true);
                triggerConfettiAtCenter();
              }}
              onMouseEnter={() => setIsHoveredOpen(true)}
              onMouseLeave={() => setIsHoveredOpen(false)}
              className="w-full py-3.5 bg-gradient-to-r from-pink-400 via-pink-500 to-rose-400 text-white text-sm font-bold rounded-2xl shadow-[0_10px_20px_rgba(244,63,94,0.2)] hover:from-pink-500 hover:to-rose-500 hover:scale-[1.03] hover:shadow-[0_12px_24px_rgba(244,63,94,0.35)] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
            >
              Open Surprise
              <svg className={`w-4 h-4 fill-current text-white transition-transform duration-300 ${isHoveredOpen ? 'scale-125 rotate-12' : ''}`} viewBox="0 0 24 24">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
              </svg>
            </button>
          </div>
        ) : (
          /* Love Dashboard Widescreen Page */
          <div className="space-y-6 animate-fade-in text-left">
            {/* Dashboard Header Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-center pb-4 border-b border-pink-100 gap-4">
              <div>
                <h1 className="text-xl font-bold text-pink-600 flex items-center gap-1.5">
                  Our Love Space
                  <svg className="w-4 h-4 fill-pink-500 animate-heartbeat-slow" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                </h1>
                <p className="text-xs text-pink-400">Cozy memories and plans auto-saved with love</p>
              </div>

              {/* Sub-tab Navigation */}
              <div className="flex bg-pink-50/50 p-1 rounded-xl border border-pink-100/60 self-stretch sm:self-auto">
                <button
                  onClick={() => {
                    setActiveTab("widgets");
                    triggerConfettiAtCenter();
                  }}
                  className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 cursor-pointer ${
                    activeTab === "widgets"
                      ? "bg-gradient-to-r from-pink-400 to-rose-400 text-white shadow-sm"
                      : "text-pink-600/80 hover:text-pink-700"
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => {
                    setActiveTab("letter");
                    triggerConfettiAtCenter();
                  }}
                  className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 cursor-pointer ${
                    activeTab === "letter"
                      ? "bg-gradient-to-r from-pink-400 to-rose-400 text-white shadow-sm"
                      : "text-pink-600/80 hover:text-pink-700"
                  }`}
                >
                  Read Letter
                </button>
              </div>
            </div>

            {/* Dashboard Content Container */}
            {activeTab === "widgets" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                {/* Left Column Widgets */}
                <div className="space-y-6">
                  {/* Love Level Meter Slider */}
                  <div className="p-5 rounded-2xl bg-white/90 border border-pink-100 shadow-[0_10px_20px_rgba(251,180,189,0.15)] space-y-4 hover:scale-[1.01] transition-transform duration-300">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-bold text-pink-700 uppercase tracking-wider flex items-center gap-1.5">
                        <svg className="w-4 h-4 fill-pink-500 animate-heartbeat-slow" viewBox="0 0 24 24">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                        How much do you love {getPartnerName()}?
                      </h3>
                      <span className="text-xs font-bold text-pink-500 bg-pink-50 px-2 py-0.5 rounded-full border border-pink-100">
                        {loveProgress}%
                      </span>
                    </div>

                    <div className="space-y-2">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={loveProgress}
                        onChange={handleLoveSlider}
                        className="w-full h-2.5 bg-pink-100 rounded-lg appearance-none cursor-pointer accent-pink-500 focus:outline-none transition-all"
                      />
                      <p className="text-xs font-medium text-pink-600/90 text-center italic min-h-[16px] animate-pulse">
                        {getLoveLevelText()}
                      </p>
                    </div>
                  </div>

                  {/* Compliments/Compliments Carousel */}
                  <div className="p-5 rounded-2xl bg-white/90 border border-pink-100 shadow-[0_10px_20px_rgba(251,180,189,0.15)] space-y-4 hover:scale-[1.01] transition-transform duration-300">
                    <h3 className="text-xs font-bold text-pink-700 uppercase tracking-wider flex items-center gap-1.5">
                      <svg className="w-4 h-4 fill-none stroke-current stroke-2 text-pink-500" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.907c.961 0 1.36 1.252.58 1.831l-3.97 2.883a1 1 0 00-.364 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.971-2.883a1 1 0 00-1.18 0l-3.97 2.883c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.364-1.118l-3.97-2.883c-.78-.579-.38-1.83 1.538-1.118l4.907-.69a1 1 0 00.95-.69l1.519-4.674z" />
                      </svg>
                      Cute reminders for today
                    </h3>

                    <div className="min-h-[72px] flex items-center justify-center text-center p-3 bg-pink-50/30 border border-pink-100/50 rounded-xl relative overflow-hidden">
                      <p className="text-sm font-semibold text-[#6e585e] italic font-serif leading-relaxed animate-fade-in" key={complimentIndex}>
                        "{currentCompliments[complimentIndex]}"
                      </p>
                    </div>

                    <button
                      onClick={handleNextCompliment}
                      className="w-full py-2 bg-pink-100/50 hover:bg-pink-100 text-pink-600 text-xs font-bold rounded-xl active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      Give me another one!
                      <svg className="w-3.5 h-3.5 fill-pink-500 animate-heartbeat-slow" viewBox="0 0 24 24">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                    </button>
                  </div>

                  {/* Auto-saving Memory Box */}
                  <div className="p-5 rounded-2xl bg-white/90 border border-pink-100 shadow-[0_10px_20px_rgba(251,180,189,0.15)] space-y-3.5 hover:scale-[1.01] transition-transform duration-300">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-bold text-pink-700 uppercase tracking-wider flex items-center gap-1.5">
                        <svg className="w-4 h-4 fill-none stroke-current stroke-2 text-pink-500" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        Our Memory Journal
                      </h3>
                      {saveIndicator && (
                        <span className={`text-[10px] font-bold transition-all duration-300 ${isSaving ? 'text-pink-400' : 'text-emerald-500'}`}>
                          {saveIndicator}
                        </span>
                      )}
                    </div>

                    <textarea
                      value={memoryText}
                      onChange={handleMemoryChange}
                      placeholder="Write down a sweet memory, plans for the next date, or just leave a cozy message here..."
                      className="w-full h-24 p-3 bg-pink-50/20 border border-pink-100/70 rounded-xl text-xs text-pink-800 placeholder-pink-300/80 focus:outline-none focus:ring-2 focus:ring-pink-300 focus:bg-white resize-none transition-all"
                    />
                  </div>
                </div>

                {/* Right Column Widgets */}
                <div className="space-y-6">
                  {/* Bucket List Checklist */}
                  <div className="p-5 rounded-2xl bg-white/90 border border-pink-100 shadow-[0_10px_20px_rgba(251,180,189,0.15)] space-y-4 hover:scale-[1.01] transition-transform duration-300 flex flex-col h-full min-h-[384px]">
                    <h3 className="text-xs font-bold text-pink-700 uppercase tracking-wider flex items-center gap-1.5">
                      <svg className="w-4 h-4 fill-none stroke-current stroke-[2.5] text-pink-500" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Date Ideas & Plans
                    </h3>

                    {/* Checklist items list */}
                    <div className="flex-1 overflow-y-auto max-h-56 pr-1 space-y-2.5">
                      {checklist.length === 0 ? (
                        <p className="text-xs text-pink-300 italic text-center py-8">Your list is empty. Add a sweet idea below!</p>
                      ) : (
                        checklist.map((item) => (
                          <div
                            key={item.id}
                            className={`flex items-center justify-between p-2.5 rounded-xl border transition-all duration-300 ${
                              item.checked
                                ? "bg-emerald-50/30 border-emerald-100/50 text-emerald-700/80"
                                : "bg-pink-50/20 border-pink-100/40 text-[#6e585e]"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleToggleCheck(item.id)}
                              className="flex items-center gap-2.5 text-left text-xs font-semibold focus:outline-none cursor-pointer group flex-1"
                            >
                              <span className={`w-4.5 h-4.5 rounded-md flex items-center justify-center border transition-all duration-300 shrink-0 ${
                                item.checked
                                  ? "bg-emerald-500 border-emerald-500 scale-110"
                                  : "border-pink-300 bg-white group-hover:scale-105"
                              }`}>
                                <svg className={`w-3 h-3 transition-all duration-300 ${
                                  item.checked ? "fill-white scale-100" : "fill-none scale-50 opacity-0"
                                }`} viewBox="0 0 24 24">
                                  <path strokeWidth="3" stroke="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                </svg>
                              </span>
                              <span className={`transition-all duration-300 ${item.checked ? "line-through opacity-65" : ""}`}>
                                {item.text}
                              </span>
                            </button>

                            {/* Delete custom item button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteChecklist(item.id)}
                              className="text-pink-300 hover:text-pink-500 hover:scale-110 p-1 transition-all cursor-pointer focus:outline-none"
                            >
                              <svg className="w-3.5 h-3.5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add Custom Date form */}
                    <form onSubmit={handleAddChecklist} className="flex gap-2 pt-3 border-t border-pink-100">
                      <input
                        type="text"
                        value={newChecklistItem}
                        onChange={(e) => setNewChecklistItem(e.target.value)}
                        placeholder="Add a date plan..."
                        maxLength={40}
                        className="flex-1 px-3 py-2 bg-pink-50/30 border border-pink-100 rounded-xl text-xs text-pink-700 placeholder-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-300 focus:bg-white transition-all"
                      />
                      <button
                        type="submit"
                        className="px-3.5 bg-gradient-to-r from-pink-400 to-rose-400 text-white rounded-xl hover:from-pink-500 hover:to-rose-500 hover:scale-[1.03] active:scale-[0.97] transition-all duration-200 cursor-pointer flex items-center justify-center focus:outline-none"
                      >
                        <svg className="w-4 h-4 fill-none stroke-current stroke-[2.5]" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ) : (
              /* Love Letter Tab Container */
              <div className="space-y-6 animate-fade-in text-left">
                <div className="p-5 rounded-2xl bg-[#fffcf9] border-2 border-dashed border-pink-200 shadow-inner relative overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-pink-300 via-rose-300 to-pink-300"></div>
                  
                  {/* Watermark heart */}
                  <div className="absolute bottom-4 right-4 opacity-[0.03] text-pink-500 pointer-events-none">
                    <svg className="w-32 h-32 fill-current" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                  </div>

                  <p className="text-xs font-semibold text-[#6e585e] leading-relaxed whitespace-pre-line font-serif italic">
                    {getLoveNote()}
                  </p>
                </div>
              </div>
            )}

            {/* Back Button and Footer */}
            <div className="flex justify-between items-center pt-4 border-t border-pink-100 mt-2 gap-2">
              <button
                onClick={() => {
                  setShowDashboard(false);
                  triggerConfettiAtCenter();
                }}
                className="px-4 py-2 border border-pink-200 text-pink-500 text-xs font-semibold rounded-xl hover:bg-pink-50 active:scale-[0.98] transition-all cursor-pointer focus:outline-none"
              >
                Close Dashboard
              </button>

              <button
                onClick={() => {
                  triggerConfettiAtCenter();
                  router.push(`/gallery?user=${user}`);
                }}
                className="px-4 py-2 bg-gradient-to-r from-fuchsia-400 to-pink-400 text-white text-xs font-bold rounded-xl hover:from-fuchsia-500 hover:to-pink-500 hover:scale-[1.03] active:scale-[0.98] transition-all cursor-pointer focus:outline-none flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5 fill-none stroke-current stroke-[2.5]" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                See Gallery
              </button>

              <button
                onClick={() => {
                  triggerConfettiAtCenter();
                  router.push(`/game?user=${user}`);
                }}
                className="px-4 py-2 bg-gradient-to-r from-violet-400 to-indigo-400 text-white text-xs font-bold rounded-xl hover:from-violet-500 hover:to-indigo-500 hover:scale-[1.03] active:scale-[0.98] transition-all cursor-pointer focus:outline-none flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5 fill-none stroke-current stroke-[2.5]" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
                </svg>
                Play Game
              </button>
              
              <button
                onClick={() => {
                  triggerConfettiAtCenter();
                  router.push("/");
                }}
                className="px-4 py-2 bg-gradient-to-r from-pink-400 to-rose-400 text-white text-xs font-bold rounded-xl hover:from-pink-500 hover:to-rose-500 active:scale-[0.98] transition-all cursor-pointer focus:outline-none"
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
