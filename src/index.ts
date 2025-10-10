import 'dotenv/config';
import { startDataCheckCron } from './services/corn/dataChecker.js';
import { startPredictionRunnerCron } from './services/corn/predictionRunner.js';
import { server, socketServer } from './socket-instance.js';

const port = 8080;
const host = process.env.HOST_LOCAL_AREA || 'localhost';
try {
  server.listen(port, () => {
    console.log(`server is on http://${host}:${port}/api/v1`);
    socketServer.listen(port);
  });
  startDataCheckCron();
  startPredictionRunnerCron(); // BARU: Aktifkan cron job prediksi
} catch (error: any) {
  console.log(error.message);
}
