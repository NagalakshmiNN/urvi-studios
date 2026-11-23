"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";

type MascotMessage = {
  id: string;
  message: string;
  animation: string;
};

type MascotWalkerProps = {
  onFinished?: () => void;
  imageA: string;
  imageB: string;
  messages: MascotMessage[];
};

// Animation durations per type (ms)
const ANIM_DURATIONS: Record<string, number> = {
  namaste: 1200,
  wave: 1000,
  dance: 1500,
  jump: 1000,
  twirl: 1200,
  sit: 1800,
};

export default function MascotWalker({ imageA, imageB, messages, onFinished }: MascotWalkerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const mascotARef = useRef<HTMLDivElement>(null);
  const mascotBRef = useRef<HTMLDivElement>(null);
  const bubbleARef = useRef<HTMLDivElement>(null);
  const bubbleBRef = useRef<HTMLDivElement>(null);

  const [dismissed, setDismissed] = useState(false);
  const posA = useRef(-100);
  const posB = useRef(typeof window !== "undefined" ? window.innerWidth + 50 : 1500);
  const dirA = useRef(1);
  const dirB = useRef(-1);
  const busyA = useRef(false);
  const busyB = useRef(false);
  const rafId = useRef(0);

  // Reduced motion preference
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);

    return () => mq.removeEventListener("change", handler);
  }, []);

  // Spawn sparkles

  // Auto-finish: fade out after ~30s and call onFinished
  const [fading, setFading] = useState(false);
  useEffect(() => {
    if (!onFinished || dismissed) return;
    const timer = setTimeout(() => {
      setFading(true);
      // After fade animation (1s), call onFinished
      setTimeout(() => {
        setDismissed(true);
        onFinished();
      }, 1000);
    }, 30000); // 30 seconds
    return () => clearTimeout(timer);
  }, [onFinished, dismissed]);

  const spawnSparkles = useCallback((mascotEl: HTMLDivElement) => {
    const container = containerRef.current;
    if (!container || reducedMotion) return;
    const rect = mascotEl.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    for (let i = 0; i < 5; i++) {
      const s = document.createElement("div");
      s.className = "mascot-sparkle";
      s.style.left = `${rect.left - cRect.left + rect.width / 2 + (Math.random() - 0.5) * 50}px`;
      s.style.top = `${rect.top - cRect.top + rect.height * 0.3 + (Math.random() - 0.5) * 30}px`;
      s.innerHTML = '<svg viewBox="0 0 10 10" width="10" height="10"><path d="M5,0 L6,4 L10,5 L6,6 L5,10 L4,6 L0,5 L4,4Z" fill="#A98238"/></svg>';
      s.style.animationDelay = `${i * 50}ms`;
      container.appendChild(s);
      setTimeout(() => s.remove(), 1200);
    }
  }, [reducedMotion]);

  // Click action
  const doAction = useCallback((which: "A" | "B") => {
    if (messages.length === 0) return;
    const mascot = which === "A" ? mascotARef.current : mascotBRef.current;
    const bubble = which === "A" ? bubbleARef.current : bubbleBRef.current;
    const busy = which === "A" ? busyA : busyB;

    if (!mascot || !bubble || busy.current) return;
    busy.current = true;

    const msg = messages[Math.floor(Math.random() * messages.length)];
    const dur = ANIM_DURATIONS[msg.animation] || 1000;
    const animName = `mascot${msg.animation.charAt(0).toUpperCase() + msg.animation.slice(1)}`;

    // Stop walk bob, play action
    mascot.classList.remove("mascot-walking");
    if (!reducedMotion) {
      mascot.style.animation = `${animName} ${dur}ms ease`;
    }

    // Show speech bubble
    bubble.textContent = msg.message;
    bubble.classList.add("mascot-bubble-show");

    spawnSparkles(mascot);

    setTimeout(() => {
      mascot.style.animation = "";
      if (!reducedMotion) mascot.classList.add("mascot-walking");
      bubble.classList.remove("mascot-bubble-show");
      busy.current = false;
    }, dur + 600);
  }, [messages, reducedMotion, spawnSparkles]);

  // Walk loop
  useEffect(() => {
    if (dismissed) return;

    const speedA = reducedMotion ? 0 : 0.6;
    const speedB = reducedMotion ? 0 : 0.5;

    posA.current = -100;
    posB.current = window.innerWidth + 50;

    // Add walking class
    if (!reducedMotion) {
      mascotARef.current?.classList.add("mascot-walking");
      mascotBRef.current?.classList.add("mascot-walking");
    }

    function loop() {
      const w = window.innerWidth;

      if (!busyA.current && mascotARef.current) {
        posA.current += speedA * dirA.current;
        if (posA.current > w + 20) { dirA.current = -1; mascotARef.current.classList.add("mascot-flipped"); }
        if (posA.current < -100) { dirA.current = 1; mascotARef.current.classList.remove("mascot-flipped"); }
        mascotARef.current.style.left = `${posA.current}px`;
      }

      if (!busyB.current && mascotBRef.current) {
        posB.current += speedB * dirB.current;
        if (posB.current > w + 20) { dirB.current = -1; mascotBRef.current.classList.remove("mascot-flipped"); }
        if (posB.current < -100) { dirB.current = 1; mascotBRef.current.classList.add("mascot-flipped"); }
        mascotBRef.current.style.left = `${posB.current}px`;
      }

      rafId.current = requestAnimationFrame(loop);
    }

    const timer = setTimeout(() => {
      rafId.current = requestAnimationFrame(loop);
    }, 500);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(rafId.current);
    };
  }, [dismissed, reducedMotion]);

  // Hide mascots on admin pages
  if (pathname?.startsWith("/admin")) return null;
  if (dismissed) return null;

  return (
    <>
      <style>{mascotCSS}</style>
      <div className={`mascot-container${fading ? " mascot-fading" : ""}`} ref={containerRef}>
        <div
          className="mascot-char"
          ref={mascotARef}
          onClick={() => doAction("A")}
          role="button"
          tabIndex={0}
          aria-label="Click to interact with mascot"
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") doAction("A"); }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageA} alt="URVI mascot" draggable={false} />
          <div className="mascot-bubble" ref={bubbleARef}>Hi!</div>
        </div>
        <div
          className="mascot-char"
          ref={mascotBRef}
          onClick={() => doAction("B")}
          role="button"
          tabIndex={0}
          aria-label="Click to interact with mascot"
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") doAction("B"); }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageB} alt="URVI mascot" draggable={false} />
          <div className="mascot-bubble" ref={bubbleBRef}>Hi!</div>
        </div>
        <button
          className="mascot-dismiss-btn"
          onClick={() => {
            try { localStorage.setItem("urvi-hide-mascots", "true"); } catch {}
            setDismissed(true);
          }}
          aria-label="Hide mascots"
          title="Hide mascots"
        >
          ✕
        </button>
      </div>
    </>
  );
}

