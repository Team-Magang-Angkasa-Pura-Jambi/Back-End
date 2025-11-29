import request from 'supertest';
import bcrypt from 'bcrypt';
import prisma from '../../configs/db.js';
import { RoleName } from '../../generated/prisma/index.js';
import { app } from '../../configs/app.js';

describe('Auth Endpoint Tests', () => {
  let testUserId: number;
  let testRoleId: number;
  const testUser = {
    username: 'testuser_auth',
    password: 'password123',
  };

  // Setup: Create a test role and a test user before running the tests
  beforeAll(async () => {
    // 1. Create a role for the user
    const role = await prisma.role.upsert({
      where: { role_name: RoleName.Technician },
      update: {},
      create: { role_name: RoleName.Technician },
    });
    testRoleId = role.role_id;

    // 2. Hash the password
    const hashedPassword = await bcrypt.hash(testUser.password, 10);

    // 3. Create the test user
    const user = await prisma.user.create({
      data: {
        username: testUser.username,
        password_hash: hashedPassword,
        role_id: testRoleId,
        is_active: true,
      },
    });
    testUserId = user.user_id;
  });

  // Teardown: Clean up the test data after all tests are done
  afterAll(async () => {
    // Delete the user and role in reverse order of creation
    await prisma.user.delete({ where: { user_id: testUserId } });
    // Note: Deleting the role might fail if other users are still using it.
    // For a robust test suite, consider a dedicated test database.
    // For this case, we assume it's safe to delete.
    try {
      await prisma.role.delete({ where: { role_id: testRoleId } });
    } catch (e) {
      console.warn(`Could not delete role ${testRoleId}. It might be in use.`);
    }
  });

  describe('POST /api/v1/auth/login', () => {
    test('should return 200 OK and a JWT token for a successful login', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        })
        .expect('Content-Type', /json/)
        .expect(200);

      // Check the response structure
      expect(response.body.status.code).toBe(200);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user.username).toBe(testUser.username);
      expect(response.body.data.user.role).toBe(RoleName.Technician);
      expect(typeof response.body.data.token).toBe('string');
    });

    test('should return 401 Unauthorized for a wrong password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: testUser.username,
          password: 'wrongpassword',
        })
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body.status.code).toBe(401);
      expect(response.body.errors).toBe('Unauthorized');
    });

    test('should return 401 Unauthorized for a non-existent user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'nonexistentuser',
          password: 'anypassword',
        })
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body.status.code).toBe(401);
      // For security, the error message should be the same as for a wrong password
      expect(response.body.errors).toBe('Unauthorized');
    });
  });
});
