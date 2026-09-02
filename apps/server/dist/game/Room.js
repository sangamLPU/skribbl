"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Room = void 0;
const shared_1 = require("shared");
const GameEngine_1 = require("./GameEngine");
class Room {
    id;
    settings;
    players = [];
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
            this.hostId = this.players[0].playerId;
            this.players[0].isHost = true;
        }
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
