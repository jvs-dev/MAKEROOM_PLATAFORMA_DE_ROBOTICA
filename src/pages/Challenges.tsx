import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, serverTimestamp, query, where, setDoc, doc, Timestamp, updateDoc, increment } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Zap, CheckCircle, Clock, ChevronRight, Send, AlertCircle, X, RefreshCcw } from 'lucide-react';

interface Question {
  id: string;
  text: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswers: string[];
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  type: 'quiz' | 'activity';
  points: number;
  teamId?: string;
  questions?: Question[];
}

interface Submission {
  id: string;
  challengeId: string;
  status: 'pending' | 'graded';
  grade?: number;
  earnedPoints?: number;
  answers?: { [questionId: string]: string[] };
}

interface QuizCooldown {
  id: string;
  challengeId: string;
  cooldownUntil: any;
}

export default function Challenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [submissions, setSubmissions] = useState<{ [id: string]: Submission }>({});
  const [cooldowns, setCooldowns] = useState<{ [id: string]: QuizCooldown }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [submissionContent, setSubmissionContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<{
    challengeId: string;
    answers: { [questionId: string]: string[] };
    startTime: number;
  } | null>(null);
  const [startConfirmation, setStartConfirmation] = useState<Challenge | null>(null);
  const [cancelConfirmation, setCancelConfirmation] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'warning' } | null>(null);
  const [reviewQuiz, setReviewQuiz] = useState<{
    challenge: Challenge;
    submission: Submission;
  } | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading && challenges.length > 0 && location.state?.challengeId) {
      const challenge = challenges.find(c => c.id === location.state.challengeId);
      if (challenge) {
        setSelectedChallenge(challenge);
        // Clear state to prevent re-opening on refresh
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [isLoading, challenges, location, navigate]);

  const showToast = (message: string, type: 'error' | 'success' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const fetchData = async () => {
    if (auth.currentUser && auth.currentUser.email) {
      try {
        // Get challenges
        const challengesSnapshot = await getDocs(collection(db, 'challenges'));
        const challengesList = challengesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Challenge));
        setChallenges(challengesList);

        // Get user submissions
        const submissionsQuery = query(collection(db, 'submissions'), where('userEmail', '==', auth.currentUser.email));
        const submissionsSnapshot = await getDocs(submissionsQuery);
        const submissionsList = submissionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        
        // Sort by createdAt descending to get the latest first
        submissionsList.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
          return timeB - timeA;
        });

        const submissionsMap: { [id: string]: Submission } = {};
        submissionsList.forEach(data => {
          // Only take the first (latest) one for each challenge
          if (!submissionsMap[data.challengeId]) {
            submissionsMap[data.challengeId] = data as Submission;
          }
        });
        setSubmissions(submissionsMap);

        // Get cooldowns
        const cooldownsQuery = query(collection(db, 'quizCooldowns'), where('userId', '==', auth.currentUser.uid));
        const cooldownsSnapshot = await getDocs(cooldownsQuery);
        const cooldownsMap: { [id: string]: QuizCooldown } = {};
        cooldownsSnapshot.forEach(doc => {
          const data = doc.data() as QuizCooldown;
          cooldownsMap[data.challengeId] = { id: doc.id, ...data };
        });
        setCooldowns(cooldownsMap);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'challenges/submissions/cooldowns');
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const applyPenalty = async (challengeId: string) => {
    if (!auth.currentUser) return;
    const cooldownUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    try {
      const cooldownId = `${challengeId}_${auth.currentUser.uid}`;
      await setDoc(doc(db, 'quizCooldowns', cooldownId), {
        userId: auth.currentUser.uid,
        challengeId,
        cooldownUntil: cooldownUntil,
      });
      setActiveQuiz(null);
      setSelectedChallenge(null);
      setCancelConfirmation(null);
      fetchData();
      showToast('Quiz cancelado. Você poderá tentar novamente em 15 minutos.', 'warning');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'quizCooldowns');
    }
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && activeQuiz) {
        applyPenalty(activeQuiz.challengeId);
      }
    };

    const handleBlur = () => {
      if (activeQuiz) {
        applyPenalty(activeQuiz.challengeId);
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [activeQuiz]);

  const startQuiz = (challenge: Challenge) => {
    const cooldown = cooldowns[challenge.id];
    const cooldownDate = cooldown?.cooldownUntil instanceof Timestamp 
      ? cooldown.cooldownUntil.toDate() 
      : (cooldown?.cooldownUntil instanceof Date ? cooldown.cooldownUntil : null);

    if (cooldownDate && cooldownDate > new Date()) {
      const remaining = Math.ceil((cooldownDate.getTime() - Date.now()) / (60 * 1000));
      showToast(`Este quiz está bloqueado. Você poderá tentar novamente em ${remaining} minutos.`, 'error');
      return;
    }

    setStartConfirmation(challenge);
  };

  const confirmStartQuiz = () => {
    if (!startConfirmation) return;
    
    setActiveQuiz({
      challengeId: startConfirmation.id,
      answers: {},
      startTime: Date.now(),
    });
    setSelectedChallenge(startConfirmation);
    setStartConfirmation(null);
  };

  const handleQuizAnswer = (questionId: string, option: string) => {
    if (!activeQuiz) return;
    const currentAnswers = activeQuiz.answers[questionId] || [];
    let newAnswers: string[];
    
    if (currentAnswers.includes(option)) {
      newAnswers = currentAnswers.filter(a => a !== option);
    } else {
      newAnswers = [...currentAnswers, option];
    }

    setActiveQuiz({
      ...activeQuiz,
      answers: {
        ...activeQuiz.answers,
        [questionId]: newAnswers,
      }
    });
  };

  const submitQuiz = async () => {
    if (!activeQuiz || !selectedChallenge || !auth.currentUser || !auth.currentUser.email) return;
    
    // Check if all questions are answered
    const questions = selectedChallenge.questions || [];
    if (questions.some(q => !activeQuiz.answers[q.id] || activeQuiz.answers[q.id].length === 0)) {
      showToast('Por favor, responda todas as perguntas.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      // Calculate grade
      let correctCount = 0;
      questions.forEach(q => {
        const userAnswers = activeQuiz.answers[q.id] || [];
        const correctAnswers = q.correctAnswers || [];
        if (userAnswers.length === correctAnswers.length && userAnswers.every(a => correctAnswers.includes(a))) {
          correctCount++;
        }
      });
      const grade = Math.round((correctCount / questions.length) * 100);
      const earnedPoints = Math.round((correctCount / questions.length) * selectedChallenge.points);

      await addDoc(collection(db, 'submissions'), {
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email,
        challengeId: selectedChallenge.id,
        answers: activeQuiz.answers,
        status: 'graded',
        grade,
        earnedPoints,
        createdAt: serverTimestamp(),
      });

      // Update user points in their profile
      const userRef = doc(db, 'users', auth.currentUser.email);
      await updateDoc(userRef, {
        points: increment(earnedPoints)
      });

      // Set cooldown if grade is less than 100%
      if (grade < 100) {
        const cooldownUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        const cooldownId = `${selectedChallenge.id}_${auth.currentUser.uid}`;
        await setDoc(doc(db, 'quizCooldowns', cooldownId), {
          userId: auth.currentUser.uid,
          challengeId: selectedChallenge.id,
          cooldownUntil: cooldownUntil,
        });
      }

      const newSubmission: Submission = { 
        id: 'temp', 
        challengeId: selectedChallenge.id, 
        status: 'graded', 
        grade,
        earnedPoints,
        answers: activeQuiz.answers 
      };

      setSubmissions(prev => ({ 
        ...prev, 
        [selectedChallenge.id]: newSubmission
      }));
      
      setActiveQuiz(null);
      setSelectedChallenge(null);
      setReviewQuiz({ challenge: selectedChallenge, submission: newSubmission });
      fetchData();
      showToast(`Quiz enviado! Você ganhou ${earnedPoints} pontos.`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'submissions');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitActivity = async () => {
    if (!selectedChallenge || !submissionContent || !auth.currentUser || !auth.currentUser.email) return;
    setIsSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, 'submissions'), {
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email,
        challengeId: selectedChallenge.id,
        content: submissionContent,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setSubmissions(prev => ({ 
        ...prev, 
        [selectedChallenge.id]: { id: docRef.id, challengeId: selectedChallenge.id, status: 'pending' } 
      }));
      showToast('Atividade enviada com sucesso!', 'success');
      setSelectedChallenge(null);
      setSubmissionContent('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'submissions');
    } finally {
      setIsSubmitting(false);
    }
  };

  const completedChallenges = challenges.filter(c => !!submissions[c.id]);
  const availableChallenges = challenges.filter(c => !submissions[c.id]);

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
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-1 md:mb-2">Desafios Maker ⚡</h1>
          <p className="text-slate-500 text-sm md:text-base">Supere limites e ganhe pontos para subir no ranking.</p>
        </div>
        <div className="bg-brand-50 p-3 md:p-4 rounded-2xl flex items-center gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-brand-500 rounded-xl flex items-center justify-center shadow-md shadow-brand-100">
            <Zap className="text-white w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div>
            <p className="text-[10px] text-brand-600 font-bold uppercase tracking-wider">Concluídos</p>
            <p className="text-slate-900 font-bold text-sm md:text-base">{Object.keys(submissions).length} / {challenges.length} Desafios</p>
          </div>
        </div>
      </header>

      {availableChallenges.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-xl font-bold text-slate-900 px-2">Desafios Disponíveis</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {availableChallenges.map((challenge) => {
              const cooldown = cooldowns[challenge.id];
              const cooldownDate = cooldown?.cooldownUntil instanceof Timestamp 
                ? cooldown.cooldownUntil.toDate() 
                : (cooldown?.cooldownUntil instanceof Date ? cooldown.cooldownUntil : null);

              const isOnCooldown = cooldownDate && cooldownDate > new Date();
              const remainingMinutes = isOnCooldown 
                ? Math.ceil((cooldownDate.getTime() - Date.now()) / (60 * 1000)) 
                : 0;

              return (
                <div key={challenge.id} className={`bg-white p-4 md:p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all duration-200 flex flex-col ${isOnCooldown ? 'opacity-75' : ''}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex gap-2">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                        challenge.type === 'quiz' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                      }`}>
                        {challenge.type === 'quiz' ? 'Quiz' : 'Atividade'}
                      </span>
                      {isOnCooldown && (
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-red-50 text-red-600 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Bloqueado
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-brand-600 font-bold text-sm">
                      <Zap className="w-4 h-4 fill-brand-500" />
                      {challenge.points} pts
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 mb-2">{challenge.title}</h3>
                  <p className="text-slate-500 text-sm mb-6 line-clamp-2">{challenge.description}</p>
                  
                  {isOnCooldown && (
                    <div className="mb-4 p-3 bg-red-50 rounded-xl border border-red-100">
                      <p className="text-xs text-red-600 font-medium flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Tente novamente em {remainingMinutes} min
                      </p>
                    </div>
                  )}

                  <div className="mt-auto pt-6 border-t border-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-400 text-xs">
                      <Clock className="w-4 h-4" />
                      <span>{isOnCooldown ? 'Aguarde o cooldown' : 'Disponível'}</span>
                    </div>
                    
                    <button 
                      onClick={() => challenge.type === 'quiz' ? startQuiz(challenge) : setSelectedChallenge(challenge)}
                      disabled={isOnCooldown}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 ${
                        isOnCooldown 
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      {isOnCooldown ? 'Bloqueado' : 'Participar'} <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {completedChallenges.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-xl font-bold text-slate-900 px-2">Desafios Concluídos 🎉</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {completedChallenges.map((challenge) => {
              const submission = submissions[challenge.id];
              const isGraded = submission?.status === 'graded';
              const cooldown = cooldowns[challenge.id];
              
              const cooldownDate = cooldown?.cooldownUntil instanceof Timestamp 
                ? cooldown.cooldownUntil.toDate() 
                : (cooldown?.cooldownUntil instanceof Date ? cooldown.cooldownUntil : null);

              const isOnCooldown = cooldownDate && cooldownDate > new Date();
              const remainingMinutes = isOnCooldown 
                ? Math.ceil((cooldownDate.getTime() - Date.now()) / (60 * 1000)) 
                : 0;

              const isPerfect = isGraded && submission.grade === 100;

              return (
                <div key={challenge.id} className={`p-4 md:p-6 rounded-3xl shadow-sm border transition-all duration-200 flex flex-col ${
                  isPerfect ? 'bg-emerald-50/30 border-emerald-100' : 'bg-white border-slate-100'
                } ${isOnCooldown ? 'opacity-75' : ''}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex gap-2">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                        challenge.type === 'quiz' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                      }`}>
                        {challenge.type === 'quiz' ? 'Quiz' : 'Atividade'}
                      </span>
                      <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-emerald-50 text-emerald-600 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Concluído
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-brand-600 font-bold text-sm">
                      <Zap className="w-4 h-4 fill-brand-500" />
                      {isGraded ? submission.earnedPoints : challenge.points} pts
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 mb-2">{challenge.title}</h3>
                  <p className="text-slate-500 text-sm mb-6 line-clamp-2">{challenge.description}</p>
                  
                  {isOnCooldown && (
                    <div className="mb-4 p-3 bg-red-50 rounded-xl border border-red-100">
                      <p className="text-xs text-red-600 font-medium flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Tente novamente em {remainingMinutes} min
                      </p>
                    </div>
                  )}

                  <div className="mt-auto pt-6 border-t border-slate-50 flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                        <CheckCircle className="w-4 h-4" />
                        {isGraded ? `Nota: ${submission.grade}%` : 'Enviado'}
                      </div>
                      {challenge.type === 'quiz' && isGraded && (
                        <button 
                          onClick={() => setReviewQuiz({ challenge, submission })}
                          className="text-[10px] font-bold text-brand-500 hover:text-brand-600 flex items-center gap-1 uppercase tracking-wider"
                        >
                          Ver Revisão <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    
                    {(!isPerfect && !isOnCooldown) && (
                      <button 
                        onClick={() => challenge.type === 'quiz' ? startQuiz(challenge) : setSelectedChallenge(challenge)}
                        className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors flex items-center gap-2"
                      >
                        Refazer <RefreshCcw className="w-4 h-4" />
                      </button>
                    )}

                    {isOnCooldown && (
                      <div className="text-red-600 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Bloqueado
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-8 right-8 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border ${
            toast.type === 'error' ? 'bg-red-50 border-red-100 text-red-600' :
            toast.type === 'warning' ? 'bg-amber-50 border-amber-100 text-amber-600' :
            'bg-emerald-50 border-emerald-100 text-emerald-600'
          }`}
        >
          <AlertCircle className="w-5 h-5" />
          <span className="font-bold">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Start Quiz Confirmation Modal */}
      {startConfirmation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div 
            className="bg-white p-8 rounded-[32px] shadow-2xl max-w-md w-full border border-slate-100"
          >
              <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <AlertCircle className="w-8 h-8 text-amber-500" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 text-center mb-4">Iniciar Quiz?</h2>
              <div className="space-y-4 text-slate-600 text-center mb-8">
                <p className="font-medium">
                  ATENÇÃO: Ao iniciar o quiz, você <span className="text-red-600 font-bold">NÃO</span> poderá fechar a janela ou trocar de página.
                </p>
                <p className="text-sm">
                  Se você sair ou minimizar a página, perderá a tentativa e só poderá acessar novamente após 15 minutos.
                </p>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setStartConfirmation(null)}
                  className="flex-1 px-6 py-4 rounded-2xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmStartQuiz}
                  className="flex-1 px-6 py-4 rounded-2xl bg-brand-500 text-white font-bold hover:bg-brand-600 transition-colors shadow-lg shadow-brand-100"
                >
                  Iniciar Agora
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Cancel Quiz Confirmation Modal */}
      {cancelConfirmation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[70] flex items-center justify-center p-4">
          <div 
            className="bg-white p-8 rounded-[32px] shadow-2xl max-w-md w-full border border-slate-100"
          >
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 text-center mb-4">Sair do Quiz?</h2>
              <div className="space-y-4 text-slate-600 text-center mb-8">
                <p className="font-medium">
                  Se você sair agora, perderá esta tentativa e terá que esperar <span className="text-red-600 font-bold">15 minutos</span> para tentar novamente.
                </p>
                <p className="text-sm">Deseja realmente sair?</p>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setCancelConfirmation(null)}
                  className="flex-1 px-6 py-4 rounded-2xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors"
                >
                  Continuar Quiz
                </button>
                <button 
                  onClick={() => applyPenalty(cancelConfirmation)}
                  className="flex-1 px-6 py-4 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-100"
                >
                  Sair e Bloquear
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Review Quiz Modal */}
      {reviewQuiz && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div 
            className="bg-white p-8 rounded-[32px] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-100"
          >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Revisão: {reviewQuiz.challenge.title}</h2>
                  <p className="text-slate-500 font-medium">Sua nota: <span className="text-brand-600 font-bold">{reviewQuiz.submission.grade}</span></p>
                </div>
                <button 
                  onClick={() => setReviewQuiz(null)}
                  className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-10 mb-8">
                {reviewQuiz.challenge.questions?.map((q, idx) => {
                  const userAnswers = reviewQuiz.submission.answers?.[q.id] || [];
                  const correctAnswers = q.correctAnswers || [];
                  const isCorrect = userAnswers.length === correctAnswers.length && userAnswers.every(a => correctAnswers.includes(a));

                  return (
                    <div key={q.id} className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center font-bold ${
                          isCorrect ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                        }`}>
                          {idx + 1}
                        </div>
                        <p className="font-bold text-slate-900 pt-1">{q.text}</p>
                      </div>

                      <div className="grid grid-cols-1 gap-3 pl-11">
                        {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                          const isUserSelected = userAnswers.includes(opt);
                          const isCorrectOption = correctAnswers.includes(opt);
                          
                          let bgClass = 'bg-slate-50 border-slate-100 text-slate-600';
                          let icon = null;

                          if (isCorrectOption) {
                            bgClass = 'bg-emerald-50 border-emerald-200 text-emerald-700 ring-2 ring-emerald-500/20';
                            icon = <CheckCircle className="w-4 h-4 text-emerald-500" />;
                          } else if (isUserSelected && !isCorrectOption) {
                            bgClass = 'bg-red-50 border-red-200 text-red-700 ring-2 ring-red-500/20';
                            icon = <AlertCircle className="w-4 h-4 text-red-500" />;
                          }

                          return (
                            <div
                              key={opt}
                              className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${bgClass}`}
                            >
                              <div className="flex items-center gap-4">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                                  isCorrectOption ? 'bg-emerald-500 text-white' : 
                                  isUserSelected ? 'bg-red-500 text-white' : 'bg-white text-slate-400'
                                }`}>
                                  {opt}
                                </div>
                                <span className="font-medium">{q.options[opt]}</span>
                              </div>
                              {icon}
                            </div>
                          );
                        })}
                      </div>
                      
                      {!isCorrect && (
                        <div className="pl-11">
                          <p className="text-xs font-bold text-red-500 uppercase tracking-widest bg-red-50 px-3 py-1 rounded-full inline-block">
                            Resposta Incorreta
                          </p>
                        </div>
                      )}
                      {isCorrect && (
                        <div className="pl-11">
                          <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full inline-block">
                            Resposta Correta
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button 
                onClick={() => setReviewQuiz(null)}
                className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
              >
                Fechar Revisão
              </button>
            </div>
          </div>
        )}

      {/* Submission Modal */}
      {selectedChallenge && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div 
            className="bg-white p-8 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-900">{selectedChallenge.title}</h2>
                <button 
                  onClick={() => {
                    if (activeQuiz) {
                      setCancelConfirmation(selectedChallenge.id);
                    } else {
                      setSelectedChallenge(null);
                    }
                  }} 
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            
            <p className="text-slate-500 mb-6">{selectedChallenge.description}</p>
            
            {selectedChallenge.type === 'activity' ? (
              <div className="space-y-4 mb-8">
                <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">
                  Sua Resposta / Link do Projeto
                </label>
                <textarea 
                  value={submissionContent}
                  onChange={(e) => setSubmissionContent(e.target.value)}
                  placeholder="Digite sua resposta ou cole o link do seu projeto aqui..."
                  className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all outline-none resize-none"
                />
              </div>
            ) : (
              <div className="space-y-8 mb-8">
                {selectedChallenge.questions?.map((q, idx) => (
                  <div key={q.id} className="space-y-4">
                    <p className="font-bold text-slate-900">
                      <span className="text-brand-600 mr-2">{idx + 1}.</span>
                      {q.text}
                    </p>
                    <div className="grid grid-cols-1 gap-3">
                      {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                        const isSelected = activeQuiz?.answers[q.id]?.includes(opt);
                        return (
                          <button
                            key={opt}
                            onClick={() => handleQuizAnswer(q.id, opt)}
                            className={`w-full p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-4 ${
                              isSelected 
                                ? 'border-brand-500 bg-brand-50 text-brand-700' 
                                : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-200'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                              isSelected ? 'bg-brand-500 text-white' : 'bg-white text-slate-400'
                            }`}>
                              {opt}
                            </div>
                            <span className="font-medium">{q.options[opt]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-4">
              <button 
                onClick={() => {
                  if (activeQuiz) {
                    setCancelConfirmation(selectedChallenge.id);
                  } else {
                    setSelectedChallenge(null);
                  }
                }}
                className="flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-2xl hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                disabled={isSubmitting || (selectedChallenge.type === 'activity' ? !submissionContent : false)}
                onClick={selectedChallenge.type === 'activity' ? handleSubmitActivity : submitQuiz}
                className="flex-1 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-200 text-white font-bold py-3 rounded-2xl transition-all shadow-lg shadow-brand-100 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                ) : (
                  <>Enviar Resposta <Send className="w-4 h-4" /></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
