import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, 
  User, 
  ShoppingBag, 
  Trophy, 
  Users, 
  LayoutDashboard, 
  LogOut, 
  Menu, 
  X,
  Zap,
  Award,
  ChevronLeft,
  ChevronRight,
  Bell
} from 'lucide-react';
import NotificationCenter from './NotificationCenter';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Layout() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const collapseTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startCollapseTimer = () => {
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    if (!isCollapsed) {
      collapseTimerRef.current = setTimeout(() => {
        setIsCollapsed(true);
      }, 30000); // Increased to 30 seconds for better UX
    }
  };

  const clearCollapseTimer = () => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
  };

  useEffect(() => {
    startCollapseTimer();
    return () => clearCollapseTimer();
  }, [isCollapsed]);

  const handleMouseEnter = () => {
    clearCollapseTimer();
  };

  const handleMouseLeave = () => {
    startCollapseTimer();
  };

  useEffect(() => {
    const fetchRole = async () => {
      if (auth.currentUser && auth.currentUser.email) {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.email));
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role);
        }
      }
    };
    fetchRole();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: Home },
    { name: 'Desafios', path: '/challenges', icon: Zap },
    { name: 'Loja Maker', path: '/store', icon: ShoppingBag },
    { name: 'Leaderboard', path: '/ranking', icon: Trophy },
    { name: 'Comunidade', path: '/teams', icon: Users },
  ];

  if (userRole === 'admin') {
    navItems.push({ name: 'Administração', path: '/admin', icon: LayoutDashboard });
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-deep-black dark:text-slate-100 flex flex-col md:flex-row font-sans selection:bg-brand-500/30 selection:text-brand-600 dark:selection:text-brand-300">
      {/* Sticky Top Header (Mobile & Tablet) */}
      <header className="md:hidden glass-strong p-3 flex items-center justify-between sticky top-0 z-50 border-b border-slate-200 dark:border-white/5">
        <Link to="/" className="flex items-center gap-2">
          <img src="https://makeroom2.vercel.app/lampLogo.svg" alt="Makeroom" className="w-8 h-8 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
          <span className="hidden sm:block font-extrabold text-xl tracking-tighter bg-gradient-to-r from-brand-600 to-brand-400 dark:from-brand-400 dark:to-brand-300 bg-clip-text text-transparent">MAKEROOM</span>
        </Link>
        <div className="flex items-center gap-2">
          <NotificationCenter />
          <Link to="/profile" className="w-10 h-10 glass rounded-xl flex items-center justify-center overflow-hidden border border-brand-500/20">
            <img 
              className="w-full h-full object-cover"
              src={auth.currentUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${auth.currentUser?.email}`} 
              alt="User" 
            />
          </Link>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="w-10 h-10 flex items-center justify-center glass rounded-xl text-brand-600 dark:text-brand-400">
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Sidebar Navigation (Glassmorphism) */}
      <aside 
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "fixed inset-0 z-[60] glass-strong border-r border-slate-200 dark:border-white/5 transform transition-all duration-500 ease-out md:relative md:translate-x-0 hidden md:block",
          isCollapsed ? "md:w-20" : "md:w-64"
        )}
      >
        <div className="p-4 flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between mb-8 px-1">
            <Link to="/" className={cn("flex items-center gap-3 transition-all duration-500 group", isCollapsed && "md:opacity-0 md:pointer-events-none")}>
              <img src="https://makeroom2.vercel.app/logo.svg" alt="Makeroom" className="w-9 h-9 min-w-[36px] drop-shadow-[0_0_12px_rgba(249,115,22,0.6)] group-hover:scale-110 transition-transform" />
              <span className="font-black text-xl tracking-tighter bg-gradient-to-r from-brand-600 to-brand-400 dark:from-brand-400 dark:to-brand-300 bg-clip-text text-transparent italic">MAKEROOM</span>
            </Link>
            {isCollapsed && (
              <img 
                src="https://makeroom2.vercel.app/logo.svg" 
                alt="Makeroom" 
                className="w-9 h-9 absolute left-1/2 -translate-x-1/2 top-7 md:block hidden animate-pulse-subtle drop-shadow-[0_0_12px_rgba(249,115,22,0.6)]" 
              />
            )}
          </div>

          <nav className="flex-1 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMenuOpen(false)}
                  className={cn(
                    "flex items-center px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden",
                    isCollapsed ? "justify-center" : "gap-4",
                    isActive 
                      ? "bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold border border-brand-500/20 shadow-[inset_0_0_20px_rgba(249,115,22,0.05)]" 
                      : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  {isActive && <motion.div layoutId="activeNav" className="absolute left-0 top-0 bottom-0 w-1 bg-brand-500 shadow-[0_0_15px_rgba(249,115,22,0.8)]" />}
                  <Icon className={cn("w-5 h-5 min-w-[20px] transition-transform group-hover:scale-110", isActive ? "text-brand-600 dark:text-brand-400" : "text-slate-400 dark:text-slate-500")} />
                  {!isCollapsed && (
                    <span className="transition-all duration-500 whitespace-nowrap overflow-hidden font-medium tracking-tight">
                      {item.name}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto pt-6 border-t border-slate-200 dark:border-white/5 space-y-2">
            <button
              onClick={handleLogout}
              className={cn(
                "flex w-full items-center py-3 px-4 text-slate-500 dark:text-slate-400 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 rounded-xl transition-all duration-300 group",
                isCollapsed ? "justify-center" : "gap-4"
              )}
            >
              <LogOut className="w-5 h-5 min-w-[20px] group-hover:rotate-12 transition-transform" />
              {!isCollapsed && (
                <span className="transition-all duration-500 whitespace-nowrap overflow-hidden font-medium">
                  Desconectar
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Improved Collapse Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:flex absolute -right-4 top-20 w-8 h-8 glass-strong border border-slate-200 dark:border-white/10 rounded-full items-center justify-center text-brand-600 dark:text-brand-400 hover:text-brand-400 dark:hover:text-brand-300 hover:scale-110 transition-all duration-300 z-[70] shadow-xl"
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </aside>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[80] md:hidden"
              onClick={() => setIsMenuOpen(false)}
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-[80%] max-w-sm glass-strong z-[90] p-6 flex flex-col md:hidden"
            >
              <div className="flex items-center justify-between mb-10">
                <Link to="/" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2">
                  <img src="https://makeroom2.vercel.app/logo.svg" alt="Makeroom" className="w-8 h-8" />
                  <span className="font-black text-xl tracking-tighter bg-gradient-to-r from-brand-600 to-brand-400 dark:from-brand-400 dark:to-brand-300 bg-clip-text text-transparent">MAKEROOM</span>
                </Link>
                <button onClick={() => setIsMenuOpen(false)} className="p-2 glass rounded-xl text-slate-500 dark:text-slate-400">
                  <X size={20} />
                </button>
              </div>
              <nav className="space-y-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-black/5 dark:bg-white/5 text-slate-900 dark:text-slate-200 border border-slate-100 dark:border-white/5"
                    >
                      <Icon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                      <span className="font-bold">{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-screen relative overflow-x-hidden">
        {/* Sticky Desktop Header */}
        <header className="hidden md:flex h-20 items-center justify-end px-8 glass sticky top-0 z-40 border-b border-slate-200 dark:border-white/5">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-white/5 px-4 py-2 rounded-full border border-slate-200 dark:border-white/5">
              <Zap size={14} className="text-brand-600 dark:text-brand-400 animate-pulse" />
              <span className="text-xs font-mono font-bold tracking-widest text-slate-500 dark:text-slate-400 uppercase">System Online</span>
            </div>
            <NotificationCenter />
            <div className="h-8 w-px bg-slate-200 dark:bg-white/10" />
            <Link to="/profile" className="flex items-center gap-3 group">
              <div className="overflow-hidden">
                <img 
                  className="rounded-[100px] border border-brand-500/30 w-8 h-8 object-cover"
                  src={auth.currentUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${auth.currentUser?.email}`} 
                  alt="User" 
                />
              </div>
              <span className="text-sm font-bold text-slate-600 dark:text-slate-300 group-hover:text-brand-600 dark:group-hover:text-white transition-colors">{auth.currentUser?.displayName?.split(' ')[0] || 'Maker'}</span>
            </Link>
          </div>
        </header>

        <section className="flex-1 px-2 py-8 md:p-8 relative">
          {/* Animated Background Particle/Circuit Overlay */}
          <div className="absolute inset-0 -z-10 opacity-[0.03] dark:opacity-[0.03] pointer-events-none select-none">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
                  <path d="M 100 0 L 0 0 0 100" fill="none" stroke="currentColor" strokeWidth="1"/>
                  <circle cx="0" cy="0" r="2" fill="currentColor" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" className="text-slate-900 dark:text-white" />
            </svg>
          </div>

          <div className="max-w-7xl mx-auto relative">
            <Outlet />
          </div>
        </section>

        {/* Breadcrumbs Placeholder */}
        <footer className="p-4 md:px-8 md:py-6 border-t border-slate-200 dark:border-white/5 text-[10px] uppercase tracking-[0.2em] font-mono text-slate-400 dark:text-slate-600 flex justify-between items-center">
          <div className="flex gap-4">
            <span>Terminal: 001</span>
            <span>Auth: Verified</span>
          </div>
          <div className="hidden md:block">
            © 2026 MAKEROOM // Building the future with robotics
          </div>
        </footer>
      </main>

    </div>
  );
}

