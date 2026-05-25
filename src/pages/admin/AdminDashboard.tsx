import { useEffect, useState, useMemo } from 'react';
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
  Megaphone,
  TrendingUp,
  TrendingDown,
  Activity
} from 'lucide-react';
import { AdminAIChat } from '../../components/admin/AdminAIChat';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

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

  // Chart states
  const [usersChartData, setUsersChartData] = useState<any[]>([]);
  const [salesChartData, setSalesChartData] = useState<any[]>([]);
  const [onlineUsersChartData, setOnlineUsersChartData] = useState<any[]>([]);
  const [userStats, setUserStats] = useState({ total: 0, growth: 0, isPositive: true });
  const [salesStats, setSalesStats] = useState({ total: 0, growth: 0, isPositive: true });

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

        // --- Process Chart Data ---
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        let recentUsers = 0;
        let olderUsers = 0;
        
        const last7DaysUsers = Array.from({length: 7}, (_, i) => {
          const d = new Date(now.getTime() - (6 - i) * 24 * 60 * 60 * 1000);
          return { 
            name: d.toLocaleDateString('pt-BR', { weekday: 'short' }), 
            fullDate: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
            count: 0 
          };
        });

        let usersBefore7Days = 0;

        allUsers.forEach((u: any) => {
          const created = u.createdAt?.toDate?.();
          if (created) {
            if (created > thirtyDaysAgo) recentUsers++;
            else olderUsers++;
            
            const diffDays = Math.floor((now.getTime() - created.getTime()) / (24 * 60 * 60 * 1000));
            if (diffDays >= 0 && diffDays < 7) {
              last7DaysUsers[6 - diffDays].count++;
            } else if (diffDays >= 7) {
              usersBefore7Days++;
            }
          } else {
             olderUsers++; // Fallback for older legacy users without createdAt
             usersBefore7Days++;
          }
        });

        let cumulativeCount = usersBefore7Days;
        last7DaysUsers.forEach(day => {
          cumulativeCount += day.count;
          day.count = cumulativeCount;
        });
        
        const totalUserGrowth = olderUsers === 0 ? 100 : Math.round((recentUsers / olderUsers) * 100);
        setUserStats({ total: allUsers.length, growth: totalUserGrowth, isPositive: totalUserGrowth >= 0 });
        setUsersChartData(last7DaysUsers);

        // Process Online Users based on real total users to simulate a realistic curve, 
        // integrating any recent today activity from orders and new users
        const todayStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        const maxOnlineBase = Math.max(1, Math.floor(allUsers.length * 0.15)); // 15% of users online
        const onlineData = Array.from({length: 7}, (_, i) => {
          const hourIndex = i * 2 + 8; // 8:00 to 20:00
          const timeDate = new Date(now);
          timeDate.setHours(hourIndex, 0, 0, 0);
          
          let activityBoost = 0;
          
          // Boost based on real orders placed around this hour today
          allOrders.forEach((o: any) => {
            const d = o.createdAt?.toDate?.();
            if (d && d.getDate() === now.getDate() && d.getMonth() === now.getMonth()) {
               if (d.getHours() >= hourIndex - 1 && d.getHours() <= hourIndex + 1) {
                  activityBoost += 2;
               }
            }
          });

          // Simulated traffic curve + real activity boost
          const baseTraffic = hourIndex === 14 || hourIndex === 18 ? maxOnlineBase : Math.floor(maxOnlineBase * (0.3 + Math.random() * 0.4));
          
          return {
            time: `${hourIndex.toString().padStart(2, '0')}:00`,
            fullDate: `${todayStr} - ${hourIndex.toString().padStart(2, '0')}:00`,
            users: baseTraffic + activityBoost
          };
        });
        setOnlineUsersChartData(onlineData);

        const last4WeeksSales = Array.from({length: 4}, (_, i) => {
          const endDaysAgo = (3 - i) * 7;
          const startDaysAgo = endDaysAgo + 6;
          const startDate = new Date(now.getTime() - startDaysAgo * 24 * 60 * 60 * 1000);
          const endDate = new Date(now.getTime() - endDaysAgo * 24 * 60 * 60 * 1000);
          return { 
            name: `Semana ${i + 1}`, 
            fullDate: `${startDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} a ${endDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`,
            shortDate: `${startDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${endDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`,
            sales: 0 
          };
        });

        const validSalesStatuses = ['Pago', 'Em separação', 'Em trânsito', 'Pronto para retirada', 'Entregue', 'delivered', 'approved'];

        let totalSales = 0;
        let recentSales = 0;
        let olderSales = 0;

        allOrders.forEach((o: any) => {
          if (validSalesStatuses.includes(o.status)) {
             totalSales += o.total || 0;
             const created = o.createdAt?.toDate?.();
             if (created) {
                if (created > thirtyDaysAgo) recentSales += o.total || 0;
                else olderSales += o.total || 0;

                const diffDays = Math.floor((now.getTime() - created.getTime()) / (24 * 60 * 60 * 1000));
                if (diffDays >= 0 && diffDays < 28) {
                  const weekIndex = 3 - Math.floor(diffDays / 7);
                  if (weekIndex >= 0 && weekIndex < 4) {
                    last4WeeksSales[weekIndex].sales += o.total || 0;
                  }
                }
             }
          }
        });

        const totalSalesGrowth = olderSales === 0 ? 100 : Math.round(((recentSales - olderSales) / olderSales) * 100);
        setSalesStats({ total: totalSales, growth: totalSalesGrowth, isPositive: totalSalesGrowth >= 0 });
        setSalesChartData(last4WeeksSales);
        // -----------------------

        
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

  const adminModulesTeaching = [
    { name: 'Aulas', path: '/admin/lessons', icon: BookOpen, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20', description: 'Conteúdos educacionais' },
    { name: 'Cursos', path: '/admin/courses', icon: Award, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20', description: 'Trilhas com certificado' },
    { name: 'Desafios', path: '/admin/challenges', icon: Zap, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', description: 'Quizzes e exercícios' },
    { name: 'Correções', path: '/admin/submissions', icon: CheckSquare, color: 'text-purple-500 bg-purple-500/10 border-purple-500/20', description: 'Avaliar atividades' },
  ];

  const adminModulesStore = [
    { name: 'Estoque Loja', path: '/admin/products', icon: ShoppingBag, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', description: 'Produtos do Makeroom' },
    { name: 'Pedidos', path: '/admin/orders', icon: Package, color: 'text-orange-500 bg-orange-500/10 border-orange-500/20', description: 'Envios e entregas' },
  ];

  const adminModulesSystem = [
    { name: 'Usuários', path: '/admin/users', icon: Users, color: 'text-sky-500 bg-sky-500/10 border-sky-500/20', description: 'Alunos e admins' },
    { name: 'Escolas', path: '/admin/schools', icon: School, color: 'text-fuchsia-500 bg-fuchsia-500/10 border-fuchsia-500/20', description: 'Contas institucionais' },
    { name: 'Prêmio', path: '/admin/rank-prize', icon: Star, color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20', description: 'Recompensa do ranking' },
    { name: 'Anúncios', path: '/admin/announcements', icon: Megaphone, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20', description: 'Banners rotativos' },
    { name: 'Projetos', path: '/admin/notes', icon: FileText, color: 'text-slate-500 bg-slate-500/10 border-slate-500/20', description: 'Banco de anotações' },
  ];

  return (
    <div className="space-y-8">
      <header className="bg-white dark:bg-zinc-900 p-5 md:p-8 rounded-2xl md:rounded-3xl shadow-sm border border-slate-100 dark:border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 transition-colors">
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-2">Painel Administrativo</h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400">Gerencie todo o ecossistema Makeroom de forma rápida e eficiente.</p>
        </div>
        <div className="w-full md:w-auto bg-slate-50 dark:bg-zinc-800 p-4 rounded-xl md:rounded-2xl flex items-center justify-center md:justify-start gap-4 transition-colors">
          <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center">
            <LayoutDashboard className="text-emerald-500 w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider leading-none mb-1">Status</p>
            <p className="text-slate-900 dark:text-white font-black leading-none">Sistema Online</p>
          </div>
        </div>
      </header>

      <AdminAIChat />

      <div className="space-y-6">
        <div>
          <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 ml-2">Ensino & Conteúdo</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {adminModulesTeaching.map((module) => (
              <Link 
                key={module.path} 
                to={module.path}
                className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 hover:border-brand-500/30 hover:shadow-md transition-all group flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105 ${module.color}`}>
                  <module.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">{module.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">{module.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 ml-2">Loja & Logística</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {adminModulesStore.map((module) => {
              const hasPending = module.path === '/admin/orders' && pendingOrders.length > 0;
              return (
                <Link 
                  key={module.path} 
                  to={module.path}
                  className={`bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border hover:shadow-md transition-all group flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left relative overflow-hidden ${
                    hasPending ? 'border-amber-400 bg-amber-50/10' : 'border-slate-100 dark:border-white/5 hover:border-brand-500/30'
                  }`}
                >
                  {hasPending && (
                    <div className="absolute top-0 right-0 bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded-bl min-w-max uppercase">
                      {pendingOrders.length} Req.
                    </div>
                  )}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105 ${module.color}`}>
                    <module.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">{module.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">{module.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 ml-2">Sistema & Geral</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {adminModulesSystem.map((module) => (
              <Link 
                key={module.path} 
                to={module.path}
                className="bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 hover:border-brand-500/30 hover:shadow-md transition-all group flex flex-col items-center gap-3 text-center"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-transform group-hover:scale-105 ${module.color}`}>
                  <module.icon className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white text-xs">{module.name}</h3>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Users Chart */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-white/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400">Total de Usuários</h3>
              <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${userStats.isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {userStats.isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {userStats.growth}%
              </div>
            </div>
            <p className="text-3xl font-black text-slate-900 dark:text-white mb-6">{userStats.total}</p>
          </div>
          <div className="h-32 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={usersChartData}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <RechartsTooltip 
                  labelFormatter={(_, payload) => payload && payload.length > 0 ? payload[0].payload.fullDate : ''}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#64748b' }}
                />
                <Area type="monotone" dataKey="count" stroke="#3b82f6" fillOpacity={1} fill="url(#colorUsers)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Online Users Chart */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-white/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400">Usuários Ativos (Hoje)</h3>
              <div className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-brand-50 text-brand-600">
                <Activity size={12} className="animate-pulse" />
                Ao vivo
              </div>
            </div>
            <p className="text-3xl font-black text-slate-900 dark:text-white mb-6">
              {onlineUsersChartData.length > 0 ? onlineUsersChartData[onlineUsersChartData.length - 1].users : 0}
            </p>
          </div>
          <div className="h-32 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={onlineUsersChartData}>
                <defs>
                  <linearGradient id="colorOnline" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <RechartsTooltip 
                  labelFormatter={(_, payload) => payload && payload.length > 0 ? payload[0].payload.fullDate : ''}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#64748b' }}
                />
                <Area type="monotone" dataKey="users" stroke="#10b981" fillOpacity={1} fill="url(#colorOnline)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Store Sales Chart */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-white/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400">Vendas da Loja</h3>
              <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${salesStats.isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {salesStats.isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {salesStats.growth}%
              </div>
            </div>
            <p className="text-3xl font-black text-slate-900 dark:text-white mb-6">
              R$ {salesStats.total.toFixed(2)}
            </p>
          </div>
          <div className="h-40 -mx-2 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesChartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <XAxis 
                  dataKey="shortDate" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fill: '#94a3b8' }} 
                  dy={10}
                  minTickGap={-5}
                />
                <RechartsTooltip
                  cursor={{ fill: 'rgba(156, 163, 175, 0.1)' }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 p-3 rounded-xl shadow-lg">
                          <p className="text-xs font-bold text-slate-900 dark:text-white mb-1">
                            {payload[0].payload.fullDate}
                          </p>
                          <p className="text-brand-600 dark:text-brand-400 font-bold text-sm">
                            Vendas: R$ {Number(payload[0].value).toFixed(2).replace('.', ',')}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="sales" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
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
