"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { getSocket } from "@/lib/socket";
import { Avatar } from "@/components/Avatar";
import { DrawingCanvas } from "@/components/DrawingCanvas";
import { WordSelectionModal } from "@/components/WordSelectionModal";
import { WordPatternRenderer } from "@/components/WordPatternRenderer";
import { ChatPanel } from "@/components/ChatPanel";
import { TimerDisplay } from "@/components/TimerDisplay";
import { TurnResultOverlay } from "@/components/TurnResultOverlay";
import { RoundResultOverlay } from "@/components/RoundResultOverlay";
import { RoomSettingsPanel } from "@/components/RoomSettingsPanel";
import { PlayerActionMenu } from "@/components/PlayerActionMenu";
import { TurnResultPayload, ReactionTotals } from "shared";
import { ThumbsUp, ThumbsDown } from "lucide-react";

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
  
  // Phase 2 Round/Turn Results
  const [turnResult, setTurnResult] = useState<TurnResultPayload | null>(null);
  const [reactionTotals, setReactionTotals] = useState<ReactionTotals | null>(null);
  const [myReaction, setMyReaction] = useState<"like" | "dislike" | null>(null);

  useEffect(() => {
    if (!guestId || !username) {
      router.push(`/?code=${roomId}`);
      return;
    }

    const socket = getSocket();
    if (!socket.connected) {
      socket.connect();
    }

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
      // Reset reactions if phase goes to word selection
      if (state.phase === "WORD_SELECTION") {
        setReactionTotals(null);
        setMyReaction(null);
        setTurnResult(null);
      }
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

    socket.on("turn:ended", (payload: TurnResultPayload) => {
      setWordChoices([]);
      setSecretWord("");
      setTurnResult(payload);
    });
    
    socket.on("drawing:reactionUpdate", (payload: ReactionTotals) => {
      setReactionTotals(payload);
    });

    socket.on("room:removed", (data: { reason: string }) => {
      setError(`You were ${data.reason} from this room.`);
      socket.disconnect();
    });

    return () => {
      socket.off("room:state");
      socket.off("word:hint");
      socket.off("word:secret");
      socket.off("word:choices");
      socket.off("turn:ended");
      socket.off("drawing:reactionUpdate");
      socket.off("room:removed");
    };
  }, [roomId, guestId, username, avatar, router]);

  const handleCancelMatch = () => {
    if (confirm("Are you sure you want to cancel the match and return to the lobby?")) {
      getSocket().emit("game:cancel", { roomId, guestId });
    }
  };

  const handleRestartMatch = () => {
    getSocket().emit("game:restart", { roomId, guestId });
  };
  
  const handleReact = (type: "like" | "dislike") => {
    const newReaction = myReaction === type ? null : type;
    setMyReaction(newReaction);
    getSocket().emit("drawing:reaction", { roomId, guestId, reaction: newReaction });
  };

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
  const isDrawingOrResults = roomState.phase === "DRAWING" || roomState.phase === "TURN_RESULTS";
  const amIDrawer = roomState.currentDrawerId === guestId;

  return (
    <div className="min-h-[100dvh] md:min-h-screen bg-gray-50 flex flex-col p-2 md:p-8">
      <div className="max-w-7xl mx-auto w-full flex flex-col md:grid md:grid-cols-4 gap-2 md:gap-6 flex-grow h-full min-h-[600px] md:min-h-0">
        
        {/* Left Col: Players (Hidden on mobile unless toggled) */}
        <div className={`md:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-200 p-4 h-full flex flex-col ${showMobilePlayers ? 'fixed inset-4 z-50' : 'hidden md:flex'}`}>
          <div className="flex justify-between items-center mb-4 pb-2 border-b">
            <h2 className="text-xl font-bold text-gray-800">Players ({roomState.players.length}/{roomState.settings.maxPlayers})</h2>
            {showMobilePlayers && (
              <button onClick={() => setShowMobilePlayers(false)} className="md:hidden text-gray-700 font-bold p-2">✕</button>
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
                  <span className="text-sm font-bold text-gray-700">Score: {p.score}</span>
                </div>
                {isHost && p.playerId !== guestId && (
                  <div className="ml-auto">
                    <PlayerActionMenu roomId={roomId} guestId={guestId!} targetId={p.playerId} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Middle Col: Lobby Settings & Game Area */}
        <div className="md:col-span-2 flex flex-col gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center h-full relative">
            {roomState.phase === "LOBBY" ? (
              <>
                <h1 className="text-3xl font-black text-indigo-700 mb-2">Room Code: {roomId}</h1>
                <p className="text-gray-700 font-medium mb-6">Invite friends to join this room.</p>
                <div className="flex flex-col gap-6">
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-indigo-800 mb-4">Ready to Play?</h3>
                    
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
                            : "bg-gray-300 text-gray-600 cursor-not-allowed"
                        }`}
                      >
                        {roomState.players.length < 2 ? "Need 2 players" : "Start Game"}
                      </button>
                    ) : (
                      <p className="text-indigo-800 font-bold">Waiting for host to start...</p>
                    )}
                  </div>
                  <RoomSettingsPanel roomId={roomId} guestId={guestId!} isHost={isHost} settings={roomState.settings} />
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
                    <div className="font-bold text-indigo-600 hidden sm:block flex items-center gap-2">
                      Round {roomState.round}/{roomState.settings.rounds}
                      {isHost && (
                        <button onClick={handleCancelMatch} className="ml-2 text-xs bg-red-100 text-red-600 hover:bg-red-200 px-2 py-1 rounded-md font-bold transition">Cancel Match</button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 md:gap-4 flex-grow justify-center px-4 overflow-hidden">
                    <TimerDisplay endsAt={roomState.timerEndsAt} />
                    <WordPatternRenderer pattern={amIDrawer && secretWord ? secretWord : wordHint} />
                  </div>
                  <div className="font-bold text-indigo-900 text-sm md:text-base text-right">
                    {amIDrawer ? "You are drawing!" : "Guess the word!"}
                  </div>
                </div>
                
                {/* Canvas Area */}
                <div className="flex-grow min-h-0 relative">
                   {roomState.phase === "TURN_RESULTS" && <TurnResultOverlay turnResult={turnResult} reactionTotals={reactionTotals} />}
                   {roomState.phase === "ROUND_RESULTS" && <RoundResultOverlay round={roomState.round} players={roomState.players} />}
                   
                   {roomState.phase === "GAME_RESULTS" && (
                     <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md rounded-2xl p-6">
                        <h2 className="text-4xl font-black text-yellow-400 mb-6">Game Over!</h2>
                        <div className="flex flex-col gap-4 w-full max-w-sm">
                           {roomState.players.sort((a:any, b:any) => b.score - a.score).map((p:any, i:number) => (
                             <div key={p.playerId} className="bg-white p-4 rounded-xl flex items-center justify-between">
                               <div className="flex items-center gap-3">
                                 <span className="font-black text-2xl text-gray-500">#{i + 1}</span>
                                 <Avatar config={p.avatar} size={40} />
                                 <span className="font-bold">{p.username}</span>
                               </div>
                               <span className="font-black text-indigo-600">{p.score} pt</span>
                             </div>
                           ))}
                        </div>
                        {isHost && (
                          <button 
                            onClick={handleRestartMatch}
                            className="mt-8 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-full"
                          >
                            Play Again
                          </button>
                        )}
                     </div>
                   )}
                   {roomState.phase === "WORD_SELECTION" && amIDrawer && (
                     <WordSelectionModal roomId={roomId} guestId={guestId!} choices={wordChoices} onSelected={() => setWordChoices([])} />
                   )}
                   {roomState.phase === "WORD_SELECTION" && !amIDrawer && (
                     <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl">
                       <h2 className="text-2xl font-bold text-white">Drawer is choosing a word...</h2>
                     </div>
                   )}
                   
                   <DrawingCanvas 
                     roomId={roomId}
                     guestId={guestId!}
                     isDrawer={amIDrawer && roomState.phase === "DRAWING"}
                   />

                   {/* Floating Reactions UI */}
                   {roomState.phase === "TURN_RESULTS" && !amIDrawer && (
                     <div className="absolute bottom-4 right-4 z-50 flex items-center gap-2 bg-white/90 backdrop-blur shadow-lg border border-gray-200 rounded-full p-2">
                       <button
                         onClick={() => handleReact("like")}
                         className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-sm transition-colors ${myReaction === "like" ? "bg-indigo-100 text-indigo-700" : "text-gray-600 hover:bg-gray-100"}`}
                       >
                         <ThumbsUp size={18} className={myReaction === "like" ? "fill-current" : ""} />
                         <span>{reactionTotals?.likes || 0}</span>
                       </button>
                       <div className="w-px h-5 bg-gray-300" />
                       <button
                         onClick={() => handleReact("dislike")}
                         className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-sm transition-colors ${myReaction === "dislike" ? "bg-red-100 text-red-600" : "text-gray-600 hover:bg-gray-100"}`}
                       >
                         <ThumbsDown size={18} className={myReaction === "dislike" ? "fill-current" : ""} />
                         <span>{reactionTotals?.dislikes || 0}</span>
                       </button>
                     </div>
                   )}
                   
                   {/* Drawer Reaction View */}
                   {isDrawingOrResults && amIDrawer && (
                     <div className="absolute bottom-4 right-4 z-40 flex items-center gap-4 bg-white/90 backdrop-blur shadow-lg border border-gray-200 rounded-full px-4 py-2 pointer-events-none">
                        <div className="flex items-center gap-1.5 font-bold text-sm text-indigo-700">
                          <ThumbsUp size={18} className="fill-current" />
                          <span>{reactionTotals?.likes || 0}</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-bold text-sm text-red-600">
                          <ThumbsDown size={18} className="fill-current" />
                          <span>{reactionTotals?.dislikes || 0}</span>
                        </div>
                     </div>
                   )}
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
              isDrawer={amIDrawer && (roomState.phase === "DRAWING" || roomState.phase === "WORD_SELECTION")}
            />
          )}
        </div>

      </div>
    </div>
  );
}
