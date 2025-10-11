import 'dotenv/config';
import { startDataCheckCron } from './services/corn/dataChecker.js';
import { startPredictionRunnerCron } from './services/corn/predictionRunner.js';
import { server, socketServer } from './socket-instance.js';
const port = process.env.PORT || 8080;
const host = process.env.HOST_LOCAL_AREA || 'localhost';
try {
  server.listen(Number(port), () => {
    console.log(`server is on http://${host}:${port}/api/v1`);
    // Pemanggilan socketServer.listen() ini tidak diperlukan dan bisa dihapus.
  });
  startDataCheckCron();
  startPredictionRunnerCron(); // BARU: Aktifkan cron job prediksi
} catch (error: any) {
  console.log(error.message);
}
