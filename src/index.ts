// src/server.ts
import http from 'http';
import 'dotenv/config';

import { app } from './configs/app.js';
import { SocketServer } from './configs/socket.js';
import { startDataCheckCron } from './services/corn/dataChecker.js';
import { startPredictionRunnerCron } from './services/corn/predictionRunner.js';

const port = process.env.PORT || 8080;
const host = process.env.HOST_LOCAL_AREA || 'localhost';

// 1️⃣ Buat HTTP server dari Express
const server = http.createServer(app);

// 2️⃣ Inisialisasi Socket.IO
const socketServer = new SocketServer(server);
socketServer.init(); // Panggil method init setelah instance dibuat

// 3️⃣ Jalankan server HTTP
try {
  server.listen(Number(port), () => {
    console.log(`🚀 Server is running at http://${host}:${port}/api/v1`);
  });

  // 4️⃣ Jalankan cron job
  startDataCheckCron();
  startPredictionRunnerCron();
} catch (error: any) {
  console.error('❌ Server startup error:', error.message);
}
