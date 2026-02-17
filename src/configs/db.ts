import pkg from '../generated/prisma/index.js';

const { PrismaClient } = pkg;
const prisma = new PrismaClient({ log: ['query', 'error', 'warn'] });

export default prisma;
