export interface RoomSettings {
  maxPlayers: number;
  rounds: number;
  drawTime: number;
  wordCount: number;
  hints: number;
  language: string;
  customWordsOnly: boolean;
}

export interface RoomBan {
  playerId: string;
  expiresAt: number;
}

export type GamePhase = 
  | "LOBBY"
  | "STARTING"
  | "WORD_SELECTION"
  | "DRAWING"
  | "TURN_RESULTS"
  | "ROUND_RESULTS"
  | "GAME_RESULTS"
  | "ENDED";

export interface PublicRoomState {
  roomId: string;
  hostId: string;
  settings: RoomSettings;
  players: PlayerState[];
  phase: GamePhase;
  round: number;
  currentDrawerId: string | null;
  timerEndsAt: number | null;
}

export interface PlayerState {
  playerId: string;
  username: string;
  avatar: any;
  score: number;
  isHost: boolean;
  hasGuessedCorrectly: boolean;
  isDisconnected: boolean;
}

export type Point = { x: number; y: number };

export type DrawingTool = "brush" | "eraser" | "line" | "rect" | "circle" | "fill";

export type DrawOperation = 
  | { type: "stroke"; id: string; points: Point[]; color: string; width: number; tool: "brush" | "eraser" }
  | { type: "shape"; id: string; shape: "line" | "rect" | "circle"; start: Point; end: Point; color: string; width: number; fill: boolean }
  | { type: "fill"; id: string; point: Point; color: string }
  | { type: "clear"; id: string };

export interface ChatPayload {
  message: string;
}

export interface ChatMessage {
  id: string;
  senderId?: string;
  senderName?: string;
  message: string;
  type: "player" | "system" | "correct" | "close" | "join" | "leave";
}
