"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function GalleryFallback() {
  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#1a0a10] via-[#2a0f1a] to-[#1a0a10]">
      <div className="w-12 h-12 rounded-full border-4 border-pink-900 border-t-pink-400 animate-spin" />
    </main>
  );
}

// Grid dimensions
const COLS = 10;
const ROWS = 5;
const TOTAL = COLS * ROWS;

function GalleryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const user = searchParams.get("user") || "";

  const [images, setImages] = useState<string[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Fetch images.json from public folder
  useEffect(() => {
    fetch("/images.json")
      .then((res) => res.json())
      .then((data: { images: string[] }) => {
        setImages(data.images);
        setLoaded(true);
      })
      .catch(() => {
        setImages([]);
        setLoaded(true);
      });
  }, []);

  // Build the 50-slot array by repeating images cyclically
  const gridImages = useMemo(() => {
    if (images.length === 0) return Array(TOTAL).fill("");
    return Array.from({ length: TOTAL }, (_, i) => images[i % images.length]);
  }, [images]);

  // Euclidean grid distance between two cell indices
  const getDistance = (a: number, b: number): number => {
    const ax = a % COLS;
    const ay = Math.floor(a / COLS);
    const bx = b % COLS;
    const by = Math.floor(b / COLS);
    return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
  };

  // Compute per-cell transform based on proximity to hovered cell
  const getCellStyle = (index: number): React.CSSProperties => {
    if (hoveredIndex === null) {
      return {
        transform: "scale(1) translate(0px, 0px)",
        zIndex: 1,
        filter: "brightness(0.85)",
      };
    }

    const dist = getDistance(index, hoveredIndex);

    if (dist === 0) {
      // The hovered cell itself
      return {
        transform: "scale(1.35)",
        zIndex: 30,
        filter: "brightness(1.1)",
        boxShadow: "0 0 30px 8px rgba(236, 72, 153, 0.5), 0 0 60px 15px rgba(236, 72, 153, 0.2)",
      };
    }

    // Push adjacent cells outward from the hovered cell
    const ix = index % COLS;
    const iy = Math.floor(index / COLS);
    const hx = hoveredIndex % COLS;
    const hy = Math.floor(hoveredIndex / COLS);
    const dx = ix - hx;
    const dy = iy - hy;
    const angle = Math.atan2(dy, dx);

    if (dist <= 1.5) {
      const push = 8;
      return {
        transform: `scale(1.12) translate(${Math.cos(angle) * push}px, ${Math.sin(angle) * push}px)`,
        zIndex: 20,
        filter: "brightness(1.0)",
      };
    }

    if (dist <= 2.5) {
      const push = 4;
      return {
        transform: `scale(1.04) translate(${Math.cos(angle) * push}px, ${Math.sin(angle) * push}px)`,
        zIndex: 10,
        filter: "brightness(0.95)",
      };
    }

    // Far away cells shrink slightly
    return {
      transform: "scale(0.92)",
      zIndex: 1,
      filter: "brightness(0.7)",
    };
  };

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden bg-gradient-to-br from-[#1a0a10] via-[#2a0f1a] to-[#1a0a10]">
      {/* Subtle animated gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(ellipse at 20% 50%, rgba(236,72,153,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 50%, rgba(244,114,182,0.06) 0%, transparent 60%)",
        }}
      />

      {/* Top header bar */}
      <header className="w-[90vw] max-w-[1600px] flex justify-between items-center py-4 px-2 z-20 animate-fade-in">
        <h1 className="text-lg md:text-xl font-bold text-pink-300/90 flex items-center gap-2">
          <svg className="w-5 h-5 fill-pink-400 animate-heartbeat-slow" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
          Our Secret Memories
        </h1>
        <button
          onClick={() => router.push(`/welcome?user=${user}`)}
          className="px-4 py-2 border border-pink-500/30 text-pink-300 text-xs font-semibold rounded-xl hover:bg-pink-500/10 hover:border-pink-400/50 active:scale-95 transition-all cursor-pointer backdrop-blur-sm"
        >
          Back to Dashboard
        </button>
      </header>

      {/* Gallery Grid */}
      <div
        className="w-[90vw] max-w-[1600px] z-10 animate-fade-in"
        style={{
          height: "82vh",
          display: "grid",
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gridTemplateRows: `repeat(${ROWS}, 1fr)`,
          gap: "4px",
          padding: "2px",
        }}
      >
        {gridImages.map((src, i) => (
          <div
            key={i}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
            className="relative rounded-lg overflow-hidden cursor-pointer"
            style={{
              ...getCellStyle(i),
              transition: "transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), filter 0.35s ease, box-shadow 0.35s ease, z-index 0s",
            }}
          >
            {loaded && src ? (
              <img
                src={src}
                alt={`Memory ${i + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
                draggable={false}
              />
            ) : (
              <div className="w-full h-full bg-pink-950/40 flex items-center justify-center">
                <svg className="w-6 h-6 fill-pink-800/40" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </div>
            )}

            {/* Pink gradient overlay on every cell */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  hoveredIndex === i
                    ? "linear-gradient(to top, rgba(236,72,153,0.15) 0%, transparent 60%)"
                    : "linear-gradient(to top, rgba(0,0,0,0.25) 0%, transparent 50%)",
                transition: "background 0.35s ease",
              }}
            />
          </div>
        ))}
      </div>

      {/* Floating decorative hearts in the background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {[
          { left: "3%", size: "w-6 h-6", anim: "animate-float-heart-1", color: "text-pink-500/10" },
          { left: "15%", size: "w-4 h-4", anim: "animate-float-heart-3", color: "text-rose-500/8" },
          { left: "50%", size: "w-8 h-8", anim: "animate-float-heart-2", color: "text-pink-400/8" },
          { left: "80%", size: "w-5 h-5", anim: "animate-float-heart-4", color: "text-rose-400/10" },
          { left: "95%", size: "w-7 h-7", anim: "animate-float-heart-1", color: "text-pink-500/8" },
        ].map((h, i) => (
          <div
            key={i}
            className={`absolute bottom-[-40px] ${h.left} ${h.size} ${h.color} ${h.anim}`}
          >
            <svg className="w-full h-full fill-current" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
        ))}
      </div>
    </main>
  );
}

export default function GalleryPage() {
  return (
    <Suspense fallback={<GalleryFallback />}>
      <GalleryContent />
    </Suspense>
  );
}
