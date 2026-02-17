import { pinoHttp } from 'pino-http';

export const logger = pinoHttp({
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            // Menyembunyikan field yang kurang penting di console
            ignore: 'pid,hostname,req,res',
            // Format waktu yang lebih manusiawi (HH:MM:ss)
            translateTime: 'SYS:standard',
            // Membuat tampilan log menjadi satu baris yang ringkas
            singleLine: true,
            // Custom format pesan (Method, URL, Status, Response Time)
            messageFormat: '{req.method} {req.url} - {res.statusCode} ({responseTime}ms)',
          },
        }
      : undefined,
});
