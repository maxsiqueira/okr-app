import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Loader2, Home, AlertCircle } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [customLogo, setCustomLogo] = useState<string | null>(null);
    const navigate = useNavigate();

    React.useEffect(() => {
        const savedLoginLogo = localStorage.getItem("ion_login_logo");
        const savedSystemLogo = localStorage.getItem("ion_custom_logo");

        // Priority: Dedicated Login Logo > System Logo > Default
        if (savedLoginLogo && savedLoginLogo !== "null" && savedLoginLogo.trim() !== "") {
            setCustomLogo(savedLoginLogo);
        } else if (savedSystemLogo && savedSystemLogo !== "null" && savedSystemLogo.trim() !== "") {
            setCustomLogo(savedSystemLogo);
        } else {
            setCustomLogo(null);
        }
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Dev Bypass for Admin
            if (email === 'max.sena@ionsistemas.com.br' && password === 'ion@2025') {
                console.log("Local Dev Bypass Auth for Admin...");
                navigate('/');
                return;
            }
            await signInWithEmailAndPassword(auth, email, password);
            navigate('/');
        } catch (err: any) {
            console.error("Login fail:", err);
            let msg = "Falha ao autenticar. Verifique suas credenciais.";
            if (err.code === 'auth/invalid-credential') msg = "E-mail ou senha incorretos.";
            if (err.code === 'auth/too-many-requests') msg = "Muitas tentativas falhas. Tente novamente mais tarde.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-sidebar flex items-start justify-center p-4 pt-20 relative overflow-hidden">
            {/* Animated Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-realestate-primary-500/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px] animate-pulse" />
            </div>

            <div className="w-full max-w-md relative z-10">
                <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/5 shadow-2xl rounded-3xl p-10 overflow-hidden relative">
                    {/* Glassmorphism highlight */}
                    <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                    <div className="flex flex-col items-center mb-10">
                        {customLogo ? (
                            <div className="mb-6 shadow-realestate-xl transform -rotate-3 hover:rotate-0 transition-transform duration-300">
                                <img src={customLogo} alt="Logo" className="max-h-24 w-auto object-contain" />
                            </div>
                        ) : (
                            <>
                                <div className="w-20 h-20 bg-gradient-realestate-blue rounded-2xl flex items-center justify-center mb-6 shadow-realestate-xl transform -rotate-3 hover:rotate-0 transition-transform duration-300">
                                    <Home className="w-10 h-10 text-white" />
                                </div>
                                <h1 className="text-4xl font-black text-white tracking-tight mb-2">
                                    Ion <span className="text-realestate-primary-400">Dashboard</span>
                                </h1>
                            </>
                        )}
                        <p className="text-slate-400 text-sm font-medium uppercase tracking-widest">Acesso Estratégico</p>
                    </div>

                    {error && (
                        <div className="mb-8 bg-rose-500/10 backdrop-blur-sm border border-rose-500/20 rounded-2xl p-4 flex items-center gap-3 text-rose-200 text-xs font-bold animate-shake">
                            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">E-mail Corporativo</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 group-focus-within:text-realestate-primary-400 transition-colors" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-slate-800/50 border border-slate-700/50 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-realestate-primary-500/50 focus:ring-4 focus:ring-realestate-primary-500/10 transition-all"
                                    placeholder="seu@exemplo.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Senha de Acesso</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 group-focus-within:text-realestate-primary-400 transition-colors" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-800/50 border border-slate-700/50 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-realestate-primary-500/50 focus:ring-4 focus:ring-realestate-primary-500/10 transition-all"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-realestate-blue hover:scale-[1.02] active:scale-[0.98] text-white font-black py-4 px-6 rounded-2xl shadow-realestate-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mt-8 uppercase tracking-widest text-sm"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin mr-3" />
                                    Autenticando...
                                </>
                            ) : 'Entrar na Plataforma'}
                        </button>
                    </form>
                </div>
                <div className="mt-8 text-center text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                    © 2026 Ion Intelligence System • Strategical Real Estate
                </div>
            </div>
        </div>
    );
}


