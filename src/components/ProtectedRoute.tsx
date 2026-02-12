import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: string[];
    requiredPanel?: string; // ID do painel atual para checar no allowedPanels
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    allowedRoles,
    requiredPanel
}) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return null;
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Se for Admin, tem acesso irrestrito (God Mode)
    if (user.role === 'admin') {
        return <>{children}</>;
    }

    // Validação de Role (se especificado)
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        console.warn(`[ProtectedRoute] Acesso negado: role '${user.role}' não está em`, allowedRoles);
        return <Navigate to="/" replace />;
    }

    // ⚠️ VALIDAÇÃO CRÍTICA: Painel Específico (para usuários não-admin)
    if (requiredPanel) {
        // 1. Garantir que allowedPanels existe e não está vazio
        if (!user.allowedPanels || user.allowedPanels.length === 0) {
            console.warn(`[ProtectedRoute] ❌ Usuário ${user.email} não tem painéis permitidos (allowedPanels vazio)`);
            return <Navigate to="/" replace />;
        }

        // 2. Verificar se o painel requerido está na lista de permitidos
        if (!user.allowedPanels.includes(requiredPanel)) {
            console.warn(
                `[ProtectedRoute] ❌ Acesso negado ao painel '${requiredPanel}'`,
                `\nUsuário: ${user.email}`,
                `\nPainéis permitidos:`, user.allowedPanels
            );
            return <Navigate to="/" replace />;
        }

        console.log(`[ProtectedRoute] ✅ Acesso permitido ao painel '${requiredPanel}' para ${user.email}`);
    }

    return <>{children}</>;
};
