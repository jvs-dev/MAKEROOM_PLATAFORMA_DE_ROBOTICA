import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useRef } from 'react';
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
      }, 30000); // 30 seconds
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
    { name: 'Início', path: '/', icon: Home },
    { name: 'Desafios', path: '/challenges', icon: Zap },
    { name: 'Loja', path: '/store', icon: ShoppingBag },
    { name: 'Ranking', path: '/ranking', icon: Trophy },
    { name: 'Turma', path: '/teams', icon: Users },
    { name: 'Perfil', path: '/profile', icon: User },
  ];

  if (userRole === 'admin') {
    navItems.push({ name: 'Admin', path: '/admin', icon: LayoutDashboard });
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden bg-white border-b border-slate-200 p-3 flex items-center justify-between sticky top-0 z-50">
        <Link to="/" className="flex items-center gap-2">
          <img src="https://makeroom2.vercel.app/logo.svg" alt="Makeroom" className="w-8 h-8" referrerPolicy="no-referrer" />
          <span className="font-bold text-slate-900">Makeroom</span>
        </Link>
        <div className="flex items-center gap-3">
          <NotificationCenter />
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-slate-600">
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      {/* Sidebar Navigation */}
      <aside 
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "fixed inset-0 z-40 bg-white border-r border-slate-200 transform transition-all duration-300 ease-in-out md:relative md:translate-x-0",
          isMenuOpen ? "translate-x-0" : "-translate-x-full",
          isCollapsed ? "md:w-20" : "md:w-64"
        )}
      >
        <div className="p-4 flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between mb-10 px-2">
            <Link to="/" className={cn("flex items-center gap-3 transition-opacity duration-300", isCollapsed && "md:opacity-0 md:pointer-events-none")}>
              <img src="https://makeroom2.vercel.app/logo.svg" alt="Makeroom" className="w-10 h-10 min-w-[40px]" referrerPolicy="no-referrer" />
              <span className="font-bold text-xl text-slate-900 whitespace-nowrap">Makeroom</span>
            </Link>
            {isCollapsed && (
              <img 
                src="https://makeroom2.vercel.app/logo.svg" 
                alt="Makeroom" 
                className="w-10 h-10 absolute left-5 top-4 md:block hidden" 
                referrerPolicy="no-referrer" 
              />
            )}
          </div>

          <nav className="flex-1 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMenuOpen(false)}
                  title={isCollapsed ? item.name : undefined}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative",
                    isActive 
                      ? "bg-brand-50 text-brand-600 font-semibold" 
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <Icon className={cn("w-5 h-5 min-w-[20px]", isActive ? "text-brand-600" : "text-slate-400")} />
                  <span className={cn(
                    "transition-all duration-300 whitespace-nowrap overflow-hidden",
                    isCollapsed ? "md:w-0 md:opacity-0" : "w-auto opacity-100"
                  )}>
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-1 pt-4 border-t border-slate-100">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 px-4 py-3 text-slate-600 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all duration-200"
            >
              <LogOut className="w-5 h-5 text-slate-400 min-w-[20px]" />
              <span className={cn(
                "transition-all duration-300 whitespace-nowrap overflow-hidden",
                isCollapsed ? "md:w-0 md:opacity-0" : "w-auto opacity-100"
              )}>
                Sair
              </span>
            </button>
          </div>
        </div>

        {/* Collapse Toggle Button (Desktop Only) */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:flex absolute -right-3 top-12 w-6 h-6 bg-white border border-slate-200 rounded-full items-center justify-center text-slate-400 hover:text-brand-600 hover:border-brand-600 transition-all duration-200 z-50 shadow-sm"
          title={isCollapsed ? "Expandir" : "Recolher"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-3 md:p-8 overflow-y-auto relative">
        <div className="hidden md:flex absolute top-8 right-8 z-50">
          <NotificationCenter />
        </div>
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Mobile Overlay */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsMenuOpen(false)}
        />
      )}
    </div>
  );
}
