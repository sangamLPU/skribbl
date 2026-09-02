import { RoomSettings, PublicRoomState, PlayerState, GamePhase, DEFAULT_ROOM_SETTINGS } from "shared";
import { Server } from "socket.io";
import { GameEngine } from "./GameEngine";

export class Room {
  public id: string;
  public settings: RoomSettings;
  public players: PlayerState[] = [];
  public phase: GamePhase = "LOBBY";
  public hostId: string;
  public round: number = 0;
  public currentDrawerId: string | null = null;
  public timerEndsAt: number | null = null;
  public engine: GameEngine;
  
  constructor(id: string, hostId: string, settings: Partial<RoomSettings> = {}, io: Server) {
    this.id = id;
    this.hostId = hostId;
    this.settings = { ...DEFAULT_ROOM_SETTINGS, ...settings };
    this.engine = new GameEngine(this, io);
  }
  
  addPlayer(playerId: string, username: string, avatar: any) {
    if (this.players.length >= this.settings.maxPlayers) {
      throw new Error("Room is full");
    }

    if (this.phase !== "LOBBY") {
      throw new Error("Game is already in progress");
    }
    
    // Check if player already exists (reconnect)
    const existingPlayer = this.players.find(p => p.playerId === playerId);
    if (existingPlayer) {
      existingPlayer.isDisconnected = false;
      return;
    }

    this.players.push({
      playerId,
      username,
      avatar,
      score: 0,
      isHost: this.hostId === playerId,
      hasGuessedCorrectly: false,
      isDisconnected: false
    });
  }
  
  removePlayer(playerId: string) {
    this.players = this.players.filter(p => p.playerId !== playerId);
    
    // Host migration
    if (this.hostId === playerId && this.players.length > 0) {
      this.hostId = this.players[0].playerId;
      this.players[0].isHost = true;
    }
  }

  markPlayerDisconnected(playerId: string) {
    const player = this.players.find(p => p.playerId === playerId);
    if (player) {
      player.isDisconnected = true;
    }
  }

  handleDisconnect(playerId: string) {
    if (this.phase === "LOBBY") {
      this.removePlayer(playerId);
    } else {
      this.markPlayerDisconnected(playerId);
    }
  }

  getPublicState(): PublicRoomState {
    return {
      roomId: this.id,
      hostId: this.hostId,
      settings: this.settings,
      players: this.players,
      phase: this.phase,
      round: this.round,
      currentDrawerId: this.currentDrawerId,
      timerEndsAt: this.timerEndsAt
    };
  }
}
