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
    'http://192.168.1.9:3000',
    // 'https://patentable-steve-unsuburbed.ngrok-free.dev',
  ],
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(json());
app.use(urlencoded({ extended: false }));
app.use(morgan('dev'));

app.set('view engine', 'ejs');

apiV1(app);

app.use(ErrorHandler.handleNotFound);
app.use(ErrorHandler.errorHandler);

initializeCronJobs();
