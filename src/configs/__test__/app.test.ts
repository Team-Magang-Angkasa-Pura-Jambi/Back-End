import request from 'supertest';
import { app } from '../app.js';
import prisma from '../db.js';

describe('API Endpoint Tests', () => {
  describe('GET Root', () => {
    test('should return a 200 OK status and the correct API status object', async () => {
      const response = await request(app)
        .get('/api/v1')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual({
        status: {
          code: 200,
          message: 'Sentinel API v1 Ready to use (❁´◡`❁) Happy Coding!',
        },
        data: {
          status: 'Online',
          version: '1.0.0',
          serverTime: expect.any(String),
        },
      });
    });
  });

  describe('GET /non-existent-route', () => {
    test('should return a 404 Not Found status for a non-existent route', async () => {
      const response = await request(app)
        .get('/path-yang-pasti-tidak-ada')
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body).toEqual({
        status: {
          code: 404,
          message: 'Resource not found at GET /path-yang-pasti-tidak-ada',
        },
        errors: 'NotFoundError',
      });
    });
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
