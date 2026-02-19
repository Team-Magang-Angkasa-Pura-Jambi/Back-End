import { getAuditContext } from '../common/utils/context.js';
import { PrismaClient, Prisma } from '../generated/prisma/index.js';

interface SentinelEntity {
  id?: number | string;
  user_id?: number | string;
  location_id?: number | string;
  meter_id?: number | string;
  reading_type_id?: number | string;
}

const basePrisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

const AUDITABLE_MODELS = ['Location', 'User', 'Meter', 'PriceScheme', 'Tenant'];

const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (
          !model ||
          !AUDITABLE_MODELS.includes(model) ||
          !['create', 'update', 'delete', 'upsert'].includes(operation)
        ) {
          return query(args);
        }

        const context = getAuditContext();

        const safeUserId = context.userId && context.userId !== 0 ? Number(context.userId) : 1;
        const safeIp = context.ipAddress || '127.0.0.1';
        const safeAgent = context.userAgent || 'SYSTEM';

        let oldData: SentinelEntity | null = null;
        if (operation === 'update' || operation === 'delete') {
          try {
            const queryArgs = args as { where?: unknown };
            if (queryArgs?.where) {
              const delegate = model.charAt(0).toLowerCase() + model.slice(1);

              const fetched = await (basePrisma as any)[delegate].findUnique({
                where: queryArgs.where,
              });
              oldData = fetched as SentinelEntity | null;
            }
          } catch (e: any) {
            console.warn(`⚠️ [Audit Skip] ${model}: ${e}`);
          }
        }

        const result = await query(args);

        (async () => {
          try {
            const entity = result as unknown as SentinelEntity | null;

            const recordId = String(
              entity?.id ??
                entity?.user_id ??
                entity?.location_id ??
                entity?.meter_id ??
                entity?.reading_type_id ??
                'N/A',
            );

            if (recordId === 'N/A') return;

            const oldJson = oldData ? (oldData as unknown as Prisma.InputJsonValue) : Prisma.DbNull;
            const newJson = result ? (result as unknown as Prisma.InputJsonValue) : Prisma.DbNull;

            await basePrisma.auditLog.create({
              data: {
                action: operation.toUpperCase(),
                entity_table: model,
                entity_id: recordId,
                user_id: safeUserId,

                ip_address: safeIp,
                user_agent: safeAgent,
                old_values: operation === 'create' ? Prisma.DbNull : oldJson,
                new_values: operation === 'delete' ? Prisma.DbNull : newJson,
                reason: null,
              },
            });
          } catch (err: any) {
            console.warn(`⚠️ [Audit Skip] ${model}: ${err.message}`);
          }
        })();

        return result;
      },
    },
  },
});

export default prisma;
