import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  X, 
  Check, 
  BookOpen, 
  Zap, 
  Image as ImageIcon,
  Loader2,
  ChevronRight,
  Award
} from 'lucide-react';

interface Lesson {
  id: string;
  title: string;
}

interface Challenge {
  id: string;
  title: string;
  type: string;
}

interface Course {
  id: string;
  title: string;
  description: string;
  lessonIds: string[];
  challengeIds: string[];
  pointsReward: number;
  thumbnail: string;
}

export default function ManageCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [quizzes, setQuizzes] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<Course | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedLessons, setSelectedLessons] = useState<string[]>([]);
  const [selectedQuizzes, setSelectedQuizzes] = useState<string[]>([]);
  const [pointsReward, setPointsReward] = useState(100);
  const [thumbnail, setThumbnail] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const coursesSnap = await getDocs(query(collection(db, 'courses'), orderBy('createdAt', 'desc')));
      setCourses(coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));

      const lessonsSnap = await getDocs(collection(db, 'lessons'));
      setLessons(lessonsSnap.docs.map(doc => ({ id: doc.id, title: doc.data().title })));

      const challengesSnap = await getDocs(collection(db, 'challenges'));
      setQuizzes(challengesSnap.docs
        .map(doc => ({ id: doc.id, title: doc.data().title, type: doc.data().type }))
        .filter(c => c.type === 'quiz')
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'courses');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) return;

    const courseData = {
      title,
      description,
      lessonIds: selectedLessons,
      challengeIds: selectedQuizzes,
      pointsReward,
      thumbnail,
      updatedAt: serverTimestamp()
    };

    try {
      if (editingCourse) {
        await updateDoc(doc(db, 'courses', editingCourse.id), courseData);
      } else {
        await addDoc(collection(db, 'courses'), {
          ...courseData,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'courses');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmation) return;
    
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'courses', deleteConfirmation.id));
      setDeleteConfirmation(null);
      fetchData();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'courses');
    } finally {
      setIsDeleting(false);
    }
  };

  const resetForm = () => {
    setEditingCourse(null);
    setTitle('');
    setDescription('');
    setSelectedLessons([]);
    setSelectedQuizzes([]);
    setPointsReward(100);
    setThumbnail('');
  };

  const openEdit = (course: Course) => {
    setEditingCourse(course);
    setTitle(course.title);
    setDescription(course.description);
    setSelectedLessons(course.lessonIds || []);
    setSelectedQuizzes(course.challengeIds || []);
    setPointsReward(course.pointsReward || 100);
    setThumbnail(course.thumbnail || '');
    setIsModalOpen(true);
  };

  const toggleLesson = (id: string) => {
    setSelectedLessons(prev => 
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    );
  };

  const toggleQuiz = (id: string) => {
    setSelectedQuizzes(prev => 
      prev.includes(id) ? prev.filter(q => q !== id) : [...prev, id]
    );
  };

  const filteredCourses = courses.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Gerenciar Cursos 🎓</h1>
          <p className="text-slate-500 dark:text-slate-400">Crie trilhas de aprendizado com certificados.</p>
        </div>
        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-brand-500 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-brand-600 transition-all shadow-lg shadow-brand-100 dark:shadow-none"
        >
          <Plus className="w-5 h-5" /> Novo Curso
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-5 h-5" />
        <input
          type="text"
          placeholder="Buscar cursos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-white dark:bg-zinc-900 dark:text-white rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-brand-500 dark:text-brand-400" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Carregando cursos...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map(course => (
            <div key={course.id} className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-100 dark:border-white/10 shadow-sm overflow-hidden group transition-colors">
              <div className="aspect-video bg-slate-100 dark:bg-white/5 relative overflow-hidden">
                {course.thumbnail ? (
                  <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-700" />
                  </div>
                )}
                <div className="absolute top-4 right-4 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-brand-600 dark:text-brand-400 flex items-center gap-1 shadow-sm">
                  <Award className="w-3 h-3" /> Certificado
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{course.title}</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm line-clamp-2 mb-4">{course.description}</p>
                
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                    <BookOpen className="w-4 h-4" />
                    <span className="text-xs font-medium">{course.lessonIds?.length || 0} aulas</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                    <Zap className="w-4 h-4" />
                    <span className="text-xs font-medium">{course.challengeIds?.length || 0} quizes</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-50 dark:border-white/5">
                  <button
                    onClick={() => openEdit(course)}
                    className="p-2 text-slate-400 dark:text-slate-500 hover:text-brand-500 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-xl transition-all"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmation(course)}
                    className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteConfirmation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] shadow-2xl max-w-md w-full border border-slate-100 dark:border-white/10 transition-colors">
            <div className="flex items-center gap-4 text-red-500 mb-6">
              <div className="w-12 h-12 bg-red-50 dark:bg-red-500/20 rounded-2xl flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Excluir Curso?</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            
            <p className="text-slate-600 dark:text-slate-400 mb-8">
              Você está prestes a excluir o curso <span className="font-bold text-slate-900 dark:text-white">"{deleteConfirmation.title}"</span>.
            </p>
            
            <div className="flex gap-4">
              <button 
                disabled={isDeleting}
                onClick={() => setDeleteConfirmation(null)}
                className="flex-1 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 font-bold py-3 rounded-xl hover:bg-slate-200 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button 
                disabled={isDeleting}
                onClick={handleDelete}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-red-100 dark:shadow-none flex items-center justify-center gap-2 disabled:opacity-50"
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-100 dark:border-white/10 transition-colors">
            <div className="p-6 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-white/5 transition-colors">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {editingCourse ? 'Editar Curso' : 'Novo Curso'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white dark:hover:bg-white/10 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400 dark:text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Título do Curso</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 dark:text-white rounded-xl border border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-brand-500 outline-none transition-colors"
                      placeholder="Ex: Robótica Básica com Arduino"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Descrição</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 dark:text-white rounded-xl border border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-brand-500 outline-none resize-none transition-colors"
                      placeholder="O que o aluno vai aprender?"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Pontos de Recompensa</label>
                      <input
                        type="number"
                        value={pointsReward}
                        onChange={(e) => setPointsReward(Number(e.target.value))}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 dark:text-white rounded-xl border border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-brand-500 outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">URL da Thumbnail</label>
                      <div className="relative">
                        <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-5 h-5" />
                        <input
                          type="text"
                          value={thumbnail}
                          onChange={(e) => setThumbnail(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-white/5 dark:text-white rounded-xl border border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-brand-500 outline-none transition-colors"
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Selecionar Aulas ({selectedLessons.length})</label>
                    <div className="bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 p-4 max-h-[200px] overflow-y-auto space-y-2 transition-colors">
                      {lessons.map(lesson => (
                        <button
                          key={lesson.id}
                          type="button"
                          onClick={() => toggleLesson(lesson.id)}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                            selectedLessons.includes(lesson.id)
                              ? 'bg-brand-50 dark:bg-brand-500/20 border-brand-200 dark:border-brand-500/30 text-brand-700 dark:text-brand-400'
                              : 'bg-white dark:bg-white/5 border-slate-100 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20'
                          }`}
                        >
                          <span className="text-sm font-medium truncate">{lesson.title}</span>
                          {selectedLessons.includes(lesson.id) && <Check className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Selecionar Quizes ({selectedQuizzes.length})</label>
                    <div className="bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 p-4 max-h-[200px] overflow-y-auto space-y-2 transition-colors">
                      {quizzes.map(quiz => (
                        <button
                          key={quiz.id}
                          type="button"
                          onClick={() => toggleQuiz(quiz.id)}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                            selectedQuizzes.includes(quiz.id)
                              ? 'bg-purple-50 dark:bg-purple-500/20 border-purple-200 dark:border-purple-500/30 text-purple-700 dark:text-purple-400'
                              : 'bg-white dark:bg-white/5 border-slate-100 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20'
                          }`}
                        >
                          <span className="text-sm font-medium truncate">{quiz.title}</span>
                          {selectedQuizzes.includes(quiz.id) && <Check className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-4 pt-6 border-t border-slate-100 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-3 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-brand-500 text-white px-8 py-3 rounded-xl font-bold hover:bg-brand-600 transition-all shadow-lg shadow-brand-100 dark:shadow-none"
                >
                  {editingCourse ? 'Salvar Alterações' : 'Criar Curso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