const mascotCSS = `
/* MASCOT WALKER SYSTEM */

.mascot-container {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  height: 180px;
  pointer-events: none;
  z-index: 1000;
  overflow: visible;
}

.mascot-char {
  position: absolute;
  bottom: 0;
  height: 120px;
  cursor: pointer;
  pointer-events: all;
  transition: transform 0.15s ease;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
.mascot-char:hover {
  transform: scale(1.05);
  filter: drop-shadow(0 2px 8px rgba(169,130,56,0.3));
}
.mascot-char:focus-visible {
  outline: 2px solid #A98238;
  outline-offset: 4px;
  border-radius: 8px;
}
.mascot-char img {
  height: 100%;
  width: auto;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
}
.mascot-flipped img {
  transform: scaleX(-1);
}

/* Speech bubble */
.mascot-bubble {
  position: absolute;
  bottom: 130px;
  left: 50%;
  transform: translateX(-50%) scale(0.5) translateY(10px);
  background: #fff;
  border: 2px solid #A98238;
  border-radius: 16px 16px 16px 4px;
  padding: 8px 16px;
  font-family: 'Cormorant Garamond', serif;
  font-size: 16px;
  font-weight: 600;
  color: #3F4827;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.3s, transform 0.3s;
  pointer-events: none;
  box-shadow: 0 4px 14px rgba(0,0,0,0.12);
  z-index: 1001;
}
.mascot-bubble-show {
  opacity: 1;
  transform: translateX(-50%) scale(1) translateY(0);
}
.mascot-bubble::after {
  content: '';
  position: absolute;
  bottom: -8px;
  left: 14px;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 8px solid #fff;
}

/* Dismiss button */
.mascot-dismiss-btn {
  position: fixed;
  bottom: 135px;
  right: 12px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #EFE4D0;
  border: 1px solid #A98238;
  color: #A98238;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1002;
  opacity: 0.6;
  transition: opacity 0.2s;
  pointer-events: all;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
.mascot-dismiss-btn:hover { opacity: 1; }

/* Walk bob */
.mascot-walking {
  animation: mascotWalkBob 0.6s ease-in-out infinite;
}

/* Sparkles */
.mascot-sparkle {
  position: absolute;
  pointer-events: none;
  z-index: 1002;
  width: 10px;
  height: 10px;
  animation: mascotSparklePop 700ms ease forwards;
}

/* Keyframes */
@keyframes mascotWalkBob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
@keyframes mascotDance {
  0% { transform: rotate(0) scale(1); }
  25% { transform: rotate(-10deg) scale(1.05); }
  50% { transform: rotate(8deg) scale(1.08); }
  75% { transform: rotate(-6deg) scale(1.03); }
  100% { transform: rotate(0) scale(1); }
}
@keyframes mascotJump {
  0% { transform: translateY(0) scale(1,1); }
  20% { transform: translateY(0) scale(1.05,0.92); }
  50% { transform: translateY(-25px) scale(0.95,1.08); }
  80% { transform: translateY(0) scale(1.03,0.96); }
  100% { transform: translateY(0) scale(1,1); }
}
@keyframes mascotTwirl {
  0% { transform: rotateY(0) scale(1); }
  50% { transform: rotateY(180deg) scale(1.05); }
  100% { transform: rotateY(360deg) scale(1); }
}
@keyframes mascotWave {
  0%, 100% { transform: rotate(0); }
  20% { transform: rotate(-12deg); }
  40% { transform: rotate(12deg); }
  60% { transform: rotate(-8deg); }
  80% { transform: rotate(8deg); }
}
@keyframes mascotSit {
  0% { transform: translateY(0) scaleY(1); }
  40%, 100% { transform: translateY(15px) scaleY(0.88); }
}
@keyframes mascotNamaste {
  0%, 100% { transform: translateY(0) scale(1); }
  30% { transform: translateY(-5px) scale(1.03); }
  60% { transform: translateY(8px) scale(0.97); }
}
@keyframes mascotSparklePop {
  0% { opacity: 1; transform: scale(0) rotate(0); }
  50% { opacity: 1; transform: scale(1.5) rotate(90deg); }
  100% { opacity: 0; transform: scale(2) rotate(180deg) translateY(-20px); }
}

/* Responsive - mobile / iPad */
@media (max-width: 768px) {
  .mascot-char { height: 90px; }
  .mascot-container { height: 140px; }
  .mascot-bubble { bottom: 100px; font-size: 14px; }
  .mascot-dismiss-btn { bottom: 102px; }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .mascot-walking { animation: none; }
  .mascot-sparkle { animation: none; display: none; }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .mascot-bubble {
    background: #2a2a20;
    color: #c8d4a8;
    border-color: #d4a84a;
  }
  .mascot-bubble::after {
    border-top-color: #2a2a20;
  }
  .mascot-dismiss-btn {
    background: #2a2a20;
    color: #d4a84a;
    border-color: #d4a84a;
  }
}

/* Fade-out transition */
.mascot-fading {
  animation: mascotFadeOut 1s ease forwards;
}
@keyframes mascotFadeOut {
  0% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(20px); }
}
`;
