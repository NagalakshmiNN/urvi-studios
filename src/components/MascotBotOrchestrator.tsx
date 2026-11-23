"use client";

import { useState, useCallback } from "react";
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

/**
 * Orchestrates the mascot walkers → bot widget transition.
 * Walking mascots play for ~30 seconds, fade out, then the bot bubble appears.
 */
export default function MascotBotOrchestrator({ imageA, imageB, messages }: OrchestratorProps) {
  const [walkersFinished, setWalkersFinished] = useState(false);

  const handleWalkersFinished = useCallback(() => {
    setWalkersFinished(true);
  }, []);

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
      />
    </>
  );
}
