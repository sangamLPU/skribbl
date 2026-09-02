"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameEngine = void 0;
const shared_1 = require("shared");
class GameEngine {
    room;
    io;
    wordGenerator = new shared_1.WordGenerator();
    // State machine timers
    stateTimer = null;
    // Game state
    wordChoices = [];
    secretWord = "";
    hiddenPattern = [];
    hintTimers = [];
    turnOrder = [];
    currentTurnIndex = 0;
    turnId = "";
    // Drawing state
    drawOperations = [];
    constructor(room, io) {
        this.room = room;
        this.io = io;
    }
    startGame() {
        if (this.room.phase !== "LOBBY" && this.room.phase !== "GAME_RESULTS") {
            throw new Error("Game already in progress");
        }
        if (this.room.players.length < 2) {
            throw new Error("Not enough players to start");
        }
        this.room.round = 1;
        this.turnOrder = this.room.players.map(p => p.playerId);
        // Fisher-Yates shuffle for random turn order
        for (let i = this.turnOrder.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.turnOrder[i], this.turnOrder[j]] = [this.turnOrder[j], this.turnOrder[i]];
        }
        this.currentTurnIndex = 0;
        // Reset scores
        this.room.players.forEach(p => { p.score = 0; });
        this.transitionTo("STARTING");
    }
    transitionTo(phase) {
        this.room.phase = phase;
        this.turnId = Math.random().toString(36).substring(2, 10); // Generate unique ID for EVERY phase
        if (this.stateTimer) {
            clearTimeout(this.stateTimer);
            this.stateTimer = null;
        }
        switch (phase) {
            case "STARTING":
                this.room.timerEndsAt = Date.now() + 5000;
                const sTurnId = this.turnId;
                this.stateTimer = setTimeout(() => {
                    if (this.turnId !== sTurnId)
                        return;
                    this.beginTurn();
                }, 5000);
                break;
            case "WORD_SELECTION":
                this.room.timerEndsAt = Date.now() + 15000; // 15 seconds to pick word
                this.wordChoices = this.wordGenerator.getChoices(3);
                // Only send choices to drawer
                this.io.to(this.room.currentDrawerId).emit("word:choices", this.wordChoices);
                const wsTurnId = this.turnId;
                this.stateTimer = setTimeout(() => {
                    if (this.turnId !== wsTurnId)
                        return;
                    // Auto pick if timeout
                    this.selectWord(this.wordChoices[0]);
                }, 15000);
                break;
            case "DRAWING":
                this.room.timerEndsAt = Date.now() + (this.room.settings.drawTime * 1000);
                // Reset player correct guess states
                this.room.players.forEach(p => { p.hasGuessedCorrectly = false; });
                this.scheduleHints();
                const dTurnId = this.turnId;
                this.stateTimer = setTimeout(() => {
                    if (this.turnId !== dTurnId)
                        return;
                    this.endTurn();
                }, this.room.settings.drawTime * 1000);
                break;
            case "TURN_RESULTS":
                this.room.timerEndsAt = Date.now() + 5000;
                const trTurnId = this.turnId;
                this.stateTimer = setTimeout(() => {
                    if (this.turnId !== trTurnId)
                        return;
                    this.nextTurn();
                }, 5000);
                break;
            case "ROUND_RESULTS":
                this.room.timerEndsAt = Date.now() + 5000;
                const rrTurnId = this.turnId;
                this.stateTimer = setTimeout(() => {
                    if (this.turnId !== rrTurnId)
                        return;
                    this.room.round++;
                    this.beginTurn();
                }, 5000);
                break;
            case "GAME_RESULTS":
                this.room.timerEndsAt = null;
                break;
        }
        this.broadcastState();
    }
    beginTurn() {
        this.drawOperations = []; // Reset drawing history
        this.room.currentDrawerId = this.turnOrder[this.currentTurnIndex];
        this.transitionTo("WORD_SELECTION");
    }
    selectWord(word) {
        if (this.room.phase !== "WORD_SELECTION")
            return;
        this.secretWord = word;
        this.wordGenerator.markUsed(word);
        this.hiddenPattern = word.split('').map(c => /[a-zA-Z0-9]/.test(c) ? "_" : c);
        this.io.to(this.room.id).emit("word:hint", this.hiddenPattern.join(" "));
        this.io.to(this.room.currentDrawerId).emit("word:secret", this.secretWord);
        this.transitionTo("DRAWING");
    }
    scheduleHints() {
        this.clearHintTimers();
        const hintsCount = this.room.settings.hints;
        if (hintsCount <= 0)
            return;
        // We only hint characters that are currently hidden
        const totalChars = this.secretWord.replace(/[^a-zA-Z0-9]/g, "").length;
        const hintsToShow = Math.min(hintsCount, Math.floor(totalChars * 0.7)); // Max 70% revealed
        if (hintsToShow <= 0)
            return;
        const interval = (this.room.settings.drawTime * 1000) / (hintsToShow + 1);
        for (let i = 1; i <= hintsToShow; i++) {
            const hTurnId = this.turnId;
            const timer = setTimeout(() => {
                if (this.turnId !== hTurnId)
                    return;
                this.revealHint();
            }, interval * i);
            this.hintTimers.push(timer);
        }
    }
    revealHint() {
        if (this.room.phase !== "DRAWING")
            return;
        // Find hidden indices
        const hiddenIndices = [];
        for (let i = 0; i < this.secretWord.length; i++) {
            if (this.hiddenPattern[i] === "_")
                hiddenIndices.push(i);
        }
        if (hiddenIndices.length > 1) {
            // Pick random
            const randIdx = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
            this.hiddenPattern[randIdx] = this.secretWord[randIdx];
            this.io.to(this.room.id).emit("word:hint", this.hiddenPattern.join(" "));
        }
    }
    clearHintTimers() {
        this.hintTimers.forEach(t => clearTimeout(t));
        this.hintTimers = [];
    }
    processGuess(playerId, guess) {
        if (this.room.phase !== "DRAWING" || playerId === this.room.currentDrawerId)
            return false;
        const player = this.room.players.find(p => p.playerId === playerId);
        if (!player || player.hasGuessedCorrectly)
            return false;
        const normalizedGuess = guess.trim().toLowerCase();
        const normalizedSecret = this.secretWord.toLowerCase();
        if (normalizedGuess === normalizedSecret) {
            player.hasGuessedCorrectly = true;
            // Calculate score based on time remaining
            const timeRemaining = Math.max(0, (this.room.timerEndsAt || 0) - Date.now());
            const maxTime = this.room.settings.drawTime * 1000;
            const score = Math.floor(100 + (400 * (timeRemaining / maxTime)));
            player.score += score;
            // Check if everyone guessed correctly
            this.checkAllGuessed();
            return true;
        }
        return false;
    }
    checkAllGuessed() {
        if (this.room.phase !== "DRAWING")
            return;
        // Check if every active player (who isn't the drawer) has guessed correctly
        const allGuessed = this.room.players.every(p => p.playerId === this.room.currentDrawerId || p.hasGuessedCorrectly || p.isDisconnected);
        // Only end early if there is at least one active guesser
        const activeGuessers = this.room.players.filter(p => p.playerId !== this.room.currentDrawerId && !p.isDisconnected);
        if (allGuessed && activeGuessers.length > 0) {
            this.endTurn();
        }
        else {
            this.broadcastState();
        }
    }
    handlePlayerRemoved(playerId) {
        // If the active drawer is kicked, immediately end their turn
        if (this.room.currentDrawerId === playerId && (this.room.phase === "WORD_SELECTION" || this.room.phase === "DRAWING")) {
            // Fast forward to turn results
            this.endTurn();
            return;
        }
        // If a guesser is kicked during drawing, we might need to end the turn early
        if (this.room.phase === "DRAWING") {
            this.checkAllGuessed();
        }
    }
    endTurn() {
        if (this.room.phase !== "DRAWING" && this.room.phase !== "WORD_SELECTION")
            return;
        this.clearHintTimers();
        // Broadcast real word to everyone
        this.io.to(this.room.id).emit("turn:ended", { secretWord: this.secretWord });
        this.transitionTo("TURN_RESULTS");
    }
    nextTurn() {
        // Find the next active player
        let foundNext = false;
        let attempts = 0;
        while (!foundNext && attempts < this.turnOrder.length) {
            this.currentTurnIndex++;
            attempts++;
            if (this.currentTurnIndex >= this.turnOrder.length) {
                this.currentTurnIndex = 0;
                // Loop back to start means next round!
                if (this.room.round >= this.room.settings.rounds) {
                    this.transitionTo("GAME_RESULTS");
                    return;
                }
                else {
                    this.transitionTo("ROUND_RESULTS");
                    return;
                }
            }
            const nextPlayerId = this.turnOrder[this.currentTurnIndex];
            const player = this.room.players.find(p => p.playerId === nextPlayerId);
            if (player && !player.isDisconnected) {
                foundNext = true;
            }
        }
        if (foundNext) {
            this.beginTurn();
        }
        else {
            // Everyone left or disconnected
            this.transitionTo("GAME_RESULTS");
        }
    }
    addDrawOperation(op) {
        if (this.room.phase !== "DRAWING")
            return;
        this.drawOperations.push(op);
    }
    undoDrawOperation(opId) {
        if (this.room.phase !== "DRAWING")
            return;
        this.drawOperations = this.drawOperations.filter(o => o.id !== opId);
    }
    clearDrawOperations() {
        if (this.room.phase !== "DRAWING")
            return;
        this.drawOperations = [];
    }
    getDrawSnapshot() {
        return this.drawOperations;
    }
    cleanup() {
        if (this.stateTimer) {
            clearTimeout(this.stateTimer);
            this.stateTimer = null;
        }
        this.clearHintTimers();
    }
    broadcastState() {
        this.io.to(this.room.id).emit("room:state", this.room.getPublicState());
    }
}
exports.GameEngine = GameEngine;
