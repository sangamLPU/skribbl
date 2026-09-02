"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const RoomManager_1 = require("./game/RoomManager");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
app.use((0, cors_1.default)({ origin: "*" }));
app.use((0, helmet_1.default)());
app.use(express_1.default.json());
const io = new socket_io_1.Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const roomManager = new RoomManager_1.RoomManager(io);
io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);
    socket.on("room:create", (payload, callback) => {
        const { guestId, settings } = payload || {};
        const hostId = guestId || socket.handshake.auth.guestId || socket.id;
        try {
            const room = roomManager.createRoom(hostId, settings);
            socket.join(room.id);
            socket.data = { roomId: room.id, guestId: hostId };
            if (callback)
                callback({ roomId: room.id });
        }
        catch (e) {
            if (callback)
                callback({ error: e.message });
        }
    });
    socket.on("room:check", (roomId, callback) => {
        const room = roomManager.getRoom(roomId);
        if (!room) {
            if (callback)
                callback({ error: "Room not found" });
            return;
        }
        if (room.players.length >= room.settings.maxPlayers) {
            if (callback)
                callback({ error: "Room is full" });
            return;
        }
        if (room.phase !== "LOBBY") {
            if (callback)
                callback({ error: "Game already in progress" });
            return;
        }
        if (callback)
            callback({ valid: true });
    });
    socket.on("room:join", (payload, callback) => {
        const { roomId, guestId, username, avatar } = payload;
        const playerId = guestId || socket.id;
        const room = roomManager.getRoom(roomId);
        if (!room) {
            if (callback)
                callback({ error: "Room not found" });
            return;
        }
        // Check if player is banned
        const ban = room.bannedPlayers.find(b => b.playerId === playerId);
        if (ban && ban.expiresAt > Date.now()) {
            if (callback)
                callback({ error: "You are banned from this room." });
            return;
        }
        try {
            room.addPlayer(playerId, username, avatar);
            socket.join(roomId);
            socket.join(playerId); // Join a personal room for direct messages
            socket.data = { roomId, guestId: playerId };
            io.to(roomId).emit("room:state", room.getPublicState());
            // If joining during a phase with drawings, send the current snapshot to the new player
            if (room.phase === "DRAWING" || room.phase === "TURN_RESULTS" || room.phase === "WORD_SELECTION") {
                socket.emit("draw:snapshot", room.engine.getDrawSnapshot());
            }
            if (callback)
                callback({ success: true, room: room.getPublicState() });
        }
        catch (e) {
            if (callback)
                callback({ error: e.message });
        }
    });
    socket.on("game:start", (payload, callback) => {
        const { roomId, guestId } = payload;
        const room = roomManager.getRoom(roomId);
        if (!room)
            return callback && callback({ error: "Room not found" });
        if (room.hostId !== guestId)
            return callback && callback({ error: "Only host can start" });
        try {
            room.engine.startGame();
            if (callback)
                callback({ success: true });
        }
        catch (e) {
            if (callback)
                callback({ error: e.message });
        }
    });
    socket.on("word:select", (payload) => {
        const { roomId, guestId, word } = payload;
        const room = roomManager.getRoom(roomId);
        if (!room || room.currentDrawerId !== guestId)
            return;
        room.engine.selectWord(word);
    });
    socket.on("draw:operation", (payload) => {
        const { roomId, guestId, operation } = payload;
        const room = roomManager.getRoom(roomId);
        if (!room || room.currentDrawerId !== guestId)
            return;
        room.engine.addDrawOperation(operation);
        socket.to(roomId).emit("draw:operation", operation);
    });
    socket.on("draw:undo", (payload) => {
        const { roomId, guestId, operationId } = payload;
        const room = roomManager.getRoom(roomId);
        if (!room || room.currentDrawerId !== guestId)
            return;
        room.engine.undoDrawOperation(operationId);
        socket.to(roomId).emit("draw:undo", operationId);
    });
    socket.on("draw:clear", (payload) => {
        const { roomId, guestId } = payload;
        const room = roomManager.getRoom(roomId);
        if (!room || room.currentDrawerId !== guestId)
            return;
        room.engine.clearDrawOperations();
        socket.to(roomId).emit("draw:clear");
    });
    socket.on("chat:send", (payload) => {
        const { roomId, guestId, message } = payload;
        const room = roomManager.getRoom(roomId);
        if (!room)
            return;
        const player = room.players.find(p => p.playerId === guestId);
        if (!player)
            return;
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
    socket.on("room:updateSettings", (payload) => {
        const { roomId, guestId, settings } = payload;
        const room = roomManager.getRoom(roomId);
        if (!room || room.hostId !== guestId || room.phase !== "LOBBY")
            return;
        room.settings = { ...room.settings, ...settings };
        io.to(roomId).emit("room:state", room.getPublicState());
    });
    socket.on("moderation:kick", (payload) => {
        const { roomId, guestId, targetId } = payload;
        const room = roomManager.getRoom(roomId);
        if (!room || room.hostId !== guestId || guestId === targetId)
            return;
        room.removePlayer(targetId);
        io.to(roomId).emit("room:state", room.getPublicState());
        // Find target socket and disconnect it from the room
        const targetSocket = Array.from(io.sockets.sockets.values()).find(s => s.data.guestId === targetId && s.data.roomId === roomId);
        if (targetSocket)
            targetSocket.leave(roomId);
    });
    socket.on("moderation:ban", (payload) => {
        const { roomId, guestId, targetId } = payload;
        const room = roomManager.getRoom(roomId);
        if (!room || room.hostId !== guestId || guestId === targetId)
            return;
        room.banPlayer(targetId);
        io.to(roomId).emit("room:state", room.getPublicState());
        const targetSocket = Array.from(io.sockets.sockets.values()).find(s => s.data.guestId === targetId && s.data.roomId === roomId);
        if (targetSocket)
            targetSocket.leave(roomId);
    });
    socket.on("moderation:transferHost", (payload) => {
        const { roomId, guestId, targetId } = payload;
        const room = roomManager.getRoom(roomId);
        if (!room || room.hostId !== guestId || guestId === targetId)
            return;
        const newHost = room.players.find(p => p.playerId === targetId);
        const oldHost = room.players.find(p => p.playerId === guestId);
        if (newHost && oldHost) {
            room.hostId = targetId;
            newHost.isHost = true;
            oldHost.isHost = false;
            io.to(roomId).emit("room:state", room.getPublicState());
        }
    });
    socket.on("game:cancel", (payload) => {
        const { roomId, guestId } = payload;
        const room = roomManager.getRoom(roomId);
        if (!room || room.hostId !== guestId)
            return;
        room.resetGame();
        io.to(roomId).emit("room:state", room.getPublicState());
    });
    socket.on("game:restart", (payload) => {
        const { roomId, guestId } = payload;
        const room = roomManager.getRoom(roomId);
        if (!room || room.hostId !== guestId || room.phase !== "GAME_RESULTS")
            return;
        room.resetGame();
        room.engine.startGame();
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
