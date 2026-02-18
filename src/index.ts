import http from 'http';
import 'dotenv/config';
import { app } from './configs/app.js';
import { SocketServer } from './configs/socket.js';
import { configureZod } from './common/utils/zodConfig.js';

const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST_LOCAL_AREA ?? '0.0.0.0';

configureZod();
const server = http.createServer(app);

const socketServer = new SocketServer(server);
socketServer.init();

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${port} is already in use. Please use a different port.`);
  } else {
    console.error('❌ Server startup error:', error.message);
  }
  process.exit(1);
});

server.listen(port, host, () => {
  const displayHost = host === '0.0.0.0' ? 'localhost' : host;
  const baseUrl = `http://${displayHost}:${port}`;

  console.log(`\n🚀 Sentinel API v2 is online!`);
  console.log(`---------------------------------------------`);
  console.log(`➜  Local:   ${baseUrl}`);
  console.log(`➜  API:     ${baseUrl}/api/v2`);
  console.log(`➜  Swagger: ${baseUrl}/api-docs`);
  console.log(`➜  Socket:  ws://${displayHost}:${port}`);
  console.log(`---------------------------------------------\n`);

  try {
    console.log('📅 [Cron] Services initialized.');
  } catch (err: any) {
    console.error('⚠️ [Cron] Failed to start:', err.message);
  }
});
