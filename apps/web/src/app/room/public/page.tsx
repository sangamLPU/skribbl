"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { getSocket } from "@/lib/socket";

export default function PublicMatchmakingPage() {
  const router = useRouter();
  const { guestId, username } = useUserStore();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!guestId || !username) {
      router.push("/");
      return;
    }

    const socket = getSocket();
    if (!socket.connected) {
      socket.connect();
    }

    // Authenticate with guestId
    socket.auth = { guestId };

    // Request to join a public room
    socket.emit("room:join_public", (res: any) => {
      if (res && res.roomId) {
        // Redirect to the actual room URL once found/created
        router.replace(`/room/${res.roomId}`);
      } else {
        setError("Failed to find a public room. Please try again.");
      }
    });
  }, [guestId, username, router]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Matchmaking Failed</h1>
          <p className="text-gray-700">{error}</p>
          <button 
            onClick={() => router.push("/")}
            className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-indigo-500 flex flex-col items-center justify-center">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white mb-6"></div>
      <h1 className="text-3xl font-bold text-white mb-2">Finding a Game...</h1>
      <p className="text-indigo-200">Matching you with other players</p>
    </div>
  );
}
