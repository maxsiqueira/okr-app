import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, ShieldCheck, Lock, AlertCircle, CheckCircle2 } from "lucide-react"
import { auth } from "@/lib/firebase"
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth"

export function AccountSecurityPanel() {
    const [currentPassword, setCurrentPassword] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<boolean>(false)

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setSuccess(false)

        if (newPassword !== confirmPassword) {
            setError("As senhas não coincidem.")
            return
        }

        if (newPassword.length < 6) {
            setError("A nova senha deve ter pelo menos 6 caracteres.")
            return
        }

        const user = auth.currentUser
        if (!user || !user.email) {
            setError("Usuário não autenticado.")
            return
        }

        setIsLoading(true)
        try {
            // 1. Re-autenticar o usuário para segurança
            const credential = EmailAuthProvider.credential(user.email, currentPassword)
            await reauthenticateWithCredential(user, credential)

            // 2. Atualizar a senha
            await updatePassword(user, newPassword)

            setSuccess(true)
            setCurrentPassword("")
            setNewPassword("")
            setConfirmPassword("")
        } catch (err: any) {
            console.error("Erro ao alterar senha:", err)
            if (err.code === 'auth/wrong-password') {
                setError("A senha atual está incorreta.")
            } else if (err.code === 'auth/too-many-requests') {
                setError("Muitas tentativas. Tente novamente mais tarde.")
            } else {
                setError("Ocorreu um erro ao tentar alterar a senha.")
            }
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-xl shadow-slate-200/20 dark:shadow-none bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl">
            <CardHeader className="border-b border-slate-100 dark:border-slate-900 pb-6">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-slate-100 dark:bg-slate-900/30 rounded-lg">
                        <Lock className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                        <CardTitle className="text-xl">Segurança da Conta</CardTitle>
                        <CardDescription>Atualize sua senha de acesso ao Ion Dashboard.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-8">
                <form onSubmit={handleUpdatePassword} className="max-w-md space-y-6">
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold flex items-center gap-2 border border-red-100 dark:border-red-900/30">
                            <AlertCircle className="h-4 w-4" /> {error}
                        </div>
                    )}
                    {success && (
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-bold flex items-center gap-2 border border-emerald-100 dark:border-emerald-900/30">
                            <CheckCircle2 className="h-4 w-4" /> Senha alterada com sucesso!
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Senha Atual</Label>
                            <Input
                                type="password"
                                required
                                value={currentPassword}
                                onChange={e => setCurrentPassword(e.target.value)}
                                placeholder="••••••••"
                                className="h-11 bg-slate-50 border-slate-200 focus-visible:ring-slate-400"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Nova Senha</Label>
                            <Input
                                type="password"
                                required
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                placeholder="••••••••"
                                className="h-11 bg-slate-50 border-slate-200 focus-visible:ring-slate-400"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Confirmar Nova Senha</Label>
                            <Input
                                type="password"
                                required
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                className="h-11 bg-slate-50 border-slate-200 focus-visible:ring-slate-400"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="bg-slate-900 hover:bg-black dark:bg-white dark:text-black dark:hover:bg-slate-200 px-8 h-11 font-bold uppercase text-[11px] tracking-widest shadow-lg transition-all"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...
                                </>
                            ) : (
                                <>
                                    <ShieldCheck className="mr-2 h-4 w-4" /> Alterar Senha
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
