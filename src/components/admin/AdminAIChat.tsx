import { useState, useRef, useEffect } from 'react';
import { Send, Bot, Loader2, Sparkles, ChevronUp, BookOpen, CheckSquare, Code, ShoppingBag, Megaphone } from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';

type MessageState = {
  role: 'user' | 'model';
  parts: { text: string; functionCall?: any }[];
};

export function AdminAIChat() {
  const [messages, setMessages] = useState<MessageState[]>([
    {
      role: 'model',
      parts: [{ text: 'Olá! Sou o Assistente Makeroom 👋\nEstou aqui para ajudar você a gerenciar a plataforma de forma rápida e fácil. Posso criar atividades, aulas, itens da loja e muito mais. O que vamos construir hoje?' }]
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const quickActions = [
    {
      icon: <BookOpen className="w-4 h-4 text-indigo-500" />,
      label: "Criar Aula",
      prompt: 'Crie uma aula com o título "[TÍTULO]", conteúdo detalhado, categoria "[CATEGORIA]", valendo [PONTOS] pontos, e adicione este link de vídeo: [LINK]'
    },
    {
      icon: <CheckSquare className="w-4 h-4 text-emerald-500" />,
      label: "Criar Quiz",
      prompt: 'Crie um desafio de quiz sobre "[TEMA]" valendo [PONTOS] pontos. Elabore pelo menos 4 perguntas criativas com múltiplas alternativas.'
    },
    {
      icon: <Code className="w-4 h-4 text-blue-500" />,
      label: "Desafio de Código",
      prompt: 'Crie um desafio prático de código em [javascript/html] sobre "[TEMA]". Forneça um template inicial, código de teste com validações e instruções passo a passo.'
    },
    {
      icon: <ShoppingBag className="w-4 h-4 text-orange-500" />,
      label: "Criar Item na Loja",
      prompt: 'Crie um item para a loja chamado "[NOME]". Escolha o preço, estoque e uma categoria adequada (kits, materials, etc), invente uma descrição atrativa.'
    },
    {
      icon: <Megaphone className="w-4 h-4 text-purple-500" />,
      label: "Criar Anúncio",
      prompt: 'Crie um banner de anúncio para a home sobre "[AÇÃO]". Link para redirecionamento: "[LINK]".'
    }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleCreateStoreItem = async (args: any) => {
    try {
      const { name, description = '', price = 0, stock = 0, category = 'items' } = args;
      await addDoc(collection(db, 'products'), {
        name: name || 'Novo Item',
        description: description || '',
        price: Number(price) || 0,
        stock: Number(stock) || 0,
        category: category || 'items',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { success: true, message: `Item "${name || 'Novo Item'}" criado com sucesso!` };
    } catch (err) {
      console.error(err);
      return { success: false, error: err };
    }
  };

  const handleCreateLesson = async (args: any) => {
    try {
      const { title, description = '', content = '', category = 'general', points = 0, videoUrl = '' } = args;
      const lessonData: any = {
        title: title || 'Nova Aula',
        description: description || '',
        content: content || '',
        category: category || 'general',
        points: Number(points) || 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      if (videoUrl) {
        lessonData.videoUrl = videoUrl;
      }
      await addDoc(collection(db, 'lessons'), lessonData);
      return { success: true, message: `Aula "${title || 'Nova Aula'}" criada com sucesso!` };
    } catch (err) {
      console.error(err);
      return { success: false, error: err };
    }
  };

  const handleCreateChallenge = async (args: any) => {
    try {
      const { title, description = '', type = 'activity', points = 0, questions, teamId, codeLanguage, codeTemplate, codeInstructions, codeAssertions, isPublic } = args;
      const finalArgs: any = {
        title: title || 'Novo Desafio',
        description: description || '',
        type: String(type).trim().toLowerCase(),
        points: Number(points) || 0
      };

      if (teamId) finalArgs.teamId = teamId;
      if (typeof isPublic === 'boolean') finalArgs.isPublic = isPublic;

      if (finalArgs.type === 'code') {
        if (codeLanguage) finalArgs.codeLanguage = String(codeLanguage);
        if (codeTemplate) finalArgs.codeTemplate = String(codeTemplate);
        if (codeInstructions) finalArgs.codeInstructions = String(codeInstructions);
        if (codeAssertions && Array.isArray(codeAssertions)) finalArgs.codeAssertions = codeAssertions;
      } else if (finalArgs.type === 'quiz') {
        if (questions && Array.isArray(questions)) {
          finalArgs.questions = questions.map((q: any) => ({
            ...q,
            id: q.id || Math.random().toString(36).substr(2, 9)
          }));
        } else {
          finalArgs.questions = [];
        }
      }

      await addDoc(collection(db, 'challenges'), {
        ...finalArgs,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { success: true, message: `Desafio "${finalArgs.title}" criado com sucesso!` };
    } catch (err) {
      console.error(err);
      return { success: false, error: err };
    }
  };

  const handleCreateCourse = async (args: any) => {
    try {
      const { title, description = '', pointsReward = 0 } = args;
      await addDoc(collection(db, 'courses'), {
        title: title || 'Novo Curso',
        description: description || '',
        pointsReward: Number(pointsReward) || 0,
        lessonIds: [],
        challengeIds: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { success: true, message: `Curso "${title || 'Novo Curso'}" criado com sucesso!` };
    } catch (err) {
      console.error(err);
      return { success: false, error: err };
    }
  };

  const handleCreateAnnouncement = async (args: any) => {
    try {
      const { imageUrl = '', redirectUrl = '', isActive = true } = args;
      await addDoc(collection(db, 'announcements'), {
        imageUrl: imageUrl || 'https://via.placeholder.com/800x400',
        redirectUrl: redirectUrl || '',
        isActive: Boolean(isActive),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { success: true, message: `Anúncio criado com sucesso!` };
    } catch (err) {
      console.error(err);
      return { success: false, error: err };
    }
  };

  const executeFunctionCall = async (call: any): Promise<{ success: boolean, error?: any, message?: string }> => {
    let result: { success: boolean, error?: any, message?: string } = { success: false, error: 'Unknown function' };
    if (call.name === 'createStoreItem') result = await handleCreateStoreItem(call.args);
    if (call.name === 'createLesson') result = await handleCreateLesson(call.args);
    if (call.name === 'createChallenge') result = await handleCreateChallenge(call.args);
    if (call.name === 'createCourse') result = await handleCreateCourse(call.args);
    if (call.name === 'createAnnouncement') result = await handleCreateAnnouncement(call.args);
    return result;
  };

  const sendMessage = async (newMessages: MessageState[]) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages })
      });
      
      const data = await response.json();
      
      if (data.error) throw new Error(data.error);

      // Model response
      const modelParts = [];
      if (data.text) {
        modelParts.push({ text: data.text });
      }

      if (data.functionCalls && data.functionCalls.length > 0) {
        setMessages([...newMessages, { role: 'model', parts: [{ text: "Executando ações solicitadas..." }] }]);
        
        let execResults = [];
        for (const call of data.functionCalls) {
          const res = await executeFunctionCall(call);
          execResults.push(res);
        }

        // We can just add a final status message
        setMessages(prev => [
           ...prev,
           { role: 'model', parts: [{ text: execResults.map(r => r.message || 'Erro ao criar item.').join('\n') }] }
        ]);
        
        setIsLoading(false);
        return;
      }
      
      setMessages([...newMessages, { role: 'model', parts: modelParts }]);
      
    } catch (error: any) {
      console.error('Chat error:', error);
      let errorMessage = 'Ops, ocorreu um erro ao comunicar com a IA.';
      if (error.message?.includes('GEMINI_API_KEY')) {
        errorMessage = 'A chave GEMINI_API_KEY não está configurada. Por favor, adicione-a nas configurações do projeto para usar o Assistente Makeroom.';
      }
      setMessages(prev => [
        ...prev,
        { role: 'model', parts: [{ text: errorMessage }] }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    
    const userMsg: MessageState = { role: 'user', parts: [{ text: input }] };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    sendMessage(newMessages);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-white/10 rounded-2xl md:rounded-3xl shadow-sm flex flex-col h-[400px] overflow-hidden mb-8">
      <div className="p-4 bg-brand-50 dark:bg-brand-500/10 border-b border-brand-100 dark:border-brand-500/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center overflow-hidden border-2 border-white dark:border-zinc-900 shadow-sm">
             <img src="https://makeroom2.vercel.app/logo.svg" alt="Makeroom Agent" className="w-5 h-5 object-contain brightness-0 invert" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white text-sm">Assistente Makeroom</h2>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 -mt-0.5">Online agora</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
          <Sparkles className="w-3 h-3" />
          Beta
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-zinc-900/50">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'model' && (
              <div className="w-8 h-8 rounded-full bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20 flex flex-shrink-0 items-center justify-center overflow-hidden">
                <img src="https://makeroom2.vercel.app/logo.svg" alt="Assistente" className="w-5 h-5 object-contain" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-2xl p-3 ${
              msg.role === 'user' 
                ? 'bg-brand-500 text-white rounded-tr-sm' 
                : 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-white/10 rounded-tl-sm'
            }`}>
              {msg.parts.map((p, j) => (
                <div key={j} className="whitespace-pre-wrap text-sm leading-relaxed">
                  {p.text}
                </div>
              ))}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20 flex flex-shrink-0 items-center justify-center overflow-hidden">
              <img src="https://makeroom2.vercel.app/logo.svg" alt="Assistente" className="w-5 h-5 object-contain" />
            </div>
            <div className="bg-white dark:bg-zinc-800 border border-slate-100 dark:border-white/10 rounded-2xl rounded-tl-sm p-3 flex items-center">
              <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white dark:bg-zinc-900 border-t border-slate-100 dark:border-white/10 relative">
        {showQuickActions && (
          <div className="absolute bottom-full left-4 mb-2 bg-white dark:bg-zinc-800 border border-slate-100 dark:border-white/10 shadow-xl rounded-2xl p-2 w-64 max-h-64 overflow-y-auto z-10 animate-in slide-in-from-bottom-2 fade-in duration-200">
            <h3 className="text-[10px] uppercase font-bold text-slate-400 mb-2 px-2 pt-1 tracking-wider">Preencher Prompt Rápidamente</h3>
            <div className="space-y-1">
              {quickActions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInput(action.prompt);
                    setShowQuickActions(false);
                    setTimeout(() => inputRef.current?.focus(), 100);
                  }}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors text-left text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  <div className="p-1.5 bg-slate-100 dark:bg-zinc-900 rounded-lg shadow-sm">
                    {action.icon}
                  </div>
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2 relative">
          <button
            onClick={() => setShowQuickActions(!showQuickActions)}
            className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0 flex items-center justify-center border border-slate-200 dark:border-white/10 shadow-sm"
            title="Ações Rápidas"
          >
            <ChevronUp className={`w-5 h-5 transition-transform duration-300 ${showQuickActions ? 'rotate-180' : ''}`} />
          </button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ex: Crie um item..."
            className="flex-1 bg-slate-50 dark:bg-zinc-800 border-0 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white placeholder:text-slate-400 shadow-sm"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:hover:bg-brand-500 text-white p-2.5 rounded-xl transition-all shadow-md shrink-0 flex items-center justify-center"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
