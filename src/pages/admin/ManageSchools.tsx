import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../firebase';
import { School, Plus, Edit2, Trash2, X, Save, Users, Mail } from 'lucide-react';

interface SchoolData {
  id: string;
  name: string;
  adminIds: string[];
}

export default function ManageSchools() {
  const [schools, setSchools] = useState<SchoolData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<SchoolData | null>(null);
  const [editingSchool, setEditingSchool] = useState<SchoolData | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    adminIds: [] as string[],
  });

  const [adminEmailsStr, setAdminEmailsStr] = useState('');

  useEffect(() => {
    fetchSchools();
  }, []);

  const fetchSchools = async () => {
    if (!auth.currentUser) return;
    setIsLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'schools'));
      setSchools(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SchoolData)));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'schools');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (school?: SchoolData) => {
    if (school) {
      setEditingSchool(school);
      setFormData({
        name: school.name,
        adminIds: school.adminIds,
      });
      setAdminEmailsStr(school.adminIds.join(', '));
    } else {
      setEditingSchool(null);
      setFormData({ name: '', adminIds: [] });
      setAdminEmailsStr('');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const adminIds = adminEmailsStr.split(',').map(s => s.trim()).filter(s => s !== '');
    const dataToSave = { ...formData, adminIds };

    try {
      if (editingSchool) {
        await updateDoc(doc(db, 'schools', editingSchool.id), dataToSave);
      } else {
        await addDoc(collection(db, 'schools'), dataToSave);
      }
      setIsModalOpen(false);
      fetchSchools();
    } catch (err) {
      handleFirestoreError(err, editingSchool ? OperationType.UPDATE : OperationType.CREATE, 'schools');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmation) return;
    
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'schools', deleteConfirmation.id));
      setDeleteConfirmation(null);
      fetchSchools();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `schools/${deleteConfirmation.id}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Escolas Parceiras 🏫</h1>
          <p className="text-slate-500">Gerencie contas institucionais e escolas parceiras.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 px-6 rounded-2xl transition-all shadow-lg shadow-brand-100 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" /> Nova Escola
        </button>
      </header>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Escola</th>
              <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Administradores</th>
              <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {schools.map((school) => (
              <tr key={school.id} className="hover:bg-slate-50 transition-colors group">
                <td className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                      <School className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{school.name}</p>
                      <p className="text-xs text-slate-400">ID: {school.id.slice(-6)}</p>
                    </div>
                  </div>
                </td>
                <td className="p-6">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-600 font-medium">{school.adminIds.length} Admins</span>
                  </div>
                </td>
                <td className="p-6 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button 
                      onClick={() => handleOpenModal(school)}
                      className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setDeleteConfirmation(school)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {schools.length === 0 && !isLoading && (
          <div className="p-12 text-center text-slate-400 italic">Nenhuma escola cadastrada.</div>
        )}
      </div>

      {deleteConfirmation && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full">
            <div className="flex items-center gap-4 text-red-500 mb-6">
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Excluir Escola?</h2>
                <p className="text-sm text-slate-500">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            
            <p className="text-slate-600 mb-8">
              Você está prestes a excluir a escola <span className="font-bold text-slate-900">"{deleteConfirmation.name}"</span>.
            </p>
            
            <div className="flex gap-4">
              <button 
                disabled={isDeleting}
                onClick={() => setDeleteConfirmation(null)}
                className="flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-2xl hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button 
                disabled={isDeleting}
                onClick={handleDelete}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-2xl transition-all shadow-lg shadow-red-100 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                ) : (
                  <>Excluir Agora</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-slate-900">
                {editingSchool ? 'Editar Escola' : 'Nova Escola'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nome da Escola</label>
                <input 
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="Ex: Colégio Maker"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Emails dos Administradores (Opcional)</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    value={adminEmailsStr}
                    onChange={(e) => setAdminEmailsStr(e.target.value)}
                    className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                    placeholder="admin1@escola.com, admin2@escola.com"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Adicione os e-mails dos usuários que terão permissão para gerenciar esta escola, separados por vírgula.
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-2xl hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 rounded-2xl transition-all shadow-lg shadow-brand-100 flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" /> Salvar Escola
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
