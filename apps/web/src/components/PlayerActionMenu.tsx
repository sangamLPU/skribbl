import { useState, useRef, useEffect } from "react";
import { MoreVertical, UserMinus, Ban, Crown } from "lucide-react";
import { getSocket } from "@/lib/socket";

interface PlayerActionMenuProps {
  roomId: string;
  guestId: string;
  targetId: string;
}

export function PlayerActionMenu({ roomId, guestId, targetId }: PlayerActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAction = (action: string) => {
    getSocket().emit(`moderation:${action}`, { roomId, guestId, targetId });
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 rounded-full hover:bg-gray-200 transition text-gray-500"
      >
        <MoreVertical size={20} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
          <button 
            onClick={() => handleAction("transferHost")}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2"
          >
            <Crown size={16} /> Make Host
          </button>
          <button 
            onClick={() => handleAction("kick")}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <UserMinus size={16} /> Kick
          </button>
          <button 
            onClick={() => handleAction("ban")}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 font-bold"
          >
            <Ban size={16} /> Ban
          </button>
        </div>
      )}
    </div>
  );
}
