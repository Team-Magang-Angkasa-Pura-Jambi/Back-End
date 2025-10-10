// src/socket-instance.ts
import http from 'http';
import { app } from './configs/app.js';
import { SocketServer } from './configs/socket.js';

export const server = http.createServer(app);
export const socketServer = new SocketServer(server);
