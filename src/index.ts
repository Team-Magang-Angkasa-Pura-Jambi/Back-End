import http from 'http';
import 'dotenv/config';
import { app } from './configs/app.js';
import { SocketServer } from './configs/socket.js';
import { startDataCheckCron } from './services/corn/dataChecker.js';
import { startPredictionRunnerCron } from './services/corn/predictionRunner.js';

const port = process.env.PORT ?? 8080;
const host = process.env.HOST_LOCAL_AREA ?? '0.0.0.0';

const server = http.createServer(app);

const socketServer = new SocketServer(server);
socketServer.init();

try {
  server.listen(Number(port), () => {
    console.log(`🚀 Server is running at http://${host}:${port}/api/v1`);
  });

  startDataCheckCron();
  startPredictionRunnerCron();
} catch (error: any) {
  console.error('❌ Server startup error:', error.message);
}
