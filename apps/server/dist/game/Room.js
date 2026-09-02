"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Room = void 0;
const shared_1 = require("shared");
const GameEngine_1 = require("./GameEngine");
class Room {
    id;
    settings;
    players = [];
    bannedPlayers = [];
    phase = "LOBBY";
    hostId;
    round = 0;
    currentDrawerId = null;
    timerEndsAt = null;
    engine;
    constructor(id, hostId, settings = {}, io) {
        this.id = id;
        this.hostId = hostId;
        this.settings = { ...shared_1.DEFAULT_ROOM_SETTINGS, ...settings };
        this.engine = new GameEngine_1.GameEngine(this, io);
    }
    addPlayer(playerId, username, avatar) {
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
    removePlayer(playerId) {
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
    banPlayer(playerId, durationMinutes = 60) {
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
    markPlayerDisconnected(playerId) {
        const player = this.players.find(p => p.playerId === playerId);
        if (player) {
            player.isDisconnected = true;
        }
    }
    handleDisconnect(playerId) {
        if (this.phase === "LOBBY") {
            this.removePlayer(playerId);
        }
        else {
            this.markPlayerDisconnected(playerId);
        }
    }
    getPublicState() {
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
exports.Room = Room;
