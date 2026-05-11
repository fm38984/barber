export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'TRIAL';

export interface TenantContext {
  tenantId: string;
  status: TenantStatus;
}

export interface ResolvedTenant {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  timezone: string;
  whatsappPhoneNumberId: string;
}

export type TenantAdminRole = 'OWNER' | 'MANAGER';

export interface AuthenticatedAdmin {
  tenantId: string;
  adminId: string;
  role: TenantAdminRole;
  clerkUserId: string;
}
