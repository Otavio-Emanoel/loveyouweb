"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function GalleryFallback() {
  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-zinc-950">
      <div className="w-12 h-12 rounded-full border-4 border-pink-900 border-t-pink-400 animate-spin" />
    </main>
  );
}

// 46 items packed perfectly to cover a 13x7 grid (total 91 cells) without gaps
const GALLERY_ITEMS = [
  // Row 0
  { id: 0, col: 0, row: 0, colSpan: 2, rowSpan: 2 },
  { id: 1, col: 2, row: 0, colSpan: 1, rowSpan: 1 },
  { id: 2, col: 3, row: 0, colSpan: 2, rowSpan: 1 },
  { id: 3, col: 5, row: 0, colSpan: 1, rowSpan: 2 },
  { id: 4, col: 6, row: 0, colSpan: 2, rowSpan: 1 },
  { id: 5, col: 8, row: 0, colSpan: 1, rowSpan: 1 },
  { id: 6, col: 9, row: 0, colSpan: 2, rowSpan: 2 },
  { id: 7, col: 11, row: 0, colSpan: 2, rowSpan: 1 },

  // Row 1
  { id: 8, col: 2, row: 1, colSpan: 1, rowSpan: 1 },
  { id: 9, col: 3, row: 1, colSpan: 2, rowSpan: 1 },
  { id: 10, col: 6, row: 1, colSpan: 2, rowSpan: 1 },
  { id: 11, col: 8, row: 1, colSpan: 1, rowSpan: 1 },
  { id: 12, col: 11, row: 1, colSpan: 2, rowSpan: 1 },

  // Row 2
  { id: 13, col: 0, row: 2, colSpan: 1, rowSpan: 2 },
  { id: 14, col: 1, row: 2, colSpan: 2, rowSpan: 1 },
  { id: 15, col: 3, row: 2, colSpan: 2, rowSpan: 2 },
  { id: 16, col: 5, row: 2, colSpan: 1, rowSpan: 1 },
  { id: 17, col: 6, row: 2, colSpan: 2, rowSpan: 1 },
  { id: 18, col: 8, row: 2, colSpan: 2, rowSpan: 2 },
  { id: 19, col: 10, row: 2, colSpan: 1, rowSpan: 2 },
  { id: 20, col: 11, row: 2, colSpan: 2, rowSpan: 1 },

  // Row 3
  { id: 21, col: 1, row: 3, colSpan: 2, rowSpan: 1 },
  { id: 22, col: 5, row: 3, colSpan: 1, rowSpan: 1 },
  { id: 23, col: 6, row: 3, colSpan: 2, rowSpan: 1 },
  { id: 24, col: 11, row: 3, colSpan: 2, rowSpan: 1 },

  // Row 4
  { id: 25, col: 0, row: 4, colSpan: 2, rowSpan: 2 },
  { id: 26, col: 2, row: 4, colSpan: 1, rowSpan: 1 },
  { id: 27, col: 3, row: 4, colSpan: 2, rowSpan: 1 },
  { id: 28, col: 5, row: 4, colSpan: 1, rowSpan: 2 },
  { id: 29, col: 6, row: 4, colSpan: 2, rowSpan: 1 },
  { id: 30, col: 8, row: 4, colSpan: 1, rowSpan: 1 },
  { id: 31, col: 9, row: 4, colSpan: 2, rowSpan: 2 },
  { id: 32, col: 11, row: 4, colSpan: 2, rowSpan: 1 },

  // Row 5
  { id: 33, col: 2, row: 5, colSpan: 1, rowSpan: 1 },
  { id: 34, col: 3, row: 5, colSpan: 2, rowSpan: 1 },
  { id: 35, col: 6, row: 5, colSpan: 2, rowSpan: 1 },
  { id: 36, col: 8, row: 5, colSpan: 1, rowSpan: 1 },
  { id: 37, col: 11, row: 5, colSpan: 2, rowSpan: 1 },

  // Row 6
  { id: 38, col: 0, row: 6, colSpan: 2, rowSpan: 1 },
  { id: 39, col: 2, row: 6, colSpan: 1, rowSpan: 1 },
  { id: 40, col: 3, row: 6, colSpan: 2, rowSpan: 1 },
  { id: 41, col: 5, row: 6, colSpan: 2, rowSpan: 1 },
  { id: 42, col: 7, row: 6, colSpan: 1, rowSpan: 1 },
  { id: 43, col: 8, row: 6, colSpan: 1, rowSpan: 1 },
  { id: 44, col: 9, row: 6, colSpan: 2, rowSpan: 1 },
  { id: 45, col: 11, row: 6, colSpan: 2, rowSpan: 1 }
];

function GalleryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const user = searchParams.get("user") || "";

  const [images, setImages] = useState<string[]>([]);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Fetch images database
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

  // Dynamically repeat images if JSON contains fewer than 46 images
  const gridImages = useMemo(() => {
    if (images.length === 0) return Array(GALLERY_ITEMS.length).fill("");
    return Array.from({ length: GALLERY_ITEMS.length }, (_, i) => images[i % images.length]);
  }, [images]);

  // Compute 3D translations and rotations based on distance
  const getCellStyle = (item: typeof GALLERY_ITEMS[0]): React.CSSProperties => {
    if (hoveredId === null) {
      return {
        transform: "scale(1) translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg)",
        zIndex: 1,
        opacity: 0.95,
        filter: "brightness(0.9) grayscale(10%)",
      };
    }

    const hoveredItem = GALLERY_ITEMS.find((g) => g.id === hoveredId);
    if (!hoveredItem) return {};

    // Center coordinates
    const cx = item.col + item.colSpan / 2;
    const cy = item.row + item.rowSpan / 2;
    const hcx = hoveredItem.col + hoveredItem.colSpan / 2;
    const hcy = hoveredItem.row + hoveredItem.rowSpan / 2;

    const dx = cx - hcx;
    const dy = cy - hcy;
    const dist = Math.sqrt(dx ** 2 + dy ** 2);

    if (item.id === hoveredId) {
      // The hovered image zooms out in 3D
      return {
        transform: "scale(1.4) translate3d(0, 0, 150px) rotateX(0deg) rotateY(0deg)",
        zIndex: 50,
        opacity: 1,
        filter: "brightness(1.15) contrast(1.05)",
        boxShadow: "0 25px 50px -12px rgba(244, 63, 94, 0.4), 0 0 40px 10px rgba(236, 72, 153, 0.3)",
      };
    }

    if (dist > 0 && dist <= 3.2) {
      // Tilts and lifts neighbors away from hovered item
      const rotY = (dx / dist) * 22; // rotate around Y axis
      const rotX = -(dy / dist) * 22; // rotate around X axis
      const zLift = (3.2 - dist) * 35; // translate Z value

      return {
        transform: `scale(1.08) translate3d(${(dx / dist) * 8}px, ${(dy / dist) * 8}px, ${zLift}px) rotateX(${rotX}deg) rotateY(${rotY}deg)`,
        zIndex: Math.round((3.2 - dist) * 10),
        opacity: 0.9,
        filter: "brightness(0.95)",
      };
    }

    // Far away images shrink, dim, and blur lightly
    return {
      transform: "scale(0.88) translate3d(0, 0, -20px) rotateX(0deg) rotateY(0deg)",
      zIndex: 1,
      opacity: 0.4,
      filter: "brightness(0.65) blur(1.5px) grayscale(30%)",
    };
  };

  return (
    <main className="h-screen w-screen relative overflow-hidden bg-zinc-950 select-none">
      {/* 3D Grid Perspective Viewport */}
      <div 
        className="w-full h-full p-1"
        style={{
          perspective: "1200px",
          transformStyle: "preserve-3d",
          display: "grid",
          gridTemplateColumns: "repeat(13, 1fr)",
          gridTemplateRows: "repeat(7, 1fr)",
          gap: "8px",
        }}
      >
        {GALLERY_ITEMS.map((item, i) => (
          <div
            key={item.id}
            onMouseEnter={() => setHoveredId(item.id)}
            onMouseLeave={() => setHoveredId(null)}
            className="relative rounded-xl overflow-hidden cursor-pointer"
            style={{
              gridColumn: `${item.col + 1} / span ${item.colSpan}`,
              gridRow: `${item.row + 1} / span ${item.rowSpan}`,
              ...getCellStyle(item),
              transition: "transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), filter 0.45s ease, opacity 0.45s ease, box-shadow 0.45s ease",
              transformStyle: "preserve-3d",
            }}
          >
            {loaded && gridImages[i] ? (
              <img
                src={gridImages[i]}
                alt={`Love Memory ${i + 1}`}
                className="w-full h-full object-cover pointer-events-none"
                draggable={false}
              />
            ) : (
              <div className="w-full h-full bg-zinc-900/60 flex items-center justify-center">
                <svg className="w-6 h-6 fill-pink-900/35" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </div>
            )}

            {/* Inner hover reflection gradient */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  hoveredId === item.id
                    ? "linear-gradient(to top, rgba(244,63,94,0.1) 0%, transparent 60%)"
                    : "linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 50%)",
                transition: "background 0.45s ease",
              }}
            />
          </div>
        ))}
      </div>

      {/* Floating Header Panel (Overlaid absolutely) */}
      <div className="absolute top-4 left-4 z-40 bg-zinc-950/75 backdrop-blur-md border border-zinc-800/60 text-zinc-100 rounded-2xl px-4 py-2 flex items-center gap-2 shadow-lg animate-fade-in">
        <svg className="w-4 h-4 fill-pink-500 animate-heartbeat-slow" viewBox="0 0 24 24">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
        <span className="text-xs md:text-sm font-bold tracking-wider text-pink-300">OUR SECRET MEMORIES</span>
      </div>

      {/* Floating Back Control Panel (Overlaid absolutely) */}
      <div className="absolute top-4 right-4 z-40 animate-fade-in">
        <button
          onClick={() => router.push(`/welcome?user=${user}`)}
          className="bg-zinc-950/75 hover:bg-zinc-900 border border-zinc-800/60 hover:border-pink-500/30 text-pink-300 hover:text-pink-200 text-xs font-bold rounded-2xl px-4 py-2.5 shadow-lg active:scale-95 transition-all cursor-pointer backdrop-blur-md flex items-center gap-1.5 focus:outline-none"
        >
          <svg className="w-3.5 h-3.5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </button>
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
