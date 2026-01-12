// src/configs/socket.ts
import { type Server as HttpServer } from 'http';
import { Server, type Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  MissingDataPayload,
  ServerToClientEvents,
} from '../types/socket.types.js';

export class SocketServer {
  public static instance: SocketServer;
  public io: Server<ClientToServerEvents, ServerToClientEvents>;

  constructor(httpServer: HttpServer) {
    // Singleton pattern: ensure only one instance is created
    SocketServer.instance = this;
    this.io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
      cors: {
        origin: ['http://localhost:3000', 'https://sentinel-angkasa-pura.vercel.app'],
        methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      },
    });
  }

  /**
   * Inisialisasi koneksi dan event listener socket
   */
  public init() {
    this.io.on('connection', (socket) => this.handleConnection(socket));
    console.log('✅ Socket.IO server initialized and listening for connections.');
  }

  /**
   * Mengirim notifikasi atau pengingat ke user tertentu
   */
  public sendDataReminder(userId: string, payload: MissingDataPayload) {
    console.log(`
      🔔 Mengirim pengingat ke user: ${userId}
      🔹 Tipe Meteran: ${payload.meterType}
      🔹 Pesan: ${payload.message}
    `);
    this.io.to(userId).emit('data_reminder', payload);
  }

  /**
   * Menangani koneksi client baru
   */
  private handleConnection(socket: Socket<ClientToServerEvents, ServerToClientEvents>) {
    console.log(`🔌 New client connected: ${socket.id}`);

    socket.on('join_room', (userId: string) => {
      socket.join(userId);
      console.log(`🚪 Client ${socket.id} bergabung ke room: ${userId}`);
    });

    socket.emit('server_info', { version: '1.0.0' });

    this.registerSocketEvents(socket);

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  }

  /**
   * Registrasi event custom dari client
   */
  private registerSocketEvents(socket: Socket<ClientToServerEvents, ServerToClientEvents>) {
    socket.on('send_message', (payload) => {
      console.log(`📩 Received message from ${payload.author}: ${payload.text}`);
      this.io.emit('new_message', payload);
    });
  }
}
