import { Room } from "./Room";
import { Server } from "socket.io";
import { GamePhase, WordGenerator, DrawOperation } from "shared";

export class GameEngine {
  private room: Room;
  private io: Server;
  private wordGenerator = new WordGenerator();
  
  // State machine timers
  private stateTimer: NodeJS.Timeout | null = null;
  
  // Game state
  private wordChoices: string[] = [];
  private secretWord: string = "";
  private hiddenPattern: string[] = [];
  private hintTimers: NodeJS.Timeout[] = [];
  private turnOrder: string[] = [];
  private currentTurnIndex: number = 0;
  private turnId: string = "";
  
  // Drawing state
  private drawOperations: DrawOperation[] = [];

  constructor(room: Room, io: Server) {
    this.room = room;
    this.io = io;
  }

  public startGame() {
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

  private transitionTo(phase: GamePhase) {
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
          if (this.turnId !== sTurnId) return;
          this.beginTurn();
        }, 5000);
        break;
      
      case "WORD_SELECTION":
        this.room.timerEndsAt = Date.now() + 15000; // 15 seconds to pick word
        this.wordChoices = this.wordGenerator.getChoices(3);
        
        // Only send choices to drawer
        this.io.to(this.room.currentDrawerId!).emit("word:choices", this.wordChoices);
        
        const wsTurnId = this.turnId;
        this.stateTimer = setTimeout(() => {
          if (this.turnId !== wsTurnId) return;
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
          if (this.turnId !== dTurnId) return;
          this.endTurn();
        }, this.room.settings.drawTime * 1000);
        break;
        
      case "TURN_RESULTS":
        this.room.timerEndsAt = Date.now() + 5000;
        const trTurnId = this.turnId;
        this.stateTimer = setTimeout(() => {
          if (this.turnId !== trTurnId) return;
          this.nextTurn();
        }, 5000);
        break;
        
      case "ROUND_RESULTS":
        this.room.timerEndsAt = Date.now() + 5000;
        const rrTurnId = this.turnId;
        this.stateTimer = setTimeout(() => {
          if (this.turnId !== rrTurnId) return;
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

  private beginTurn() {
    this.drawOperations = []; // Reset drawing history
    this.room.currentDrawerId = this.turnOrder[this.currentTurnIndex];
    this.transitionTo("WORD_SELECTION");
  }

  public selectWord(word: string) {
    if (this.room.phase !== "WORD_SELECTION") return;
    this.secretWord = word;
    this.wordGenerator.markUsed(word);
    this.hiddenPattern = word.split('').map(c => /[a-zA-Z0-9]/.test(c) ? "_" : c);
    this.io.to(this.room.id).emit("word:hint", this.hiddenPattern.join(" "));
    this.io.to(this.room.currentDrawerId!).emit("word:secret", this.secretWord);
    this.transitionTo("DRAWING");
  }

  private scheduleHints() {
    this.clearHintTimers();
    const hintsCount = this.room.settings.hints;
    if (hintsCount <= 0) return;

    // We only hint characters that are currently hidden
    const totalChars = this.secretWord.replace(/[^a-zA-Z0-9]/g, "").length;
    const hintsToShow = Math.min(hintsCount, Math.floor(totalChars * 0.7)); // Max 70% revealed
    
    if (hintsToShow <= 0) return;

    const interval = (this.room.settings.drawTime * 1000) / (hintsToShow + 1);
    
    for (let i = 1; i <= hintsToShow; i++) {
      const hTurnId = this.turnId;
      const timer = setTimeout(() => {
        if (this.turnId !== hTurnId) return;
        this.revealHint();
      }, interval * i);
      this.hintTimers.push(timer);
    }
  }

  private revealHint() {
    if (this.room.phase !== "DRAWING") return;
    
    // Find hidden indices
    const hiddenIndices: number[] = [];
    for (let i = 0; i < this.secretWord.length; i++) {
      if (this.hiddenPattern[i] === "_") hiddenIndices.push(i);
    }
    
    if (hiddenIndices.length > 1) {
      // Pick random
      const randIdx = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
      this.hiddenPattern[randIdx] = this.secretWord[randIdx];
      this.io.to(this.room.id).emit("word:hint", this.hiddenPattern.join(" "));
    }
  }

  private clearHintTimers() {
    this.hintTimers.forEach(t => clearTimeout(t));
    this.hintTimers = [];
  }

  public processGuess(playerId: string, guess: string) {
    if (this.room.phase !== "DRAWING" || playerId === this.room.currentDrawerId) return false;
    
    const player = this.room.players.find(p => p.playerId === playerId);
    if (!player || player.hasGuessedCorrectly) return false;

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
      const allGuessed = this.room.players.every(p => p.playerId === this.room.currentDrawerId || p.hasGuessedCorrectly);
      if (allGuessed) {
        this.endTurn();
      } else {
        this.broadcastState();
      }
      return true;
    }
    return false;
  }

  private endTurn() {
    if (this.room.phase !== "DRAWING") return;
    this.clearHintTimers();
    
    // Broadcast real word to everyone
    this.io.to(this.room.id).emit("turn:ended", { secretWord: this.secretWord });
    this.transitionTo("TURN_RESULTS");
  }

  private nextTurn() {
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
        } else {
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
    } else {
      // Everyone left or disconnected
      this.transitionTo("GAME_RESULTS");
    }
  }

  public addDrawOperation(op: DrawOperation) {
    if (this.room.phase !== "DRAWING") return;
    this.drawOperations.push(op);
  }

  public undoDrawOperation(opId: string) {
    if (this.room.phase !== "DRAWING") return;
    this.drawOperations = this.drawOperations.filter(o => o.id !== opId);
  }

  public clearDrawOperations() {
    if (this.room.phase !== "DRAWING") return;
    this.drawOperations = [];
  }

  public getDrawSnapshot(): DrawOperation[] {
    return this.drawOperations;
  }

  private broadcastState() {
    this.io.to(this.room.id).emit("room:state", this.room.getPublicState());
  }
}
