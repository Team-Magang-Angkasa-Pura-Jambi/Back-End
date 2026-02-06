import http from 'http';
import 'dotenv/config';
import { app } from './configs/app.js';
import { SocketServer } from './configs/socket.js';
import { startDataCheckCron } from './services/corn/dataChecker.js';
import { startPredictionRunnerCron } from './services/corn/predictionRunner.js';

const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST_LOCAL_AREA ?? '0.0.0.0';

const server = http.createServer(app);

// Initialize Socket
const socketServer = new SocketServer(server);
socketServer.init();

// 1. Error Handling yang Lebih Baik (Event Based)
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${port} is already in use.`);
  } else {
    console.error('❌ Server startup error:', error.message);
  }
  process.exit(1);
});

// 2. Start Server
server.listen(port, host, () => {
  const baseUrl = `http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`;

  console.log(`\n🚀 Server is running!`);
  console.log(`---------------------------------------------`);
  console.log(`➜  API:     ${baseUrl}/api/v1`);
  console.log(`---------------------------------------------\n`);

  // 3. Jalankan Cron Jobs setelah server sukses berjalan
  try {
    startDataCheckCron();
    startPredictionRunnerCron();
    console.log('✅ Cron services started successfully.');
  } catch (err: any) {
    console.error('⚠️ Failed to start cron services:', err.message);
  }
});
