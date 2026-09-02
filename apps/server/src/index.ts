import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import { RoomManager } from "./game/RoomManager";

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: "*" }));
app.use(helmet());
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const roomManager = new RoomManager(io);

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  socket.on("room:create", (payload, callback) => {
    const { guestId, settings } = payload || {};
    const hostId = guestId || socket.handshake.auth.guestId || socket.id;
    
    try {
      const room = roomManager.createRoom(hostId, settings);
      socket.join(room.id);
      socket.data = { roomId: room.id, guestId: hostId };
      if (callback) callback({ roomId: room.id });
    } catch (e: any) {
      if (callback) callback({ error: e.message });
    }
  });

  socket.on("room:check", (roomId, callback) => {
    const room = roomManager.getRoom(roomId);
    if (!room) {
      if (callback) callback({ error: "Room not found" });
      return;
    }
    if (room.players.length >= room.settings.maxPlayers) {
      if (callback) callback({ error: "Room is full" });
      return;
    }
    if (room.phase !== "LOBBY") {
      if (callback) callback({ error: "Game already in progress" });
      return;
    }
    if (callback) callback({ valid: true });
  });

  socket.on("room:join", (payload, callback) => {
    const { roomId, guestId, username, avatar } = payload;
    const playerId = guestId || socket.id;
    const room = roomManager.getRoom(roomId);
    
    if (!room) {
      if (callback) callback({ error: "Room not found" });
      return;
    }
    
    try {
      room.addPlayer(playerId, username, avatar);
      socket.join(roomId);
      socket.join(playerId); // Join a personal room for direct messages
      socket.data = { roomId, guestId: playerId };
      
      io.to(roomId).emit("room:state", room.getPublicState());
      
      if (callback) callback({ success: true, room: room.getPublicState() });
    } catch (e: any) {
      if (callback) callback({ error: e.message });
    }
  });

  socket.on("game:start", (payload, callback) => {
    const { roomId, guestId } = payload;
    const room = roomManager.getRoom(roomId);
    if (!room) return callback && callback({ error: "Room not found" });
    if (room.hostId !== guestId) return callback && callback({ error: "Only host can start" });
    
    try {
      room.engine.startGame();
      if (callback) callback({ success: true });
    } catch (e: any) {
      if (callback) callback({ error: e.message });
    }
  });

  socket.on("word:select", (payload) => {
    const { roomId, guestId, word } = payload;
    const room = roomManager.getRoom(roomId);
    if (!room || room.currentDrawerId !== guestId) return;
    room.engine.selectWord(word);
  });

  socket.on("draw:operation", (payload) => {
    const { roomId, guestId, operation } = payload;
    const room = roomManager.getRoom(roomId);
    if (!room || room.currentDrawerId !== guestId) return;
    
    // In a real robust implementation, the server would keep track of the drawing history here.
    // For this implementation, we rely on the drawer's client state as the master history.
    socket.to(roomId).emit("draw:operation", operation);
  });

  socket.on("draw:undo", (payload) => {
    const { roomId, guestId, operationId } = payload;
    const room = roomManager.getRoom(roomId);
    if (!room || room.currentDrawerId !== guestId) return;
    socket.to(roomId).emit("draw:undo", operationId);
  });

  socket.on("draw:clear", (payload) => {
    const { roomId, guestId } = payload;
    const room = roomManager.getRoom(roomId);
    if (!room || room.currentDrawerId !== guestId) return;
    socket.to(roomId).emit("draw:clear");
  });

  socket.on("chat:send", (payload) => {
    const { roomId, guestId, message } = payload;
    const room = roomManager.getRoom(roomId);
    if (!room) return;
    
    const player = room.players.find(p => p.playerId === guestId);
    if (!player) return;

    // Reject all chat messages from the active drawer during WORD_SELECTION and DRAWING
    if ((room.phase === "DRAWING" || room.phase === "WORD_SELECTION") && room.currentDrawerId === guestId) {
      return; 
    }

    // Check if it's a correct guess
    if (room.phase === "DRAWING" && room.currentDrawerId !== guestId) {
      const isCorrect = room.engine.processGuess(guestId, message);
      
      if (isCorrect) {
        io.to(roomId).emit("chat:message", {
          id: Math.random().toString(),
          message: `${player.username} guessed the word!`,
          type: "correct"
        });
        return; // Don't broadcast the actual word
      }
    }

    // Normal chat broadcast
    io.to(roomId).emit("chat:message", {
      id: Math.random().toString(),
      senderId: guestId,
      senderName: player.username,
      message,
      type: "player"
    });
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    const { roomId, guestId } = socket.data;
    if (roomId && guestId) {
      const room = roomManager.getRoom(roomId);
      if (room) {
        room.handleDisconnect(guestId);
        io.to(roomId).emit("room:state", room.getPublicState());
      }
    }
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
