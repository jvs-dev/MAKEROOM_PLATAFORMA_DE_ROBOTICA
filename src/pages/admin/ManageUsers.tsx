import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, writeBatch, getDocs, where, arrayRemove } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { 
  Users, 
  Search, 
  UserPlus, 
  Shield, 
  GraduationCap, 
  ExternalLink,
  MoreVertical,
  Trash2,
  Edit2,
  X,
  Check,
  Filter,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface User {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'student' | 'external';
  admin?: boolean;
  teamId?: string | null;
  schoolId?: string | null;
  room?: string | null;
  points?: number;
  photoURL?: string;
}

interface School {
  id: string;
  name: string;
}

export default function ManageUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<User | null>(null);
  const [isPromoting, setIsPromoting] = useState(false);
  const [promotionData, setPromotionData] = useState({ teamId: '', room: '', schoolId: '' });

  useEffect(() => {
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        ...doc.data(),
        email: doc.id // Document ID is the email
      })) as User[];
      
      const sortedUsers = [...usersData].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setUsers(sortedUsers);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'users');
    });

    const unsubscribeSchools = onSnapshot(collection(db, 'schools'), (snapshot) => {
      const schoolsData = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      })) as School[];
      setSchools(schoolsData);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'schools');
    });

    return () => {
      unsubscribeUsers();
      unsubscribeSchools();
    };
  }, []);

  const handleUpdateUser = async (user: User, newRole?: 'admin' | 'student' | 'external') => {
    const userRef = doc(db, 'users', user.email);
    try {
      const updateData: any = { ...user };
      
      if (newRole) {
        updateData.role = newRole;
        if (newRole === 'admin') {
          updateData.admin = true;
        } else if (newRole === 'student') {
          updateData.admin = false;
          if (isPromoting) {
            updateData.teamId = promotionData.teamId || null;
            updateData.room = promotionData.room || null;
            updateData.schoolId = promotionData.schoolId || null;
          }
        } else {
          updateData.admin = false;
          updateData.teamId = null;
          updateData.room = null;
          updateData.schoolId = null;
        }
      }

      await updateDoc(userRef, updateData);
      setEditingUser(null);
      setIsPromoting(false);
      setPromotionData({ teamId: '', room: '', schoolId: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.email}`);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirmation) return;
    
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);
      const userEmail = deleteConfirmation.email;
      const userUid = deleteConfirmation.uid;

      // 1. Delete user document
      batch.delete(doc(db, 'users', userEmail));

      // 2. Delete submissions
      const submissionsSnapshot = await getDocs(query(collection(db, 'submissions'), where('userId', '==', userUid)));
      submissionsSnapshot.docs.forEach(d => batch.delete(d.ref));

      // 3. Delete orders
      const ordersSnapshot = await getDocs(query(collection(db, 'orders'), where('userId', '==', userUid)));
      ordersSnapshot.docs.forEach(d => batch.delete(d.ref));

      // 4. Delete cooldowns
      const cooldownsSnapshot = await getDocs(query(collection(db, 'quizCooldowns'), where('userId', '==', userUid)));
      cooldownsSnapshot.docs.forEach(d => batch.delete(d.ref));

      // 5. Delete comments
      const commentsSnapshot = await getDocs(query(collection(db, 'comments'), where('userId', '==', userEmail)));
      commentsSnapshot.docs.forEach(d => batch.delete(d.ref));

      // 6. Remove from teams
      if (deleteConfirmation.teamId) {
        batch.update(doc(db, 'teams', deleteConfirmation.teamId), {
          studentIds: arrayRemove(userUid)
        });
      }

      // 7. Remove from schools adminIds
      const schoolsSnapshot = await getDocs(query(collection(db, 'schools'), where('adminIds', 'array-contains', userEmail)));
      schoolsSnapshot.docs.forEach(d => {
        batch.update(d.ref, {
          adminIds: arrayRemove(userEmail)
        });
      });

      await batch.commit();
      setDeleteConfirmation(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${deleteConfirmation.email}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Gerenciar Usuários 👥</h1>
          <p className="text-slate-500">Controle permissões, promova alunos e gerencie a comunidade.</p>
        </div>
      </header>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-brand-500 transition-all"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-3 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-brand-500 transition-all text-slate-600 font-medium"
            >
              <option value="all">Todos os Cargos</option>
              <option value="admin">Administradores</option>
              <option value="student">Alunos</option>
              <option value="external">Externos</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-4 font-bold text-slate-400 text-sm uppercase tracking-wider">Usuário</th>
                <th className="pb-4 font-bold text-slate-400 text-sm uppercase tracking-wider">Cargo</th>
                <th className="pb-4 font-bold text-slate-400 text-sm uppercase tracking-wider">Escola</th>
                <th className="pb-4 font-bold text-slate-400 text-sm uppercase tracking-wider">Turma / Sala</th>
                <th className="pb-4 font-bold text-slate-400 text-sm uppercase tracking-wider">Pontos</th>
                <th className="pb-4 font-bold text-slate-400 text-sm uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.map((user) => (
                <tr key={user.email} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden">
                        <img 
                          src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                          alt={user.name} 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-600' :
                      user.role === 'student' ? 'bg-brand-100 text-brand-600' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {user.role === 'admin' ? 'Admin' : user.role === 'student' ? 'Aluno' : 'Externo'}
                    </span>
                  </td>
                  <td className="py-4">
                    <span className="text-sm text-slate-600 font-medium">
                      {schools.find(s => s.id === user.schoolId)?.name || <span className="text-slate-300">—</span>}
                    </span>
                  </td>
                  <td className="py-4">
                    {user.role === 'student' ? (
                      <div className="text-sm">
                        <p className="text-slate-900 font-medium">{user.teamId || 'Sem Turma'}</p>
                        <p className="text-xs text-slate-500">{user.room || 'Sem Sala'}</p>
                      </div>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="py-4">
                    <span className="font-mono text-slate-600">{user.points || 0}</span>
                  </td>
                  <td className="py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {user.role === 'external' && (
                        <button
                          onClick={() => {
                            setEditingUser(user);
                            setIsPromoting(true);
                          }}
                          className="p-2 text-brand-500 hover:bg-brand-50 rounded-xl transition-colors"
                          title="Promover a Aluno"
                        >
                          <UserPlus className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={() => setEditingUser(user)}
                        className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"
                        title="Editar Usuário"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmation(user)}
                        className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors"
                        title="Excluir Usuário"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmation && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center gap-4 text-red-500 mb-6">
                  <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Excluir Usuário?</h2>
                    <p className="text-sm text-slate-500">Esta ação é irreversível.</p>
                  </div>
                </div>
                
                <p className="text-slate-600 mb-8">
                  Você está prestes a excluir <span className="font-bold text-slate-900">{deleteConfirmation.name}</span> ({deleteConfirmation.email}). 
                  Isso também removerá permanentemente todas as suas submissões, pedidos, comentários e registros de quiz.
                </p>
                
                <div className="flex gap-4">
                  <button 
                    disabled={isDeleting}
                    onClick={() => setDeleteConfirmation(null)}
                    className="flex-1 bg-slate-100 text-slate-600 font-bold py-4 rounded-2xl hover:bg-slate-200 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button 
                    disabled={isDeleting}
                    onClick={handleDeleteUser}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-red-100 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                    ) : (
                      <>Excluir Agora</>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit/Promote Modal */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-slate-900">
                    {isPromoting ? 'Promover a Aluno' : 'Editar Usuário'}
                  </h2>
                  <button
                    onClick={() => {
                      setEditingUser(null);
                      setIsPromoting(false);
                    }}
                    className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center overflow-hidden shadow-sm">
                      <img 
                        src={editingUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${editingUser.uid}`} 
                        alt={editingUser.name} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{editingUser.name}</p>
                      <p className="text-sm text-slate-500">{editingUser.email}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">Escola</label>
                    <select
                      value={isPromoting ? promotionData.schoolId : (editingUser.schoolId || '')}
                      onChange={(e) => {
                        if (isPromoting) {
                          setPromotionData({ ...promotionData, schoolId: e.target.value });
                        } else {
                          setEditingUser({ ...editingUser, schoolId: e.target.value });
                        }
                      }}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-brand-500 transition-all text-slate-600"
                    >
                      <option value="">Nenhuma Escola</option>
                      {schools.map(school => (
                        <option key={school.id} value={school.id}>{school.name}</option>
                      ))}
                    </select>
                  </div>

                  {!isPromoting && (
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 ml-1">Cargo</label>
                      <div className="grid grid-cols-3 gap-3">
                        {(['admin', 'student', 'external'] as const).map((role) => (
                          <button
                            key={role}
                            onClick={() => handleUpdateUser(editingUser, role)}
                            className={`py-3 rounded-2xl text-sm font-bold transition-all ${
                              editingUser.role === role
                                ? 'bg-brand-500 text-white shadow-lg shadow-brand-100'
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {role === 'admin' ? 'Admin' : role === 'student' ? 'Aluno' : 'Externo'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {(isPromoting || editingUser.role === 'student') && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-1">Turma</label>
                        <input
                          type="text"
                          placeholder="Ex: 9A"
                          value={isPromoting ? promotionData.teamId : (editingUser.teamId || '')}
                          onChange={(e) => {
                            if (isPromoting) {
                              setPromotionData({ ...promotionData, teamId: e.target.value });
                            } else {
                              setEditingUser({ ...editingUser, teamId: e.target.value });
                            }
                          }}
                          className="w-full px-4 py-3 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-brand-500 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-1">Sala</label>
                        <input
                          type="text"
                          placeholder="Ex: 204"
                          value={isPromoting ? promotionData.room : (editingUser.room || '')}
                          onChange={(e) => {
                            if (isPromoting) {
                              setPromotionData({ ...promotionData, room: e.target.value });
                            } else {
                              setEditingUser({ ...editingUser, room: e.target.value });
                            }
                          }}
                          className="w-full px-4 py-3 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-brand-500 transition-all"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => {
                        setEditingUser(null);
                        setIsPromoting(false);
                      }}
                      className="flex-1 py-4 rounded-2xl text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleUpdateUser(editingUser, isPromoting ? 'student' : undefined)}
                      className="flex-1 py-4 rounded-2xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200"
                    >
                      {isPromoting ? 'Promover Agora' : 'Salvar Alterações'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
