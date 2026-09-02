import { Room } from "./Room";
import { Server } from "socket.io";

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private io: Server;

  constructor(io: Server) {
    this.io = io;
  }
  
  createRoom(hostId: string, settings: any): Room {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const room = new Room(roomId, hostId, settings, this.io);
    this.rooms.set(roomId, room);
    return room;
  }
  
  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }
  
  removeRoom(roomId: string) {
    this.rooms.delete(roomId);
  }
}

