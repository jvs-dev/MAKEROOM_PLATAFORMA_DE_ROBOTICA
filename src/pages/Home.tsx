import { useEffect, useState, useCallback } from 'react';
import { collection, query, getDocs, where, doc, getDoc, addDoc, setDoc, serverTimestamp, onSnapshot, deleteDoc, updateDoc, arrayUnion, arrayRemove, orderBy } from 'firebase/firestore';
import { awardPoints, syncUserProfile } from '../services/userService';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { BookOpen, Play, Clock, ChevronRight, X, Youtube, FileText, ExternalLink, MessageCircle, Heart, Trash2, Send, Award, PartyPopper, CheckCircle2, RefreshCcw } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import Toast from '../components/Toast';
import { cn } from '../lib/utils';

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

interface Announcement {
  id: string;
  imageUrl: string;
  mobileImageUrl?: string;
  redirectUrl: string;
  isActive: boolean;
}

export default function Home() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
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

          // Ensure public profile exists
          if (auth.currentUser && data) {
            await syncUserProfile(auth.currentUser.uid, auth.currentUser.email);
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

          const annSnap = await getDocs(query(
            collection(db, 'announcements'),
            where('isActive', '==', true),
            orderBy('createdAt', 'desc')
          ));
          setAnnouncements(annSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement)));
        } catch (err) {
          handleFirestoreError(err, OperationType.LIST, 'app_data');
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

  useEffect(() => {
    if (announcements.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % (announcements.length + 1));
    }, 10000);

    return () => clearInterval(interval);
  }, [announcements]);

  const handleCompleteLesson = async (lessonId: string) => {
    if (!auth.currentUser?.email || isCompletingLesson) return;
    
    setIsCompletingLesson(true);
    try {
      const userRef = doc(db, 'users', auth.currentUser.email);
      // Award 10 points and sync profile automatically via awardPoints service
      await awardPoints(auth.currentUser.uid, auth.currentUser.email, 10);
      
      const newPoints = (userData?.points || 0) + 10;
      await updateDoc(userRef, {
        completedLessons: arrayUnion(lessonId)
      });
      
      // Update local state
      setUserData((prev: any) => ({
        ...prev,
        completedLessons: [...(prev?.completedLessons || []), lessonId],
        points: newPoints
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
    <div className="space-y-12 pb-20">
      {/* Dynamic Hero Section - Carousel */}
      <div className="relative w-full aspect-[5/6] md:aspect-[16/6] max-h-[600px]">
        <AnimatePresence mode="wait">
          {currentBannerIndex === 0 ? (
            <motion.section 
              key="main-hero"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="absolute inset-0 glass-strong rounded-[2.5rem] overflow-hidden group flex items-center border border-slate-200 dark:border-white/10"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-brand-100/50 via-slate-50 to-brand-500/10 dark:from-brand-950/50 dark:via-deep-black dark:to-brand-500/10 z-0" />
              <div className="absolute -top-24 -right-24 w-96 h-96 bg-brand-500/10 blur-[100px] rounded-full animate-pulse" />
              <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-brand-500/10 dark:bg-brand-500/10 blur-[80px] rounded-full animate-float" />
              
              <div className="relative z-10 p-5 md:p-16 flex flex-col md:flex-row items-center gap-10 w-full">
                <div className="flex-1 text-center md:text-left space-y-6">                                    
                  <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-none italic uppercase text-slate-900 dark:text-white">
                    Construa o Seu <br />
                    <span className="bg-gradient-to-r from-brand-600 to-brand-400 dark:from-brand-400 dark:to-brand-300 bg-clip-text text-transparent">Primeiro Robô Hoje!</span>
                  </h1>
                  
                  <p className="text-slate-600 dark:text-slate-400 text-lg md:text-xl max-w-xl font-medium leading-relaxed">
                    Junte-se a mais de <span className="text-slate-900 dark:text-white font-bold">500 makers</span> que já estão transformando ideias em realidade.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <button 
                      onClick={() => {
                        const firstLesson = availableLessons[0];
                        if (firstLesson) setSelectedLesson(firstLesson);
                      }}
                      className="w-full sm:w-auto px-8 py-4 bg-brand-500 text-white font-bold rounded-2xl shadow-[0_0_30px_rgba(249,115,22,0.3)] hover:shadow-[0_0_40px_rgba(249,115,22,0.5)] hover:scale-105 transition-all flex items-center justify-center gap-3 group"
                    >
                      COMEÇAR A CRIAR →
                    </button>
                    <div className="flex -space-x-3">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="w-10 h-10 rounded-full border-2 border-slate-200 dark:border-deep-black overflow-hidden bg-slate-100 dark:bg-slate-800">
                          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`} alt="User" />
                        </div>
                      ))}
                      <div className="w-10 h-10 rounded-full border-2 border-slate-200 dark:border-deep-black bg-white/50 dark:bg-white/10 backdrop-blur-md flex items-center justify-center text-xs font-bold text-slate-600 dark:text-white">
                        +500
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex-shrink-0 relative hidden xl:block">
                  <div className="w-80 h-80 relative animate-float">
                    <div className="absolute inset-0 bg-brand-500/20 rounded-[3rem] rotate-6 border border-brand-500/30" />
                    <div className="absolute inset-0 bg-brand-500/10 rounded-[3rem] -rotate-3 border border-brand-500/20" />
                    <div className="absolute inset-0 glass-strong rounded-[3rem] border border-slate-200 dark:border-white/10 shadow-2xl flex items-center justify-center overflow-hidden bg-white dark:bg-zinc-900">
                      <img 
                        src="https://makeroom2.vercel.app/lampLogo.svg" 
                        alt="Maker" 
                        className="w-48 h-48 drop-shadow-[0_0_30px_rgba(249,115,22,0.6)]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>
          ) : (
            <motion.section
              key={`announcement-${announcements[currentBannerIndex - 1].id}`}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="absolute inset-0 rounded-[2.5rem] overflow-hidden group border border-slate-200 dark:border-white/10"
            >
              <a 
                href={announcements[currentBannerIndex - 1].redirectUrl}
                target={announcements[currentBannerIndex - 1].redirectUrl.startsWith('http') ? "_blank" : "_self"}
                rel="noopener noreferrer"
                className="block w-full h-full relative"
              >
                <picture className="w-full h-full">
                  {announcements[currentBannerIndex - 1].mobileImageUrl && (
                    <source 
                      media="(max-width: 767px)" 
                      srcSet={announcements[currentBannerIndex - 1].mobileImageUrl} 
                    />
                  )}
                  <img 
                    src={announcements[currentBannerIndex - 1].imageUrl} 
                    alt="Announcement" 
                    className="w-full h-full object-cover"
                  />
                </picture>
                <div className="absolute inset-0 bg-black/20 hover:bg-black/10 transition-colors" />
                
                {/* Announcement Indicators */}
                <div className="absolute bottom-6 right-6 flex gap-2">
                  <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-white uppercase tracking-widest border border-white/10">
                    Propaganda
                  </div>
                </div>
              </a>
            </motion.section>
          )}
        </AnimatePresence>
        
        {/* Carousel Indicators */}
        {announcements.length > 0 && (
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
            {[0, ...announcements].map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentBannerIndex(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  currentBannerIndex === idx ? 'w-8 bg-brand-500' : 'w-2 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Persistence Banner: Continue Training */}
      {lastCourse && (
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative group cursor-pointer"
          onClick={() => navigate(`/courses/${lastCourse.id}`)}
        >
          <div className="relative bg-white dark:bg-zinc-900/40 p-4 md:p-5 rounded-3xl border border-slate-200 dark:border-white/5 flex flex-col md:flex-row items-center gap-6 shadow-sm hover:border-brand-500/30 transition-all">
            <div className="w-16 h-16 bg-slate-50 dark:bg-white/5 rounded-2xl flex items-center justify-center border border-slate-100 dark:border-white/5 shrink-0 overflow-hidden">
              <img src={lastCourse.thumbnail || 'https://makeroom2.vercel.app/lampLogo.svg'} alt="" className="w-10 h-10 object-contain" />
            </div>
            
            <div className="flex-1 space-y-2 text-center md:text-left min-w-0">
              <div className="flex items-center justify-center md:justify-start gap-4">
                <span className="text-[10px] font-mono font-black text-brand-600 dark:text-brand-500 uppercase tracking-[0.2em]">SESSÃO ATIVA</span>
                <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                <span className="text-[10px] font-mono font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">{getCourseProgress(lastCourse)}% COMPLETO</span>
              </div>
              <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white truncate uppercase tracking-tight italic">
                {lastCourse.title}
              </h2>
              <div className="w-full h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${getCourseProgress(lastCourse)}%` }}
                  className="h-full bg-brand-500"
                />
              </div>
            </div>
            
            <button className="hidden md:flex w-12 h-12 rounded-full border border-slate-200 dark:border-white/10 items-center justify-center text-slate-400 group-hover:text-brand-500 group-hover:border-brand-500/50 transition-all">
              <ChevronRight size={20} />
            </button>

            <button className="md:hidden w-full py-3 bg-brand-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest">
              RETOMAR AGORA
            </button>
          </div>
        </motion.section>
      )}

      {/* Gamification Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-2 glass p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-white/5 flex flex-col justify-between shadow-sm bg-white dark:bg-transparent">
          <div className="space-y-1">
            <h3 className="text-slate-500 dark:text-slate-400 font-mono text-xs font-bold uppercase tracking-[0.2em]">XP Statistics</h3>
            <div className="text-3xl md:text-4xl font-black italic tracking-tighter text-slate-900 dark:text-white">LEVEL {Math.floor((userData?.points || 0) / 100) + 1}</div>
          </div>
          <div className="mt-8 space-y-4">
            <div className="flex justify-between items-end">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{userData?.points || 0} / {(Math.floor((userData?.points || 0) / 100) + 1) * 100} XP</span>
              <span className="text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-widest">{100 - ((userData?.points || 0) % 100)} TO NEXT LVL</span>
            </div>
            <div className="h-4 bg-slate-100 dark:bg-white/5 rounded-full p-1 border border-slate-200 dark:border-white/5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(userData?.points || 0) % 100}%` }}
                className="h-full bg-gradient-to-r from-brand-600 via-brand-400 to-brand-300 rounded-full shadow-[0_0_15px_rgba(249,115,22,0.4)]"
              />
            </div>
          </div>
        </div>

        <div className="glass p-8 rounded-3xl border border-slate-200 dark:border-white/5 flex flex-col items-center justify-center text-center gap-4 group hover:border-brand-500/30 transition-colors shadow-sm bg-white dark:bg-transparent">
          <div className="w-16 h-16 rounded-full bg-brand-500/10 flex items-center justify-center border border-brand-500/20 group-hover:scale-110 transition-transform">
            <Award className="text-brand-600 dark:text-brand-400" size={32} />
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-black italic text-slate-900 dark:text-white leading-none">{(userData?.certificates?.length || 0)}</div>
            <div className="text-xs font-mono font-black text-slate-500 uppercase tracking-[0.2em] mt-2">Badges Unlocked</div>
          </div>
        </div>

        <div className="glass p-8 rounded-3xl border border-slate-200 dark:border-white/5 flex flex-col items-center justify-center text-center gap-4 group hover:border-brand-500/30 transition-colors shadow-sm bg-white dark:bg-transparent">
          <div className="w-16 h-16 rounded-full bg-brand-500/10 flex items-center justify-center border border-brand-500/20 group-hover:scale-110 transition-transform">
            <BookOpen className="text-brand-600 dark:text-brand-400" size={32} />
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-black italic text-slate-900 dark:text-white leading-none">{(userData?.completedLessons?.length || 0)}</div>
            <div className="text-xs font-mono font-black text-slate-500 uppercase tracking-[0.2em] mt-2">Lessons Finished</div>
          </div>
        </div>
      </div>

      {/* Main Learning Hub */}
      <section className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-black tracking-tighter uppercase italic text-slate-900 dark:text-white">Módulos de Exploração</h2>
            <p className="text-slate-600 dark:text-slate-500 font-medium">Selecione seu caminho e comece a construir.</p>
          </div>
          <div className="hidden md:flex gap-2">
            <button className="px-4 py-2 glass rounded-xl text-xs font-black uppercase tracking-widest text-brand-600 dark:text-brand-400 border border-brand-500/20 bg-brand-50 dark:bg-transparent">Todos</button>
            <button className="px-4 py-2 glass rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-white/10">Arduino</button>
            <button className="px-4 py-2 glass rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-white/10">Eletrônica</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {availableCourses.map((course) => (
            <motion.div
              layout
              key={course.id}
              whileHover={{ y: -8 }}
              className="group relative"
            >
              <Link to={`/courses/${course.id}`} className="block h-full glass-strong rounded-[2rem] border border-slate-200 dark:border-white/5 overflow-hidden transition-all group-hover:border-brand-500/30 shadow-md hover:shadow-xl hover:shadow-brand-500/10 hover:bg-white dark:hover:bg-transparent">
                <div className="aspect-video relative overflow-hidden">
                  <img 
                    src={course.thumbnail || 'https://makeroom2.vercel.app/logo.svg'} 
                    alt={course.title} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                  
                  {/* Video Preview Overlay (Pseudo-interaction) */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-16 h-16 glass rounded-full flex items-center justify-center shadow-2xl border border-white/20">
                      <Play className="text-white fill-white translate-x-0.5" />
                    </div>
                  </div>

                  <div className="absolute top-4 left-4 glass px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/20">
                    <Award size={14} className="text-brand-400" />
                    <span className="text-xs font-black uppercase tracking-widest text-brand-100">Certificado</span>
                  </div>
                </div>

                <div className="p-8 space-y-6 bg-white dark:bg-transparent">
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold italic uppercase tracking-tight text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{course.title}</h3>
                    <p className="text-slate-600 dark:text-slate-500 text-sm line-clamp-2 leading-relaxed">{course.description}</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-end text-xs font-mono font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                      <span>Sync Progress</span>
                      <span className="text-brand-600 dark:text-brand-400">{getCourseProgress(course)}%</span>
                    </div>
                    <div className="h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        whileInView={{ width: `${getCourseProgress(course)}%` }}
                        className="h-full bg-brand-500"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        <BookOpen size={14} />
                        {course.lessonIds?.length || 0} Modules
                      </div>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity">Launch →</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Social Proof / Project Showcase */}
      <section className="glass p-6 md:p-12 rounded-[2rem] md:rounded-[3rem] border border-slate-200 dark:border-white/5 space-y-12 shadow-sm bg-white dark:bg-transparent">
        <div className="text-center space-y-4">
          <h2 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">Projetos em Destaque</h2>
          <p className="text-slate-600 dark:text-slate-500 max-w-2xl mx-auto">Veja o que seus colegas de turma estão construindo no laboratório Makeroom.</p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="aspect-square bg-white dark:bg-white/5 rounded-3xl overflow-hidden group relative border border-slate-100 dark:border-white/5 shadow-sm">
              <img 
                src={`https://picsum.photos/seed/robot${i}/800/800`} 
                alt="Student Project" 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 grayscale group-hover:grayscale-0"
              />
              <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-slate-900 via-transparent to-transparent">
                <div className="text-[10px] font-black uppercase tracking-widest text-brand-400">Robô Articulado v{i}.0</div>
                <div className="text-[8px] font-mono text-slate-300 tracking-widest">By Maker_{i}33</div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex justify-center">
          <button className="px-8 py-4 glass-strong rounded-2xl font-black text-xs tracking-widest uppercase border border-slate-200 dark:border-white/5 hover:border-brand-500/50 transition-all text-slate-600 dark:text-slate-200 bg-white dark:bg-transparent shadow-md">
            VER TODA A GALERIA
          </button>
        </div>
      </section>

      {/* Achievement Unlocked / Toast Overlay (Handled by original Toast component) */}

      <AnimatePresence>
        {selectedLesson && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 bg-deep-black z-[200] overflow-y-auto selection:bg-brand-500/30"
          >
            {/* Ambient Background Glow for Lesson */}
            <div className="fixed inset-0 z-0 pointer-events-none">
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-500/5 blur-[120px] rounded-full" />
              <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-neon-green/5 blur-[120px] rounded-full" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-12 py-8 pb-32">
              {/* Top Navigation */}
              <div className="flex items-center justify-between mb-12">
                <button 
                  onClick={() => setSelectedLesson(null)}
                  className="group flex items-center gap-3 glass px-6 py-3 rounded-2xl hover:bg-white/5 transition-all text-slate-400 hover:text-white"
                >
                  <ChevronRight className="rotate-180 group-hover:-translate-x-1 transition-transform" />
                  <span className="text-xs font-black uppercase tracking-[0.2em]">Abortar Missão</span>
                </button>
                
                <div className="hidden md:flex flex-col items-center gap-1">
                  <span className="text-xs font-mono font-black text-brand-400 uppercase tracking-[0.3em]">Module Stream Activated</span>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-neon-green animate-ping" />
                    <h2 className="text-xl font-black italic uppercase tracking-tighter text-white truncate max-w-md">{selectedLesson.title}</h2>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="hidden md:flex items-center gap-2 glass px-4 py-2 rounded-xl border border-white/5">
                    <Clock size={14} className="text-slate-500" />
                    <span className="text-xs font-mono font-bold text-slate-400 tracking-widest uppercase">EST. 35:00</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
                <div className="xl:col-span-8 space-y-12">
                  {/* Video Sector */}
                  {selectedLesson.videoUrl && (
                    <motion.div 
                      layoutId={`video-${selectedLesson.id}`}
                      className="aspect-video glass-strong rounded-[2.5rem] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10"
                    >
                      {selectedLesson.videoUrl.includes('youtube.com') || selectedLesson.videoUrl.includes('youtu.be') ? (
                        <iframe 
                          src={`https://www.youtube.com/embed/${selectedLesson.videoUrl.split('v=')[1] || selectedLesson.videoUrl.split('/').pop()}`}
                          className="w-full h-full"
                          allowFullScreen
                          title={selectedLesson.title}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-brand-950/20 flex-col gap-6">
                          <Youtube size={64} className="text-red-500 animate-pulse" />
                          <div className="space-y-4 text-center">
                            <h3 className="text-xl font-bold uppercase tracking-tighter italic">Feed Externo Detectado</h3>
                            <a 
                              href={selectedLesson.videoUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-3 px-8 py-4 bg-red-500 text-white font-black rounded-2xl hover:scale-105 transition-all text-xs tracking-widest shadow-2xl"
                            >
                              ASSISTIR NO YOUTUBE <ExternalLink size={16} />
                            </a>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Content Sector */}
                  <div className="glass p-6 md:p-16 rounded-[1.5rem] md:rounded-[2.5rem] border border-white/5 space-y-10">
                    <div className="flex items-center gap-4 border-b border-white/5 pb-8">
                      <div className="w-12 h-12 glass rounded-2xl flex items-center justify-center">
                        <FileText className="text-brand-400" />
                      </div>
                      <div>
                        <span className="text-xs font-mono font-black text-slate-500 uppercase tracking-[0.3em]">Encryption: ZERO-POINT</span>
                        <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">Manual e Esquemas</h3>
                      </div>
                    </div>
                    
                    <div className="prose prose-invert prose-brand max-w-none">
                      <div className="markdown-body !bg-transparent !text-slate-300 font-medium leading-relaxed">
                        <Markdown>{selectedLesson.content}</Markdown>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="xl:col-span-4 space-y-8">
                  {/* Progress Floating Indicator */}
                  <div className="glass p-6 md:p-8 rounded-3xl border border-white/5 space-y-6">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-mono font-black text-slate-500 uppercase tracking-[0.2em]">System Update</h4>
                      <span className="text-xs font-mono font-black text-neon-green uppercase tracking-[0.2em]">+15 XP</span>
                    </div>
                    
                    <button 
                      onClick={() => handleCompleteLesson(selectedLesson.id)}
                      disabled={isCompletingLesson || userData?.completedLessons?.includes(selectedLesson.id)}
                      className="w-full py-5 bg-gradient-to-r from-brand-500 to-brand-700 text-white font-black flex items-center justify-center gap-3 rounded-2xl hover:shadow-[0_0_30px_rgba(0,170,255,0.4)] disabled:opacity-50 disabled:grayscale transition-all text-xs tracking-[0.2em] transform active:scale-95"
                    >
                      {isCompletingLesson ? 'PROCESSANDO...' : userData?.completedLessons?.includes(selectedLesson.id) ? 'AUTORIZADO / CONCLUÍDO' : 'CONFIRMAR CONCLUSÃO ↓'}
                    </button>
                  </div>

                  {/* Communication Sector */}
                  <div className="glass p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border border-white/5 flex flex-col h-[500px]">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <MessageCircle size={20} className="text-brand-400" />
                        <h4 className="text-xs font-mono font-black text-slate-400 uppercase tracking-[0.2em]">Comlink ({comments.length})</h4>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar no-scrollbar scroll-smooth">
                      {comments.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-40 space-y-4">
                          <RefreshCcw size={32} className="animate-spin-slow" />
                          <p className="text-xs font-mono uppercase tracking-widest font-bold">Nenhum sinal detectado... <br />Seja o primeiro.</p>
                        </div>
                      ) : (
                        comments.map((comment) => (
                          <div key={comment.id} className="glass p-4 rounded-2xl border border-white/5 group hover:border-brand-500/30 transition-all">
                            <div className="flex gap-4">
                              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.userId}`} className="w-10 h-10 rounded-xl glass border border-white/5" alt="" />
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black uppercase text-brand-300 tracking-tight">{comment.userName}</span>
                                  <div className="flex items-center gap-2">
                                     {comment.userId === auth.currentUser?.email && (
                                       <button onClick={() => handleDeleteComment(comment.id)} className="text-red-500/40 hover:text-red-500 transition-colors p-2 md:p-1">
                                          <Trash2 size={14} />
                                       </button>
                                     )}
                                     <span className="text-[10px] font-mono text-slate-500">
                                       {comment.createdAt?.toDate ? comment.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'SYS'}
                                     </span>
                                  </div>
                                </div>
                                <p className="text-xs text-slate-400 leading-relaxed font-medium">{comment.content}</p>
                                <button 
                                  onClick={() => handleLikeComment(comment)}
                                  className={cn(
                                    "flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase transition-colors min-h-[32px]",
                                    comment.likes.includes(auth.currentUser?.email || '') ? "text-neon-green" : "text-slate-500 hover:text-slate-300"
                                  )}
                                >
                                  <Heart size={14} className={comment.likes.includes(auth.currentUser?.email || '') ? 'fill-neon-green' : ''} />
                                  {comment.likes.length}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <form onSubmit={handleAddComment} className="mt-6 relative">
                      <input
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Transmitir mensagem..."
                        className="w-full glass border border-white/10 rounded-2xl py-4 pl-6 pr-14 text-xs font-medium focus:border-brand-500 focus:ring-0 outline-none transition-all placeholder:text-slate-600"
                      />
                      <button 
                        type="submit"
                        disabled={isSendingComment || !newComment.trim()}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-brand-500 text-white rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 disabled:grayscale transition-all shadow-lg"
                      >
                        <Send size={16} />
                      </button>
                    </form>
                  </div>
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
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-8 md:p-12 max-w-lg w-full relative shadow-2xl text-center"
            >
              <button 
                onClick={() => setEligibleCourse(null)}
                className="absolute top-6 right-6 p-2 hover:bg-slate-50 dark:hover:bg-white/10 rounded-full text-slate-400 dark:text-slate-500 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="w-24 h-24 bg-amber-100 dark:bg-amber-500/20 rounded-3xl flex items-center justify-center mx-auto mb-8 relative">
                <Award className="w-12 h-12 text-amber-600" />
                <motion.div 
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute -top-2 -right-2 w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-white"
                >
                  <PartyPopper className="w-5 h-5" />
                </motion.div>
              </div>

              <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4">Novo Certificado! 🎓</h2>
              <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
                Você acaba de completar todos os requisitos para o curso <span className="font-bold text-indigo-600 dark:text-indigo-400">{eligibleCourse.title}</span>!
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
                  className="w-full bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 font-bold py-4 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
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
