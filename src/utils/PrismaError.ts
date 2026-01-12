import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

export function isPrismaError(
  error: unknown,
  code: string,
): error is PrismaClientKnownRequestError {
  return error instanceof PrismaClientKnownRequestError && error.code === code;
}
