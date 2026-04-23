import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, orderBy, limit, getDocs, where, getDoc, doc, onSnapshot, writeBatch, setDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../firebase';
import { 
  BookOpen, 
  ShoppingBag, 
  Zap, 
  Users, 
  FileText, 
  School, 
  CheckSquare, 
  Package,
  ChevronRight,
  LayoutDashboard,
  Loader2,
  AlertCircle,
  Award,
  Trophy,
  Star,
  Megaphone
} from 'lucide-react';

interface RecentActivity {
  id: string;
  type: 'user' | 'order' | 'submission';
  title: string;
  description: string;
  time: string;
  timestamp: Date;
}

interface PendingOrder {
  id: string;
  productNames: string[];
  status: string;
  userName: string;
}

export default function AdminDashboard() {
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [orderActivities, setOrderActivities] = useState<RecentActivity[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdmin = async () => {
      if (!auth.currentUser) {
        setIsAdmin(false);
        navigate('/');
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.email!));
        const userData = userDoc.data();
        const isUserAdmin = userData?.admin === true || auth.currentUser.email === 'jvssilv4@gmail.com';
        setIsAdmin(isUserAdmin);
        
        if (!isUserAdmin) {
          navigate('/');
        }
      } catch (err) {
        console.error("Error checking admin status:", err);
        setIsAdmin(false);
        navigate('/');
      }
    };

    checkAdmin();
  }, [navigate]);

  // Monthly Reset Logic
  useEffect(() => {
    const checkAndResetMonthlyPoints = async () => {
      if (isAdmin !== true) return;

      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      try {
        const metadataDoc = await getDoc(doc(db, 'metadata', 'system'));
        const lastResetMonth = metadataDoc.exists() ? metadataDoc.data().lastResetMonth : null;

        if (lastResetMonth !== currentMonth) {
          console.log('New month detected! Starting points reset and medal distribution...');
          setIsResetting(true);
          
          // 1. Fetch all users
          const usersSnapshot = await getDocs(collection(db, 'users'));
          const allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
          // 2. Find top 3 (only students)
          const students = allUsers.filter((u: any) => u.role === 'student' && (u.points || 0) > 0);
          const sortedStudents = [...students].sort((a: any, b: any) => (b.points || 0) - (a.points || 0));
          
          // 3. Award medals to top 3 and reset points
          // Split into smaller batches if needed (max 500 ops per batch)
          const batch = writeBatch(db);
          const lastMonthLabel = lastResetMonth ? new Date(lastResetMonth + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : 'Temporada Anterior';

          const medalTypes: ('gold' | 'silver' | 'bronze')[] = ['gold', 'silver', 'bronze'];
          
          // Award medals
          sortedStudents.slice(0, 3).forEach((student, index) => {
            const userRef = doc(db, 'users', student.id);
            batch.update(userRef, {
              medals: arrayUnion({
                type: medalTypes[index],
                date: lastMonthLabel
              })
            });
          });

          // Reset all users points and notify them
          allUsers.forEach((user: any) => {
            const userRef = doc(db, 'users', user.id);
            batch.update(userRef, { points: 0 });

            // Create notification
            const notificationRef = doc(collection(db, 'notifications'));
            batch.set(notificationRef, {
              userId: user.id,
              title: 'Nova Temporada Iniciada! 🚀',
              message: `Os pontos foram resetados para o início do mês. ${user.points > 0 ? `Você terminou a última temporada com ${user.points} pontos.` : ''} Boa sorte nesta nova jornada!`,
              read: false,
              createdAt: serverTimestamp()
            });
          });

          // 5. Update metadata
          batch.set(doc(db, 'metadata', 'system'), { lastResetMonth: currentMonth }, { merge: true });

          await batch.commit();
          console.log('Monthly reset completed successfully.');
          setIsResetting(false);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'metadata/system');
        setIsResetting(false);
      }
    };

    checkAndResetMonthlyPoints();
  }, [isAdmin]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!auth.currentUser || isAdmin === false) return;
      if (isAdmin === null) return; // Wait for check

      try {
        // Fetch users and sort in memory to avoid index requirement
        let allUsers: any[] = [];
        try {
          const usersSnapshot = await getDocs(collection(db, 'users'));
          allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (err) {
          handleFirestoreError(err, OperationType.LIST, 'users');
        }
        
        const sortedUsers = allUsers
          .filter((u: any) => u.createdAt)
          .sort((a: any, b: any) => {
            const dateA = a.createdAt?.toDate?.() || new Date(0);
            const dateB = b.createdAt?.toDate?.() || new Date(0);
            return dateB.getTime() - dateA.getTime();
          })
          .slice(0, 5);

        const userActivities: RecentActivity[] = sortedUsers.map((data: any) => {
          const createdAt = data.createdAt?.toDate?.() || new Date();
          const diff = Math.floor((new Date().getTime() - createdAt.getTime()) / 60000);
          const timeStr = diff < 60 ? `Há ${diff} min` : diff < 1440 ? `Há ${Math.floor(diff/60)}h` : `Há ${Math.floor(diff/1440)}d`;
          
          return {
            id: data.id,
            type: 'user',
            title: `Novo Maker`,
            description: `${data.name || 'Um novo aluno'} se juntou à plataforma.`,
            time: timeStr,
            timestamp: createdAt
          };
        });

        // Fetch orders and filter/sort in memory to avoid index requirement
        let allOrders: any[] = [];
        try {
          const ordersSnapshot = await getDocs(collection(db, 'orders'));
          allOrders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (err) {
          handleFirestoreError(err, OperationType.LIST, 'orders');
        }
        
        const orderActivities: RecentActivity[] = allOrders
          .filter((o: any) => o.createdAt)
          .sort((a: any, b: any) => {
            const dateA = a.createdAt?.toDate?.() || new Date(0);
            const dateB = b.createdAt?.toDate?.() || new Date(0);
            return dateB.getTime() - dateA.getTime();
          })
          .slice(0, 5)
          .map((data: any) => {
            const createdAt = data.createdAt?.toDate?.() || new Date();
            const diff = Math.floor((new Date().getTime() - createdAt.getTime()) / 60000);
            const timeStr = diff < 60 ? `Há ${diff} min` : diff < 1440 ? `Há ${Math.floor(diff/60)}h` : `Há ${Math.floor(diff/1440)}d`;
            
            return {
              id: data.id,
              type: 'order',
              title: `Novo Pedido`,
              description: `Um pedido de R$ ${data.total || 0} foi realizado.`,
              time: timeStr,
              timestamp: createdAt
            };
          });

        // Fetch submissions
        let allSubmissions: any[] = [];
        try {
          const submissionsSnapshot = await getDocs(collection(db, 'submissions'));
          allSubmissions = submissionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (err) {
          handleFirestoreError(err, OperationType.LIST, 'submissions');
        }

        const submissionActivities: RecentActivity[] = allSubmissions
          .filter((s: any) => s.createdAt)
          .sort((a: any, b: any) => {
            const dateA = a.createdAt?.toDate?.() || new Date(0);
            const dateB = b.createdAt?.toDate?.() || new Date(0);
            return dateB.getTime() - dateA.getTime();
          })
          .slice(0, 5)
          .map((data: any) => {
            const createdAt = data.createdAt?.toDate?.() || new Date();
            const diff = Math.floor((new Date().getTime() - createdAt.getTime()) / 60000);
            const timeStr = diff < 60 ? `Há ${diff} min` : diff < 1440 ? `Há ${Math.floor(diff/60)}h` : `Há ${Math.floor(diff/1440)}d`;
            
            return {
              id: data.id,
              type: 'submission',
              title: `Nova Submissão`,
              description: `Um aluno enviou uma atividade para correção.`,
              time: timeStr,
              timestamp: createdAt
            };
          });

        const combinedActivities = [...userActivities, ...submissionActivities]
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, 8);

        setRecentActivity(combinedActivities);
        setOrderActivities(orderActivities);

        const pendingOrdersList = allOrders
          .filter((o: any) => !['Cancelado', 'Entregue', 'Pronto para retirada'].includes(o.status))
          .sort((a: any, b: any) => {
            const dateA = a.createdAt?.toDate?.() || new Date(0);
            const dateB = b.createdAt?.toDate?.() || new Date(0);
            return dateB.getTime() - dateA.getTime();
          })
          .slice(0, 3);

        const enrichedOrders = await Promise.all(pendingOrdersList.map(async (orderData: any) => {
          // Fetch user name
          const userDoc = await getDoc(doc(db, 'users', orderData.userEmail || orderData.userId));
          const userName = userDoc.exists() ? userDoc.data().name : 'Usuário';

          // Fetch product names
          const productNames = await Promise.all((orderData.productIds || []).map(async (pid: string) => {
            const pDoc = await getDoc(doc(db, 'products', pid));
            return pDoc.exists() ? pDoc.data().name : 'Produto';
          }));

          return {
            id: orderData.id,
            productNames,
            status: orderData.status,
            userName
          };
        }));
        setPendingOrders(enrichedOrders);

      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [isAdmin]);

  const adminModules = [
    { name: 'Gerenciar Aulas', path: '/admin/lessons', icon: BookOpen, color: 'bg-blue-500', description: 'Adicione e edite aulas e cursos.' },
    { name: 'Gerenciar Cursos', path: '/admin/courses', icon: Award, color: 'bg-indigo-600', description: 'Crie trilhas de aprendizado com certificados.' },
    { name: 'Gerenciar Loja', path: '/admin/products', icon: ShoppingBag, color: 'bg-brand-500', description: 'Controle o estoque e preços.' },
    { name: 'Gerenciar Desafios', path: '/admin/challenges', icon: Zap, color: 'bg-amber-500', description: 'Crie quizzes e atividades.' },
    { name: 'Corrigir Atividades', path: '/admin/submissions', icon: CheckSquare, color: 'bg-purple-500', description: 'Avalie o trabalho dos alunos.' },
    { name: 'Gerenciar Pedidos', path: '/admin/orders', icon: Package, color: 'bg-orange-500', description: 'Controle as entregas da loja.' },
    { name: 'Gerenciar Usuários', path: '/admin/users', icon: Users, color: 'bg-emerald-500', description: 'Promova alunos e gerencie permissões.' },
    { name: 'Contas Institucionais', path: '/admin/schools', icon: School, color: 'bg-indigo-500', description: 'Gerencie escolas parceiras.' },
    { name: 'Prêmio Ranking', path: '/admin/rank-prize', icon: Star, color: 'bg-yellow-500', description: 'Configure o prêmio da temporada.' },
    { name: 'Anúncios Home', path: '/admin/announcements', icon: Megaphone, color: 'bg-cyan-500', description: 'Gerencie os banners rotativos da home.' },
    { name: 'Banco de Projetos', path: '/admin/notes', icon: FileText, color: 'bg-rose-500', description: 'Notas e anotações internas.' },
  ];

  return (
    <div className="space-y-8">
      <header className="bg-white dark:bg-zinc-900 p-5 md:p-8 rounded-2xl md:rounded-3xl shadow-sm border border-slate-100 dark:border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 transition-colors">
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-2">Painel Administrativo 🛠️</h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400">Gerencie todo o ecossistema Makeroom em um só lugar.</p>
        </div>
        <div className="w-full md:w-auto bg-slate-900 dark:bg-zinc-800 p-4 rounded-xl md:rounded-2xl flex items-center justify-center md:justify-start gap-4 transition-colors min-h-[44px]">
          <div className="w-12 h-12 bg-brand-500 rounded-xl flex items-center justify-center shadow-md shadow-brand-100 dark:shadow-none">
            <LayoutDashboard className="text-white w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-brand-400 font-bold uppercase tracking-wider leading-none mb-1">Status</p>
            <p className="text-white font-bold leading-none">Sistema Online</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {adminModules.map((module) => {
          const Icon = module.icon;
          const isOrdersModule = module.path === '/admin/orders';
          const hasPending = isOrdersModule && pendingOrders.length > 0;

          return (
            <Link 
              key={module.path} 
              to={module.path}
              className={`bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border transition-all duration-200 group flex flex-col relative overflow-hidden ${
                hasPending 
                  ? 'border-amber-500 ring-2 ring-amber-200 shadow-xl shadow-amber-100 dark:shadow-none animate-pulse-subtle bg-gradient-to-br from-white to-amber-50/30' 
                  : 'border-slate-100 dark:border-white/10 hover:shadow-md'
              }`}
            >
              {hasPending && (
                <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] font-black px-4 py-1.5 rounded-bl-2xl uppercase tracking-widest shadow-sm">
                  {pendingOrders.length} Pendentes
                </div>
              )}
              <div className={`w-12 h-12 ${module.color} rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-${module.color.split('-')[1]}-100 dark:shadow-none group-hover:scale-110 transition-transform duration-200`}>
                <Icon className="text-white w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{module.name}</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 flex-1">{module.description}</p>
              <div className={`flex items-center font-bold text-sm gap-2 transition-opacity duration-200 ${
                hasPending ? 'text-amber-600 opacity-100' : 'text-brand-600 opacity-0 group-hover:opacity-100'
              }`}>
                Acessar <ChevronRight className="w-4 h-4" />
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-white/10 transition-colors">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
            <Users className="w-6 h-6 text-brand-500" /> Atividade Recente
          </h2>
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
              </div>
            ) : recentActivity.length > 0 ? (
              recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                  <div className="w-10 h-10 bg-white dark:bg-white/10 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                    {activity.type === 'user' && <Users className="w-5 h-5 text-emerald-500" />}
                    {activity.type === 'submission' && <CheckSquare className="w-5 h-5 text-purple-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{activity.title}</p>
                      <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider whitespace-nowrap">{activity.time}</p>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{activity.description}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center py-8 text-slate-400 italic text-sm">Nenhuma atividade recente.</p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-white/10 transition-colors">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
            <ShoppingBag className="w-6 h-6 text-brand-500" /> Atividade da Loja Maker
          </h2>
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
              </div>
            ) : orderActivities.length > 0 ? (
              <div className="space-y-6">
                {/* Recent Store Notifications */}
                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Notificações Recentes</p>
                  {orderActivities.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                      <div className="w-10 h-10 bg-white dark:bg-white/10 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                        <ShoppingBag className="w-5 h-5 text-brand-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{activity.title}</p>
                          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider whitespace-nowrap">{activity.time}</p>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{activity.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pending Actions */}
                {pendingOrders.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-white/5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ações Pendentes</p>
                    {pendingOrders.map((order) => (
                      <div key={order.id} className="flex items-center gap-4 p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 transition-colors flex-wrap sm:flex-nowrap">
                        <div className="w-10 h-10 bg-white dark:bg-white/10 rounded-xl flex items-center justify-center shadow-sm shrink-0">
                          <Package className="w-5 h-5 text-amber-500" />
                        </div>
                        <div className="flex-1 min-w-[120px]">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{order.productNames.join(', ')}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Para: {order.userName}</p>
                        </div>
                        <Link 
                          to="/admin/orders"
                          className="w-full sm:w-auto bg-amber-500 text-white px-4 py-3 sm:py-1.5 rounded-lg text-xs font-bold hover:bg-amber-600 transition-colors text-center min-h-[44px] flex items-center justify-center"
                        >
                          Gerenciar
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center py-8 text-slate-400 italic text-sm">Nenhuma atividade na loja.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
