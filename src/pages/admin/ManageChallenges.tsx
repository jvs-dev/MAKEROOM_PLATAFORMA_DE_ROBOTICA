import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { Zap, Plus, Edit2, Trash2, X, Save, HelpCircle, FileText, AlertTriangle, Sparkles, Loader2, Eye, EyeOff, Search } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

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

interface CodeAssertion {
  testName: string;
  assertionBody: string;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  type: 'quiz' | 'activity' | 'code';
  points: number;
  questions?: Question[];
  codeLanguage?: 'html' | 'javascript';
  codeTemplate?: string;
  codeInstructions?: string;
  codeAssertions?: CodeAssertion[];
  isPublic?: boolean;
}

export default function ManageChallenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAiInput, setShowAiInput] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<Challenge | null>(null);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'quiz' as 'quiz' | 'activity' | 'code',
    points: 0,
    questions: [] as Question[],
    codeLanguage: 'html' as 'html' | 'javascript',
    codeTemplate: '',
    codeInstructions: '',
    codeAssertions: [] as CodeAssertion[],
    isPublic: true,
  });

  useEffect(() => {
    fetchChallenges();
  }, []);

  const fetchChallenges = async () => {
    setIsLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'challenges'));
      setChallenges(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Challenge)));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'challenges');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (challenge?: Challenge) => {
    if (challenge) {
      setEditingChallenge(challenge);
      setFormData({
        title: challenge.title,
        description: challenge.description,
        type: challenge.type,
        points: challenge.points,
        questions: challenge.questions || [],
        codeLanguage: challenge.codeLanguage || 'html',
        codeTemplate: challenge.codeTemplate || '',
        codeInstructions: challenge.codeInstructions || '',
        codeAssertions: challenge.codeAssertions || [],
        isPublic: challenge.isPublic ?? true,
      });
    } else {
      setEditingChallenge(null);
      setFormData({ 
        title: '', 
        description: '', 
        type: 'quiz', 
        points: 0, 
        questions: [],
        codeLanguage: 'html',
        codeTemplate: '',
        codeInstructions: '',
        codeAssertions: [],
        isPublic: true,
      });
    }
    setIsModalOpen(true);
    setShowAiInput(false);
    setAiPrompt('');
  };

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) return;
    
    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: 'AIzaSyCLIfr4yy-g8vPhfG6nN7vM0jmVt89vuRM' });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Gere um quiz educacional baseado no seguinte tema ou instrução: "${aiPrompt}". 
        O quiz deve ter um título atraente, uma descrição clara e uma lista de perguntas de múltipla escolha.
        Cada pergunta deve ter 4 opções (A, B, C, D) e pelo menos uma resposta correta.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING },
                    options: {
                      type: Type.OBJECT,
                      properties: {
                        A: { type: Type.STRING },
                        B: { type: Type.STRING },
                        C: { type: Type.STRING },
                        D: { type: Type.STRING }
                      },
                      required: ["A", "B", "C", "D"]
                    },
                    correctAnswers: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    }
                  },
                  required: ["text", "options", "correctAnswers"]
                }
              }
            },
            required: ["title", "description", "questions"]
          }
        }
      });

      const result = JSON.parse(response.text);
      
      setFormData({
        ...formData,
        title: result.title,
        description: result.description,
        questions: result.questions.map((q: any) => ({
          ...q,
          id: Math.random().toString(36).substr(2, 9)
        }))
      });
      
      setShowAiInput(false);
      setAiPrompt('');
    } catch (err) {
      console.error('Erro ao gerar com IA:', err);
      alert('Ocorreu um erro ao gerar o quiz com IA. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  const addQuestion = () => {
    const newQuestion: Question = {
      id: Math.random().toString(36).substr(2, 9),
      text: '',
      options: { A: '', B: '', C: '', D: '' },
      correctAnswers: [],
    };
    setFormData({ ...formData, questions: [...formData.questions, newQuestion] });
  };

  const removeQuestion = (index: number) => {
    const newQuestions = [...formData.questions];
    newQuestions.splice(index, 1);
    setFormData({ ...formData, questions: newQuestions });
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const newQuestions = [...formData.questions];
    newQuestions[index] = { ...newQuestions[index], [field]: value };
    setFormData({ ...formData, questions: newQuestions });
  };

  const updateOption = (qIndex: number, option: 'A' | 'B' | 'C' | 'D', value: string) => {
    const newQuestions = [...formData.questions];
    newQuestions[qIndex].options[option] = value;
    setFormData({ ...formData, questions: newQuestions });
  };

  const toggleCorrectAnswer = (qIndex: number, option: string) => {
    const newQuestions = [...formData.questions];
    const currentCorrect = newQuestions[qIndex].correctAnswers || [];
    if (currentCorrect.includes(option)) {
      newQuestions[qIndex].correctAnswers = currentCorrect.filter(a => a !== option);
    } else {
      newQuestions[qIndex].correctAnswers = [...currentCorrect, option];
    }
    setFormData({ ...formData, questions: newQuestions });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.type === 'quiz' && formData.questions.length < 3) {
      alert('Um quiz deve ter no mínimo 3 perguntas.');
      return;
    }
    try {
      if (editingChallenge) {
        await updateDoc(doc(db, 'challenges', editingChallenge.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'challenges'), {
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      fetchChallenges();
    } catch (err) {
      handleFirestoreError(err, editingChallenge ? OperationType.UPDATE : OperationType.CREATE, 'challenges');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmation) return;
    
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);
      const challengeId = deleteConfirmation.id;
      
      // 1. Delete the challenge itself
      batch.delete(doc(db, 'challenges', challengeId));
      
      // 2. Delete related submissions
      const submissionsSnapshot = await getDocs(query(collection(db, 'submissions'), where('challengeId', '==', challengeId)));
      submissionsSnapshot.docs.forEach((subDoc) => {
        batch.delete(subDoc.ref);
      });
      
      // 3. Delete related cooldowns
      const cooldownsSnapshot = await getDocs(query(collection(db, 'quizCooldowns'), where('challengeId', '==', challengeId)));
      cooldownsSnapshot.docs.forEach((cooldownDoc) => {
        batch.delete(cooldownDoc.ref);
      });
      
      await batch.commit();
      setDeleteConfirmation(null);
      fetchChallenges();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `challenges/${deleteConfirmation.id}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredChallenges = challenges.filter(challenge => 
    challenge.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    challenge.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    challenge.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-3">
            <Zap className="text-brand-500" size={32} />
            Gerenciar Desafios
          </h1>
          <p className="text-slate-500 dark:text-slate-400">Crie quizzes e atividades para os alunos.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 px-6 rounded-2xl transition-all shadow-lg shadow-brand-100 dark:shadow-none flex items-center gap-2"
        >
          <Plus className="w-5 h-5" /> Novo Desafio
        </button>
      </header>

      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-slate-400 dark:text-slate-500" />
        </div>
        <input
          type="text"
          placeholder="Buscar desafios por título, descrição ou tipo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/10 dark:text-white rounded-3xl focus:ring-2 focus:ring-brand-500 outline-none transition-colors shadow-sm"
        />
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-slate-100 dark:border-white/10 overflow-hidden transition-colors">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
            <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/10">
              <th className="p-6 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Desafio</th>
              <th className="p-6 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Tipo</th>
              <th className="p-6 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Pontos</th>
              <th className="p-6 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-white/5">
            {filteredChallenges.map((challenge) => (
              <tr key={challenge.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                <td className="p-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      challenge.type === 'quiz' ? 'bg-blue-50 dark:bg-blue-500/10' : (challenge.type === 'code' ? 'bg-indigo-50 dark:bg-indigo-500/10' : 'bg-purple-50 dark:bg-purple-500/10')
                    }`}>
                      {challenge.type === 'quiz' ? (
                        <HelpCircle className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                      ) : challenge.type === 'code' ? (
                        <span className="text-indigo-500 dark:text-indigo-400 font-extrabold text-sm">JS</span>
                      ) : (
                        <FileText className="w-5 h-5 text-purple-500 dark:text-purple-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900 dark:text-white">{challenge.title}</p>
                        {challenge.isPublic === false && (
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-white/5 text-slate-500" title="Não aparece na página de desafios">
                            <EyeOff className="w-3 h-3" /> Privado
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-500 line-clamp-1">{challenge.description}</p>
                    </div>
                  </div>
                </td>
                <td className="p-6">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${
                    challenge.type === 'quiz' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : (challenge.type === 'code' ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400')
                  }`}>
                    {challenge.type === 'quiz' ? 'Quiz' : (challenge.type === 'code' ? 'Playground' : 'Atividade')}
                  </span>
                </td>
                <td className="p-6 font-bold text-brand-600 dark:text-brand-400">
                  <div className="flex items-center gap-1">
                    <Zap className="w-4 h-4 fill-brand-500" />
                    {challenge.points}
                  </div>
                </td>
                <td className="p-6 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button 
                      onClick={() => handleOpenModal(challenge)}
                      className="p-3 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <Edit2 className="w-5 h-5 md:w-4 md:h-4" />
                    </button>
                    <button 
                      onClick={() => setDeleteConfirmation(challenge)}
                      className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <Trash2 className="w-5 h-5 md:w-4 md:h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {filteredChallenges.length === 0 && !isLoading && (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500 italic">
            {searchTerm ? 'Nenhum desafio encontrado para esta busca.' : 'Nenhum desafio cadastrado.'}
          </div>
        )}
      </div>

      {deleteConfirmation && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-2xl max-w-md w-full border border-slate-100 dark:border-white/10 transition-colors">
            <div className="flex items-center gap-4 text-red-500 mb-6">
              <div className="w-12 h-12 bg-red-50 dark:bg-red-500/20 rounded-2xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Excluir Desafio?</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            
            <p className="text-slate-600 dark:text-slate-400 mb-8">
              Você está prestes a excluir o desafio <span className="font-bold text-slate-900 dark:text-white">"{deleteConfirmation.title}"</span>. 
              Isso também removerá permanentemente todas as submissões e cooldowns dos alunos relacionados a este desafio.
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
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-2xl transition-all shadow-lg shadow-red-100 dark:shadow-none flex items-center justify-center gap-2 disabled:opacity-50"
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
              <div className="flex items-center gap-4">
                <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                  {editingChallenge ? 'Editar Desafio' : 'Novo Desafio'}
                </h2>
                {!editingChallenge && formData.type === 'quiz' && (
                  <button
                    type="button"
                    onClick={() => setShowAiInput(!showAiInput)}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded-xl font-bold text-sm hover:bg-brand-100 dark:hover:bg-brand-500/20 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    Gerar com IA
                  </button>
                )}
              </div>
              <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 bg-white dark:bg-white/5 flex items-center justify-center rounded-2xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors shadow-sm">
                <X className="w-6 h-6" />
              </button>
            </div>

            {showAiInput && (
              <div className="mb-8 p-6 bg-brand-50 dark:bg-brand-500/10 rounded-3xl border border-brand-100 dark:border-brand-500/20 space-y-4 transition-colors">
                <div className="flex items-center gap-3 text-brand-600 dark:text-brand-400 mb-2">
                  <Sparkles className="w-5 h-5" />
                  <h3 className="font-bold">Gerador de Quiz IA</h3>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Descreva o tema e detalhes do quiz (ex: "5 perguntas sobre robótica básica para iniciantes").
                </p>
                <div className="flex gap-3">
                  <input 
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Digite o tema do quiz..."
                    className="flex-1 p-3 bg-white dark:bg-white/5 border border-brand-200 dark:border-white/10 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && generateWithAI()}
                  />
                  <button
                    type="button"
                    disabled={isGenerating || !aiPrompt.trim()}
                    onClick={generateWithAI}
                    className="bg-brand-500 hover:bg-brand-600 text-white font-bold px-6 rounded-xl transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-brand-100 dark:shadow-none"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      'Gerar'
                    )}
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Título</label>
                  <input 
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                    placeholder="Ex: Quiz sobre Sensores"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Tipo</label>
                  <select 
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'quiz' | 'activity' | 'code' })}
                    className="w-full p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                  >
                    <option value="quiz" className="dark:bg-zinc-900">Quiz</option>
                    <option value="activity" className="dark:bg-zinc-900">Atividade</option>
                    <option value="code" className="dark:bg-zinc-900">💻 Playground de Código</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Descrição</label>
                <textarea 
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full h-32 p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                  placeholder="Explique o que o aluno deve fazer..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Pontuação</label>
                  <div className="relative">
                    <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <input 
                      required
                      type="number"
                      value={isNaN(formData.points) ? '' : formData.points}
                      onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) })}
                      className="w-full p-3 pl-10 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Visibilidade</label>
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">Mostrar na página de Desafios</span>
                      <span className="text-[10px] text-slate-500">Se desativado, só aparece nos cursos.</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={formData.isPublic}
                        onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-500/20 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-brand-500"></div>
                    </label>
                  </div>
                </div>
              </div>

              {formData.type === 'quiz' && (
                <div className="space-y-6 pt-4 border-t border-slate-100 dark:border-white/10">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 dark:text-white">Perguntas do Quiz</h3>
                    <button 
                      type="button"
                      onClick={addQuestion}
                      className="text-brand-600 dark:text-brand-400 text-sm font-bold hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Adicionar Pergunta
                    </button>
                  </div>

                  <div className="space-y-8">
                    {formData.questions.map((q, qIndex) => (
                      <div key={q.id} className="p-6 bg-slate-50 dark:bg-white/5 rounded-2xl space-y-4 relative group/q transition-colors">
                        <button 
                          type="button"
                          onClick={() => removeQuestion(qIndex)}
                          className="absolute top-4 right-4 text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Pergunta {qIndex + 1}</label>
                          <input 
                            required
                            value={q.text}
                            onChange={(e) => updateQuestion(qIndex, 'text', e.target.value)}
                            className="w-full p-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                            placeholder="Digite a pergunta..."
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                            <div key={opt} className="space-y-1">
                              <div className="flex items-center justify-between px-1">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Opção {opt}</label>
                                <button 
                                  type="button"
                                  onClick={() => toggleCorrectAnswer(qIndex, opt)}
                                  className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full transition-all ${
                                    (q.correctAnswers || []).includes(opt)
                                      ? 'bg-green-500 text-white'
                                      : 'bg-slate-200 dark:bg-white/10 text-slate-400 dark:text-slate-500 hover:bg-slate-300 dark:hover:bg-white/20'
                                  }`}
                                >
                                  {(q.correctAnswers || []).includes(opt) ? 'Correta' : 'Marcar Correta'}
                                </button>
                              </div>
                              <input 
                                required
                                value={q.options?.[opt] || ''}
                                onChange={(e) => updateOption(qIndex, opt, e.target.value)}
                                className="w-full p-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                                placeholder={`Texto da opção ${opt}...`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {formData.questions.length === 0 && (
                      <div className="text-center py-8 border-2 border-dashed border-slate-100 dark:border-white/10 rounded-2xl text-slate-400 dark:text-slate-500 text-sm">
                        Nenhuma pergunta adicionada ainda.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {formData.type === 'code' && (
                <div className="space-y-6 pt-4 border-t border-slate-100 dark:border-white/10">
                  <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>💻 Configuração do Playground de Código</span>
                    <span className="text-xs bg-brand-500 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Premium Mode</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Linguagem</label>
                      <select
                        value={formData.codeLanguage}
                        onChange={(e) => setFormData({ ...formData, codeLanguage: e.target.value as 'html' | 'javascript' })}
                        className="w-full p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                      >
                        <option value="html" className="dark:bg-zinc-900 font-bold">HTML5 (HTML + CSS + JS)</option>
                        <option value="javascript" className="dark:bg-zinc-900 font-bold">JavaScript Puro (Console/Lógica)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Instruções Práticas (Markdown)</label>
                    <textarea
                      value={formData.codeInstructions}
                      onChange={(e) => setFormData({ ...formData, codeInstructions: e.target.value })}
                      className="w-full h-32 p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 outline-none resize-none font-mono text-xs"
                      placeholder="Ex: # Instruções do Desafio\n\nCrie uma tag `<h1>` que contenha o texto 'Makeroom'.\nOu imprima no console com `console.log('Olá mundo!')`"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Código Inicial (Template)</label>
                      <button
                        type="button"
                        onClick={() => {
                          const boilerplate = formData.codeLanguage === 'html' 
                            ? `<!DOCTYPE html>\n<html>\n<head>\n  <style>\n    body { font-family: sans-serif; text-align: center; padding-top: 50px; }\n    button { background: #6366f1; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; }\n  </style>\n</head>\n<body>\n  <!-- Escreva seu código aqui -->\n  \n</body>\n</html>`
                            : `// Escreva sua função aqui\nfunction somar(a, b) {\n  return a + b;\n}`;
                          setFormData({ ...formData, codeTemplate: boilerplate });
                        }}
                        className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                      >
                        Carregar Boilerplate Clássico
                      </button>
                    </div>
                    <textarea
                      value={formData.codeTemplate}
                      onChange={(e) => setFormData({ ...formData, codeTemplate: e.target.value })}
                      className="w-full h-48 p-3 bg-slate-900 text-slate-100 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-mono text-xs resize-y"
                      placeholder="<!-- Código inicial que aparecerá para o aluno -->"
                    />
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-white/5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Casos de Teste / Asserções Automáticas</label>
                      <button
                        type="button"
                        onClick={() => {
                          const newAssertions = [...(formData.codeAssertions || [])];
                          newAssertions.push({ testName: '', assertionBody: '' });
                          setFormData({ ...formData, codeAssertions: newAssertions });
                        }}
                        className="text-xs text-brand-600 dark:text-brand-400 font-bold hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Adicionar Teste
                      </button>
                    </div>

                    <div className="space-y-3">
                      {(formData.codeAssertions || []).map((assertion, index) => (
                        <div key={index} className="flex flex-col md:flex-row gap-3 bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-200 dark:border-white/10 relative">
                          <div className="flex-1 space-y-2">
                            <input
                              type="text"
                              value={assertion.testName}
                              onChange={(e) => {
                                const newAssertions = [...(formData.codeAssertions || [])];
                                newAssertions[index].testName = e.target.value;
                                setFormData({ ...formData, codeAssertions: newAssertions });
                              }}
                              placeholder="Ex: Deve conter tag H1 com id 'titulo'"
                              className="w-full p-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 dark:text-white rounded-lg text-xs"
                              required
                            />
                            <input
                              type="text"
                              value={assertion.assertionBody}
                              onChange={(e) => {
                                const newAssertions = [...(formData.codeAssertions || [])];
                                newAssertions[index].assertionBody = e.target.value;
                                setFormData({ ...formData, codeAssertions: newAssertions });
                              }}
                              placeholder="Fórmula JS, Ex: document.querySelector('h1') || logs.join('').includes('olá')"
                              className="w-full p-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 dark:text-white rounded-lg text-xs font-mono"
                              required
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const newAssertions = [...(formData.codeAssertions || [])];
                              newAssertions.splice(index, 1);
                              setFormData({ ...formData, codeAssertions: newAssertions });
                            }}
                            className="bg-red-50 hover:bg-red-100 text-red-500 p-2 rounded-lg self-center dark:bg-red-500/10 dark:hover:bg-red-500/20"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {(formData.codeAssertions || []).length === 0 && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 italic text-center">Nenhum teste configurado. O aluno poderá enviar qualquer código funcional.</p>
                      )}
                    </div>
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
                  <Save className="w-6 h-6" /> Salvar Desafio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
