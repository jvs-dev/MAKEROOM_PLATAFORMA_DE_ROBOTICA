import { useEffect, useState } from 'react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Users, User, Shield, Zap, Mail, ChevronRight } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  studentIds: string[];
}

interface Student {
  uid: string;
  name: string;
  email: string;
  points: number;
  photoURL?: string;
}

export default function Teams() {
  const [team, setTeam] = useState<Team | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTeamData = async () => {
      if (auth.currentUser && auth.currentUser.email) {
        try {
          const userDoc = await getDoc(doc(db, 'users', auth.currentUser.email));
          if (userDoc.exists()) {
            const teamId = userDoc.data().teamId;
            if (teamId) {
              const teamDoc = await getDoc(doc(db, 'teams', teamId));
              if (teamDoc.exists()) {
                const teamData = { id: teamDoc.id, ...teamDoc.data() } as Team;
                setTeam(teamData);

                // Fetch students in the team
                try {
                  const studentsQuery = query(collection(db, 'users'), where('teamId', '==', teamId));
                  const studentsSnapshot = await getDocs(studentsQuery);
                  const studentsList = studentsSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as Student));
                  setStudents(studentsList);
                } catch (err) {
                  console.warn("Could not fetch team members:", err);
                  // If query fails, at least show the current user
                  setStudents([{
                    uid: auth.currentUser.uid,
                    name: userDoc.data().name,
                    email: userDoc.data().email,
                    points: userDoc.data().points || 0
                  }]);
                }
              }
            }
          }
        } catch (err) {
          console.error("Error fetching team data:", err);
        }
      }
      setIsLoading(false);
    };

    fetchTeamData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="max-w-2xl mx-auto text-center py-24 px-6 bg-white rounded-3xl shadow-sm border border-slate-100">
        <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-inner">
          <Users className="w-10 h-10 text-slate-300" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-4">Você ainda não está em uma turma.</h1>
        <p className="text-slate-500 mb-8">Peça a um administrador para adicioná-lo a uma turma para começar a colaborar com seus colegas.</p>
        <div className="flex flex-col items-center gap-4">
          <div className="bg-brand-50 p-4 rounded-2xl flex items-center gap-3 text-brand-600 font-medium">
            <Shield className="w-5 h-5" />
            <span>Somente administradores podem gerenciar turmas.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
      <header className="bg-white p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-1 md:mb-2">Minha Turma: {team.name} 👥</h1>
          <p className="text-sm md:text-base text-slate-500">Colabore e aprenda junto com seus colegas de equipe.</p>
        </div>
        <div className="w-full md:w-auto bg-brand-50 p-3 md:p-4 rounded-xl md:rounded-2xl flex items-center justify-center md:justify-start gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-brand-500 rounded-lg md:rounded-xl flex items-center justify-center shadow-md shadow-brand-100">
            <Users className="text-white w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div>
            <p className="text-[10px] text-brand-600 font-bold uppercase tracking-wider">Membros</p>
            <p className="text-sm md:text-base text-slate-900 font-bold">{students.length} Estudantes</p>
          </div>
        </div>
      </header>

      <div className="bg-white rounded-2xl md:rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 md:p-6 border-b border-slate-50 bg-slate-50/50">
          <h2 className="text-base md:text-lg font-bold text-slate-900">Membros da Turma</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {students.map((student) => (
            <div key={student.uid} className="p-4 md:p-6 flex items-center gap-3 md:gap-6 hover:bg-slate-50 transition-colors group">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-100 rounded-lg md:rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                <img 
                  src={student.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${student.uid}`} 
                  alt={student.name} 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm md:text-base text-slate-900 truncate">{student.name}</h3>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-0.5 md:mt-1">
                  <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-slate-400">
                    <Mail className="w-3 md:w-3.5 h-3 md:h-3.5" />
                    <span className="truncate">{student.email}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-brand-500 font-bold">
                    <Zap className="w-3 md:w-3.5 h-3 md:h-3.5 fill-brand-500" />
                    <span>{student.points} pts</span>
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-slate-200 group-hover:text-brand-500 transition-colors shrink-0" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
        <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-sm border border-slate-100">
          <h2 className="text-lg md:text-xl font-bold text-slate-900 mb-4 md:mb-6 flex items-center gap-2 md:gap-3">
            <Zap className="w-5 h-5 md:w-6 md:h-6 text-brand-500" /> Desempenho Coletivo
          </h2>
          <p className="text-sm md:text-base text-slate-500 mb-6 md:mb-8">Sua turma acumulou um total de <span className="font-bold text-slate-900">{students.reduce((acc, s) => acc + s.points, 0)} pontos</span> nesta temporada.</p>
          <div className="w-full bg-slate-100 h-3 md:h-4 rounded-full overflow-hidden">
            <div className="bg-brand-500 h-full w-[65%] rounded-full shadow-lg shadow-brand-100" />
          </div>
          <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-3 md:mt-4 text-center">65% da meta mensal atingida</p>
        </div>

        <div className="bg-slate-900 p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-xl shadow-slate-200 text-white relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-lg md:text-xl font-bold mb-3 md:mb-4">Próxima Aula Presencial</h2>
            <div className="flex items-center gap-3 mb-4 md:mb-6">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-white/10 rounded-lg md:rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/10">
                <Shield className="w-5 h-5 md:w-6 md:h-6 text-brand-400" />
              </div>
              <div>
                <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest">Data & Hora</p>
                <p className="text-sm md:text-base font-bold">Sexta-feira, 21 de Março · 14:00</p>
              </div>
            </div>
            <p className="text-white/60 text-xs md:text-sm mb-6 md:mb-8">Prepare seus kits de robótica e traga suas dúvidas sobre sensores ultrassônicos!</p>
            <button className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-2.5 md:py-3 rounded-xl md:rounded-2xl transition-all shadow-lg shadow-brand-500/20 text-sm md:text-base">
              Confirmar Presença
            </button>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        </div>
      </div>
    </div>
  );
}
