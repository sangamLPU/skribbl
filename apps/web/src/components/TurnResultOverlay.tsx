import { TurnResultPayload, ReactionTotals } from "shared";
import { ThumbsUp, ThumbsDown } from "lucide-react";

interface TurnResultOverlayProps {
  turnResult: TurnResultPayload | null;
  reactionTotals?: ReactionTotals | null;
}

export function TurnResultOverlay({ turnResult, reactionTotals }: TurnResultOverlayProps) {
  if (!turnResult) return null;

  const sortedPlayers = [...turnResult.players].sort((a, b) => b.scoreEarned - a.scoreEarned);
  const drawer = turnResult.players.find(p => p.playerId === turnResult.drawerId);
  const guessers = sortedPlayers.filter(p => p.playerId !== turnResult.drawerId);
  const nobodyGuessed = guessers.every(p => !p.guessedCorrectly);

  const getRankMedal = (rank: number | null) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return null;
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl p-4">
      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-2xl text-center transform scale-100 animate-in zoom-in duration-300 w-full max-w-sm">
        <h2 className="text-2xl font-black text-red-500 mb-2 uppercase tracking-wider">Time's Up!</h2>
        
        <p className="text-gray-600 font-bold mb-1">The word was:</p>
        <div className="text-4xl font-black text-green-500 mb-6 uppercase tracking-widest">{turnResult.wordDisplay}</div>
        
        {drawer && (
          <div className="mb-4 bg-indigo-50 border border-indigo-100 p-3 rounded-xl flex items-center justify-between">
            <div className="text-left">
              <span className="block text-xs font-bold text-indigo-400 uppercase">Drawer</span>
              <span className="font-bold text-indigo-900">{drawer.username}</span>
            </div>
            <div className="text-right">
              <span className="block font-black text-indigo-600">+{drawer.scoreEarned}</span>
              <span className="text-xs text-gray-500">Total: {drawer.totalScore}</span>
            </div>
          </div>
        )}

        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider border-b pb-2 mb-3 text-left">Players</h3>
        
        <div className="flex flex-col gap-2 mb-4 max-h-48 overflow-y-auto">
          {nobodyGuessed ? (
             <div className="p-4 text-center text-gray-500 font-bold bg-gray-50 rounded-lg">
               Nobody guessed the word.
             </div>
          ) : (
            guessers.map(p => {
              const medal = getRankMedal(p.guessRank);
              return (
                <div key={p.playerId} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-100">
                  <span className="font-bold text-gray-700 flex items-center gap-2">
                    {medal ? (
                      <span className="text-xl w-6 text-center">{medal}</span>
                    ) : p.guessedCorrectly ? (
                      <span className="text-green-500 font-black w-6 text-center">✓</span>
                    ) : (
                      <span className="text-gray-400 font-black w-6 text-center">—</span>
                    )}
                    <span className="truncate max-w-[100px]">{p.username}</span>
                  </span>
                  <div className="text-right flex flex-col">
                    <span className={`font-black ${p.scoreEarned > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                      +{p.scoreEarned}
                    </span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase leading-none">
                      Total: {p.totalScore}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {reactionTotals && (reactionTotals.likes > 0 || reactionTotals.dislikes > 0) && (
          <div className="pt-3 border-t border-gray-100 flex items-center justify-center gap-6">
            <div className="flex items-center gap-1.5 text-indigo-600 font-bold">
              <ThumbsUp size={16} className="fill-current" />
              <span>{reactionTotals.likes}</span>
            </div>
            <div className="flex items-center gap-1.5 text-red-500 font-bold">
              <ThumbsDown size={16} className="fill-current" />
              <span>{reactionTotals.dislikes}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
