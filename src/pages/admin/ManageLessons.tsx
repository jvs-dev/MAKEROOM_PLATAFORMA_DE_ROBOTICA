import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { BookOpen, Plus, Edit2, Trash2, X, Save, AlertCircle, Youtube, AlertTriangle } from 'lucide-react';

interface Lesson {
  id: string;
  title: string;
  description: string;
  content: string;
  category: string;
  videoUrl?: string;
  imageUrl?: string;
  teamId?: string;
}

export default function ManageLessons() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<Lesson | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    category: 'Básico',
    videoUrl: '',
    imageUrl: '',
    teamId: '',
  });

  useEffect(() => {
    fetchLessons();
  }, []);

  const fetchLessons = async () => {
    setIsLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'lessons'));
      setLessons(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lesson)));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'lessons');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (lesson?: Lesson) => {
    if (lesson) {
      setEditingLesson(lesson);
      setFormData({
        title: lesson.title,
        description: lesson.description,
        content: lesson.content,
        category: lesson.category,
        videoUrl: lesson.videoUrl || '',
        imageUrl: lesson.imageUrl || '',
        teamId: lesson.teamId || '',
      });
    } else {
      setEditingLesson(null);
      setFormData({ title: '', description: '', content: '', category: 'Básico', videoUrl: '', imageUrl: '', teamId: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingLesson) {
        await updateDoc(doc(db, 'lessons', editingLesson.id), formData);
      } else {
        await addDoc(collection(db, 'lessons'), formData);
      }
      setIsModalOpen(false);
      fetchLessons();
    } catch (err) {
      handleFirestoreError(err, editingLesson ? OperationType.UPDATE : OperationType.CREATE, 'lessons');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmation) return;
    
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'lessons', deleteConfirmation.id));
      setDeleteConfirmation(null);
      fetchLessons();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `lessons/${deleteConfirmation.id}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Gerenciar Aulas 📚</h1>
          <p className="text-slate-500">Adicione, edite ou remova conteúdos educativos.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 px-6 rounded-2xl transition-all shadow-lg shadow-brand-100 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" /> Nova Aula
        </button>
      </header>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Título</th>
              <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Categoria</th>
              <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Turma</th>
              <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {lessons.map((lesson) => (
              <tr key={lesson.id} className="hover:bg-slate-50 transition-colors group">
                <td className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center overflow-hidden border border-slate-100">
                      {lesson.imageUrl ? (
                        <img src={lesson.imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <BookOpen className="w-5 h-5 text-blue-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 flex items-center gap-2">
                        {lesson.title}
                        {lesson.videoUrl && <Youtube className="w-3.5 h-3.5 text-red-500" />}
                      </p>
                      <p className="text-xs text-slate-400 line-clamp-1">{lesson.description}</p>
                    </div>
                  </div>
                </td>
                <td className="p-6">
                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                    {lesson.category}
                  </span>
                </td>
                <td className="p-6">
                  <span className="text-sm text-slate-500">{lesson.teamId || 'Todas'}</span>
                </td>
                <td className="p-6 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button 
                      onClick={() => handleOpenModal(lesson)}
                      className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setDeleteConfirmation(lesson)}
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
        {lessons.length === 0 && !isLoading && (
          <div className="p-12 text-center text-slate-400 italic">Nenhuma aula cadastrada.</div>
        )}
      </div>

      {deleteConfirmation && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full">
            <div className="flex items-center gap-4 text-red-500 mb-6">
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Excluir Aula?</h2>
                <p className="text-sm text-slate-500">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            
            <p className="text-slate-600 mb-8">
              Você está prestes a excluir a aula <span className="font-bold text-slate-900">"{deleteConfirmation.title}"</span>.
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
                {editingLesson ? 'Editar Aula' : 'Nova Aula'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Título</label>
                  <input 
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                    placeholder="Ex: Introdução ao Arduino"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Categoria</label>
                  <select 
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                  >
                    <option value="Básico">Básico</option>
                    <option value="Programação">Programação</option>
                    <option value="Mecânica">Mecânica</option>
                    <option value="Eletrônica">Eletrônica</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Descrição Curta</label>
                <input 
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="Uma breve descrição do que será aprendido."
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Link da Capa (Opcional)</label>
                <input 
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="Ex: https://link-da-imagem.com/capa.jpg"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Link do Vídeo (YouTube)</label>
                <input 
                  value={formData.videoUrl}
                  onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="Ex: https://www.youtube.com/watch?v=..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Conteúdo (Markdown)</label>
                <textarea 
                  required
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full h-48 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                  placeholder="Escreva o conteúdo da aula ou cole o link do vídeo..."
                />
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
                  <Save className="w-5 h-5" /> Salvar Aula
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
