import express, { json, urlencoded } from 'express';
import apiV1 from '../routes/api/v1/index.js';
import morgan from 'morgan';
import * as ErrorHandler from '../middleware/errorHandler.js';

export const app = express();
app.use(json());
app.use(urlencoded({ extended: false }));
app.use(morgan('dev'));

app.set('view engine', 'ejs');

apiV1(app);

app.use(ErrorHandler.handleNotFound);
app.use(ErrorHandler.handleOther);
