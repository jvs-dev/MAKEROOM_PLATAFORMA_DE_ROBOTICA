import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { 
  BookOpen, 
  Zap, 
  Award, 
  CheckCircle2, 
  Circle, 
  ChevronLeft, 
  Loader2,
  Trophy,
  Download,
  AlertCircle,
  RefreshCcw,
  PartyPopper,
  X,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Course {
  id: string;
  title: string;
  description: string;
  lessonIds: string[];
  challengeIds: string[];
  pointsReward: number;
  thumbnail: string;
}

interface Lesson {
  id: string;
  title: string;
}

interface Challenge {
  id: string;
  title: string;
}

interface Submission {
  challengeId: string;
  grade: number;
  status: string;
}

interface QuizCooldown {
  challengeId: string;
  cooldownUntil: any;
}

export default function CourseView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [cooldowns, setCooldowns] = useState<QuizCooldown[]>([]);
  const [userData, setUserData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isIssuing, setIsIssuing] = useState(false);
  const [certificate, setCertificate] = useState<any>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const courseDoc = await getDoc(doc(db, 'courses', id!));
      if (!courseDoc.exists()) {
        navigate('/');
        return;
      }
      const courseData = { id: courseDoc.id, ...courseDoc.data() } as Course;
      setCourse(courseData);

      // Fetch lessons
      const lessonsData = await Promise.all(
        (courseData.lessonIds || []).map(async (lid) => {
          const lDoc = await getDoc(doc(db, 'lessons', lid));
          return lDoc.exists() ? { id: lDoc.id, title: lDoc.data().title } : null;
        })
      );
      setLessons(lessonsData.filter(l => l !== null) as Lesson[]);

      // Fetch challenges
      const challengesData = await Promise.all(
        (courseData.challengeIds || []).map(async (cid) => {
          const cDoc = await getDoc(doc(db, 'challenges', cid));
          return cDoc.exists() ? { id: cDoc.id, title: cDoc.data().title } : null;
        })
      );
      setChallenges(challengesData.filter(c => c !== null) as Challenge[]);

      // Fetch user data and submissions
      if (auth.currentUser?.email) {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.email));
        setUserData(userDoc.data());

        const subsSnap = await getDocs(query(
          collection(db, 'submissions'),
          where('userId', '==', auth.currentUser.uid)
        ));
        const subsList = subsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        
        // Sort by createdAt descending to get the latest first
        subsList.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
          return timeB - timeA;
        });
        
        setSubmissions(subsList as Submission[]);

        // Check for existing certificate
        const certsSnap = await getDocs(query(
          collection(db, 'certificates'),
          where('userId', '==', auth.currentUser.email),
          where('courseId', '==', id)
        ));
        if (!certsSnap.empty) {
          setCertificate({ id: certsSnap.docs[0].id, ...certsSnap.docs[0].data() });
        }

        // Fetch cooldowns
        const cooldownsSnap = await getDocs(query(
          collection(db, 'quizCooldowns'),
          where('userId', '==', auth.currentUser.uid)
        ));
        setCooldowns(cooldownsSnap.docs.map(doc => doc.data() as QuizCooldown));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'course-view');
    } finally {
      setIsLoading(false);
    }
  };

  const isLessonCompleted = (lessonId: string) => {
    return userData?.completedLessons?.includes(lessonId);
  };

  const getQuizResult = (challengeId: string) => {
    return submissions.find(s => s.challengeId === challengeId && s.status === 'graded');
  };

  const getCooldown = (challengeId: string) => {
    const cooldown = cooldowns.find(c => c.challengeId === challengeId);
    if (!cooldown) return null;
    
    const until = cooldown.cooldownUntil?.toDate ? cooldown.cooldownUntil.toDate() : new Date(cooldown.cooldownUntil);
    if (until > new Date()) {
      return until;
    }
    return null;
  };

  const allLessonsCompleted = course?.lessonIds.every(id => isLessonCompleted(id));
  const allQuizzesPassed = course?.challengeIds.every(id => {
    const res = getQuizResult(id);
    return res && res.grade >= 70;
  });

  const averageGrade = course?.challengeIds.length 
    ? course.challengeIds.reduce((acc, id) => acc + (getQuizResult(id)?.grade || 0), 0) / course.challengeIds.length
    : 100;

  const canClaimCertificate = allLessonsCompleted && allQuizzesPassed && !certificate;

  const handleClaimCertificate = async () => {
    if (!canClaimCertificate || !auth.currentUser?.email || !course) return;
    
    setIsIssuing(true);
    try {
      const certData = {
        userId: auth.currentUser.email,
        userName: userData.name,
        courseId: course.id,
        courseTitle: course.title,
        issueDate: serverTimestamp(),
        grade: averageGrade
      };
      const docRef = await addDoc(collection(db, 'certificates'), certData);
      
      // Update user document with certificate ID
      await updateDoc(doc(db, 'users', auth.currentUser.email), {
        certificates: arrayUnion(docRef.id)
      });

      setCertificate({ id: docRef.id, ...certData });
      setShowSuccessModal(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'certificates');
    } finally {
      setIsIssuing(false);
    }
  };

  const handlePrintCertificate = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const date = certificate.issueDate?.toDate ? certificate.issueDate.toDate().toLocaleDateString() : new Date().toLocaleDateString();

    printWindow.document.write(`
      <html>
        <head>
          <title>Certificado - ${course?.title}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { 
              margin: 0; 
              padding: 0; 
              font-family: 'Inter', sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              background: #f8fafc;
            }
            .certificate {
              width: 800px;
              height: 600px;
              background: white;
              border: 20px solid #4f46e5;
              padding: 60px;
              text-align: center;
              position: relative;
              box-shadow: 0 20px 50px rgba(0,0,0,0.1);
            }
            .logo { font-size: 24px; font-weight: 900; color: #4f46e5; margin-bottom: 40px; }
            h1 { font-size: 48px; margin: 20px 0; color: #1e293b; }
            h2 { font-size: 24px; color: #64748b; font-weight: 400; margin-bottom: 40px; }
            .name { font-size: 36px; font-weight: 700; color: #4f46e5; margin: 20px 0; text-decoration: underline; }
            .course { font-size: 28px; font-weight: 700; color: #1e293b; }
            .footer { margin-top: 60px; display: flex; justify-content: space-between; align-items: flex-end; }
            .info { text-align: left; color: #64748b; font-size: 14px; }
            .stamp { width: 100px; height: 100px; border: 4px double #4f46e5; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #4f46e5; font-weight: 900; transform: rotate(-15deg); }
          </style>
        </head>
        <body>
          <div class="certificate">
            <div class="logo">MAKEROOM ROBÓTICA</div>
            <h2>Certificamos que</h2>
            <div class="name">${userData.name}</div>
            <h2>concluiu com êxito o curso de</h2>
            <div class="course">${course?.title}</div>
            <div class="footer">
              <div class="info">
                <p>Data de Emissão: ${date}</p>
                <p>Média Final: ${averageGrade.toFixed(1)}%</p>
                <p>ID do Certificado: ${certificate.id}</p>
              </div>
              <div class="stamp">APROVADO</div>
            </div>
          </div>
          <script>
            window.onload = () => { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
        <p className="text-slate-500 font-medium">Carregando detalhes da trilha...</p>
      </div>
    );
  }

  if (!course) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <button 
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold transition-colors group"
      >
        <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> Voltar para Início
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {certificate && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-500 text-white p-6 rounded-[2rem] shadow-lg shadow-emerald-100 flex items-center justify-between gap-6"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <Trophy className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">Trilha Concluída! 🎉</h3>
                  <p className="text-emerald-50 text-xs font-bold opacity-90">Você dominou todos os conceitos desta trilha.</p>
                </div>
              </div>
              <button 
                onClick={handlePrintCertificate}
                className="bg-white text-emerald-600 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-50 transition-all shadow-md"
              >
                Ver Certificado
              </button>
            </motion.div>
          )}

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">Trilha de Aprendizado</span>
              {certificate && (
                <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Concluído
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-4">{course.title}</h1>
            <p className="text-slate-600 leading-relaxed mb-8">{course.description}</p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <BookOpen className="w-5 h-5 text-indigo-500 mb-2" />
                <p className="text-xs text-slate-500 font-bold uppercase">Aulas</p>
                <p className="text-lg font-bold text-slate-900">{lessons.length}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <Zap className="w-5 h-5 text-amber-500 mb-2" />
                <p className="text-xs text-slate-500 font-bold uppercase">Quizes</p>
                <p className="text-lg font-bold text-slate-900">{challenges.length}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <Trophy className="w-5 h-5 text-emerald-500 mb-2" />
                <p className="text-xs text-slate-500 font-bold uppercase">Pontos</p>
                <p className="text-lg font-bold text-slate-900">+{course.pointsReward}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 px-4">Conteúdo do Curso</h2>
            <div className="space-y-3">
              {lessons.map((lesson, idx) => (
                <div 
                  key={lesson.id}
                  onClick={() => navigate('/', { state: { lessonId: lesson.id } })}
                  className={`bg-white p-5 rounded-2xl border flex items-center gap-4 transition-all cursor-pointer hover:shadow-md hover:border-indigo-200 ${
                    isLessonCompleted(lesson.id) ? 'border-emerald-100 bg-emerald-50/30' : 'border-slate-100'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                    isLessonCompleted(lesson.id) ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {isLessonCompleted(lesson.id) ? <CheckCircle2 className="w-6 h-6" /> : idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-slate-900">{lesson.title}</p>
                    <p className="text-xs text-slate-500">Aula Teórica</p>
                  </div>
                  {!isLessonCompleted(lesson.id) && (
                    <div className="text-indigo-600 font-bold text-xs hover:underline">
                      Assistir
                    </div>
                  )}
                </div>
              ))}

              {challenges.map((quiz) => {
                const result = getQuizResult(quiz.id);
                const isPassed = result && result.grade >= 70;
                const isPerfect = result && result.grade === 100;
                const cooldownUntil = getCooldown(quiz.id);
                const isOnCooldown = !!cooldownUntil;
                const isDisabled = isOnCooldown || isPerfect;

                return (
                  <div 
                    key={quiz.id}
                    onClick={() => !isDisabled && navigate('/challenges', { state: { challengeId: quiz.id } })}
                    className={`bg-white p-5 rounded-2xl border flex items-center gap-4 transition-all ${
                      isDisabled ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer hover:shadow-md hover:border-amber-200'
                    } ${
                      isOnCooldown ? 'border-red-100 bg-red-50/10' : (isPassed ? 'border-amber-100 bg-amber-50/30' : 'border-slate-100')
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                      isOnCooldown ? 'bg-red-100 text-red-500' : (isPassed ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400')
                    }`}>
                      {isOnCooldown ? <Clock className="w-6 h-6" /> : (isPassed ? <CheckCircle2 className="w-6 h-6" /> : <Zap className="w-6 h-6" />)}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-slate-900">{quiz.title}</p>
                      <p className="text-xs text-slate-500">
                        {isOnCooldown ? (
                          <span className="text-red-600 font-medium">
                            Em cooldown até {cooldownUntil.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          result ? `Nota: ${result.grade}%` : 'Quiz de Avaliação'
                        )}
                      </p>
                    </div>
                    {(!result || (result.grade < 100)) && !isOnCooldown && (
                      <div className="text-indigo-600 font-bold text-xs hover:underline flex items-center gap-1">
                        {result ? 'Refazer' : 'Responder'} <RefreshCcw className="w-3 h-3" />
                      </div>
                    )}
                    {isOnCooldown && (
                      <div className="text-red-600 font-bold text-[10px] uppercase tracking-wider">
                        Bloqueado
                      </div>
                    )}
                    {isPerfect && (
                      <div className="text-emerald-600 font-bold text-[10px] uppercase tracking-wider">
                        Concluído
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm sticky top-8">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Seu Progresso</h3>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${allLessonsCompleted ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-slate-700">Aulas</span>
                </div>
                <span className="text-sm font-black text-slate-900">
                  {userData?.completedLessons?.filter((id: string) => course.lessonIds.includes(id)).length || 0}/{course.lessonIds.length}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${allQuizzesPassed ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                    <Zap className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-slate-700">Quizes</span>
                </div>
                <span className="text-sm font-black text-slate-900">
                  {course.challengeIds.filter(id => getQuizResult(id)?.grade && getQuizResult(id)!.grade >= 70).length}/{course.challengeIds.length}
                </span>
              </div>

              <div className="pt-6 border-t border-slate-50">
                {certificate ? (
                  <div className="space-y-4">
                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-center">
                      <Award className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                      <p className="text-sm font-bold text-emerald-900">Certificado Conquistado!</p>
                      <p className="text-[10px] text-emerald-600 uppercase font-black mt-1">Média: {certificate.grade.toFixed(1)}%</p>
                    </div>
                    <button 
                      onClick={handlePrintCertificate}
                      className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                    >
                      <Download className="w-5 h-5" /> Baixar Certificado
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {!allQuizzesPassed && submissions.some(s => course.challengeIds.includes(s.challengeId) && s.grade < 70) && (
                      <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                        <p className="text-xs text-red-700 leading-relaxed">
                          Você não atingiu a nota mínima de 70% em alguns quizes. Refaça-os para ganhar o certificado.
                        </p>
                      </div>
                    )}
                    
                    <button 
                      onClick={handleClaimCertificate}
                      disabled={!canClaimCertificate || isIssuing}
                      className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg"
                    >
                      {isIssuing ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Award className="w-5 h-5" />
                      )}
                      {isIssuing ? 'Emitindo...' : 'Resgatar Certificado'}
                    </button>
                    
                    {!canClaimCertificate && !certificate && (
                      <p className="text-[10px] text-slate-400 text-center font-medium">
                        Complete todas as aulas e atinja 70% nos quizes para liberar.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSuccessModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[2.5rem] p-8 md:p-12 max-w-lg w-full relative shadow-2xl text-center"
            >
              <button 
                onClick={() => setShowSuccessModal(false)}
                className="absolute top-6 right-6 p-2 hover:bg-slate-50 rounded-full text-slate-400 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="w-24 h-24 bg-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-8 relative">
                <PartyPopper className="w-12 h-12 text-indigo-600" />
                <motion.div 
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute -top-2 -right-2 w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center text-white"
                >
                  <Award className="w-5 h-5" />
                </motion.div>
              </div>

              <h2 className="text-3xl font-black text-slate-900 mb-4">Parabéns, {userData?.name}! 🎉</h2>
              <p className="text-slate-600 mb-8 leading-relaxed">
                Você concluiu com sucesso o curso <span className="font-bold text-indigo-600">{course.title}</span> e seu certificado oficial já está disponível!
              </p>

              <div className="space-y-3">
                <button 
                  onClick={() => {
                    setShowSuccessModal(false);
                    handlePrintCertificate();
                  }}
                  className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                >
                  <Download className="w-5 h-5" /> Baixar Certificado Agora
                </button>
                <button 
                  onClick={() => navigate('/profile')}
                  className="w-full bg-slate-50 text-slate-600 font-bold py-4 rounded-2xl hover:bg-slate-100 transition-all"
                >
                  Ver no meu Perfil
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
