import pkg from "../generated/prisma/default.js";

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

export default prisma;
