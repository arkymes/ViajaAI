import React from 'react';
import { Plane, Map, Sparkles, ArrowRight } from 'lucide-react';
import { signInWithGoogle } from '../services/firebase';

interface LoginScreenProps {
  onGuestLogin: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onGuestLogin }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-600 to-indigo-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 w-full max-w-md flex flex-col items-center text-center animate-fade-in-up">
        <div className="w-16 h-16 bg-brand-100 rounded-2xl flex items-center justify-center mb-6 text-brand-600 rotate-3 shadow-sm">
          <Plane className="w-8 h-8" />
        </div>
        
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Bem-vindo ao ViajaAI</h1>
        <p className="text-slate-500 mb-8 leading-relaxed">
          Planeje suas viagens com inteligência artificial. Crie roteiros detalhados e receba dicas personalizadas.
        </p>

        <div className="w-full space-y-3">
          <button 
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-3 px-4 rounded-xl transition-all shadow-sm hover:shadow-md group relative overflow-hidden"
          >
            <img 
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
              alt="Google Logo" 
              className="w-5 h-5 group-hover:scale-110 transition-transform" 
            />
            <span>Entrar com Google</span>
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink-0 mx-4 text-slate-300 text-xs font-medium uppercase">Ou</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          <button 
            onClick={onGuestLogin}
            className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium py-3 px-4 rounded-xl transition-all group"
          >
            <span>Continuar sem login</span>
            <ArrowRight className="w-4 h-4 opacity-50 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4 text-xs text-slate-400 w-full">
          <div className="flex flex-col items-center gap-1">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>IA Gemini</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Map className="w-4 h-4 text-emerald-500" />
            <span>Roteiros</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Plane className="w-4 h-4 text-brand-500" />
            <span>Offline</span>
          </div>
        </div>
      </div>
    </div>
  );
};