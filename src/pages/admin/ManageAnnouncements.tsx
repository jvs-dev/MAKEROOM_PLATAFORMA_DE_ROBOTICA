import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { Megaphone, Plus, Edit2, Trash2, X, Save, AlertTriangle, ExternalLink, Power } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Announcement {
  id: string;
  imageUrl: string;
  mobileImageUrl?: string;
  redirectUrl: string;
  isActive: boolean;
  createdAt: any;
  updatedAt?: any;
}

export default function ManageAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<Announcement | null>(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [formData, setFormData] = useState({
    imageUrl: '',
    mobileImageUrl: '',
    redirectUrl: '',
    isActive: true,
  });

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      setAnnouncements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement)));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'announcements');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (ann?: Announcement) => {
    if (ann) {
      setEditingAnnouncement(ann);
      setFormData({
        imageUrl: ann.imageUrl,
        mobileImageUrl: ann.mobileImageUrl || '',
        redirectUrl: ann.redirectUrl,
        isActive: ann.isActive,
      });
    } else {
      setEditingAnnouncement(null);
      setFormData({ 
        imageUrl: '', 
        mobileImageUrl: '',
        redirectUrl: '', 
        isActive: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dataToSave = {
        ...formData,
        updatedAt: serverTimestamp(),
      };

      if (editingAnnouncement) {
        await updateDoc(doc(db, 'announcements', editingAnnouncement.id), dataToSave);
      } else {
        await addDoc(collection(db, 'announcements'), {
          ...dataToSave,
          createdAt: serverTimestamp(),
        });
      }
      setIsModalOpen(false);
      fetchAnnouncements();
    } catch (err) {
      handleFirestoreError(err, editingAnnouncement ? OperationType.UPDATE : OperationType.CREATE, 'announcements');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmation) return;
    
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'announcements', deleteConfirmation.id));
      setDeleteConfirmation(null);
      fetchAnnouncements();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `announcements/${deleteConfirmation.id}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleActive = async (ann: Announcement) => {
    try {
      await updateDoc(doc(db, 'announcements', ann.id), {
        isActive: !ann.isActive,
        updatedAt: serverTimestamp(),
      });
      fetchAnnouncements();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `announcements/${ann.id}`);
    }
  };

  const getSafeHostname = (url: string) => {
    try {
      if (url.startsWith('http')) {
        return new URL(url).hostname;
      }
      return 'Interno';
    } catch {
      return 'Link';
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Gerenciar Anúncios 📢</h1>
          <p className="text-slate-500 dark:text-slate-400">Controle os banners rotativos da página inicial.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 px-6 rounded-2xl transition-all shadow-lg shadow-brand-100 dark:shadow-none flex items-center gap-2"
        >
          <Plus className="w-5 h-5" /> Novo Anúncio
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-64 bg-slate-100 dark:bg-white/5 animate-pulse rounded-3xl" />
          ))
        ) : (
          announcements.map((ann) => (
            <motion.div 
              layout
              key={ann.id}
              className={`group relative bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-slate-100 dark:border-white/10 overflow-hidden transition-all ${!ann.isActive ? 'opacity-60 grayscale' : ''}`}
            >
              <div className="aspect-[5/6] md:aspect-[16/6] relative overflow-hidden bg-slate-100 dark:bg-white/5">
                <img 
                  src={ann.mobileImageUrl && typeof window !== 'undefined' && window.innerWidth < 768 ? ann.mobileImageUrl : ann.imageUrl} 
                  alt="Banner Preview" 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                />
                <div className="absolute top-2 left-2 flex gap-1">
                  <div className="bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[8px] text-white font-bold uppercase">PC: 16:6</div>
                  {ann.mobileImageUrl && <div className="bg-brand-500/80 backdrop-blur-md px-2 py-0.5 rounded text-[8px] text-white font-bold uppercase">Mob: 5:6</div>}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                  <div className="flex items-center gap-2 text-white/80 text-[10px] font-mono uppercase tracking-widest bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full">
                    <ExternalLink size={10} />
                    {getSafeHostname(ann.redirectUrl)}
                  </div>
                </div>
              </div>
              
              <div className="p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => toggleActive(ann)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                      ann.isActive 
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20' 
                        : 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-white/10'
                    }`}
                  >
                    <Power size={18} />
                  </button>
                  <div className="space-y-0.5">
                    <p className={`text-sm font-bold uppercase tracking-tight ${ann.isActive ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                      {ann.isActive ? 'Ativo' : 'Desativado'}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                      {new Date(ann.createdAt?.toDate?.() || Date.now()).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleOpenModal(ann)}
                    className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setDeleteConfirmation(ann)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {announcements.length === 0 && !isLoading && (
        <div className="py-20 text-center bg-white dark:bg-white/5 rounded-[40px] border-2 border-dashed border-slate-200 dark:border-white/10">
          <div className="w-20 h-20 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
            <Megaphone className="w-10 h-10 text-slate-300 dark:text-zinc-700" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Nenhum anúncio criado</h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto text-sm">Crie banners atrativos para destacar notícias, promoções ou novos cursos na home.</p>
        </div>
      )}

      {deleteConfirmation && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-2xl max-w-md w-full border border-slate-100 dark:border-white/10 transition-colors">
            <div className="flex items-center gap-4 text-red-500 mb-6">
              <div className="w-12 h-12 bg-red-50 dark:bg-red-500/20 rounded-2xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Excluir Anúncio?</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            
            <p className="text-slate-600 dark:text-slate-400 mb-8 text-sm leading-relaxed">
              Você está prestes a excluir este banner. Ele deixará de ser exibido na rotação da página inicial.
            </p>
            
            <div className="flex gap-4">
              <button 
                disabled={isDeleting}
                onClick={() => setDeleteConfirmation(null)}
                className="flex-1 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 font-bold py-3 rounded-2xl hover:bg-slate-200 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button 
                disabled={isDeleting}
                onClick={handleDelete}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
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
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-100 dark:border-white/10 transition-colors">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                {editingAnnouncement ? 'Editar Anúncio' : 'Novo Anúncio'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Banner Desktop (16:6)</label>
                  <input 
                    required
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    className="w-full p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 dark:text-white rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                    placeholder="URL da imagem desktop..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Banner Celular (5:6)</label>
                  <input 
                    value={formData.mobileImageUrl}
                    onChange={(e) => setFormData({ ...formData, mobileImageUrl: e.target.value })}
                    className="w-full p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 dark:text-white rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                    placeholder="URL da imagem mobile (opcional)..."
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">Dica: Use imagens com as proporções recomendadas para cada dispositivo.</p>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Link de Redirecionamento</label>
                <input 
                  required
                  value={formData.redirectUrl}
                  onChange={(e) => setFormData({ ...formData, redirectUrl: e.target.value })}
                  className="w-full p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 dark:text-white rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                  placeholder="/store ou https://googl.com"
                />
              </div>

              <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                  className={`w-12 h-6 rounded-full transition-all relative ${formData.isActive ? 'bg-brand-500' : 'bg-slate-300 dark:bg-zinc-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formData.isActive ? 'left-7' : 'left-1'}`} />
                </button>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Ativar anúncio imediatamente</span>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 font-bold py-4 rounded-2xl hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-brand-500 hover:bg-brand-600 text-white font-bold py-4 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" /> Salvar Anúncio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
