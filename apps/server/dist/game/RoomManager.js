"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomManager = void 0;
const Room_1 = require("./Room");
class RoomManager {
    rooms = new Map();
    io;
    constructor(io) {
        this.io = io;
    }
    createRoom(hostId, settings) {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const room = new Room_1.Room(roomId, hostId, settings, this.io);
        this.rooms.set(roomId, room);
        return room;
    }
    getRoom(roomId) {
        return this.rooms.get(roomId);
    }
    removeRoom(roomId) {
        this.rooms.delete(roomId);
    }
}
exports.RoomManager = RoomManager;
