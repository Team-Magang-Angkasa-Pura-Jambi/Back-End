// src/config/sweager.js (atau swagger.js)
export const swaggerBaseConfig = {
  openapi: '3.0.0', // Wajib eksplisit
  info: {
    title: 'Sentinel API',
    version: '2.0.0',
    description: 'API Documentation',
  },
  servers: [
    {
      url: 'http://localhost:8080/api/v2', // Sesuaikan port
      description: 'Local Server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
};
