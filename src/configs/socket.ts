import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  NotificationPayload,
  MissingDataPayload,
  ServerToClientEvents,
} from '../types/socket.types.js';

export class SocketServer {
  public io: Server<ClientToServerEvents, ServerToClientEvents>;

  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        // Ganti "http://localhost:3000" dengan alamat frontend Anda
        origin: [
          'http://localhost:3000',
          'https://sentinel-angkasa-pura.vercel.app',
        ],
        methods: ['GET', 'POST'],
      },
    });

    this.io.on('connection', this.handleConnection);
  }

  public sendDataReminder(userId: string, payload: MissingDataPayload) {
    console.log(`
      🔔 Mengirim pengingat ke user: ${userId}
      🔹 Tipe Meteran: ${payload.meterType}
      🔹 Pesan: ${payload.message}
    `);

    // Kirim event 'data_reminder' ke room user yang spesifik
    this.io.to(userId).emit('data_reminder', payload);
  }
  // Menggunakan arrow function untuk memastikan `this` merujuk ke instance class

  private handleConnection = (
    socket: Socket<ClientToServerEvents, ServerToClientEvents>
  ) => {
    console.log(`🔌 New client connected: ${socket.id}`);
    socket.on('join_room', (userId: string) => {
      socket.join(userId); // Memasukkan koneksi ini ke dalam room sesuai userId
      console.log(`🚪 Client ${socket.id} bergabung ke room: ${userId}`);
    });
    // Mengirim info ke client yang baru terhubung
    socket.emit('server_info', { version: '1.0.0' });

    // Mendaftarkan semua event listener untuk socket ini
    this.registerSocketEvents(socket);

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  };

  private registerSocketEvents(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>
  ) {
    socket.on('send_message', (payload) => {
      console.log(
        `📩 Received message from ${payload.author}: ${payload.text}`
      );

      // Mengirimkan kembali pesan ke SEMUA client yang terhubung
      this.io.emit('new_message', payload);
    });
  }

  public listen(port: number) {
    console.log(`✅ Socket.IO server is ready.`);
  }
}
