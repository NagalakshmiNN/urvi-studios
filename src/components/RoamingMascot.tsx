"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type Props = {
  message?: string | null;
};

/**
 * A small animated peacock mascot that walks along the bottom of the screen.
 * During a festival/sale event, it displays a speech bubble with the event message.
 * Can be dismissed and respects prefers-reduced-motion.
 */
export default function RoamingMascot({ message }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [position, setPosition] = useState({ x: -60, direction: 1 });
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const pauseRef = useRef<number>(0);

  // Check if already dismissed this session
  useEffect(() => {
    try {
      if (sessionStorage.getItem("mascot-dismissed") === "1") {
        setDismissed(true);
      }
    } catch {}
  }, []);

  // Animation loop
  useEffect(() => {
    if (dismissed) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    // Hide on small screens
    if (window.innerWidth < 768) {
      setDismissed(true);
      return;
    }

    function animate(time: number) {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const dt = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      // Random pauses
      if (pauseRef.current > 0) {
        pauseRef.current -= dt;
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      setPosition((prev) => {
        const maxX = window.innerWidth - 80;
        let newX = prev.x + prev.direction * 40 * dt;
        let newDir = prev.direction;

        if (newX > maxX) {
          newX = maxX;
          newDir = -1;
          pauseRef.current = 1 + Math.random() * 3; // pause 1-4 seconds
        } else if (newX < 10) {
          newX = 10;
          newDir = 1;
          pauseRef.current = 1 + Math.random() * 2;
        }

        // Random stops
        if (Math.random() < 0.002) {
          pauseRef.current = 2 + Math.random() * 3;
        }

        return { x: newX, direction: newDir };
      });

      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [dismissed]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      sessionStorage.setItem("mascot-dismissed", "1");
    } catch {}
  }, []);

  if (dismissed) return null;

  const isFlipped = position.direction === -1;

  return (
    <>
      <style>{`
        .mascot-wrap {
          position: fixed;
          bottom: 10px;
          z-index: 50;
          cursor: pointer;
          transition: transform 0.1s ease;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.15));
        }
        .mascot-wrap:hover { transform: scale(1.1); }
        .mascot-body {
          width: 48px;
          height: 48px;
          transition: transform 0.3s ease;
        }
        .mascot-bubble {
          position: absolute;
          bottom: 56px;
          left: 50%;
          transform: translateX(-50%);
          background: #fff;
          color: #333;
          font-family: var(--font-body, Montserrat, sans-serif);
          font-size: 12px;
          padding: 8px 12px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.12);
          white-space: nowrap;
          max-width: 220px;
          white-space: normal;
          line-height: 1.4;
          pointer-events: none;
          animation: bubblePop 0.3s ease;
        }
        .mascot-bubble::after {
          content: '';
          position: absolute;
          bottom: -6px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 6px solid #fff;
        }
        .mascot-dismiss {
          position: absolute;
          top: -6px;
          right: -6px;
          width: 18px;
          height: 18px;
          background: var(--olive, #3F4827);
          color: #fff;
          border: none;
          border-radius: 50%;
          font-size: 10px;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        @keyframes bubblePop {
          from { opacity: 0; transform: translateX(-50%) scale(0.8); }
          to { opacity: 1; transform: translateX(-50%) scale(1); }
        }
        @keyframes waddle {
          0%, 100% { transform: rotate(-3deg); }
          50% { transform: rotate(3deg); }
        }
        .mascot-walking .mascot-body {
          animation: waddle 0.4s ease-in-out infinite;
        }
        @media (max-width: 767px) {
          .mascot-wrap { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .mascot-walking .mascot-body { animation: none; }
          .mascot-wrap { bottom: 10px; right: 10px; left: auto !important; }
        }
      `}</style>
      <div
        className={`mascot-wrap ${pauseRef.current <= 0 ? "mascot-walking" : ""}`}
        style={{ left: position.x }}
        onClick={() => setShowBubble(!showBubble)}
        title="Click me!"
      >
        <button className="mascot-dismiss" onClick={(e) => { e.stopPropagation(); dismiss(); }} aria-label="Dismiss mascot">
          ✕
        </button>
        {/* Inline SVG peacock mascot in brand colors */}
        <svg className="mascot-body" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"
          style={{ transform: isFlipped ? "scaleX(-1)" : "scaleX(1)" }}>
          {/* Body */}
          <ellipse cx="32" cy="42" rx="12" ry="10" fill="#3F4827"/>
          {/* Head */}
          <circle cx="32" cy="28" r="8" fill="#6A7444"/>
          {/* Eye */}
          <circle cx="35" cy="26" r="2" fill="#F7F0E4"/>
          <circle cx="35.5" cy="25.5" r="1" fill="#51462F"/>
          {/* Beak */}
          <polygon points="40,28 44,30 40,31" fill="#A98238"/>
          {/* Crown feathers */}
          <line x1="30" y1="22" x2="28" y2="15" stroke="#A98238" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="32" y1="21" x2="32" y2="13" stroke="#A98238" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="34" y1="22" x2="36" y2="15" stroke="#A98238" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="28" cy="14" r="2" fill="#A98238"/>
          <circle cx="32" cy="12" r="2" fill="#6A7444"/>
          <circle cx="36" cy="14" r="2" fill="#A98238"/>
          {/* Tail fan */}
          <path d="M20,42 Q12,30 8,18" stroke="#3F4827" strokeWidth="2" fill="none"/>
          <path d="M20,42 Q10,32 4,22" stroke="#6A7444" strokeWidth="2" fill="none"/>
          <path d="M20,42 Q8,36 2,28" stroke="#A98238" strokeWidth="1.5" fill="none"/>
          <circle cx="8" cy="17" r="3" fill="#6A7444" opacity="0.8"/>
          <circle cx="4" cy="21" r="3" fill="#A98238" opacity="0.8"/>
          <circle cx="2" cy="27" r="2.5" fill="#3F4827" opacity="0.8"/>
          {/* Tail eye patterns */}
          <circle cx="8" cy="17" r="1.5" fill="#A98238"/>
          <circle cx="4" cy="21" r="1.5" fill="#3F4827"/>
          {/* Legs */}
          <line x1="28" y1="50" x2="26" y2="58" stroke="#A98238" strokeWidth="2" strokeLinecap="round"/>
          <line x1="36" y1="50" x2="38" y2="58" stroke="#A98238" strokeWidth="2" strokeLinecap="round"/>
          {/* Feet */}
          <path d="M24,58 L26,58 L28,56" stroke="#A98238" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
          <path d="M36,58 L38,58 L40,56" stroke="#A98238" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        </svg>

        {showBubble && (
          <div className="mascot-bubble">
            {message || "Hey there! I'm Urvi, your style companion. Browse around and find something you love!"}
          </div>
        )}
      </div>
    </>
  );
}
