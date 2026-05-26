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
  Award,
  GraduationCap,
  Save
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
  contentSequence?: {type: 'lesson' | 'quiz', id: string, title?: string}[];
  hasCertificate?: boolean;
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
  const [contentSequence, setContentSequence] = useState<{type: 'lesson' | 'quiz', id: string, title?: string}[]>([]);
  const [hasCertificate, setHasCertificate] = useState(false);
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
      contentSequence,
      hasCertificate,
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
    setContentSequence([]);
    setHasCertificate(false);
    setPointsReward(100);
    setThumbnail('');
  };

  const openEdit = (course: Course) => {
    setEditingCourse(course);
    setTitle(course.title);
    setDescription(course.description);
    setSelectedLessons(course.lessonIds || []);
    setSelectedQuizzes(course.challengeIds || []);
    setContentSequence(course.contentSequence || []);
    setHasCertificate(course.hasCertificate || false);
    setPointsReward(course.pointsReward || 100);
    setThumbnail(course.thumbnail || '');
    setIsModalOpen(true);
  };

  const toggleLesson = (id: string, lessonTitle?: string) => {
    setSelectedLessons(prev => {
      const isSelected = prev.includes(id);
      if (isSelected) {
        setContentSequence(seq => seq.filter(item => !(item.type === 'lesson' && item.id === id)));
        return prev.filter(l => l !== id);
      } else {
        setContentSequence(seq => {
          if (seq.some(item => item.type === 'lesson' && item.id === id)) return seq;
          return [...seq, { type: 'lesson', id, title: lessonTitle }];
        });
        return [...prev, id];
      }
    });
  };

  const toggleQuiz = (id: string, quizTitle?: string) => {
    setSelectedQuizzes(prev => {
      const isSelected = prev.includes(id);
      if (isSelected) {
        setContentSequence(seq => seq.filter(item => !(item.type === 'quiz' && item.id === id)));
        return prev.filter(q => q !== id);
      } else {
        setContentSequence(seq => {
          if (seq.some(item => item.type === 'quiz' && item.id === id)) return seq;
          return [...seq, { type: 'quiz', id, title: quizTitle }];
        });
        return [...prev, id];
      }
    });
  };

  const moveContentItem = (index: number, direction: 'up' | 'down') => {
    setContentSequence(prev => {
      const newSeq = [...prev];
      if (direction === 'up' && index > 0) {
        [newSeq[index - 1], newSeq[index]] = [newSeq[index], newSeq[index - 1]];
      } else if (direction === 'down' && index < newSeq.length - 1) {
        [newSeq[index], newSeq[index + 1]] = [newSeq[index + 1], newSeq[index]];
      }
      return newSeq;
    });
  };

  const filteredCourses = courses.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <GraduationCap className="text-brand-500" size={28} />
            Gerenciar Cursos
          </h1>
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
                {course.hasCertificate && (
                  <div className="absolute top-4 right-4 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-brand-600 dark:text-brand-400 flex items-center gap-1 shadow-sm">
                    <Award className="w-3 h-3" /> Certificado
                  </div>
                )}
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
        <div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-zinc-950 overflow-y-auto">
          <div className="max-w-4xl mx-auto min-h-screen p-6 md:p-12 relative flex flex-col justify-center">
            <div className="flex items-center justify-between mb-8 md:mb-12">
              <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                {editingCourse ? 'Editar Curso' : 'Novo Curso'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 bg-white dark:bg-white/5 flex items-center justify-center rounded-2xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors shadow-sm">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-8">
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
                          onClick={() => toggleLesson(lesson.id, lesson.title)}
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
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Selecionar Desafios ({selectedQuizzes.length})</label>
                    <div className="bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 p-4 max-h-[200px] overflow-y-auto space-y-2 transition-colors">
                      {quizzes.map(quiz => (
                        <button
                          key={quiz.id}
                          type="button"
                          onClick={() => toggleQuiz(quiz.id, quiz.title)}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                            selectedQuizzes.includes(quiz.id)
                              ? 'bg-purple-50 dark:bg-purple-500/20 border-purple-200 dark:border-purple-500/30 text-purple-700 dark:text-purple-400'
                              : 'bg-white dark:bg-white/5 border-slate-100 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20'
                          }`}
                        >
                          <span className="text-sm font-medium truncate flex max-w-[90%] items-center gap-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                              quiz.type === 'quiz' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400' : 
                              quiz.type === 'code' ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' :
                              'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400'
                            }`}>
                              {quiz.type === 'quiz' ? 'Quiz' : quiz.type === 'code' ? 'Código' : 'Atividade'}
                            </span>
                            <span className="truncate">{quiz.title}</span>
                          </span>
                          {selectedQuizzes.includes(quiz.id) && <Check className="w-4 h-4 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Certificado de Conclusão</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Gerar certificado quando o aluno finalizar este curso</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={hasCertificate}
                        onChange={(e) => setHasCertificate(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-500/20 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-brand-500"></div>
                    </label>
                  </div>
                </div>
              </div>

              {contentSequence.length > 0 && (
                <div className="space-y-3 pt-6 border-t border-slate-100 dark:border-white/10">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Sequência do Curso</label>
                  <div className="bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 p-4 space-y-2">
                    {contentSequence.map((item, index) => (
                      <div key={`${item.type}-${item.id}-${index}`} className="flex items-center justify-between p-3 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold ${item.type === 'lesson' ? 'bg-brand-500' : 'bg-purple-500'}`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{item.title || item.id}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{item.type === 'lesson' ? 'Aula' : 'Quiz'}</p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => moveContentItem(index, 'up')}
                            disabled={index === 0}
                            className="p-1 text-slate-400 hover:text-brand-500 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => moveContentItem(index, 'down')}
                            disabled={index === contentSequence.length - 1}
                            className="p-1 text-slate-400 hover:text-brand-500 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-4 pb-12">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-1/3 bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 font-bold py-5 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-sm border border-slate-200 dark:border-white/5"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="w-2/3 bg-brand-500 hover:bg-brand-600 text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-brand-500/20 flex items-center justify-center gap-3 tracking-widest uppercase"
                >
                  <Save className="w-6 h-6" /> {editingCourse ? 'Salvar Curso' : 'Criar Curso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
