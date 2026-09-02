"use client";

import { useEffect, useState, Suspense } from "react";
import { useUserStore } from "@/store/useUserStore";
import { AvatarEditor } from "@/components/AvatarEditor";
import { useRouter, useSearchParams } from "next/navigation";
import { getSocket } from "@/lib/socket";

function HomeContent() {
  const { guestId, username, initializeGuest, setUsername } = useUserStore();
  const [localUsername, setLocalUsername] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    initializeGuest();
    setLocalUsername(username);
    
    // Auto-expand join if URL has a code
    const codeParam = searchParams.get("code");
    if (codeParam) {
      setJoinCode(codeParam);
      setIsJoining(true);
    }
  }, [initializeGuest, username, searchParams]);

  const handleSetUsername = () => {
    if (!localUsername.trim()) {
      const randomName = `Player${Math.floor(Math.random() * 10000)}`;
      setUsername(randomName);
    } else {
      setUsername(localUsername);
    }
  };

  const handleCreateRoom = () => {
    handleSetUsername();
    const socket = getSocket();
    
    // Pass guestId so the server knows exactly who the creator is
    socket.auth = { guestId };
    
    const doCreate = () => {
      const payload = {
        guestId,
        settings: { maxPlayers: 8, rounds: 3, drawTime: 80, wordCount: 3, hints: 2, language: "en", customWordsOnly: false }
      };
      socket.emit("room:create", payload, (response: any) => {
        if (response && response.error) {
          console.error("Room creation error:", response.error);
          setJoinError(response.error);
        } else if (response && response.roomId) {
          router.push(`/room/${response.roomId}`);
        } else {
          console.error("Unknown response:", response);
          setJoinError("Failed to create room.");
        }
      });
    };

    if (!socket.connected) {
      socket.connect();
      socket.once("connect", doCreate);
      
      // Add a timeout in case connection fails
      setTimeout(() => {
        if (!socket.connected) {
          setJoinError("Failed to connect to server.");
        }
      }, 5000);
    } else {
      doCreate();
    }
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError("");
    const code = joinCode.trim().toUpperCase();
    
    if (code.length < 4) {
      setJoinError("Invalid room code format.");
      return;
    }

    handleSetUsername();

    const socket = getSocket();
    socket.auth = { guestId };
    if (!socket.connected) socket.connect();

    socket.emit("room:check", code, (res: any) => {
      if (res.error) {
        setJoinError(res.error);
      } else {
        router.push(`/room/${code}`);
      }
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-center gap-12">
      {/* Left Side: Branding and Actions */}
      <div className="flex-1 flex flex-col items-center md:items-start text-white text-center md:text-left">
        <h1 className="text-6xl font-black mb-4 tracking-tight drop-shadow-xl">Scribble<span className="text-yellow-400">Verse</span></h1>
        <p className="text-xl mb-8 text-indigo-100 font-medium max-w-sm">
          Draw, guess, and compete with friends in private rooms!
        </p>
        
        <div className="w-full max-w-sm space-y-4">
          <input 
            type="text" 
            placeholder="Enter your username" 
            maxLength={15}
            value={localUsername}
            onChange={(e) => setLocalUsername(e.target.value)}
            className="w-full px-6 py-4 rounded-full text-gray-900 font-bold text-lg focus:outline-none focus:ring-4 focus:ring-yellow-400 shadow-lg transition-all"
          />
          
          <button 
            onClick={handleCreateRoom}
            className="w-full py-4 rounded-full bg-yellow-400 hover:bg-yellow-300 text-yellow-900 font-bold text-xl shadow-[0_4px_14px_0_rgba(250,204,21,0.39)] hover:shadow-[0_6px_20px_rgba(250,204,21,0.23)] transition-all transform hover:-translate-y-1"
          >
            Create Room
          </button>
          
          <button 
            onClick={() => setIsJoining(!isJoining)}
            className="w-full py-4 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xl shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.23)] transition-all transform hover:-translate-y-1"
          >
            Join Room
          </button>

          {isJoining && (
            <form onSubmit={handleJoinSubmit} className="mt-4 p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 animate-in fade-in slide-in-from-top-4 duration-300">
              <label className="block text-sm font-bold text-indigo-100 mb-2">Enter Room Code:</label>
              <div className="flex gap-2">
                <input 
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={8}
                  placeholder="e.g. NR32L7"
                  className="flex-1 px-4 py-3 rounded-xl text-gray-900 font-bold tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-indigo-400 text-center"
                />
                <button type="submit" className="px-6 py-3 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-xl transition-all shadow-md">
                  Join
                </button>
              </div>
              {joinError && <p className="text-red-300 font-bold mt-3 text-center text-sm">{joinError}</p>}
            </form>
          )}
        </div>
      </div>

      {/* Right Side: Avatar Customization */}
      <div className="flex-1 w-full flex justify-center">
        <AvatarEditor />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex flex-col items-center justify-center p-4">
      <Suspense fallback={<div className="text-white text-2xl font-bold animate-pulse">Loading...</div>}>
        <HomeContent />
      </Suspense>
    </main>
  );
}
