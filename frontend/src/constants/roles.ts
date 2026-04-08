export const SUPER_ADMIN = 'super_admin';
export const CUSTOMER = 'customer';

export type UserRole = typeof SUPER_ADMIN | typeof CUSTOMER;

export function isSuperAdmin(roleCode: string | undefined | null): boolean {
    return roleCode === SUPER_ADMIN;
}

export function isCustomer(roleCode: string | undefined | null): boolean {
    return roleCode === CUSTOMER;
}
