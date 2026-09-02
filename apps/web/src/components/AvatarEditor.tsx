"use client";

import { useUserStore, AvatarConfig } from "@/store/useUserStore";
import { Avatar } from "./Avatar";
import { ChevronLeft, ChevronRight, Dices } from "lucide-react";

const COLORS = ["#ffcc99", "#ffb366", "#cc9966", "#996633", "#663300", "#ff99cc", "#cc99ff", "#99ccff"];

export function AvatarEditor() {
  const { avatar, setAvatar } = useUserStore();

  const handleNext = (feature: keyof AvatarConfig, max: number) => {
    if (feature === 'bodyColor') return;
    setAvatar({ ...avatar, [feature]: ((avatar[feature] as number) + 1) % max });
  };

  const handlePrev = (feature: keyof AvatarConfig, max: number) => {
    if (feature === 'bodyColor') return;
    setAvatar({ ...avatar, [feature]: ((avatar[feature] as number) - 1 + max) % max });
  };

  const handleColorChange = (color: string) => {
    setAvatar({ ...avatar, bodyColor: color });
  };

  const randomize = () => {
    setAvatar({
      body: 0,
      eyes: Math.floor(Math.random() * 2),
      mouth: Math.floor(Math.random() * 2),
      hair: 0,
      accessory: 0,
      bodyColor: COLORS[Math.floor(Math.random() * COLORS.length)]
    });
  };

  return (
    <div className="flex flex-col items-center gap-4 bg-white p-6 rounded-2xl shadow-lg w-full max-w-sm">
      <div className="relative">
        <Avatar config={avatar} size={120} />
      </div>
      
      <div className="flex flex-col w-full gap-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-700">Eyes</span>
          <div className="flex items-center gap-2">
            <button onClick={() => handlePrev('eyes', 2)} className="p-1 hover:bg-gray-100 rounded"><ChevronLeft size={20}/></button>
            <span className="w-4 text-center">{avatar.eyes + 1}</span>
            <button onClick={() => handleNext('eyes', 2)} className="p-1 hover:bg-gray-100 rounded"><ChevronRight size={20}/></button>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-700">Mouth</span>
          <div className="flex items-center gap-2">
            <button onClick={() => handlePrev('mouth', 2)} className="p-1 hover:bg-gray-100 rounded"><ChevronLeft size={20}/></button>
            <span className="w-4 text-center">{avatar.mouth + 1}</span>
            <button onClick={() => handleNext('mouth', 2)} className="p-1 hover:bg-gray-100 rounded"><ChevronRight size={20}/></button>
          </div>
        </div>

        <div className="flex gap-2 justify-center mt-2 flex-wrap">
          {COLORS.map((c) => (
            <button 
              key={c}
              onClick={() => handleColorChange(c)}
              className={`w-8 h-8 rounded-full border-2 ${avatar.bodyColor === c ? 'border-gray-800' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      
      <button 
        onClick={randomize}
        className="mt-2 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 bg-gray-100 px-4 py-2 rounded-full transition-colors"
      >
        <Dices size={18} /> Randomize
      </button>
    </div>
  );
}
