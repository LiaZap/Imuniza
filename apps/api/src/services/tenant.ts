import { prisma } from '@imuniza/db';

let cachedTenantId: string | null = null;

export async function getDefaultTenantId(): Promise<string> {
  if (cachedTenantId) return cachedTenantId;
  const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!tenant) {
    throw new Error('Nenhum tenant encontrado. Rode `pnpm db:seed` antes de iniciar a API.');
  }
  cachedTenantId = tenant.id;
  return tenant.id;
}

export async function getTenantConfig(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error(`Tenant ${tenantId} não encontrado`);
  return tenant;
}
