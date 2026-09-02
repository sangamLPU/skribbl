"use client";

import { getSocket } from "@/lib/socket";

interface WordSelectionModalProps {
  roomId: string;
  guestId: string;
  choices: string[];
  onSelected: () => void;
}

export function WordSelectionModal({ roomId, guestId, choices, onSelected }: WordSelectionModalProps) {
  if (choices.length === 0) return null;

  const handleSelect = (word: string) => {
    const socket = getSocket();
    socket.emit("word:select", { roomId, guestId, word });
    onSelected();
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl">
      <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-lg w-full text-center transform scale-100 animate-in zoom-in-95 duration-200">
        <h2 className="text-3xl font-black text-indigo-700 mb-2">Choose a word!</h2>
        <p className="text-gray-700 font-medium mb-8">You are drawing this turn.</p>
        
        <div className="flex flex-col gap-4">
          {choices.map((word) => (
            <button
              key={word}
              onClick={() => handleSelect(word)}
              className="w-full py-4 bg-indigo-50 hover:bg-indigo-600 text-indigo-900 hover:text-white rounded-xl font-bold text-xl border border-indigo-100 transition-all shadow-sm hover:shadow-md"
            >
              {word}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
