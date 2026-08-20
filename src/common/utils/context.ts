import { AsyncLocalStorage } from 'async_hooks';

interface AuditContext {
  userId: number;
  ipAddress: string;
  userAgent: string;
}

export const contextStorage = new AsyncLocalStorage<AuditContext>();

export const getAuditContext = () => {
  return (
    contextStorage.getStore() ?? {
      userId: 1,
      ipAddress: 'SYSTEM',
      userAgent: 'SYSTEM',
    }
  );
};
