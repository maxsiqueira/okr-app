import { ShieldAlert, LogOut, Home } from "lucide-react";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

export default function Unauthorized() {
    const navigate = useNavigate();

    const handleLogout = async () => {
        await signOut(auth);
        navigate("/login");
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="max-w-md w-full text-center space-y-8 p-10 bg-slate-900/50 border border-slate-800 rounded-3xl backdrop-blur-xl">
                <div className="flex justify-center">
                    <div className="bg-amber-500/10 p-5 rounded-full border border-amber-500/20">
                        <ShieldAlert className="w-12 h-12 text-amber-500" />
                    </div>
                </div>

                <div className="space-y-3">
                    <h1 className="text-3xl font-black text-white tracking-tight">Acesso Restrito</h1>
                    <p className="text-slate-400 text-sm leading-relaxed">
                        Sua conta está ativa, mas você ainda não possui permissão para acessar nenhum painel do sistema.
                    </p>
                </div>

                <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">O que fazer?</p>
                    <p className="text-xs text-slate-300 mt-2">
                        Entre em contato com o administrador para liberar os módulos necessários ao seu perfil.
                    </p>
                </div>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={() => navigate("/")}
                        className="w-full bg-white text-slate-950 font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                    >
                        <Home className="w-4 h-4" />
                        Tentar Novamente
                    </button>
                    <button
                        onClick={handleLogout}
                        className="w-full bg-slate-800 text-white font-bold py-3 rounded-xl hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <LogOut className="w-4 h-4" />
                        Sair da Conta
                    </button>
                </div>

                <div className="pt-4">
                    <p className="text-[8px] text-slate-600 font-mono uppercase tracking-tighter">
                        ID: {auth.currentUser?.uid || "N/A"}
                    </p>
                </div>
            </div>
        </div>
    );
}
