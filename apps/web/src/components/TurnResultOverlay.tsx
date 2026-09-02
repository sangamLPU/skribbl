"use client";

import { useEffect, useState } from "react";
import { getSocket } from "@/lib/socket";

export function TurnResultOverlay() {
  const [secretWord, setSecretWord] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();
    
    socket.on("turn:ended", ({ secretWord }) => {
      setSecretWord(secretWord);
    });

    return () => {
      socket.off("turn:ended");
    };
  }, []);

  if (!secretWord) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-md rounded-2xl">
      <div className="bg-white p-10 rounded-3xl shadow-2xl text-center transform scale-100 animate-in zoom-in duration-300">
        <h2 className="text-3xl font-black text-gray-800 mb-2">The word was:</h2>
        <div className="text-5xl font-black text-green-500 mb-6 uppercase tracking-widest">{secretWord}</div>
        <p className="text-gray-600 font-medium">Getting ready for the next turn...</p>
      </div>
    </div>
  );
}
