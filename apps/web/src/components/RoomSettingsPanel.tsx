import { useState, useEffect } from "react";
import { getSocket } from "@/lib/socket";

interface RoomSettingsPanelProps {
  roomId: string;
  guestId: string;
  isHost: boolean;
  settings: any;
}

export function RoomSettingsPanel({ roomId, guestId, isHost, settings }: RoomSettingsPanelProps) {
  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleChange = (key: string, value: any) => {
    if (!isHost) return;
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    getSocket().emit("room:updateSettings", { roomId, guestId, settings: newSettings });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 w-full">
      <h3 className="font-bold text-gray-800 mb-4 text-left">Room Settings</h3>
      <div className="grid grid-cols-2 gap-4 text-left">
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">Draw Time</label>
          <select 
            disabled={!isHost}
            value={localSettings.drawTime} 
            onChange={(e) => handleChange("drawTime", parseInt(e.target.value))}
            className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2 disabled:opacity-50"
          >
            {[30, 45, 60, 80, 100, 120, 180].map(v => <option key={v} value={v}>{v}s</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">Rounds</label>
          <select 
            disabled={!isHost}
            value={localSettings.rounds} 
            onChange={(e) => handleChange("rounds", parseInt(e.target.value))}
            className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2 disabled:opacity-50"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">Word Choices</label>
          <select 
            disabled={!isHost}
            value={localSettings.wordCount} 
            onChange={(e) => handleChange("wordCount", parseInt(e.target.value))}
            className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2 disabled:opacity-50"
          >
            {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">Max Players</label>
          <select 
            disabled={!isHost}
            value={localSettings.maxPlayers} 
            onChange={(e) => handleChange("maxPlayers", parseInt(e.target.value))}
            className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2 disabled:opacity-50"
          >
            {[2, 4, 6, 8, 10, 12, 16, 20].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="col-span-2 flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-200">
          <label className="text-sm font-bold text-gray-700">Custom Words Only</label>
          <input 
            type="checkbox" 
            disabled={!isHost}
            checked={localSettings.customWordsOnly}
            onChange={(e) => handleChange("customWordsOnly", e.target.checked)}
            className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 disabled:opacity-50"
          />
        </div>
      </div>
    </div>
  );
}
