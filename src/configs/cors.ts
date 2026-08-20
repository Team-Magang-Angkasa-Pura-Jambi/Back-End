export const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://sentinel-angkasa-pura.vercel.app',
    'http://192.168.1.9:3000',
  ],
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
