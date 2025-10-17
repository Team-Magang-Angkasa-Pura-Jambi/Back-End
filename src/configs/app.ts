
import express, { json, urlencoded } from 'express';
import apiV1 from '../routes/api/v1/index.js';
import morgan from 'morgan';
import * as ErrorHandler from '../middleware/errorHandler.js';
import cors from 'cors';
import { initializeCronJobs } from '../scheduler.js';

export const app = express();

const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://sentinel-angkasa-pura.vercel.app',
    // 'http://192.168.18.85:3000',
    // 'https://patentable-steve-unsuburbed.ngrok-free.dev',
  ],
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// app.get('/test-notification', (req, res) => {
//   try {
//     const payload = {
//       title: '🔔 Sebuah Pemikiran Absurd',
//       // --- JOKE DIMASUKKAN DI SINI ---
//       message:
//         'Bunglon itu katanya hebat bisa nyamar. Menurut saya kurang canggih. Kenapa dia nggak sekalian berubah jadi tukang fotokopi? Kan lebih berguna. Nempel di ijazah, "krek", temennya nempel, "krek". Lebih membantu ekosistem pertemanan.',
//       link: '#',
//     };
//     socketServer.io.emit('new_notification', payload);
//     res.status(200).send('Notifikasi tes berhasil dikirim.');
//   } catch (error) {
//     res.status(500).send('Gagal mengirim notifikasi tes.');
//   }
// });
app.use(cors(corsOptions));
app.use(json());
app.use(urlencoded({ extended: false }));
app.use(morgan('dev'));

app.set('view engine', 'ejs');

apiV1(app);

app.use(ErrorHandler.handleNotFound);
app.use(ErrorHandler.errorHandler);

// Memulai semua cron job yang terdaftar
initializeCronJobs();
