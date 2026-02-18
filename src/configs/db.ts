import { getAuditContext } from '../common/utils/context.js';
import { PrismaClient, Prisma } from '../generated/prisma/index.js'; // Sesuaikan path

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

const AUDITABLE_MODELS = ['Location', 'User', 'Meter', 'PriceScheme', 'Tenant']; // Tambah Tenant jika perlu

const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        // 1. Filter Model & Operasi
        if (
          !model ||
          !AUDITABLE_MODELS.includes(model) ||
          !['create', 'update', 'delete', 'upsert'].includes(operation)
        ) {
          return query(args);
        }

        // 2. Ambil Context
        const context = getAuditContext();

        // 3. SAFETY NET: Paksa jadi angka. Jika gagal/kosong, paksa ke ID 1.
        const safeUserId = context.userId && context.userId !== 0 ? Number(context.userId) : 1;
        const safeIp = context.ipAddress || '127.0.0.1';
        const safeAgent = context.userAgent || 'SYSTEM';

        // 4. Ambil Data Lama (Old Data) untuk Update/Delete
        let oldData: SentinelEntity | null = null;
        if (operation === 'update' || operation === 'delete') {
          try {
            const queryArgs = args as { where?: unknown };
            if (queryArgs?.where) {
              const delegate = model.charAt(0).toLowerCase() + model.slice(1);
              // Gunakan 'any' casting untuk bypass type checking dinamis
              const fetched = await (basePrisma as any)[delegate].findUnique({
                where: queryArgs.where,
              });
              oldData = fetched as SentinelEntity | null;
            }
          } catch (e) {
            // Silent catch agar flow utama tidak putus
          }
        }

        // 5. Eksekusi Query Utama
        const result = await query(args);

        // 6. Async Audit Log (Background Process)
        (async () => {
          try {
            const entity = result as unknown as SentinelEntity | null;

            // Tentukan ID Record yang berubah
            const recordId = String(
              entity?.id ??
                entity?.user_id ??
                entity?.location_id ??
                entity?.meter_id ??
                entity?.reading_type_id ??
                'N/A', // Gunakan N/A jika tidak ketemu ID
            );

            // Jangan log jika ID tidak ketemu (misal deleteMany)
            if (recordId === 'N/A') return;

            const oldJson = oldData ? (oldData as unknown as Prisma.InputJsonValue) : Prisma.DbNull;
            const newJson = result ? (result as unknown as Prisma.InputJsonValue) : Prisma.DbNull;

            await basePrisma.auditLog.create({
              data: {
                action: operation.toUpperCase(),
                entity_table: model,
                entity_id: recordId,
                user_id: safeUserId, // <--- GUNAKAN VAR SAFE INI
                ip_address: safeIp,
                user_agent: safeAgent,
                old_values: operation === 'create' ? Prisma.DbNull : oldJson,
                new_values: operation === 'delete' ? Prisma.DbNull : newJson,
                reason: null,
              },
            });
          } catch (err: any) {
            // Log Warning saja, jangan Error supaya console bersih
            console.warn(`⚠️ [Audit Skip] ${model}: ${err.message}`);
          }
        })();

        return result;
      },
    },
  },
});

export default prisma;
