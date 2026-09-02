"use client";

import { useEffect, useState, useRef } from "react";
import { getSocket } from "@/lib/socket";
import { ChatMessage } from "shared";
import { SendHorizontal } from "lucide-react";

interface ChatPanelProps {
  roomId: string;
  guestId: string;
  username: string;
  isDrawer: boolean;
}

export function ChatPanel({ roomId, guestId, username, isDrawer }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = getSocket();
    
    socket.on("chat:message", (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
    });

    return () => {
      socket.off("chat:message");
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const socket = getSocket();
    socket.emit("chat:send", { roomId, guestId, message: input });
    setInput("");
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 border-b px-4 py-3">
        <h3 className="font-bold text-gray-800">Chat</h3>
      </div>
      
      <div className="flex-grow p-4 overflow-y-auto flex flex-col gap-2">
        {messages.map((msg, i) => (
          <div key={i} className={`text-sm ${msg.type === 'system' ? 'text-gray-500 italic' : msg.type === 'correct' ? 'text-green-600 font-bold bg-green-50 p-2 rounded-lg' : msg.type === 'close' ? 'text-yellow-600 font-bold' : 'text-gray-800'}`}>
            {msg.type === 'player' && <span className="font-bold mr-2">{msg.senderName}:</span>}
            {msg.message}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="p-3 border-t bg-gray-50 flex gap-2">
        <input 
          type="text" 
          placeholder={isDrawer ? "You cannot guess while drawing" : "Type your guess here..."} 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={100}
          disabled={isDrawer}
          className={`flex-grow px-4 py-2 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isDrawer ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
        />
        <button 
          type="submit"
          disabled={isDrawer}
          className={`p-2 text-white rounded-full transition ${isDrawer ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
        >
          <SendHorizontal size={20} />
        </button>
      </form>
    </div>
  );
}
