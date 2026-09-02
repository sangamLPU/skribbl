import { RoomSettings, PublicRoomState, PlayerState, GamePhase, RoomBan, DEFAULT_ROOM_SETTINGS } from "shared";
import { Server } from "socket.io";
import { GameEngine } from "./GameEngine";

export class Room {
  public id: string;
  public settings: RoomSettings;
  public players: PlayerState[] = [];
  public bannedPlayers: RoomBan[] = [];
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
      // Find oldest active player
      const activePlayer = this.players.find(p => !p.isDisconnected) || this.players[0];
      this.hostId = activePlayer.playerId;
      activePlayer.isHost = true;
    }
    
    // Inform game engine to handle active turn consequences
    this.engine.handlePlayerRemoved(playerId);
  }

  banPlayer(playerId: string, durationMinutes: number = 60) {
    this.removePlayer(playerId);
    this.bannedPlayers.push({
      playerId,
      expiresAt: Date.now() + durationMinutes * 60 * 1000
    });
  }

  resetGame() {
    this.engine.cleanup();
    this.phase = "LOBBY";
    this.round = 0;
    this.currentDrawerId = null;
    this.timerEndsAt = null;
    this.engine.clearDrawOperations();
    this.players.forEach(p => {
      p.score = 0;
      p.hasGuessedCorrectly = false;
    });
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
