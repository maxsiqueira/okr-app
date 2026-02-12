export type UserRole = 'admin' | 'user';

export interface AppUser {
    uid: string;
    email: string | null;
    displayName: string | null;
    role: UserRole;
    allowedPanels: string[]; // IDs das rotas/telas que o usuário pode acessar
    isBlocked?: boolean;
    createdAt: string;
}
