"use client";

import { useEffect, useState } from "react";

export function TimerDisplay({ endsAt }: { endsAt: number | null }) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (!endsAt) {
      setTimeLeft(0);
      return;
    }

    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  if (!endsAt) return null;

  return (
    <div className={`text-xl font-black ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-gray-700'}`}>
      00:{timeLeft.toString().padStart(2, '0')}
    </div>
  );
}
