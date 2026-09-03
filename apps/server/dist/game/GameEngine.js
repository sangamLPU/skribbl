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
    // Round/Turn feedback state
    turnScores = {};
    correctGuessers = [];
    currentReactions = { likes: new Set(), dislikes: new Set() };
    lastReactionTimes = new Map();
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
        this.turnScores = {};
        this.correctGuessers = [];
        this.currentReactions.likes.clear();
        this.currentReactions.dislikes.clear();
        this.lastReactionTimes.clear();
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
        if (this.room.settings.hints === 0)
            return;
        // 1. Identify words and letters
        const wordRegex = /[a-zA-Z0-9]+/g;
        let match;
        const words = [];
        let totalLetters = 0;
        while ((match = wordRegex.exec(this.secretWord)) !== null) {
            const length = match[0].length;
            const indices = [];
            for (let i = 0; i < length; i++) {
                indices.push(match.index + i);
            }
            words.push({ start: match.index, end: match.index + length - 1, length, indices });
            totalLetters += length;
        }
        if (totalLetters === 0)
            return;
        // 2. Determine maxReveals based on rules
        let maxReveals = 1;
        if (totalLetters >= 15)
            maxReveals = 7;
        else if (totalLetters >= 13)
            maxReveals = 6;
        else if (totalLetters >= 11)
            maxReveals = 5;
        else if (totalLetters >= 9)
            maxReveals = 4;
        else if (totalLetters >= 7)
            maxReveals = 3;
        else if (totalLetters >= 5)
            maxReveals = 2;
        maxReveals = Math.min(maxReveals, Math.floor(totalLetters * 0.5));
        if (maxReveals <= 0)
            return;
        // 3. Determine how many hints events we will have
        let hintEvents = maxReveals;
        if (this.room.settings.hints > 0) {
            hintEvents = Math.min(this.room.settings.hints, maxReveals);
        }
        // 4. Distribute the `maxReveals` across the words fairly
        const availableIndicesPerWord = words.map(w => {
            const shuffled = [...w.indices];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            return shuffled;
        });
        const chosenIndices = [];
        let wordIdx = 0;
        while (chosenIndices.length < maxReveals) {
            let madeProgress = false;
            for (let i = 0; i < availableIndicesPerWord.length; i++) {
                const wIdx = (wordIdx + i) % availableIndicesPerWord.length;
                const available = availableIndicesPerWord[wIdx];
                // Ensure at least 1 letter remains hidden in this word
                if (available.length > 1) {
                    chosenIndices.push(available.pop());
                    madeProgress = true;
                    wordIdx = wIdx + 1;
                    break; // move to next letter overall
                }
            }
            if (!madeProgress)
                break;
        }
        // Shuffle the final chosen indices
        for (let i = chosenIndices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [chosenIndices[i], chosenIndices[j]] = [chosenIndices[j], chosenIndices[i]];
        }
        if (chosenIndices.length === 0)
            return;
        hintEvents = Math.min(hintEvents, chosenIndices.length);
        if (hintEvents === 0)
            return;
        // 5. Partition `chosenIndices` into `hintEvents` buckets
        const chunks = Array.from({ length: hintEvents }, () => []);
        for (let i = 0; i < chosenIndices.length; i++) {
            chunks[i % hintEvents].push(chosenIndices[i]);
        }
        // 6. Schedule the hint events
        const interval = (this.room.settings.drawTime * 1000) / (hintEvents + 1);
        for (let i = 0; i < hintEvents; i++) {
            const hTurnId = this.turnId;
            const indicesToReveal = chunks[i];
            const timer = setTimeout(() => {
                if (this.turnId !== hTurnId)
                    return;
                this.revealHint(indicesToReveal);
            }, interval * (i + 1));
            this.hintTimers.push(timer);
        }
    }
    revealHint(indices) {
        if (this.room.phase !== "DRAWING")
            return;
        let changed = false;
        for (const idx of indices) {
            if (this.hiddenPattern[idx] === "_") {
                this.hiddenPattern[idx] = this.secretWord[idx];
                changed = true;
            }
        }
        if (changed) {
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
            this.correctGuessers.push(playerId);
            const guessRank = this.correctGuessers.length;
            // Calculate score based on time remaining
            const timeRemaining = Math.max(0, (this.room.timerEndsAt || 0) - Date.now());
            const maxTime = this.room.settings.drawTime * 1000;
            const remainingTimeRatio = Math.max(0, Math.min(1, timeRemaining / maxTime));
            const baseScore = 300;
            const timeBonus = Math.floor(150 * remainingTimeRatio);
            let placementBonus = 0;
            if (guessRank === 1)
                placementBonus = 50;
            else if (guessRank === 2)
                placementBonus = 30;
            else if (guessRank === 3)
                placementBonus = 15;
            let scoreEarned = baseScore + timeBonus + placementBonus;
            scoreEarned = Math.max(100, Math.min(500, scoreEarned));
            player.score += scoreEarned;
            this.turnScores[playerId] = scoreEarned;
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
        // Assign drawer points
        const drawerId = this.room.currentDrawerId;
        if (drawerId && this.correctGuessers.length > 0) {
            const drawer = this.room.players.find(p => p.playerId === drawerId);
            if (drawer) {
                const drawerScore = Math.min(300, this.correctGuessers.length * 75);
                drawer.score += drawerScore;
                this.turnScores[drawerId] = drawerScore;
            }
        }
        // Build TurnResult payload
        const players = this.room.players.map(p => {
            let guessRank = null;
            if (p.hasGuessedCorrectly) {
                guessRank = this.correctGuessers.indexOf(p.playerId) + 1;
            }
            return {
                playerId: p.playerId,
                username: p.username,
                scoreEarned: this.turnScores[p.playerId] || 0,
                totalScore: p.score,
                guessedCorrectly: p.hasGuessedCorrectly,
                guessRank,
            };
        });
        // Broadcast real word and results to everyone
        this.io.to(this.room.id).emit("turn:ended", {
            turnId: this.turnId,
            drawerId: this.room.currentDrawerId || "",
            wordDisplay: this.secretWord,
            players,
        });
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
    handleReaction(playerId, reaction) {
        if (this.room.phase !== "DRAWING" && this.room.phase !== "TURN_RESULTS")
            return;
        // Drawer cannot react to their own drawing
        if (playerId === this.room.currentDrawerId)
            return;
        // Check if player exists
        if (!this.room.players.some(p => p.playerId === playerId))
            return;
        // Rate limiting: max 1 change per 500ms
        const now = Date.now();
        const lastTime = this.lastReactionTimes.get(playerId) || 0;
        if (now - lastTime < 500)
            return;
        this.lastReactionTimes.set(playerId, now);
        // Remove existing
        this.currentReactions.likes.delete(playerId);
        this.currentReactions.dislikes.delete(playerId);
        if (reaction === "like") {
            this.currentReactions.likes.add(playerId);
        }
        else if (reaction === "dislike") {
            this.currentReactions.dislikes.add(playerId);
        }
        // Broadcast updated totals
        this.io.to(this.room.id).emit("drawing:reactionUpdate", {
            turnId: this.turnId,
            likes: this.currentReactions.likes.size,
            dislikes: this.currentReactions.dislikes.size
        });
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
