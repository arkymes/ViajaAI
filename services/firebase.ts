import firebase from "firebase/compat/app";
import "firebase/compat/auth";

// Helper super seguro para ler variáveis sem quebrar o build
const getEnv = (key: string, defaultValue: string) => {
  // Tenta import.meta.env
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key] as string;
    }
  } catch (e) {
    // Silently fail
  }
  
  // Tenta process.env de forma segura (sem acessar process diretamente se ele não existir)
  try {
    // @ts-ignore
    const env = typeof process !== 'undefined' ? process.env : {};
    if (env && env[key]) {
      return env[key] as string;
    }
  } catch (e) {
    // Silently fail
  }

  return defaultValue;
};

const API_KEY = getEnv("FIREBASE_API_KEY", "SUA_API_KEY_AQUI");

// Se a chave for o placeholder, ou vazia, entramos em modo DEMO automaticamente
let isDemoMode = API_KEY === "SUA_API_KEY_AQUI" || !API_KEY;

const firebaseConfig = {
  apiKey: API_KEY,
  authDomain: getEnv("FIREBASE_AUTH_DOMAIN", "seu-projeto.firebaseapp.com"),
  projectId: getEnv("FIREBASE_PROJECT_ID", "seu-projeto"),
  storageBucket: getEnv("FIREBASE_STORAGE_BUCKET", "seu-projeto.appspot.com"),
  messagingSenderId: getEnv("FIREBASE_MESSAGING_SENDER_ID", "123456789"),
  appId: getEnv("FIREBASE_APP_ID", "1:123456789:web:abcdef")
};

let auth: firebase.auth.Auth | null = null;
let googleProvider: firebase.auth.GoogleAuthProvider | null = null;

// Inicialização segura - se falhar, cai para o modo demo em vez de travar o app
if (!isDemoMode) {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    auth = firebase.auth();
    googleProvider = new firebase.auth.GoogleAuthProvider();
  } catch (error) {
    console.warn("⚠️ Falha ao inicializar Firebase real. Entrando em modo DEMO Offline.", error);
    isDemoMode = true;
    auth = null;
  }
} else {
  console.log("ℹ️ Iniciando em modo Demo (Sem Firebase Configurado).");
}

// --- MOCK AUTH ---
const mockUser: any = {
  uid: "demo-user-123",
  displayName: "Viajante Demo",
  email: "demo@viaja.ai",
  photoURL: null,
  emailVerified: true
};

type AuthCallback = (user: any | null) => void;
const mockListeners: AuthCallback[] = [];

const notifyMockListeners = (user: any | null) => {
  mockListeners.forEach(cb => cb(user));
  if (user) localStorage.setItem('demo_auth_session', 'true');
  else localStorage.removeItem('demo_auth_session');
};

export const signInWithGoogle = async () => {
  if (isDemoMode || !auth) {
    await new Promise(resolve => setTimeout(resolve, 800));
    notifyMockListeners(mockUser);
    return;
  }

  try {
    await auth.signInWithPopup(googleProvider!);
  } catch (error: any) {
    if (error.code === 'auth/cancelled-popup-request') return;
    if (error.code === 'auth/api-key-not-valid' || error.code === 'auth/configuration-not-found') {
      console.warn("Erro de configuração do Auth. Usando login Demo.");
      notifyMockListeners(mockUser);
      return;
    }
    console.error("Login Error:", error);
    alert("Erro no login. Verifique o console.");
  }
};

export const logout = async () => {
  if (isDemoMode || !auth) {
    notifyMockListeners(null);
    return;
  }
  try {
    await auth.signOut();
  } catch (error) {
    console.error("Logout Error:", error);
  }
};

export const subscribeToAuthChanges = (callback: (user: any | null) => void) => {
  // Se estivermos em modo demo OU se a inicialização do auth falhou (auth é null)
  if (isDemoMode || !auth) {
    mockListeners.push(callback);
    const hasSession = localStorage.getItem('demo_auth_session');
    // Pequeno delay para simular verificação de sessão e evitar condições de corrida no render
    setTimeout(() => {
      callback(hasSession ? mockUser : null);
    }, 50);
    
    return () => {
      const index = mockListeners.indexOf(callback);
      if (index > -1) mockListeners.splice(index, 1);
    };
  }
  
  // Se auth existe, usa o Firebase real
  return auth.onAuthStateChanged(callback);
};