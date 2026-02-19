import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Users, Plus, Loader2, Pencil, Mail, Trash2, Ban } from "lucide-react";
import { collection, getDocs, doc, setDoc, updateDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { db, app, auth, functions } from "@/lib/firebase";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { AppUser } from "@/types/user";

// Define all available panels for permissions
const AVAILABLE_PANELS = [
    { id: 'strategic', label: 'Strategic Overview' },
    { id: 'strategic-objectives', label: 'Strategic Objectives' },
    { id: 'okr', label: 'OKR Tracking' },
    { id: 'analysis', label: 'Epic Analysis' },
    { id: 'extra-analysis', label: 'Extra Initiatives' },
    { id: 'assessment', label: 'Results Assessment' },
    { id: 'manual-okrs', label: 'Manual OKRs' },
    { id: 'settings', label: 'Settings & Administration' },
];

export function UserManagementPanel() {
    const [users, setUsers] = useState<AppUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);

    // Form State
    const [userData, setUserData] = useState({
        displayName: '',
        email: '',
        password: '',
        newPassword: '',
        role: 'user' as 'admin' | 'user',
        allowedPanels: [] as string[],
        isBlocked: false
    });

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, "users"));
            const usersData: AppUser[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data() as AppUser;
                usersData.push(data);
                if (data.email?.includes('bernardo')) {
                    console.log("[DEBUG] Bernardo Data:", data);
                }
            });
            console.log("[DEBUG] All Users Fetched:", usersData);
            setUsers(usersData);
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const openCreateModal = () => {
        setEditingUserId(null);
        setUserData({ displayName: '', email: '', password: '', newPassword: '', role: 'user', allowedPanels: [], isBlocked: false });
        setShowModal(true);
    };

    const openEditModal = (user: AppUser) => {
        setEditingUserId(user.uid);
        setUserData({
            displayName: user.displayName || '',
            email: user.email || '',
            password: '',
            newPassword: '',
            role: user.role,
            allowedPanels: user.allowedPanels || [],
            isBlocked: user.isBlocked || false
        });
        setShowModal(true);
    };

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            if (editingUserId) {
                // UPDATE USER
                await updateDoc(doc(db, "users", editingUserId), {
                    displayName: userData.displayName,
                    role: userData.role,
                    allowedPanels: userData.role === 'admin' ? [] : userData.allowedPanels,
                    isBlocked: userData.isBlocked
                });

                console.log("[UserManagement] User updated:", {
                    uid: editingUserId,
                    email: userData.email,
                    role: userData.role,
                    allowedPanels: userData.role === 'admin' ? [] : userData.allowedPanels
                });


                // SE TIVER NOVA SENHA, CHAMA A CLOUD FUNCTION
                if (userData.newPassword && userData.newPassword.trim().length >= 6) {
                    try {
                        const updateUserPassword = httpsCallable(functions, 'updateUserPassword');
                        await updateUserPassword({
                            targetUid: editingUserId,
                            newPassword: userData.newPassword.trim()
                        });
                        console.log("Senha do usuário atualizada com sucesso via Cloud Function.");
                    } catch (passwordError: any) {
                        console.error("Erro ao atualizar senha via Cloud Function:", passwordError);

                        let customMsg = "Houve um erro técnico. ";
                        if (passwordError.message.includes("internal") || passwordError.message.includes("not-found")) {
                            customMsg = "Esta funcionalidade requer o plano 'Blaze' do Firebase para ativar as Cloud Functions. ";
                        }

                        alert(`Usuário atualizado, mas ${customMsg}\n\nRecomendação: Use o ícone de 'E-mail' ao lado do endereço do usuário para enviar um link de redefinição de senha.`);
                    }
                }
                alert("Usuário atualizado com sucesso!");
            } else {
                // CREATE NEW USER
                let secondaryApp: any = null;
                try {
                    secondaryApp = initializeApp(app.options, "Secondary");
                    const secondaryAuth = getAuth(secondaryApp);

                    const userCred = await createUserWithEmailAndPassword(secondaryAuth, userData.email, userData.password);
                    const uid = userCred.user.uid;

                    await setDoc(doc(db, "users", uid), {
                        uid,
                        email: userData.email,
                        displayName: userData.displayName,
                        role: userData.role,
                        allowedPanels: userData.role === 'admin' ? [] : userData.allowedPanels,
                        isBlocked: false,
                        createdAt: serverTimestamp()
                    });

                    await signOut(secondaryAuth);
                    alert(`Usuário ${userData.displayName} criado com sucesso!`);
                } finally {
                    if (secondaryApp) await deleteApp(secondaryApp);
                }
            }

            // OPTIMISTIC UPDATE / LOCAL STATE UPDATE
            const updatedUser: AppUser = {
                uid: editingUserId || 'unknown',
                email: userData.email,
                displayName: userData.displayName,
                role: userData.role,
                allowedPanels: userData.role === 'admin' ? [] : userData.allowedPanels,
                isBlocked: userData.isBlocked,
                // Preserve other fields if editing
                ...(editingUserId ? users.find(u => u.uid === editingUserId) : {})
            } as AppUser;

            if (editingUserId) {
                setUsers(prev => prev.map(u => u.uid === editingUserId ? { ...u, ...updatedUser } : u));
            } else {
                // For new users, we might need to wait for fetchUsers to get the real UID/timestamp, 
                // but we can add a placeholder or just rely on fetchUsers.
                // Given the issue is about EDITING, the above map update fixes the "reflection" issue.
            }

            setShowModal(false);

            // Still fetch to ensure consistency, but allow UI to show change immediately
            setTimeout(() => fetchUsers(), 1000);
        } catch (error: any) {
            console.error("Error saving user:", error);
            alert("Erro ao salvar: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteUser = async (user: AppUser) => {
        if (!window.confirm(`Tem certeza que deseja remover o acesso de ${user.displayName}? \n\nNota: O login pode continuar existindo no Firebase até ser removido manualmente do Console, mas o acesso ao sistema será revogado imediatamente.`)) return;

        try {
            await deleteDoc(doc(db, "users", user.uid));
            setUsers(prev => prev.filter(u => u.uid !== user.uid));
            alert("Acesso do usuário removido com sucesso.");
        } catch (error: any) {
            console.error("Error deleting user:", error);
            alert("Erro ao excluir: " + error.message);
        }
    };

    const togglePanel = (panelId: string) => {
        setUserData(prev => {
            const panels = prev.allowedPanels.includes(panelId)
                ? prev.allowedPanels.filter(p => p !== panelId)
                : [...prev.allowedPanels, panelId];
            return { ...prev, allowedPanels: panels };
        });
    };

    const selectAllPanels = () => {
        setUserData(prev => ({
            ...prev,
            allowedPanels: AVAILABLE_PANELS.map(p => p.id)
        }));
    };

    const handleResetPassword = async () => {
        if (!userData.email) return;
        const confirmReset = window.confirm(`Deseja enviar um e-mail de redefinição de senha para ${userData.email}?`);
        if (!confirmReset) return;

        try {
            await sendPasswordResetEmail(auth, userData.email);
            alert("E-mail de redefinição enviado com sucesso!");
        } catch (error: any) {
            console.error("Reset Password Error:", error);
            alert("Erro ao enviar e-mail: " + error.message);
        }
    };

    return (
        <Card className="border-emerald-100/60 dark:border-emerald-950/60 shadow-xl shadow-emerald-100/20 dark:shadow-none bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl">
            <CardHeader className="border-b border-emerald-100/30 dark:border-emerald-950/30 pb-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                            <Users className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Gestão de Usuários</CardTitle>
                            <CardDescription>Cadastre e gerencie acessos de Administradores e Usuários.</CardDescription>
                        </div>
                    </div>
                    <Button onClick={openCreateModal} className="bg-emerald-600 hover:bg-emerald-700 font-bold">
                        <Plus className="w-4 h-4 mr-2" /> Novo Usuário
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                {loading ? (
                    <div className="text-center py-8 text-slate-500">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                        Carregando usuários...
                    </div>
                ) : (
                    <div className="rounded-md border border-slate-200 dark:border-slate-800">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Acessos</TableHead>
                                    <TableHead className="w-[80px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((user) => (
                                    <TableRow key={user.uid}>
                                        <TableCell className="font-medium">{user.displayName}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${user.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'}`}>
                                                {user.role}
                                            </span>
                                            {user.isBlocked && (
                                                <span className="ml-2 px-2 py-1 rounded text-[10px] font-bold uppercase bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 animate-pulse">
                                                    BLOQUEADO
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="max-w-[200px] truncate text-xs text-slate-500">
                                            {user.role === 'admin' ? 'Acesso Total' : user.allowedPanels?.join(', ') || 'Nenhum'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-emerald-600" onClick={() => openEditModal(user)} title="Editar">
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => handleDeleteUser(user)} title="Revogar Acesso">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>

            {/* Modal for Create/Edit - SCROLLABLE OVERLAY FIX */}
            {showModal && (
                <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/80 backdrop-blur-sm">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <div className="relative w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800">

                            {/* 1. HEADER */}
                            <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800">
                                <h3 className="text-lg font-bold">{editingUserId ? 'Editar Usuário' : 'Novo Usuário'}</h3>
                                <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">✕</button>
                            </div>

                            {/* 2. BODY */}
                            <div className="p-5">
                                <form id="user-form" onSubmit={handleSaveUser} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Nome Completo</Label>
                                        <Input required value={userData.displayName} onChange={e => setUserData({ ...userData, displayName: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>E-mail Corporativo</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                type="email"
                                                required
                                                value={userData.email}
                                                onChange={e => setUserData({ ...userData, email: e.target.value })}
                                                disabled={!!editingUserId}
                                                className={editingUserId ? "opacity-60 bg-slate-100 dark:bg-slate-800" : ""}
                                            />
                                            {editingUserId && (
                                                <Button type="button" variant="outline" size="icon" title="Enviar E-mail de Redefinição de Senha" onClick={handleResetPassword}>
                                                    <Mail className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                        {editingUserId && <p className="text-[10px] text-slate-500">O e-mail não pode ser alterado. Use o botão ao lado para redefinir a senha.</p>}
                                    </div>

                                    {!editingUserId ? (
                                        <div className="space-y-2">
                                            <Label>Senha Inicial</Label>
                                            <Input type="password" required minLength={6} value={userData.password} onChange={e => setUserData({ ...userData, password: e.target.value })} />
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <Label className="text-blue-600 font-bold flex items-center gap-1">
                                                Definir Nova Senha (Manual)
                                                <Badge variant="outline" className="text-[8px] bg-blue-50 text-blue-600 border-blue-200 uppercase">Requer Plano Blaze</Badge>
                                            </Label>
                                            <Input
                                                type="password"
                                                placeholder="Deixe vazio para manter a atual"
                                                minLength={6}
                                                value={userData.newPassword}
                                                onChange={e => setUserData({ ...userData, newPassword: e.target.value })}
                                                className="border-blue-200 focus:ring-blue-500"
                                            />
                                            <div className="p-2 bg-amber-50 border border-amber-100 rounded-lg">
                                                <p className="text-[10px] text-amber-700 leading-tight">
                                                    <strong>Importante:</strong> Para salvar esta senha, seu Firebase deve estar no plano <strong>Blaze</strong>. Caso contrário, use o ícone de e-mail ao lado para enviar um link de redefinição.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2 pt-2">
                                        <Label>Nível de Acesso</Label>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex-1">
                                                <input type="radio" name="role" checked={userData.role === 'user'} onChange={() => setUserData({ ...userData, role: 'user' })} />
                                                <div className="text-sm">
                                                    <div className="font-bold">Usuário</div>
                                                    <div className="text-xs text-slate-500">Acesso limitado selecionado</div>
                                                </div>
                                            </label>
                                            <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex-1">
                                                <input type="radio" name="role" checked={userData.role === 'admin'} onChange={() => setUserData({ ...userData, role: 'admin' })} />
                                                <div className="text-sm">
                                                    <div className="font-bold text-purple-600">Admin</div>
                                                    <div className="text-xs text-slate-500">Acesso total ao sistema</div>
                                                </div>
                                            </label>
                                        </div>
                                    </div>

                                    {editingUserId && (
                                        <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                                            <Label className="text-red-500 font-bold flex items-center gap-2">
                                                <Ban className="w-4 h-4" /> Status da Conta
                                            </Label>
                                            <div className="flex items-center justify-between p-3 border border-red-100 dark:border-red-900/30 rounded-lg bg-red-50/30 dark:bg-red-900/10 transition-colors">
                                                <div className="text-sm">
                                                    <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                                        {userData.isBlocked ? (
                                                            <span className="text-red-600">Conta Bloqueada</span>
                                                        ) : (
                                                            <span className="text-emerald-600">Conta Ativa</span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        {userData.isBlocked ? 'O usuário não pode acessar o sistema.' : 'O usuário tem acesso normal.'}
                                                    </div>
                                                </div>
                                                <Checkbox
                                                    id="isBlocked"
                                                    checked={userData.isBlocked}
                                                    onCheckedChange={(checked) => setUserData({ ...userData, isBlocked: checked === true })}
                                                    className="border-red-400 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {userData.role === 'user' && (
                                        <div className="space-y-2 pt-2">
                                            <div className="flex justify-between items-center">
                                                <Label>Permissões de Painel</Label>
                                                <Button type="button" variant="ghost" size="sm" onClick={selectAllPanels} className="h-6 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
                                                    Marcar Todos
                                                </Button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                {AVAILABLE_PANELS.map(panel => (
                                                    <div key={panel.id} className="flex items-center space-x-2">
                                                        <Checkbox
                                                            id={panel.id}
                                                            checked={userData.allowedPanels.includes(panel.id)}
                                                            onCheckedChange={() => togglePanel(panel.id)}
                                                        />
                                                        <label htmlFor={panel.id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                                            {panel.label}
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </form>
                            </div>

                            {/* 3. FOOTER */}
                            <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 rounded-b-xl flex justify-end gap-3">
                                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
                                <Button type="submit" form="user-form" disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
                                    {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    {editingUserId ? 'Salvar Alterações' : 'Criar Usuário'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
}
