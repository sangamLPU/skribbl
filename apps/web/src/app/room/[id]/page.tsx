"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { getSocket } from "@/lib/socket";
import { Avatar } from "@/components/Avatar";
import { DrawingCanvas } from "@/components/DrawingCanvas";
import { WordSelectionModal } from "@/components/WordSelectionModal";
import { ChatPanel } from "@/components/ChatPanel";
import { TimerDisplay } from "@/components/TimerDisplay";
import { TurnResultOverlay } from "@/components/TurnResultOverlay";

export default function RoomPage() {
  const params = useParams();
  const roomId = params.id as string;
  const router = useRouter();
  const { guestId, username, avatar } = useUserStore();
  const [roomState, setRoomState] = useState<any>(null);
  const [error, setError] = useState("");
  const [wordHint, setWordHint] = useState("");
  const [secretWord, setSecretWord] = useState("");
  const [wordChoices, setWordChoices] = useState<string[]>([]);
  const [showMobilePlayers, setShowMobilePlayers] = useState(false);

  useEffect(() => {
    if (!guestId || !username) {
      router.push(`/?code=${roomId}`);
      return;
    }

    const socket = getSocket();
    if (!socket.connected) {
      socket.connect();
    }

    // Pass guestId as auth for reconnection mapping
    socket.auth = { guestId };

    socket.emit("room:join", { roomId, guestId, username, avatar }, (res: any) => {
      if (res.error) {
        setError(res.error);
      } else {
        setRoomState(res.room);
      }
    });

    socket.on("room:state", (state) => {
      setRoomState(state);
    });

    socket.on("word:hint", (hint) => {
      setWordHint(hint);
    });

    socket.on("word:secret", (secret) => {
      setSecretWord(secret);
    });

    socket.on("word:choices", (choices) => {
      setWordChoices(choices);
    });

    socket.on("turn:ended", () => {
      // Clear choices when turn ends to reset UI for next time
      setWordChoices([]);
      setSecretWord("");
    });

    return () => {
      socket.off("room:state");
      socket.off("word:hint");
      socket.off("word:secret");
      socket.off("word:choices");
      socket.off("turn:ended");
    };
  }, [roomId, guestId, username, avatar, router]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Error</h1>
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

  if (!roomState) {
    return (
      <div className="min-h-screen bg-indigo-500 flex items-center justify-center">
        <p className="text-white text-xl font-bold animate-pulse">Joining Room...</p>
      </div>
    );
  }

  const isHost = roomState.hostId === guestId;

  return (
    <div className="min-h-[100dvh] md:min-h-screen bg-gray-50 flex flex-col p-2 md:p-8">
      <div className="max-w-7xl mx-auto w-full flex flex-col md:grid md:grid-cols-4 gap-2 md:gap-6 flex-grow h-full min-h-[600px] md:min-h-0">
        
        {/* Left Col: Players (Hidden on mobile unless toggled) */}
        <div className={`md:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-200 p-4 h-full flex flex-col ${showMobilePlayers ? 'fixed inset-4 z-50' : 'hidden md:flex'}`}>
          <div className="flex justify-between items-center mb-4 pb-2 border-b">
            <h2 className="text-xl font-bold text-gray-800">Players ({roomState.players.length}/{roomState.settings.maxPlayers})</h2>
            {showMobilePlayers && (
              <button onClick={() => setShowMobilePlayers(false)} className="md:hidden text-gray-500 font-bold p-2">✕</button>
            )}
          </div>
          <div className="space-y-3 overflow-y-auto">
            {roomState.players.map((p: any) => (
              <div key={p.playerId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition">
                <Avatar config={p.avatar} size={48} />
                <div className="flex flex-col">
                  <span className="font-semibold text-gray-800 flex items-center gap-2">
                    {p.username} 
                    {p.playerId === guestId && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">You</span>}
                    {p.isHost && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Host</span>}
                  </span>
                  <span className="text-sm text-gray-500">Score: {p.score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Middle Col: Lobby Settings & Game Area */}
        <div className="md:col-span-2 flex flex-col gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center h-full">
            {roomState.phase === "LOBBY" ? (
              <>
                <h1 className="text-3xl font-black text-indigo-600 mb-2">Room Code: {roomId}</h1>
                <p className="text-gray-500 mb-6">Invite friends to join this room.</p>
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-indigo-800 mb-4">Waiting for players...</h3>
                  
                  {isHost ? (
                    <button 
                      onClick={() => {
                        const socket = getSocket();
                        socket.emit("game:start", { roomId, guestId });
                      }}
                      disabled={roomState.players.length < 2}
                      className={`w-full md:w-auto px-10 py-4 font-bold text-xl rounded-full transition-all ${
                        roomState.players.length >= 2 
                          ? "bg-yellow-400 hover:bg-yellow-300 text-yellow-900 shadow-[0_4px_14px_0_rgba(250,204,21,0.39)]"
                          : "bg-gray-300 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      {roomState.players.length < 2 ? "Need 2 players" : "Start Game"}
                    </button>
                  ) : (
                    <p className="text-indigo-600 font-medium">Waiting for host to start...</p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col flex-grow h-full min-h-0">
                {/* Game Header */}
                <div className="flex justify-between items-center mb-2 md:mb-4 pb-2 border-b shrink-0 px-2 md:px-0">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowMobilePlayers(true)} className="md:hidden text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-bold">
                      👥 {roomState.players.length}
                    </button>
                    <div className="font-bold text-indigo-600 hidden sm:block">Round {roomState.round}/{roomState.settings.rounds}</div>
                  </div>
                  <div className="flex items-center gap-2 md:gap-4">
                    <TimerDisplay endsAt={roomState.timerEndsAt} />
                    <div className="text-lg md:text-2xl font-black tracking-widest">{roomState.currentDrawerId === guestId && secretWord ? secretWord.split('').join(' ') : wordHint}</div>
                  </div>
                  <div className="font-bold text-gray-600 text-sm md:text-base text-right">
                    {roomState.currentDrawerId === guestId ? "You are drawing!" : "Guess the word!"}
                  </div>
                </div>
                
                {/* Canvas Area */}
                <div className="flex-grow min-h-0 relative">
                   {roomState.phase === "TURN_RESULTS" && <TurnResultOverlay />}
                   
                   {roomState.phase === "GAME_RESULTS" && (
                     <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md rounded-2xl p-6">
                        <h2 className="text-4xl font-black text-yellow-400 mb-6">Game Over!</h2>
                        <div className="flex flex-col gap-4 w-full max-w-sm">
                           {roomState.players.sort((a:any, b:any) => b.score - a.score).map((p:any, i:number) => (
                             <div key={p.playerId} className="bg-white p-4 rounded-xl flex items-center justify-between">
                               <div className="flex items-center gap-3">
                                 <span className="font-black text-2xl text-gray-400">#{i + 1}</span>
                                 <Avatar config={p.avatar} size={40} />
                                 <span className="font-bold">{p.username}</span>
                               </div>
                               <span className="font-black text-indigo-600">{p.score} pt</span>
                             </div>
                           ))}
                        </div>
                        {isHost && (
                          <button 
                            onClick={() => {
                              const socket = getSocket();
                              socket.emit("game:start", { roomId, guestId });
                            }}
                            className="mt-8 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-full"
                          >
                            Play Again
                          </button>
                        )}
                     </div>
                   )}
                   {roomState.phase === "WORD_SELECTION" && roomState.currentDrawerId === guestId && (
                     <WordSelectionModal roomId={roomId} guestId={guestId!} choices={wordChoices} onSelected={() => setWordChoices([])} />
                   )}
                   {roomState.phase === "WORD_SELECTION" && roomState.currentDrawerId !== guestId && (
                     <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl">
                       <h2 className="text-2xl font-bold text-white">Drawer is choosing a word...</h2>
                     </div>
                   )}
                   
                   <DrawingCanvas 
                     roomId={roomId}
                     guestId={guestId!}
                     isDrawer={roomState.currentDrawerId === guestId && roomState.phase === "DRAWING"}
                   />
                 </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Chat Panel */}
        <div className="md:col-span-1 h-64 md:h-full shrink-0 md:shrink">
          {roomState.phase !== "LOBBY" && (
            <ChatPanel 
              roomId={roomId} 
              guestId={guestId!} 
              username={username} 
              isDrawer={roomState.currentDrawerId === guestId && (roomState.phase === "DRAWING" || roomState.phase === "WORD_SELECTION")}
            />
          )}
        </div>

      </div>
    </div>
  );
}
