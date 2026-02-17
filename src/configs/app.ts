import express, { json, urlencoded } from 'express';
import cors from 'cors';

import * as ErrorHandler from '../middleware/errorHandler.js';
import { logger } from './express.js';
import { corsOptions } from './cors.js';
import apiV2 from '../routes/api/v2/index.js';

export const app = express();

app.use(cors(corsOptions));
app.use(logger);
app.use(json());
app.use(urlencoded({ extended: false }));
app.set('view engine', 'ejs');

apiV2(app);

app.use(ErrorHandler.handleNotFound);
app.use(ErrorHandler.errorHandler);
