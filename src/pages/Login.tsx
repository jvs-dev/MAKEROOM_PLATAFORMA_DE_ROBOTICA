import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { syncUserProfile } from '../services/userService';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, EyeOff, Instagram } from 'lucide-react';

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  // State for email/password auth
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const initUserDoc = async (user: any, nameOverride?: string) => {
    if (!user.email) throw new Error('Email é obrigatório.');

    const userDocRef = doc(db, 'users', user.email);
    let userDoc;
    try {
      userDoc = await getDoc(userDocRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${user.email}`);
    }

    if (!userDoc?.exists()) {
      const isAdmin = user.email === 'jvssilv4@gmail.com';
      const userData = {
        uid: user.uid,
        name: nameOverride || user.displayName || 'Usuário',
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
        await syncUserProfile(user.uid, user.email);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${user.email}`);
      }
    } else {
      const existingData = userDoc.data();
      if (existingData.uid !== user.uid) {
        try {
          await setDoc(userDocRef, { uid: user.uid }, { merge: true });
        } catch (err) {}
      }
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      await initUserDoc(result.user);
      navigate(from, { replace: true });
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('O login foi cancelado.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        setError('Uma solicitação de login já está em andamento. Feche a outra janela e tente novamente.');
      } else {
        setError('Falha ao fazer login com Google. Verifique sua conexão.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (mode === 'signup') {
        if (!name.trim()) throw new Error('O nome é obrigatório.');
        if (password !== confirmPassword) throw new Error('As senhas não coincidem.');
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName: name });
        await initUserDoc(result.user, name);
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        await initUserDoc(result.user);
      }
      navigate(from, { replace: true });
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Este email já está em uso.');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Email ou senha incorretos.');
      } else if (err.code === 'auth/weak-password') {
        setError('A senha deve ter pelo menos 6 caracteres.');
      } else {
        setError(err.message || 'Ocorreu um erro durante a autenticação.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-slate-50 flex w-full font-sans selection:bg-brand-500/20 selection:text-brand-900">
      
      {/* Left Section - Image Container */}
      <div className="hidden lg:flex w-1/2 p-4 lg:p-6 pr-0">
        <div className="w-full h-full rounded-[32px] overflow-hidden relative">
          {/* Subtle overlay to fit the brand color somewhat, or just pure image */}
          <div className="absolute inset-0 bg-brand-500/10 mix-blend-overlay z-10"></div>
          <motion.img 
            initial={{scale: 1.05, opacity: 0}} 
            animate={{scale: 1, opacity: 1}} 
            transition={{duration: 1.2, ease: "easeOut"}}
            src="https://images.pexels.com/photos/7868836/pexels-photo-7868836.jpeg" 
            className="object-cover w-full h-full" 
            alt="Makers working on electronics" 
          />
        </div>
      </div>

      {/* Right Section - Form */}
      <div className="flex-1 flex flex-col w-full lg:w-1/2 min-h-screen relative">
        
        {/* Scrollable Container */}
        <div className="flex-1 w-full overflow-y-auto no-scrollbar flex flex-col justify-center px-6 sm:px-12 md:px-16 lg:px-24 py-12">
          
          <div className="w-full max-w-[400px] mx-auto">
            {/* Logo */}
            <motion.div initial={{scale: 0.8, opacity: 0}} animate={{scale: 1, opacity: 1}} className="flex justify-center mb-6">
              <div className="w-20 h-20 flex items-center justify-center p-0">
                <img src="https://makeroom2.vercel.app/logo.svg" alt="Makeroom" className="w-full h-full object-contain drop-shadow-none" />
              </div>
            </motion.div>

            <motion.div initial={{y: 10, opacity: 0}} animate={{y: 0, opacity: 1}} transition={{delay: 0.1}} className="mb-6 text-center">
              <h2 className="text-3xl md:text-4xl font-black tracking-tighter italic uppercase text-brand-500 leading-none pb-2">
                Junte-se ao Makeroom
              </h2>
            </motion.div>

            <form onSubmit={handleEmailAuth} className="space-y-3">
              <AnimatePresence mode="popLayout">
                {mode === 'signup' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -10 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -10 }}
                  >
                    <label className="block text-[13px] font-bold text-slate-700 mb-1.5 ml-1">Nome Completo</label>
                    <input 
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white focus:ring-[3px] focus:ring-brand-500/10 rounded-2xl px-4 py-3 outline-none transition-all text-slate-800 placeholder:text-slate-400 font-medium"
                      required={mode === 'signup'}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}} transition={{delay: 0.2}}>
                <label className="block text-[13px] font-bold text-slate-700 mb-1.5 ml-1">Endereço de E-mail</label>
                <input 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@exemplo.com"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white focus:ring-[3px] focus:ring-brand-500/10 rounded-2xl px-4 py-3 outline-none transition-all text-slate-800 placeholder:text-slate-400 font-medium"
                  required
                />
              </motion.div>
              
              <motion.div initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}} transition={{delay: 0.3}}>
                <div className="flex items-center justify-between mb-1.5 ml-1 mr-1">
                  <label className="block text-[13px] font-bold text-slate-700">Senha</label>
                </div>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white focus:ring-[3px] focus:ring-brand-500/10 rounded-2xl px-4 py-3 outline-none transition-all text-slate-800 placeholder:text-slate-400 font-medium pr-12"
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors rounded-lg flex items-center justify-center outline-none focus:ring-2 focus:ring-brand-500/30 bg-transparent cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </motion.div>

              <AnimatePresence mode="popLayout">
                {mode === 'signup' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -10 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -10 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-1.5 ml-1 mr-1 mt-3">
                      <label className="block text-[13px] font-bold text-slate-700">Confirmar Senha</label>
                    </div>
                    <div className="relative">
                      <input 
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white focus:ring-[3px] focus:ring-brand-500/10 rounded-2xl px-4 py-3 outline-none transition-all text-slate-800 placeholder:text-slate-400 font-medium pr-12"
                        required={mode === 'signup'}
                      />
                      <button 
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors rounded-lg flex items-center justify-center outline-none focus:ring-2 focus:ring-brand-500/30 bg-transparent cursor-pointer"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, scale: 0.95 }}
                    animate={{ opacity: 1, height: 'auto', scale: 1 }}
                    exit={{ opacity: 0, height: 0, scale: 0.95 }}
                    className="bg-red-50 text-red-600 text-sm font-semibold p-4 rounded-2xl border border-red-100"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}} transition={{delay: 0.4}}
                type="submit"
                disabled={isLoading}
                className="w-full bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white font-bold py-3.5 px-4 rounded-2xl transition-all disabled:opacity-70 disabled:pointer-events-none shadow-[0_8px_16px_-6px_rgba(249,115,22,0.4)] mt-5 flex justify-center text-base"
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  mode === 'login' ? 'Entrar' : 'Criar Conta'
                )}
              </motion.button>
            </form>

            <motion.div initial={{opacity: 0}} animate={{opacity: 1}} transition={{delay: 0.5}} className="flex items-center gap-4 my-6">
              <div className="h-px bg-slate-200 flex-1" />
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Ou</span>
              <div className="h-px bg-slate-200 flex-1" />
            </motion.div>

            <motion.button
              initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}} transition={{delay: 0.6}}
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full flex justify-center items-center gap-3 bg-white border-2 border-slate-100 hover:border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-3 px-4 rounded-2xl transition-all active:bg-slate-100 shadow-sm text-base"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5 -ml-2" />
              {mode === 'login' ? 'Entrar com Google' : 'Criar conta com Google'}
            </motion.button>

            {/* Toggle Mode */}
            <motion.div initial={{opacity: 0}} animate={{opacity: 1}} transition={{delay: 0.7}} className="mt-8 flex justify-center items-center gap-2 text-sm font-medium">
              <span className="text-slate-500">
                {mode === 'login' ? 'Não tem uma conta?' : 'Já tem uma conta?'}
              </span>
              <button 
                type="button"
                onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                className="text-brand-600 hover:text-brand-700 font-bold transition-colors cursor-pointer"
              >
                {mode === 'login' ? 'Inscrever-se' : 'Entrar'}
              </button>
            </motion.div>

            {/* Instagram Link */}
            <motion.div 
              initial={{opacity: 0}} 
              animate={{opacity: 1}} 
              transition={{delay: 0.8}} 
              className="mt-6 pt-6 border-t border-slate-100 flex justify-center"
            >
              <a 
                href="https://www.instagram.com/robomind_br" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center w-10 h-10 bg-slate-50 hover:bg-slate-150 text-slate-500 hover:text-brand-600 border border-slate-200/60 rounded-xl transition-all duration-300 cursor-pointer shadow-sm active:scale-95"
                title="Siga-nos no Instagram"
              >
                <Instagram size={18} className="text-pink-600" />
              </a>
            </motion.div>

          </div>
        </div>
      </div>

    </div>
  );
}

