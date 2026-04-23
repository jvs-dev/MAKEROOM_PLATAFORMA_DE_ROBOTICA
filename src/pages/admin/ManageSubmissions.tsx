import { useEffect, useState } from 'react';
import { collection, getDocs, updateDoc, doc, getDoc, increment } from 'firebase/firestore';
import { awardPoints } from '../../services/userService';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { CheckSquare, User, Zap, Clock, ExternalLink, Check, X } from 'lucide-react';

interface Submission {
  id: string;
  userId: string;
  userEmail: string;
  challengeId: string;
  content?: string;
  answers?: { [questionId: string]: string[] };
  status: 'pending' | 'graded';
  grade?: number;
  userName?: string;
  challengeTitle?: string;
  challengeType?: 'quiz' | 'activity';
}

export default function ManageSubmissions() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [gradeValue, setGradeValue] = useState(100);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    setIsLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'submissions'));
      const subs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
      
      // Fetch user names and challenge titles
      const enrichedSubs = await Promise.all(subs.map(async (sub) => {
        try {
          const userDoc = await getDoc(doc(db, 'users', sub.userEmail));
          const challengeDoc = await getDoc(doc(db, 'challenges', sub.challengeId));
          return {
            ...sub,
            userName: userDoc.exists() ? userDoc.data().name : 'Usuário Desconhecido',
            challengeTitle: challengeDoc.exists() ? challengeDoc.data().title : 'Desafio Desconhecido',
            challengeType: challengeDoc.exists() ? challengeDoc.data().type : 'activity',
          };
        } catch (err) {
          console.warn(`Could not enrich submission ${sub.id}:`, err);
          return sub;
        }
      }));

      setSubmissions(enrichedSubs);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'submissions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGrade = async (submission: Submission) => {
    try {
      await updateDoc(doc(db, 'submissions', submission.id), {
        status: 'graded',
        grade: gradeValue,
      });

      // Award points and sync profile automatically via awardPoints service
      const challengeDoc = await getDoc(doc(db, 'challenges', submission.challengeId));
      if (challengeDoc.exists()) {
        const points = challengeDoc.data().points;
        await awardPoints(submission.userId, submission.userEmail, points);
      }

      setGradingId(null);
      fetchSubmissions();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `submissions/${submission.id}`);
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Corrigir Atividades ✅</h1>
        <p className="text-slate-500 dark:text-slate-400">Avalie o trabalho dos alunos e atribua notas.</p>
      </header>

      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-slate-100 dark:border-white/10 overflow-x-auto transition-colors">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/10">
              <th className="p-6 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Aluno / Desafio</th>
              <th className="p-6 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Conteúdo</th>
              <th className="p-6 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Status</th>
              <th className="p-6 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-white/5">
            {submissions.map((sub) => (
              <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                <td className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-100 dark:bg-white/10 rounded-xl flex items-center justify-center transition-colors">
                      <User className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{sub.userName}</p>
                      <p className="text-xs text-brand-600 dark:text-brand-400 font-medium">{sub.challengeTitle}</p>
                    </div>
                  </div>
                </td>
                <td className="p-6">
                  <div className="max-w-xs">
                    {sub.challengeType === 'quiz' ? (
                      <button 
                        onClick={() => setSelectedSubmission(sub)}
                        className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-bold flex items-center gap-1"
                      >
                        Ver Respostas do Quiz <ExternalLink className="w-3 h-3" />
                      </button>
                    ) : (
                      <>
                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{sub.content}</p>
                        {sub.content?.startsWith('http') && (
                          <a href={sub.content} target="_blank" rel="noreferrer" className="text-xs text-blue-500 dark:text-blue-400 hover:underline flex items-center gap-1 mt-1">
                            Abrir link <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </>
                    )}
                  </div>
                </td>
                <td className="p-6">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${
                    sub.status === 'graded' ? 'bg-brand-50 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400' : 'bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                  }`}>
                    {sub.status === 'graded' ? `Nota: ${sub.grade}` : 'Pendente'}
                  </span>
                </td>
                <td className="p-6 text-right">
                  {sub.status === 'pending' ? (
                    gradingId === sub.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <input 
                          type="number"
                          value={isNaN(gradeValue) ? '' : gradeValue}
                          onChange={(e) => setGradeValue(parseInt(e.target.value))}
                          className="w-16 p-1.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 dark:text-white rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-colors"
                        />
                        <button 
                          onClick={() => handleGrade(sub)}
                          className="p-1.5 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setGradingId(null)}
                          className="p-1.5 bg-slate-100 dark:bg-white/10 text-slate-400 dark:text-slate-500 rounded-lg hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => {
                          setGradingId(sub.id);
                          setGradeValue(100);
                        }}
                        className="bg-slate-900 dark:bg-brand-500 text-white px-4 py-3 md:py-2 rounded-xl text-xs font-bold hover:bg-slate-800 dark:hover:bg-brand-600 transition-colors min-h-[44px]"
                      >
                        Avaliar
                      </button>
                    )
                  ) : (
                    <div className="flex items-center justify-end gap-2 text-brand-500 dark:text-brand-400">
                      <CheckSquare className="w-5 h-5" />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {submissions.length === 0 && !isLoading && (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500 italic">Nenhuma atividade enviada.</div>
        )}
      </div>

      {selectedSubmission && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-100 dark:border-white/10 transition-colors">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Respostas do Quiz</h2>
                <p className="text-slate-500 dark:text-slate-400">{selectedSubmission.userName} - {selectedSubmission.challengeTitle}</p>
              </div>
              <button onClick={() => setSelectedSubmission(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              {Object.entries(selectedSubmission.answers || {}).map(([qId, answers], idx) => (
                <div key={qId} className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10 transition-colors">
                  <p className="font-bold text-slate-900 dark:text-white mb-2">Questão {idx + 1}</p>
                  <div className="flex flex-wrap gap-2">
                    {answers.map(ans => (
                      <span key={ans} className="px-3 py-1 bg-brand-500 text-white rounded-lg text-xs font-bold">
                        Opção {ans}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/10 flex justify-end">
              <button 
                onClick={() => setSelectedSubmission(null)}
                className="bg-slate-900 dark:bg-brand-500 text-white px-6 py-2 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-brand-600 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
