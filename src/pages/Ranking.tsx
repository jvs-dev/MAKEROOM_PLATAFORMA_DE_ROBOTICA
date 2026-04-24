import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { 
  Trophy, 
  Medal, 
  User, 
  Zap, 
  ChevronRight, 
  Search, 
  ArrowUp, 
  ArrowDown, 
  Minus,
  Sparkles,
  Timer,
  Crown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';

interface RankUser {
  uid: string;
  name: string;
  points: number;
  role: string;
  schoolId?: string | null;
  photoURL?: string;
  medals?: { type: 'gold' | 'silver' | 'bronze'; date: string }[];
}

interface PrizeConfig {
  is_active: boolean;
  prize_name: string;
  prize_description: string;
  prize_image_url: string;
  season_end_date?: string;
}

export default function Ranking() {
  const [topUsers, setTopUsers] = useState<RankUser[]>([]);
  const [allUsers, setAllUsers] = useState<RankUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userSchoolId, setUserSchoolId] = useState<string | null>(null);
  const [filterBySchool, setFilterBySchool] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [prizeConfig, setPrizeConfig] = useState<PrizeConfig | null>(null);

  const currentMonthLabel = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  
  // Calculate days left in month
  const today = new Date();
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const daysLeft = Math.ceil((lastDayOfMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const progressPercent = Math.min(100, Math.max(0, (today.getDate() / lastDayOfMonth.getDate()) * 100));

  useEffect(() => {
    let currentSchoolId = null;
    const fetchUserSchool = async () => {
      if (auth.currentUser?.email) {
        try {
          const userDoc = await getDoc(doc(db, 'users', auth.currentUser.email));
          if (userDoc.exists()) {
            currentSchoolId = userDoc.data().schoolId || null;
            setUserSchoolId(currentSchoolId);
          }
        } catch (err) {
          console.error("Error fetching user school:", err);
        }
      }
    };
    fetchUserSchool();

    const unsubscribeRanking = onSnapshot(collection(db, 'public_profiles'), (snapshot) => {
      const usersList = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          uid: doc.id, 
          name: data.displayName || 'Maker',
          points: data.points || 0,
          role: data.role || 'student',
          schoolId: data.schoolId,
          photoURL: data.photoURL
        } as RankUser;
      });
      setAllUsers(usersList);
      setIsLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'public_profiles');
      setIsLoading(false);
    });

    // Prize listener
    const unsubscribePrize = onSnapshot(
      doc(db, 'settings', 'ranking_prize'), 
      (doc) => {
        if (doc.exists()) {
          setPrizeConfig(doc.data() as PrizeConfig);
        }
      },
      (err) => {
        console.error("Error listening to prize config:", err);
      }
    );

    return () => {
      unsubscribeRanking();
      unsubscribePrize();
    };
  }, []);

  const filteredAndSorted = useMemo(() => {
    const base = allUsers.filter(user => 
      (!filterBySchool || !userSchoolId || user.schoolId === userSchoolId) &&
      (user.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return base.sort((a, b) => (b.points || 0) - (a.points || 0));
  }, [allUsers, filterBySchool, userSchoolId, searchQuery]);

  useEffect(() => {
    setTopUsers(filteredAndSorted);
  }, [filteredAndSorted]);

  // Confetti effect for 1st place
  useEffect(() => {
    if (!isLoading && topUsers.length > 0) {
      const timer = setTimeout(() => {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#FFD700', '#FFA500', '#ffffff'],
          disableForReducedMotion: true
        });
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [isLoading, topUsers.length]);

  const SkeletonRow = () => (
    <div className="p-4 md:p-6 flex items-center gap-4 animate-pulse">
      <div className="w-8 h-8 bg-slate-100 dark:bg-white/5 rounded-full" />
      <div className="w-12 h-12 bg-slate-100 dark:bg-white/5 rounded-xl" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-100 dark:bg-white/5 rounded w-1/3" />
        <div className="h-3 bg-slate-100 dark:bg-white/5 rounded w-1/4" />
      </div>
      <div className="w-16 h-8 bg-slate-100 dark:bg-white/5 rounded-xl" />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* SEASON HEADER WITH PROGRESS */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative group bg-white dark:bg-zinc-900 p-8 rounded-[32px] shadow-sm border border-slate-100 dark:border-white/10 overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-transparent to-brand-500/5 opacity-50 group-hover:opacity-100 transition-opacity duration-700" />
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="text-center md:text-left">
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Hall da Fama 🏆</h1>
            <p className="text-slate-500 dark:text-zinc-400 font-medium">Os maiores makers da nossa comunidade.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            {userSchoolId && (
              <button
                onClick={() => setFilterBySchool(!filterBySchool)}
                className={`w-full sm:w-auto px-8 py-3 rounded-2xl font-black text-sm transition-all duration-300 ${
                  filterBySchool 
                  ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' 
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
                }`}
              >
                {filterBySchool ? 'Minha Escola' : 'Global'}
              </button>
            )}
            
            <div className="w-full sm:w-auto bg-slate-50 dark:bg-black/20 p-5 rounded-2xl border border-slate-200 dark:border-white/5 min-w-[240px]">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[10px] text-brand-600 dark:text-brand-400 font-black uppercase tracking-widest leading-none mb-1">Temporada</p>
                  <p className="text-sm text-slate-900 dark:text-white font-bold capitalize">{currentMonthLabel}</p>
                </div>
                <div className="flex items-center gap-2 bg-brand-500/10 text-brand-500 px-3 py-1.5 rounded-lg">
                  <Timer size={14} className="animate-spin-slow" />
                  <span className="text-xs font-black">{daysLeft}d</span>
                </div>
              </div>
              <div className="h-2 w-full bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="h-full bg-brand-500 shadow-[0_0_10px_rgba(232,100,42,0.5)]"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-2 font-medium">Temporada em {Math.round(progressPercent)}% de progresso</p>
            </div>
          </div>
        </div>
      </motion.header>

      {/* PRIZE BANNER */}
      {prizeConfig?.is_active && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden group rounded-[2rem] p-[1px]"
        >
          {/* Animated border shimmer */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-400 to-transparent opacity-50" />
          
          <div className="relative bg-[#0d0d0f] border border-white/5 rounded-[2rem] overflow-hidden flex flex-col md:flex-row items-center">
            {/* Left Accent */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-500 shadow-[2px_0_10px_rgba(249,113,22,0.3)] hidden md:block" />
            
            <div className="flex-1 p-6 md:p-8 flex flex-col justify-center gap-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="bg-brand-500/10 text-brand-500 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border border-brand-500/20">
                  Evento Especial
                </div>
                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1">
                  <Timer size={10} /> {daysLeft} dias restantes
                </div>
              </div>

              <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight leading-none mb-1 group-hover:text-brand-400 transition-colors">
                {prizeConfig.prize_name}
              </h3>
              
              <p className="text-zinc-400 text-xs md:text-sm font-medium max-w-lg mb-6 leading-relaxed line-clamp-2">
                {prizeConfig.prize_description}
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                <button className="w-full sm:w-auto px-8 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-brand-500/20 active:scale-95 flex items-center justify-center gap-2">
                  <Trophy size={14} /> Fique em 1º para ganhar
                </button>
                <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase">
                  <span>Recompensa:</span>
                  <span className="text-white bg-white/5 px-2 py-1 rounded-md border border-white/10 uppercase">
                    1x {prizeConfig.prize_name}
                  </span>
                </div>
              </div>
            </div>

            {/* Prize Image Container */}
            <div className="hidden md:block md:w-64 h-48 md:h-full relative bg-zinc-900/50 flex-shrink-0 group-hover:bg-zinc-900/80 transition-colors duration-500">
              <div className="absolute inset-0 bg-brand-500/5 mix-blend-overlay" />
              <div className="w-full h-full p-6 relative flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-l from-[#0d0d0f] via-transparent to-transparent md:bg-gradient-to-l md:from-black md:via-transparent md:to-transparent z-10 pointer-events-none" />
                
                {prizeConfig.prize_image_url ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img 
                      src={prizeConfig.prize_image_url} 
                      alt="Prêmio" 
                      className="max-w-full max-h-full object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,0.5)] transform group-hover:scale-110 group-hover:rotate-3 transition-transform duration-700" 
                      referrerPolicy="no-referrer" 
                    />
                    <div className="absolute -bottom-2 -left-2 bg-zinc-950/80 backdrop-blur-sm border border-white/10 p-2 rounded-lg z-20 hidden md:block">
                      <Sparkles size={16} className="text-brand-500" />
                    </div>
                  </div>
                ) : (
                  <Trophy size={64} className="text-zinc-800" />
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* PODIUM SECTION */}
      <div className="flex items-end justify-center gap-2 md:gap-4 pt-12 md:pt-20 pb-12 overflow-x-auto no-scrollbar px-2 [perspective:1200px]">
        {/* 2nd Place */}
        <div className="order-1 md:order-1 flex-1 min-w-[100px] max-w-[200px]">
          <PodiumCard 
            user={topUsers[1]} 
            rank={2} 
            delay={0.2} 
            color="silver" 
            isCurrentUser={topUsers[1]?.uid === auth.currentUser?.uid} 
          />
        </div>
        
        {/* 1st Place */}
        <div className="order-2 md:order-2 flex-1 min-w-[120px] max-w-[240px]">
          <PodiumCard 
            user={topUsers[0]} 
            rank={1} 
            delay={0.4} 
            color="gold" 
            isCurrentUser={topUsers[0]?.uid === auth.currentUser?.uid} 
          />
        </div>
        
        {/* 3rd Place */}
        <div className="order-3 md:order-3 flex-1 min-w-[100px] max-w-[200px]">
          <PodiumCard 
            user={topUsers[2]} 
            rank={3} 
            delay={0.6} 
            color="bronze" 
            isCurrentUser={topUsers[2]?.uid === auth.currentUser?.uid} 
          />
        </div>
      </div>

      {/* TOP 10 LIST */}
      <div className="bg-white dark:bg-zinc-900 rounded-[40px] shadow-sm border border-slate-100 dark:border-white/10 overflow-hidden">
        <div className="p-8 border-b border-slate-50 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Ranking de Makers</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">{filterBySchool ? 'Sua Escola' : 'Ranking Global'}</p>
          </div>
          
          <div className="relative w-full md:w-72">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por nome..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all font-medium"
            />
          </div>
        </div>

        <div className="divide-y divide-slate-50 dark:divide-white/5">
          {isLoading ? (
            Array(7).fill(0).map((_, i) => <SkeletonRow key={i} />)
          ) : (
            <AnimatePresence mode="popLayout">
              {topUsers.length > 0 ? (
                topUsers.map((user, index) => (
                  <RankRow 
                    key={user.uid} 
                    user={user} 
                    index={index} 
                    isCurrentUser={user.uid === auth.currentUser?.uid}
                  />
                ))
              ) : (
                <div className="p-12 text-center text-slate-400 italic">
                  Nenhum maker encontrado com este nome.
                </div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}

function PodiumCard({ user, rank, delay, color, isCurrentUser }: { user?: RankUser, rank: number, delay: number, color: string, isCurrentUser: boolean }) {
  if (!user) return null;

  const ringColors = {
    gold: "border-[#FFD700] ring-[#FFD700]/20",
    silver: "border-[#C0C0C0] ring-[#C0C0C0]/20",
    bronze: "border-[#CD7F32] ring-[#CD7F32]/20"
  };

  const blockConfigs = {
    1: { 
      height: "h-36 md:h-52", 
      color: "bg-gradient-to-b from-[#2a240a] to-[#0d0d0f]", 
      border: "border-yellow-500/30", 
      textSize: "text-6xl md:text-8xl"
    },
    2: { 
      height: "h-24 md:h-36", 
      color: "bg-gradient-to-b from-[#1a1a1d] to-[#0d0d0f]", 
      border: "border-zinc-500/20", 
      textSize: "text-5xl md:text-6xl"
    },
    3: { 
      height: "h-16 md:h-24", 
      color: "bg-gradient-to-b from-[#1c160c] to-[#0d0d0f]", 
      border: "border-amber-900/20", 
      textSize: "text-4xl md:text-5xl"
    }
  };

  const config = blockConfigs[rank as keyof typeof blockConfigs];

  return (
    <div className="relative flex flex-col items-center w-full group">
      {/* Avatar Section (Floats Above) */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: delay + 0.3, ease: "backOut" }}
        className="relative z-10 flex flex-col items-center mb-2 md:mb-4 px-1"
      >
        {rank === 1 && (
          <motion.div 
            animate={{ y: [0, -3, 0], rotate: [-2, 2, -2] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="absolute -top-6 md:-top-8 z-20"
          >
            <Crown size={28} className="text-yellow-500 fill-yellow-500 drop-shadow-[0_0_10px_rgba(255,215,0,0.6)]" />
          </motion.div>
        )}
        
        <div className={`w-12 h-12 md:w-20 md:h-20 rounded-full border-2 md:border-4 ${ringColors[color as keyof typeof ringColors].split(' ')[0]} p-1 shadow-2xl relative ring-4 ${ringColors[color as keyof typeof ringColors].split(' ')[1]}`}>
          <img 
            src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
            alt={user.name} 
            className="w-full h-full object-cover rounded-full bg-zinc-800 transition-transform group-hover:scale-110"
          />
          {isCurrentUser && (
            <div className="absolute -top-1 -right-1 bg-brand-500 w-3 h-3 md:w-5 md:h-5 rounded-full border-2 border-zinc-950 flex items-center justify-center">
              <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-white rounded-full animate-ping" />
            </div>
          )}
        </div>

        <div className="mt-2 text-center">
          <h3 className="text-[10px] md:text-sm font-black text-white uppercase tracking-tight truncate max-w-[80px] md:max-w-[140px] group-hover:text-brand-400 transition-colors">
            {user.name}
          </h3>
          <div className="flex items-center justify-center gap-1">
            <Zap size={8} className="text-brand-500 fill-brand-500 md:w-3 md:h-3" />
            <span className="text-[8px] md:text-xs font-black text-brand-500">{user.points} <span className="opacity-50 text-[6px] md:text-[8px]">PTS</span></span>
          </div>
        </div>
      </motion.div>

      {/* Podium Block (Rises from below) */}
      <motion.div
        initial={{ opacity: 0, scaleY: 0 }}
        animate={{ opacity: 1, scaleY: 1 }}
        transition={{ duration: 0.8, delay, ease: "easeOut" }}
        style={{ originY: 1 }}
        className={`w-full ${config.height} ${config.color} border-t border-x ${config.border} rounded-t-xl md:rounded-t-3xl relative flex flex-col items-center justify-start overflow-hidden transition-all duration-500 group-hover:brightness-110 [transform:rotateX(15deg)]`}
      >
        {/* Glossy overlay and side light highlights */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-white/[0.03] via-transparent to-white/[0.03] pointer-events-none" />
        
        <span className={`font-black tracking-tighter ${config.textSize} text-white/5 absolute top-0 select-none group-hover:text-white/10 transition-colors`}>
          {rank}
        </span>

        {isCurrentUser && (
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-brand-500 to-transparent shadow-[0_0_15px_rgba(232,100,42,0.6)]" />
        )}
      </motion.div>
    </div>
  );
}

function RankRow({ user, index, isCurrentUser }: { user: RankUser, index: number, isCurrentUser: boolean }) {
  const [isHovered, setIsHovered] = useState(false);

  // Random placeholder for rank change logic as per request
  const rankChange = useMemo(() => {
    const r = Math.random();
    if (r > 0.8) return 'up';
    if (r < 0.2) return 'down';
    return 'none';
  }, []);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative p-4 md:p-6 flex items-center gap-6 transition-all duration-300 group cursor-pointer ${
        isCurrentUser 
          ? 'bg-brand-500/5 border-l-4 border-brand-500' 
          : 'hover:bg-slate-50 dark:hover:bg-white/5 border-l-4 border-transparent'
      }`}
    >
      {/* Rank Indicator */}
      <div className="flex flex-col items-center gap-1 w-8 shrink-0">
        <span className={`font-black text-lg ${index < 3 ? 'text-brand-500' : 'text-slate-400 dark:text-zinc-600'}`}>
          {index + 1}
        </span>
        <div className="h-4 flex items-center justify-center">
          {rankChange === 'up' && <ArrowUp size={10} className="text-emerald-500" />}
          {rankChange === 'down' && <ArrowDown size={10} className="text-red-500" />}
          {rankChange === 'none' && <Minus size={10} className="text-slate-300 dark:text-zinc-800" />}
        </div>
      </div>

      {/* Avatar */}
      <div className="relative w-12 h-12 md:w-14 md:h-14 shrink-0">
        <div className="w-full h-full rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden relative z-10">
          <img 
            src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
            alt={user.name} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        </div>
        {isCurrentUser && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-zinc-900 rounded-full z-20" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <h3 className={`font-bold text-sm md:text-base truncate transition-colors ${isCurrentUser ? 'text-brand-600 dark:text-brand-400' : 'text-slate-900 dark:text-white group-hover:text-brand-500'}`}>
            {user.name}
            {isCurrentUser && <span className="ml-2 text-[10px] text-brand-500 font-black uppercase tracking-widest">(Você)</span>}
          </h3>
          {user.medals && user.medals.length > 0 && (
            <div className="flex -space-x-1 shrink-0">
              {user.medals.slice(0, 3).map((m, i) => (
                <span key={i} className="text-xs filter grayscale hover:grayscale-0 transition-all cursor-help" title={`${m.type} - ${m.date}`}>
                  {m.type === 'gold' ? '🥇' : m.type === 'silver' ? '🥈' : '🥉'}
                </span>
              ))}
            </div>
          )}
        </div>
        <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-black uppercase tracking-widest leading-none">Maker Estudante</p>
      </div>

      {/* Points */}
      <div className="flex items-center gap-8">
        <motion.div 
          animate={isHovered ? { scale: 1.1 } : { scale: 1 }}
          className={`flex items-center gap-2 font-black text-base md:text-lg ${isCurrentUser ? 'text-brand-500' : 'text-slate-900 dark:text-white'}`}
        >
          <Zap className="w-4 h-4 fill-brand-500 text-brand-500" />
          {user.points}
        </motion.div>

        <motion.button
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: isHovered ? 1 : 0, x: isHovered ? 0 : 10 }}
          className="hidden md:flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-black px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl"
        >
          Perfil <ChevronRight size={14} />
        </motion.button>
      </div>
    </motion.div>
  );
}
