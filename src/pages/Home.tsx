import { useEffect, useState, useCallback } from 'react';
import { collection, query, getDocs, where, doc, getDoc, addDoc, setDoc, serverTimestamp, onSnapshot, deleteDoc, updateDoc, arrayUnion, arrayRemove, orderBy } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { BookOpen, Play, Clock, ChevronRight, X, Youtube, FileText, ExternalLink, MessageCircle, Heart, Trash2, Send, Award, PartyPopper, CheckCircle2, RefreshCcw } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import Toast from '../components/Toast';

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

interface Comment {
  id: string;
  lessonId: string;
  userId: string;
  userName: string;
  schoolId?: string | null;
  content: string;
  createdAt: any;
  likes: string[];
}

export default function Home() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userTeamId, setUserTeamId] = useState<string | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [isCompletingLesson, setIsCompletingLesson] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [eligibleCourse, setEligibleCourse] = useState<any>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading && lessons.length > 0 && location.state?.lessonId) {
      const lesson = lessons.find(l => l.id === location.state.lessonId);
      if (lesson) {
        setSelectedLesson(lesson);
        // Clear state to prevent re-opening on refresh
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [isLoading, lessons, location, navigate]);

  useEffect(() => {
    if (selectedLesson) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedLesson]);

  useEffect(() => {
    const fetchData = async () => {
      if (auth.currentUser && auth.currentUser.email) {
        try {
          const userDoc = await getDoc(doc(db, 'users', auth.currentUser.email));
          let data = null;
          if (userDoc.exists()) {
            data = userDoc.data();
            // Ensure main admin always has admin privileges in the UI and DB
            if (auth.currentUser.email === 'jvssilv4@gmail.com' && (!data.admin || data.role !== 'admin')) {
              data.admin = true;
              data.role = 'admin';
              await updateDoc(doc(db, 'users', auth.currentUser.email), { admin: true, role: 'admin' });
            }
            setUserData(data);
            setUserTeamId(data.teamId);
          } else {
            // Create user document if it doesn't exist
            const isMainAdmin = auth.currentUser.email === 'jvssilv4@gmail.com';
            data = { 
              uid: auth.currentUser.uid,
              name: auth.currentUser.displayName || 'Maker',
              email: auth.currentUser.email,
              photoURL: auth.currentUser.photoURL || null,
              admin: isMainAdmin,
              role: isMainAdmin ? 'admin' : 'external',
              completedLessons: [],
              medals: [],
              certificates: [],
              points: 0,
              teamId: null,
              room: null,
              createdAt: serverTimestamp()
            };
            await setDoc(doc(db, 'users', auth.currentUser.email), data);
            setUserData(data);
          }

          const lessonsSnapshot = await getDocs(collection(db, 'lessons'));
          const lessonsList = lessonsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lesson));
          
          const filteredLessons = lessonsList.filter(lesson => 
            !lesson.teamId || lesson.teamId === (data?.teamId || null)
          );

          setLessons(filteredLessons);

          const coursesSnapshot = await getDocs(collection(db, 'courses'));
          const coursesList = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
          setCourses(coursesList);

          const subsSnap = await getDocs(query(
            collection(db, 'submissions'),
            where('userId', '==', auth.currentUser.uid)
          ));
          setSubmissions(subsSnap.docs.map(doc => doc.data()));
        } catch (err) {
          handleFirestoreError(err, OperationType.LIST, 'lessons/users');
        }
      }
      setIsLoading(false);
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedLesson) {
      setComments([]);
      return;
    }

    const q = query(
      collection(db, 'comments'),
      where('lessonId', '==', selectedLesson.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Comment));
      
      // Filter by schoolId in memory to avoid composite index requirement
      const filteredComments = commentsList.filter(comment => 
        userData?.admin || comment.schoolId === (userData?.schoolId || null)
      );
      
      // Sort client-side to avoid composite index requirement
      filteredComments.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : Date.now());
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : Date.now());
        return timeB - timeA;
      });

      setComments(filteredComments);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'comments');
    });

    return () => unsubscribe();
  }, [selectedLesson]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !selectedLesson || !auth.currentUser || !userData) return;

    setIsSendingComment(true);
    try {
      await addDoc(collection(db, 'comments'), {
        lessonId: selectedLesson.id,
        userId: auth.currentUser.email,
        userName: userData.name,
        schoolId: userData.schoolId || null,
        content: newComment.trim(),
        createdAt: serverTimestamp(),
        likes: []
      });
      setNewComment('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'comments');
    } finally {
      setIsSendingComment(false);
    }
  };

  const handleLikeComment = async (comment: Comment) => {
    if (!auth.currentUser || !auth.currentUser.email) return;
    const userEmail = auth.currentUser.email;
    const isLiked = comment.likes.includes(userEmail);

    try {
      const commentRef = doc(db, 'comments', comment.id);
      await updateDoc(commentRef, {
        likes: isLiked ? arrayRemove(userEmail) : arrayUnion(userEmail)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'comments');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteDoc(doc(db, 'comments', commentId));
      setToast({ message: 'Comentário excluído com sucesso!', type: 'success' });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'comments');
    }
  };

  const handleCompleteLesson = async (lessonId: string) => {
    if (!auth.currentUser?.email || isCompletingLesson) return;
    
    setIsCompletingLesson(true);
    try {
      const userRef = doc(db, 'users', auth.currentUser.email);
      await updateDoc(userRef, {
        completedLessons: arrayUnion(lessonId),
        points: (userData?.points || 0) + 10 // Award 10 points per lesson
      });
      
      // Update local state
      setUserData((prev: any) => ({
        ...prev,
        completedLessons: [...(prev?.completedLessons || []), lessonId],
        points: (prev?.points || 0) + 10
      }));
      
      setSelectedLesson(null);
      setToast({ message: 'Aula concluída! +10 pontos 🚀', type: 'success' });

      // Check for certificate eligibility
      const coursesSnap = await getDocs(collection(db, 'courses'));
      const allCourses = coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      const newlyEligible = [];
      for (const course of allCourses) {
        if (!course.lessonIds.includes(lessonId)) continue;
        
        const allLessonsDone = course.lessonIds.every(id => 
          id === lessonId || userData?.completedLessons?.includes(id)
        );
        
        if (allLessonsDone) {
          // Check if already has certificate
          const certSnap = await getDocs(query(
            collection(db, 'certificates'),
            where('userId', '==', auth.currentUser.email),
            where('courseId', '==', course.id)
          ));
          
          if (certSnap.empty) {
            // Check quizzes
            const subsSnap = await getDocs(query(
              collection(db, 'submissions'),
              where('userId', '==', auth.currentUser.uid)
            ));
            const subs = subsSnap.docs.map(d => d.data());
            
            const allQuizzesPassed = course.challengeIds.every((cid: string) => {
              const res = subs.find(s => s.challengeId === cid && s.status === 'graded');
              return res && res.grade >= 70;
            });
            
            if (allQuizzesPassed) {
              newlyEligible.push(course);
            }
          }
        }
      }

      if (newlyEligible.length > 0) {
        setEligibleCourse(newlyEligible[0]);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'users/completedLessons');
    } finally {
      setIsCompletingLesson(false);
    }
  };

  const getCourseProgress = (course: any) => {
    if (!userData) return 0;
    const totalItems = course.lessonIds.length + course.challengeIds.length;
    if (totalItems === 0) return 100;
    
    const completedLessons = course.lessonIds.filter((id: string) => 
      userData.completedLessons?.includes(id)
    ).length;
    
    const completedQuizzes = course.challengeIds.filter((cid: string) => {
      const res = submissions.find(s => s.challengeId === cid && s.status === 'graded');
      return res && res.grade >= 70;
    }).length;
    
    return Math.round(((completedLessons + completedQuizzes) / totalItems) * 100);
  };

  const isCourseCompleted = (course: any) => {
    return getCourseProgress(course) === 100;
  };

  const completedCourses = courses.filter(course => isCourseCompleted(course));
  const availableCourses = courses.filter(course => !isCourseCompleted(course));

  const availableLessons = lessons.filter(lesson => !userData?.completedLessons?.includes(lesson.id));
  const completedLessons = lessons.filter(lesson => userData?.completedLessons?.includes(lesson.id));

  const lastCourse = (() => {
    if (!userData || !courses.length) return null;

    // 1. Try to find the course with the most recent submission
    if (submissions && submissions.length > 0) {
      const sortedSubs = [...submissions].sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return timeB - timeA;
      });

      for (const sub of sortedSubs) {
        const course = courses.find(c => c.challengeIds?.includes(sub.challengeId));
        if (course && !isCourseCompleted(course)) {
          return course;
        }
      }
    }

    // 2. Fallback: Find the course with progress > 0 and < 100
    const inProgress = courses
      .filter(c => !isCourseCompleted(c))
      .map(c => ({ course: c, progress: getCourseProgress(c) }))
      .filter(p => p.progress > 0)
      .sort((a, b) => b.progress - a.progress);

    if (inProgress.length > 0) {
      return inProgress[0].course;
    }

    return null;
  })();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="bg-white p-4 md:p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-1 md:mb-2">Olá, Maker! 👋</h1>
          <p className="text-slate-500 text-sm md:text-base">Pronto para construir algo incrível hoje?</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3 md:gap-4">
          <div className="bg-brand-50 p-3 md:p-4 rounded-2xl flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-brand-500 rounded-xl flex items-center justify-center shadow-md shadow-brand-100">
              <BookOpen className="text-white w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <p className="text-[10px] text-brand-600 font-bold uppercase tracking-wider">Aulas</p>
              <p className="text-slate-900 font-bold text-sm md:text-base">{(userData?.completedLessons?.length || 0)} Concluídas</p>
            </div>
          </div>
          <div className="bg-amber-50 p-3 md:p-4 rounded-2xl flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-500 rounded-xl flex items-center justify-center shadow-md shadow-amber-100">
              <Award className="text-white w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Certificados</p>
              <p className="text-slate-900 font-bold text-sm md:text-base">{(userData?.certificates?.length || 0)} Conquistados</p>
            </div>
          </div>
        </div>
      </header>

      {lastCourse && (
        <section className="bg-white rounded-[2rem] p-4 md:p-6 border border-slate-100 shadow-sm group relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-50 rounded-2xl overflow-hidden flex-shrink-0 border border-slate-100">
              <img 
                src={lastCourse.thumbnail || 'https://makeroom2.vercel.app/logo.svg'} 
                alt={lastCourse.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
            </div>
            
            <div className="flex-1 min-w-0 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                <span className="text-[9px] md:text-[10px] font-black text-brand-600 uppercase tracking-widest">Continuar Aprendendo</span>
                <span className="w-1 h-1 bg-slate-200 rounded-full hidden md:block" />
                <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">{getCourseProgress(lastCourse)}% concluído</span>
              </div>
              <h2 className="text-lg md:text-xl font-bold text-slate-900 truncate mb-3">{lastCourse.title}</h2>
              
              <div className="max-w-xs mx-auto md:mx-0">
                <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${getCourseProgress(lastCourse)}%` }}
                    className="h-full bg-brand-500 rounded-full"
                  />
                </div>
              </div>
            </div>

            <Link 
              to={`/courses/${lastCourse.id}`}
              className="w-full md:w-auto bg-brand-500 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-brand-600 transition-all flex items-center justify-center gap-2 shadow-sm whitespace-nowrap"
            >
              Retomar Trilha <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      )}

      {availableCourses.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900">Trilhas de Aprendizado</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {availableCourses.map((course) => (
              <Link 
                key={course.id} 
                to={`/courses/${course.id}`}
                className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all duration-200 group flex flex-col"
              >
                <div className="w-full aspect-video bg-slate-50 rounded-2xl mb-4 overflow-hidden relative border border-slate-100">
                  <img 
                    src={course.thumbnail || 'https://makeroom2.vercel.app/logo.svg'} 
                    alt={course.title} 
                    className={`w-full h-full ${course.thumbnail ? 'object-cover' : 'object-contain p-8'} group-hover:scale-105 transition-transform duration-300`}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-bold text-amber-600 uppercase tracking-widest flex items-center gap-1">
                    <Award className="w-3 h-3" /> Certificado
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-slate-900 mb-2">{course.title}</h3>
                <p className="text-slate-500 text-sm mb-4 line-clamp-2">{course.description}</p>
                
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progresso</span>
                    <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest">{getCourseProgress(course)}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-50">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${getCourseProgress(course)}%` }}
                      className="h-full bg-brand-500 rounded-full"
                    />
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-2 text-slate-400 text-xs">
                    <BookOpen className="w-4 h-4" />
                    <span>{course.lessonIds?.length || 0} Aulas</span>
                  </div>
                  <div className="text-brand-600 font-bold text-sm flex items-center gap-1">
                    Ver Trilha <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {completedCourses.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900">Trilhas Concluídas 🎉</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {completedCourses.map((course) => (
              <Link 
                key={course.id} 
                to={`/courses/${course.id}`}
                className="bg-emerald-50/30 p-6 rounded-3xl shadow-sm border border-emerald-100 hover:shadow-md transition-all duration-200 group flex flex-col"
              >
                <div className="w-full aspect-video bg-white rounded-2xl mb-4 overflow-hidden relative border border-emerald-200 shadow-inner">
                  <img 
                    src={course.thumbnail || 'https://makeroom2.vercel.app/logo.svg'} 
                    alt={course.title} 
                    className={`w-full h-full ${course.thumbnail ? 'object-cover' : 'object-contain p-8'} group-hover:scale-105 transition-transform duration-300 opacity-60 grayscale-[0.5]`}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center">
                    <div className="bg-white/90 backdrop-blur-md p-4 rounded-full shadow-2xl scale-110 border border-emerald-100">
                      <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                    </div>
                  </div>
                  <div className="absolute top-3 right-3 bg-emerald-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg animate-bounce-subtle">
                    <Award className="w-3.5 h-3.5" /> Concluído
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-slate-900 mb-2">{course.title}</h3>
                <p className="text-slate-500 text-sm mb-4 line-clamp-2">{course.description}</p>
                
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest">Concluído</span>
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">100%</span>
                  </div>
                  <div className="h-1.5 bg-emerald-100 rounded-full overflow-hidden border border-emerald-50">
                    <div className="h-full bg-emerald-500 rounded-full w-full" />
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold">
                    <Award className="w-4 h-4" />
                    <span>Certificado Disponível</span>
                  </div>
                  <div className="text-emerald-600 font-bold text-sm flex items-center gap-1">
                    Ver Detalhes <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {availableLessons.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900">Aulas Disponíveis</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {availableLessons.map((lesson) => (
              <div key={lesson.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all duration-200 group flex flex-col">
                <div className="w-full aspect-video bg-slate-50 rounded-2xl mb-4 overflow-hidden relative border border-slate-100">
                  <img 
                    src={lesson.imageUrl || 'https://makeroom2.vercel.app/logo.svg'} 
                    alt={lesson.title} 
                    className={`w-full h-full ${lesson.imageUrl ? 'object-cover' : 'object-contain p-8'} group-hover:scale-105 transition-transform duration-300`}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
                      <Play className="text-brand-500 w-6 h-6 fill-brand-500" />
                    </div>
                  </div>
                  <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-bold text-brand-600 uppercase tracking-widest">
                    {lesson.category}
                  </span>
                </div>
                
                <h3 className="text-lg font-bold text-slate-900 mb-2">{lesson.title}</h3>
                <p className="text-slate-500 text-sm mb-6 line-clamp-2">{lesson.description}</p>
                
                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-2 text-slate-400 text-xs">
                    <Clock className="w-4 h-4" />
                    <span>45 min</span>
                  </div>
                  <button 
                    onClick={() => setSelectedLesson(lesson)}
                    className="bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-brand-600 transition-colors flex items-center gap-2"
                  >
                    Começar <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {completedLessons.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900">Aulas Concluídas 🎉</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {completedLessons.map((lesson) => (
              <div key={lesson.id} className="bg-emerald-50/30 p-6 rounded-3xl shadow-sm border border-emerald-100 hover:shadow-md transition-all duration-200 group flex flex-col">
                <div className="w-full aspect-video bg-white rounded-2xl mb-4 overflow-hidden relative border border-emerald-100">
                  <img 
                    src={lesson.imageUrl || 'https://makeroom2.vercel.app/logo.svg'} 
                    alt={lesson.title} 
                    className={`w-full h-full ${lesson.imageUrl ? 'object-cover' : 'object-contain p-8'} group-hover:scale-105 transition-transform duration-300 opacity-75`}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-3 right-3 bg-emerald-500 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 shadow-lg">
                    <CheckCircle2 className="w-3 h-3" /> Concluída
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-slate-900 mb-2">{lesson.title}</h3>
                <p className="text-slate-500 text-sm mb-6 line-clamp-2">{lesson.description}</p>
                
                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Rever Aula</span>
                  </div>
                  <button 
                    onClick={() => setSelectedLesson(lesson)}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2"
                  >
                    Assistir Novamente <RefreshCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Full-screen Lesson View */}
      <AnimatePresence>
        {selectedLesson && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white z-50 overflow-y-auto"
          >
            <div className="max-w-7xl mx-auto px-0 md:px-8 py-0 md:py-8 pb-12 md:pb-20">
              {/* Header */}
              <div className="flex items-center justify-between p-4 md:p-0 mb-4 md:mb-8">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setSelectedLesson(null)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-slate-600" />
                  </button>
                  <div>
                    <span className="bg-brand-50 px-3 py-1 rounded-full text-[10px] font-bold text-brand-600 uppercase tracking-widest mb-1 inline-block">
                      {selectedLesson.category}
                    </span>
                    <h2 className="text-xl md:text-3xl font-bold text-slate-900 line-clamp-1">{selectedLesson.title}</h2>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedLesson(null)}
                  className="hidden md:flex bg-slate-100 text-slate-600 px-6 py-2 rounded-xl font-bold hover:bg-slate-200 transition-all items-center gap-2"
                >
                  Sair da Aula
                </button>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-0 md:gap-8">
                {/* Main Content */}
                <div className="xl:col-span-2 space-y-6 md:space-y-8">
                  {/* Video Player */}
                  {selectedLesson.videoUrl && (
                    <div className="aspect-video bg-brand-950 rounded-none md:rounded-3xl overflow-hidden shadow-2xl md:border md:border-slate-800">
                      {selectedLesson.videoUrl.includes('youtube.com') || selectedLesson.videoUrl.includes('youtu.be') ? (
                        <iframe 
                          src={`https://www.youtube.com/embed/${selectedLesson.videoUrl.split('v=')[1] || selectedLesson.videoUrl.split('/').pop()}`}
                          className="w-full h-full"
                          allowFullScreen
                          title={selectedLesson.title}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white flex-col gap-4">
                          <Youtube className="w-12 h-12 text-red-500" />
                          <a 
                            href={selectedLesson.videoUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="bg-red-500 hover:bg-red-600 px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all"
                          >
                            Assistir no YouTube <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Lesson Content */}
                  <div className="bg-white p-6 md:p-8 rounded-none md:rounded-3xl border-y md:border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-6">
                      <FileText className="w-4 h-4" />
                      Descrição e Conteúdo
                    </div>
                    <div className="prose prose-slate max-w-none">
                      <div className="markdown-body">
                        <Markdown>{selectedLesson.content}</Markdown>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sidebar: Comments */}
                <div className="p-4 md:p-0 space-y-6">
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 h-full flex flex-col max-h-[600px] xl:max-h-[calc(100vh-200px)]">
                    <div className="flex items-center gap-2 text-slate-900 font-bold mb-6">
                      <MessageCircle className="w-5 h-5 text-brand-500" />
                      Comentários ({comments.length})
                    </div>

                    {/* Comment List */}
                    <div className="flex-1 overflow-y-auto space-y-4 mb-6 pr-2 custom-scrollbar">
                      {comments.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-slate-400 text-sm italic">Seja o primeiro a comentar!</p>
                        </div>
                      ) : (
                        comments.map((comment) => (
                          <div key={comment.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 group hover:border-brand-100 transition-colors">
                            <div className="flex items-start gap-3 mb-2">
                              <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 font-bold text-xs shrink-0 border border-brand-100">
                                {comment.userName.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-bold text-slate-900 text-sm truncate">{comment.userName}</span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {(userData?.admin || auth.currentUser?.email === 'jvssilv4@gmail.com' || comment.userId === auth.currentUser?.email) && (
                                      <button 
                                        onClick={() => handleDeleteComment(comment.id)}
                                        className="p-1 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                    <span className="text-[10px] text-slate-400">
                                      {comment.createdAt?.toDate ? comment.createdAt.toDate().toLocaleDateString() : 'Agora'}
                                    </span>
                                  </div>
                                </div>
                                <p className="text-slate-600 text-sm mt-1 leading-relaxed break-words">{comment.content}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 ml-11">
                              <button 
                                onClick={() => handleLikeComment(comment)}
                                className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                                  comment.likes.includes(auth.currentUser?.email || '') 
                                    ? 'text-brand-500' 
                                    : 'text-slate-400 hover:text-slate-600'
                                }`}
                              >
                                <Heart className={`w-4 h-4 ${comment.likes.includes(auth.currentUser?.email || '') ? 'fill-brand-500' : ''}`} />
                                {comment.likes.length}
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* New Comment Input */}
                    <form onSubmit={handleAddComment} className="relative">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Escreva um comentário..."
                        className="w-full bg-white border border-slate-200 rounded-2xl p-4 pr-12 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none transition-all"
                        rows={2}
                      />
                      <button
                        type="submit"
                        disabled={isSendingComment || !newComment.trim()}
                        className="absolute right-3 bottom-3 p-2 bg-brand-500 text-white rounded-xl hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </div>

                  {/* Action Button */}
                  <button 
                    onClick={() => handleCompleteLesson(selectedLesson.id)}
                    disabled={isCompletingLesson || userData?.completedLessons?.includes(selectedLesson.id)}
                    className="w-full bg-brand-500 text-white font-bold py-4 rounded-2xl hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg mb-8"
                  >
                    {isCompletingLesson ? 'Processando...' : userData?.completedLessons?.includes(selectedLesson.id) ? 'Aula Concluída' : 'Concluir Aula'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <Toast 
            message={toast.message} 
            type={toast.type} 
            onClose={() => setToast(null)} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {eligibleCourse && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEligibleCourse(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[2.5rem] p-8 md:p-12 max-w-lg w-full relative shadow-2xl text-center"
            >
              <button 
                onClick={() => setEligibleCourse(null)}
                className="absolute top-6 right-6 p-2 hover:bg-slate-50 rounded-full text-slate-400 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="w-24 h-24 bg-amber-100 rounded-3xl flex items-center justify-center mx-auto mb-8 relative">
                <Award className="w-12 h-12 text-amber-600" />
                <motion.div 
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute -top-2 -right-2 w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-white"
                >
                  <PartyPopper className="w-5 h-5" />
                </motion.div>
              </div>

              <h2 className="text-3xl font-black text-slate-900 mb-4">Novo Certificado! 🎓</h2>
              <p className="text-slate-600 mb-8 leading-relaxed">
                Você acaba de completar todos os requisitos para o curso <span className="font-bold text-indigo-600">{eligibleCourse.title}</span>!
              </p>

              <div className="space-y-3">
                <button 
                  onClick={() => navigate(`/courses/${eligibleCourse.id}`)}
                  className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                >
                  <Award className="w-5 h-5" /> Resgatar Certificado Agora
                </button>
                <button 
                  onClick={() => setEligibleCourse(null)}
                  className="w-full bg-slate-50 text-slate-600 font-bold py-4 rounded-2xl hover:bg-slate-100 transition-all"
                >
                  Continuar Estudando
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
