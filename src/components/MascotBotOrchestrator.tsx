"use client";

import { useState, useCallback, useEffect } from "react";
import MascotWalker from "./MascotWalker";
import UrviBotWidget from "./UrviBotWidget";

type MascotMessage = {
  id: string;
  message: string;
  animation: string;
};

type OrchestratorProps = {
  imageA: string;
  imageB: string;
  messages: MascotMessage[];
};

const STORAGE_KEY = "urvi-hide-mascots";

/**
 * Orchestrates the mascot walkers -> bot widget transition.
 * Walking mascots play for ~30 seconds, fade out, then the bot bubble appears.
 * Respects persistent visitor preference stored in localStorage.
 */
export default function MascotBotOrchestrator({ imageA, imageB, messages }: OrchestratorProps) {
  const [walkersFinished, setWalkersFinished] = useState(false);
  const [hidden, setHidden] = useState(true); // start hidden, check localStorage in useEffect

  // Check persistent preference on mount (client-side only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      setHidden(stored === "true");
    } catch {
      setHidden(false); // if localStorage unavailable, show mascots
    }
  }, []);

  const handleWalkersFinished = useCallback(() => {
    setWalkersFinished(true);
  }, []);

  const handleHidePermanently = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // localStorage unavailable -- hide for this session only
    }
    setHidden(true);
  }, []);

  const handleRevive = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setHidden(false);
    setWalkersFinished(true); // skip walkers, go straight to bot
  }, []);

  // If visitor chose to hide permanently, show a tiny revival button
  if (hidden) {
    return (
      <button
        onClick={handleRevive}
        aria-label="Show shopping assistant"
        title="Show shopping assistant"
        style={{
          position: "fixed",
          bottom: 12,
          right: 12,
          zIndex: 8999,
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "#EFE4D0",
          border: "1px solid #A98238",
          color: "#A98238",
          fontSize: 18,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.5,
          transition: "opacity 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.5")}
      >
        &#x1F4AC;
      </button>
    );
  }

  return (
    <>
      {!walkersFinished && (
        <MascotWalker
          imageA={imageA}
          imageB={imageB}
          messages={messages}
          onFinished={handleWalkersFinished}
        />
      )}
      <UrviBotWidget
        imageA={imageA}
        imageB={imageB}
        visible={walkersFinished}
        onHidePermanently={handleHidePermanently}
      />
    </>
  );
}
