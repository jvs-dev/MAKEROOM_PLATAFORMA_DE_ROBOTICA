import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { syncUserProfile } from '../services/userService';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { useNavigate, useLocation } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { useState } from 'react';

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      if (!user.email) throw new Error('Email é obrigatório para o login.');

      // Check if user exists in Firestore using email as ID
      const userDocRef = doc(db, 'users', user.email);
      let userDoc;
      try {
        userDoc = await getDoc(userDocRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${user.email}`);
      }

      if (!userDoc?.exists()) {
        // Create new user profile
        // Default admin if email matches
        const isAdmin = user.email === 'jvssilv4@gmail.com';
        const userData = {
          uid: user.uid,
          name: user.displayName || 'Usuário',
          email: user.email,
          photoURL: user.photoURL || null,
          role: isAdmin ? 'admin' : 'external',
          admin: isAdmin,
          points: 0,
          certificates: [],
          completedLessons: [],
          medals: [],
          teamId: null,
          room: null,
          schoolId: null,
          createdAt: serverTimestamp()
        };
        try {
          await setDoc(userDocRef, userData);
          // Create/Sync public profile for ranking
          await syncUserProfile(user.uid, user.email);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `users/${user.email}`);
        }
      } else {
        // Update UID if it's different (ensure consistency)
        const existingData = userDoc.data();
        if (existingData.uid !== user.uid) {
          try {
            await setDoc(userDocRef, { uid: user.uid }, { merge: true });
          } catch (err) {
            console.warn("Could not update UID:", err);
          }
        }
      }

      navigate(from, { replace: true });
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('O login foi cancelado. A janela de autenticação foi fechada antes da conclusão.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        setError('Uma solicitação de login já está em andamento. Feche a outra janela e tente novamente.');
      } else {
        setError('Falha ao fazer login. Verifique sua conexão ou se o domínio está autorizado no Firebase.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-deep-black flex items-center justify-center p-4 md:p-6 transition-colors duration-300">
      <div className="bg-white dark:bg-zinc-900 p-6 md:p-10 rounded-[32px] shadow-xl shadow-slate-200 dark:shadow-none max-w-md w-full text-center border border-slate-100 dark:border-white/10">
        <div className="w-16 h-16 md:w-20 md:h-20 bg-brand-50 dark:bg-brand-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-brand-100 dark:shadow-none">
          <img src="https://makeroom2.vercel.app/logo.svg" alt="Makeroom" className="w-10 h-10 md:w-12 md:h-12" referrerPolicy="no-referrer" />
        </div>
        
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-2">Bem-vindo ao Makeroom</h1>
        <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 mb-8">A plataforma definitiva para entusiastas de robótica.</p>

        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl mb-6 text-sm font-medium border border-red-100 dark:border-red-500/20">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 font-semibold py-3 px-6 rounded-2xl transition-all duration-200 shadow-sm"
        >
          {isLoading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-brand-500"></div>
          ) : (
            <>
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              Entrar com Google
            </>
          )}
        </button>

        <p className="mt-8 text-xs text-slate-400 dark:text-slate-600">
          Ao entrar, você concorda com nossos Termos de Serviço e Política de Privacidade.
        </p>
      </div>
    </div>
  );
}
