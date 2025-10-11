import express, { json, urlencoded } from 'express';
import apiV1 from '../routes/api/v1/index.js';
import morgan from 'morgan';
import * as ErrorHandler from '../middleware/errorHandler.js';
import cors from 'cors';
import { socketServer } from '../socket-instance.js';
export const app = express();

const corsOptions = {
  origin: [
    'http://localhost:3000',
    "https://front-end-git-main-quls-projects.vercel.app"
    // 'http://192.168.18.85:3000',
    // 'https://patentable-steve-unsuburbed.ngrok-free.dev',
  ],
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.get('/test-notification', (req, res) => {
  try {
    const payload = {
      title: '🔔 Tes Notifikasi',
      message: 'Jika Anda melihat ini, koneksi Socket.IO Anda berhasil!',
      link: '#',
    };
    socketServer.io.emit('new_notification', payload);
    res.status(200).send('Notifikasi tes berhasil dikirim.');
  } catch (error) {
    res.status(500).send('Gagal mengirim notifikasi tes.');
  }
});
app.use(cors(corsOptions));
app.use(json());
app.use(urlencoded({ extended: false }));
app.use(morgan('dev'));

app.set('view engine', 'ejs');

apiV1(app);

app.use(ErrorHandler.handleNotFound);
app.use(ErrorHandler.errorHandler);
