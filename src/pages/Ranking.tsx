import { useEffect, useState } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Trophy, Medal, User, Zap, ChevronRight } from 'lucide-react';

interface RankUser {
  uid: string;
  name: string;
  points: number;
  role: string;
  schoolId?: string | null;
  photoURL?: string;
  medals?: { type: 'gold' | 'silver' | 'bronze'; date: string }[];
}

export default function Ranking() {
  const [topUsers, setTopUsers] = useState<RankUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userSchoolId, setUserSchoolId] = useState<string | null>(null);
  const [filterBySchool, setFilterBySchool] = useState(true);
  const [allUsers, setAllUsers] = useState<RankUser[]>([]);

  const currentMonthLabel = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  useEffect(() => {
    const fetchRanking = async () => {
      try {
        let currentSchoolId = null;
        if (auth.currentUser?.email) {
          const userDoc = await getDoc(doc(db, 'users', auth.currentUser.email));
          if (userDoc.exists()) {
            currentSchoolId = userDoc.data().schoolId || null;
            setUserSchoolId(currentSchoolId);
          }
        }

        const snapshot = await getDocs(collection(db, 'users'));
        const usersList = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as RankUser));
        setAllUsers(usersList);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'users');
      }
      setIsLoading(false);
    };

    fetchRanking();
  }, []);

  useEffect(() => {
    if (allUsers.length > 0) {
      const filteredUsers = allUsers.filter(user => 
        !filterBySchool || !userSchoolId || user.schoolId === userSchoolId
      );

      const sortedUsers = filteredUsers
        .sort((a, b) => (b.points || 0) - (a.points || 0))
        .slice(0, 10);
        
      setTopUsers(sortedUsers);
    }
  }, [allUsers, filterBySchool, userSchoolId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
      <header className="bg-white p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-1 md:mb-2">Hall da Fama 🏆</h1>
          <p className="text-sm md:text-base text-slate-500">Os maiores makers da nossa comunidade.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 md:gap-4 w-full md:w-auto">
          {userSchoolId && (
            <button
              onClick={() => setFilterBySchool(!filterBySchool)}
              className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all ${
                filterBySchool 
                ? 'bg-brand-500 text-white shadow-lg shadow-brand-100' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {filterBySchool ? 'Minha Escola' : 'Ranking Global'}
            </button>
          )}
          <div className="w-full sm:w-auto bg-brand-50 p-3 md:p-4 rounded-xl md:rounded-2xl flex items-center justify-center md:justify-start gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-brand-500 rounded-lg md:rounded-xl flex items-center justify-center shadow-md shadow-brand-100">
              <Trophy className="text-white w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <p className="text-[10px] text-brand-600 font-bold uppercase tracking-wider">Temporada</p>
              <p className="text-sm md:text-base text-slate-900 font-bold capitalize">{currentMonthLabel}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
        {topUsers.slice(0, 3).map((user, index) => {
          const colors = [
            'bg-yellow-400 text-yellow-900 shadow-yellow-100',
            'bg-slate-300 text-slate-700 shadow-slate-100',
            'bg-amber-600 text-amber-50 shadow-amber-100'
          ];
          const icons = [Trophy, Medal, Medal];
          const Icon = icons[index];

          return (
            <div key={user.uid} className={`p-6 md:p-8 rounded-[32px] md:rounded-[40px] shadow-xl md:shadow-2xl flex flex-col items-center text-center relative overflow-hidden transition-all duration-500 ${index === 0 ? 'bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-600 text-white md:scale-110 z-10 ring-4 ring-yellow-400/20 order-first md:order-none' : 'bg-white text-slate-900 border border-slate-100'}`}>
              <div className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-3xl flex items-center justify-center mb-4 md:mb-6 shadow-xl ${colors[index]} ${index === 0 ? 'bg-white/20 backdrop-blur-md border border-white/30' : ''}`}>
                <Icon className={`w-8 h-8 md:w-10 md:h-10 ${index === 0 ? 'text-white drop-shadow-md' : ''}`} />
              </div>
              <div className="mb-3 md:mb-4">
                <p className={`text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] mb-1 md:mb-2 ${index === 0 ? 'text-yellow-100' : 'text-slate-400'}`}>
                  {index + 1}° Lugar
                </p>
                <h3 className={`text-xl md:text-2xl font-black leading-tight ${index === 0 ? 'drop-shadow-sm' : ''}`}>{user.name}</h3>
              </div>
              <div className={`flex items-center gap-2 font-black text-lg md:text-xl px-5 md:px-6 py-1.5 md:py-2 rounded-xl md:rounded-2xl ${index === 0 ? 'bg-black/10 backdrop-blur-sm text-white' : 'text-brand-600 bg-brand-50'}`}>
                <Zap className={`w-5 h-5 md:w-6 md:h-6 ${index === 0 ? 'text-yellow-200 fill-yellow-200' : 'text-brand-500 fill-brand-500'}`} />
                {user.points} <span className="text-[10px] md:text-xs font-bold uppercase opacity-70">pts</span>
              </div>
              {index === 0 && (
                <>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-amber-900/20 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl md:rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 md:p-6 border-b border-slate-50 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-2">
          <h2 className="text-base md:text-lg font-bold text-slate-900">Top 10 Makers {filterBySchool && userSchoolId ? '(Sua Escola)' : '(Global)'}</h2>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Atualizado em tempo real</span>
        </div>
        <div className="divide-y divide-slate-50">
          {topUsers.map((user, index) => (
            <div key={user.uid} className="p-4 md:p-6 flex items-center gap-3 md:gap-6 hover:bg-slate-50 transition-colors group">
              <div className="w-6 md:w-8 text-center font-bold text-sm md:text-base text-slate-400 group-hover:text-brand-500 transition-colors">
                {index + 1}
              </div>
              <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-100 rounded-lg md:rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                <img 
                  src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                  alt={user.name} 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm md:text-base text-slate-900 truncate">{user.name}</h3>
                  {user.medals && user.medals.length > 0 && (
                    <div className="flex -space-x-1 shrink-0">
                      {user.medals.slice(0, 3).map((m, i) => (
                        <span key={i} className="text-xs" title={`${m.type === 'gold' ? 'Ouro' : m.type === 'silver' ? 'Prata' : 'Bronze'} - ${m.date}`}>
                          {m.type === 'gold' ? '🥇' : m.type === 'silver' ? '🥈' : '🥉'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Estudante</p>
              </div>
              <div className="flex items-center gap-1.5 md:gap-2 font-bold text-sm md:text-base text-slate-900 shrink-0">
                <Zap className="w-3.5 h-3.5 md:w-4 md:h-4 text-brand-500 fill-brand-500" />
                {user.points}
              </div>
              <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-slate-200 group-hover:text-brand-500 transition-colors shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
