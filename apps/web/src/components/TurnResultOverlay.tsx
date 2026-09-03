import { TurnResultPayload } from "shared";

interface TurnResultOverlayProps {
  turnResult: TurnResultPayload | null;
}

export function TurnResultOverlay({ turnResult }: TurnResultOverlayProps) {
  if (!turnResult) return null;

  const sortedPlayers = [...turnResult.players].sort((a, b) => b.scoreEarned - a.scoreEarned);
  const drawer = turnResult.players.find(p => p.playerId === turnResult.drawerId);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl p-4">
      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-2xl text-center transform scale-100 animate-in zoom-in duration-300 w-full max-w-sm">
        <h2 className="text-2xl font-black text-red-500 mb-2 uppercase tracking-wider">Time's Up!</h2>
        
        <p className="text-gray-600 font-bold mb-1">The word was:</p>
        <div className="text-4xl font-black text-green-500 mb-6 uppercase tracking-widest">{turnResult.wordDisplay}</div>
        
        <h3 className="text-lg font-bold text-gray-800 border-b pb-2 mb-4">Points this turn</h3>
        
        <div className="flex flex-col gap-2 mb-6 max-h-48 overflow-y-auto">
          {sortedPlayers.filter(p => p.playerId !== turnResult.drawerId).map(p => (
            <div key={p.playerId} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
              <span className="font-bold text-gray-700 flex items-center gap-2">
                {p.guessedCorrectly ? (
                  <span className="text-green-500 font-black">✓</span>
                ) : (
                  <span className="text-gray-400 font-black">—</span>
                )}
                {p.username}
              </span>
              <span className={`font-black ${p.scoreEarned > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                +{p.scoreEarned}
              </span>
            </div>
          ))}
        </div>

        {drawer && (
          <div className="mt-4 pt-4 border-t border-gray-100 text-sm font-bold text-gray-600">
            {drawer.username} was drawing (+{drawer.scoreEarned})
          </div>
        )}
      </div>
    </div>
  );
}
