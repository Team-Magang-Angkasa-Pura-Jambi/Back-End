import { getAuditContext } from '../common/utils/context.js';
import { PrismaClient, Prisma } from '../generated/prisma/index.js';
import { serverLoggerService } from '../modules/system_monitor/server_logger.service.js';

interface SentinelEntity {
  id?: number | string;
  user_id?: number | string;
  location_id?: number | string;
  meter_id?: number | string;
  reading_type_id?: number | string;
  scheme_id?: number | string;
  rate_id?: number | string;
  tenant_id?: number | string;
  session_id?: number | string;
  reading_id?: number | string;
  summary_id?: number | string;
  budget_id?: number | string;
  allocation_id?: number | string;
  target_id?: number | string;
  template_id?: number | string;
  formula_id?: number | string;
  setting_id?: number | string;
  key?: string;
  pax_id?: number | string;
  energy_type_id?: number | string;
  role_id?: number | string;
  config_id?: number | string;
  log_id?: number | string;
}

const basePrisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

const AUDITABLE_MODELS = [
  'User',
  'Role',
  'Location',
  'Tenant',
  'EnergyType',
  'Meter',
  'MeterReadingConfig',
  'ReadingType',
  'ReadingSession',
  'MeterReading',
  'DailySummary',
  'MonthlySummary',
  'PriceScheme',
  'SchemeRate',
  'AnnualBudget',
  'BudgetAllocation',
  'EfficiencyTarget',
  'CalculationTemplate',
  'FormulaDefinition',
  'SystemSetting',
  'PaxData',
  'MeterLifecycleLog',
  'MlPrediction',
];

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
              if ((basePrisma as any)[delegate]?.findUnique) {
                const fetched = await (basePrisma as any)[delegate].findUnique({
                  where: queryArgs.where,
                });
                oldData = fetched as SentinelEntity | null;
              }
            }
          } catch (e: any) {
            console.warn(`⚠️ [Audit Skip Previous Fetch] ${model}: ${e.message}`);
          }
        }

        const result = await query(args);

        // Asynchronously persist to Audit Log and Server Logger
        (async () => {
          try {
            const entity = result as unknown as SentinelEntity | null;

            const recordId = String(
              entity?.id ??
                entity?.user_id ??
                entity?.location_id ??
                entity?.meter_id ??
                entity?.session_id ??
                entity?.reading_id ??
                entity?.summary_id ??
                entity?.budget_id ??
                entity?.allocation_id ??
                entity?.target_id ??
                entity?.scheme_id ??
                entity?.rate_id ??
                entity?.tenant_id ??
                entity?.setting_id ??
                entity?.key ??
                entity?.pax_id ??
                entity?.template_id ??
                entity?.formula_id ??
                entity?.energy_type_id ??
                entity?.role_id ??
                entity?.config_id ??
                'N/A',
            );

            if (recordId === 'N/A') return;

            const oldJson = oldData ? (oldData as unknown as Prisma.InputJsonValue) : Prisma.DbNull;
            const newJson = result ? (result as unknown as Prisma.InputJsonValue) : Prisma.DbNull;

            // 1. Save to Database Audit Log Table
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

            // 2. Also register as core audit log in Server Monitoring Logger
            serverLoggerService.log(
              'DB',
              `[Audit] ${operation.toUpperCase()} pada tabel ${model} (ID: ${recordId}) oleh User #${safeUserId}`,
              'AuditTrail',
              {
                endpoint: `DB://${model}/${recordId}`,
                request: {
                  method: operation.toUpperCase(),
                  url: `DB://${model}/${recordId}`,
                  ip: safeIp,
                  body: operation === 'delete' ? undefined : (result as any),
                },
                response: {
                  statusCode: 200,
                  durationMs: 0,
                  body: {
                    action: operation.toUpperCase(),
                    table: model,
                    recordId,
                    userId: safeUserId,
                    oldData: oldData || null,
                    newData: result || null,
                  },
                },
              },
            );
          } catch (err: any) {
            console.warn(`⚠️ [Audit Log Save Skip] ${model}: ${err.message}`);
          }
        })();

        return result;
      },
    },
  },
});

export const ensureSystemSettingsTable = async () => {
  try {
    await basePrisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.system_settings (
        setting_id SERIAL PRIMARY KEY,
        key VARCHAR(255) UNIQUE NOT NULL,
        value JSONB NOT NULL,
        description TEXT,
        updated_by INTEGER,
        updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (err) {
    console.warn('[DB] Auto-ensure system_settings table notice:', err);
  }
};

export default prisma;
