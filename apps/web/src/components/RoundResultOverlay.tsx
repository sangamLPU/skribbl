"use client";

import { Avatar } from "@/components/Avatar";
import { PlayerState } from "shared";

interface RoundResultOverlayProps {
  round: number;
  players: PlayerState[];
}

export function RoundResultOverlay({ round, players }: RoundResultOverlayProps) {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md rounded-2xl p-4 md:p-6">
      <div className="bg-white p-6 md:p-10 rounded-3xl shadow-2xl text-center transform scale-100 animate-in zoom-in duration-300 w-full max-w-lg">
        <h2 className="text-3xl md:text-4xl font-black text-indigo-700 mb-8 uppercase tracking-wide">
          Round {round - 1} Complete
        </h2>
        
        <div className="flex flex-col gap-4 mb-8">
          {sortedPlayers.map((p, i) => (
            <div key={p.playerId} className="bg-gray-50 border border-gray-100 p-4 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="font-black text-xl text-gray-400 w-6 text-left">{i + 1}.</span>
                <Avatar config={p.avatar} size={40} />
                <span className="font-bold text-gray-800 text-lg truncate max-w-[120px] md:max-w-[180px] text-left">
                  {p.username}
                </span>
              </div>
              <span className="font-black text-indigo-600 text-xl">{p.score} pt</span>
            </div>
          ))}
        </div>
        
        <p className="text-gray-500 font-medium animate-pulse">Get ready for the next round...</p>
      </div>
    </div>
  );
}
