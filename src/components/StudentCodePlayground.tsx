import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, RotateCcw, Award, CheckCircle, XCircle, Code, List, Terminal, ChevronRight, X, Sparkles } from 'lucide-react';

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
  codeLanguage?: 'html' | 'javascript';
  codeTemplate?: string;
  codeInstructions?: string;
  codeAssertions?: CodeAssertion[];
}

interface StudentCodePlaygroundProps {
  challenge: Challenge;
  onCancel: () => void;
  onComplete: (code: string) => void;
}

export function StudentCodePlayground({ challenge, onCancel, onComplete }: StudentCodePlaygroundProps) {
  const [code, setCode] = useState(challenge.codeTemplate || '');
  const [logs, setLogs] = useState<string[]>(['📝 Console Makeroom pronto. Escreva seu código e rode-o!']);
  const [testResults, setTestResults] = useState<{ testName: string; passed: boolean; error?: string }[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [mobileTab, setMobileTab] = useState<'instructions' | 'editor'>('instructions');
  const [isSuccess, setIsSuccess] = useState(false);
  const previewRef = useRef<HTMLIFrameElement>(null);

  // Initialize tests list as pending progress
  useEffect(() => {
    if (challenge.codeAssertions) {
      setTestResults(challenge.codeAssertions.map(a => ({ testName: a.testName, passed: false })));
    }
  }, [challenge]);

  // Handle Tab Indentation in textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newCode = code.substring(0, start) + '  ' + code.substring(end);
      setCode(newCode);
      
      // Async reposition cursor
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  // Run/Refresh code preview
  const runPreview = () => {
    if (challenge.codeLanguage === 'html' && !previewRef.current) return;
    setLogs(prev => [...prev, '🔄 Atualizando visualização/execução...']);
    
    try {
      if (challenge.codeLanguage === 'html' && previewRef.current) {
        if (activeTab !== 'preview') setActiveTab('preview');
        const iframeDoc = previewRef.current.contentDocument || previewRef.current.contentWindow?.document;
        if (iframeDoc) {
          // Inject console log interceptor inside target iframe
          const consoleOverrideScript = `
            <script>
              const _log = console.log;
              const _warn = console.warn;
              const _error = console.error;
              
              window.console.log = (...args) => {
                _log(...args);
                window.parent.postMessage({ type: 'CONSOLE_LOG', data: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
              };
              window.console.warn = (...args) => {
                _warn(...args);
                window.parent.postMessage({ type: 'CONSOLE_WARN', data: args.join(' ') }, '*');
              };
              window.console.error = (...args) => {
                _error(...args);
                window.parent.postMessage({ type: 'CONSOLE_ERROR', data: args.join(' ') }, '*');
              };
            </script>
          `;
          previewRef.current.srcdoc = consoleOverrideScript + code;
        }
      } else {
        // Pure javascript simulation
        evaluateJavascriptCode(false);
      }
    } catch (err: any) {
      setLogs(prev => [...prev, `❌ Erro de execucação: ${err.message}`]);
    }
  };

  // Safe Javascript Evaluation to catch output
  const evaluateJavascriptCode = (isTestPhase: boolean = false) => {
    const virtualIframe = document.createElement('iframe');
    virtualIframe.style.display = 'none';
    document.body.appendChild(virtualIframe);
    
    try {
      const win = virtualIframe.contentWindow as any;
      const runLogs: string[] = [];
      
      const customConsole = {
        log: (...args: any[]) => runLogs.push(`[LOG] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`),
        warn: (...args: any[]) => runLogs.push(`[WARN] ${args.join(' ')}`),
        error: (...args: any[]) => runLogs.push(`[ERROR] ${args.join(' ')}`)
      };
      
      win.console = customConsole;
      win.eval(code);
      
      if (!isTestPhase) {
        setLogs(prev => [...prev, ...runLogs, '✅ Script executado sem erros!']);
      }
      
      document.body.removeChild(virtualIframe);
      return { win, logs: runLogs, success: true };
    } catch (err: any) {
      if (!isTestPhase) {
        setLogs(prev => [...prev, `❌ Compilação falhou: ${err.message}`]);
      }
      document.body.removeChild(virtualIframe);
      return { win: null, logs: [], success: false, error: err.message };
    }
  };

  // Register listener for logs
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type) {
        if (event.data.type === 'CONSOLE_LOG') {
          setLogs(prev => [...prev, `[LOG] ${event.data.data}`]);
        } else if (event.data.type === 'CONSOLE_WARN') {
          setLogs(prev => [...prev, `[WARN] ${event.data.data}`]);
        } else if (event.data.type === 'CONSOLE_ERROR') {
          setLogs(prev => [...prev, `[ERROR] ${event.data.data}`]);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Run Assertion checks
  const runVerificationSuite = () => {
    setIsVerifying(true);
    setLogs(prev => [...prev, '⚡ Iniciando rodada de testes automatizados...']);
    
    const virtualIframe = document.createElement('iframe');
    virtualIframe.style.display = 'none';
    document.body.appendChild(virtualIframe);
    
    try {
      if (challenge.codeLanguage === 'html') {
        const consoleOverrideScript = `
          <script>
            window.__testLogs = [];
            const _log = console.log;
            window.console.log = (...args) => {
              _log(...args);
              window.__testLogs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
            };
          </script>
        `;
        virtualIframe.srcdoc = consoleOverrideScript + code;
        virtualIframe.onload = () => {
          const doc = virtualIframe.contentDocument || virtualIframe.contentWindow?.document;
          const win = virtualIframe.contentWindow as any;
          
          if (!doc || !win) {
            setLogs(prev => [...prev, '❌ Ambiente de asserção inalcançável.']);
            setIsVerifying(false);
            document.body.removeChild(virtualIframe);
            return;
          }
          
          const runLogs = win.__testLogs || [];
          
          let passedCount = 0;
          const assertionsList = challenge.codeAssertions || [];
          const results = assertionsList.map(assert => {
            try {
              const assertFn = new Function('document', 'window', 'logs', `return !!(${assert.assertionBody})`);
              const passed = assertFn(doc, win, runLogs);
              if (passed) passedCount++;
              return { testName: assert.testName, passed };
            } catch (err: any) {
              return { testName: assert.testName, passed: false, error: err.message };
            }
          });
          
          setTestResults(results);
          setIsVerifying(false);
          document.body.removeChild(virtualIframe);
          
          if (passedCount === assertionsList.length) {
            setLogs(prev => [...prev, '🌟 PERFEITO! Todos os testes de asserções foram superados.']);
            onComplete(code);
            setIsSuccess(true);
          } else {
            setLogs(prev => [...prev, `❌ ${assertionsList.length - passedCount} testes falharam. Veja os detalhes no painel lateral.`]);
          }
        };
      } else {
        // Pure JavaScript tests
        try {
          const win = virtualIframe.contentWindow as any;
          const runLogs: string[] = [];
          
          win.console = {
            log: (...args: any[]) => runLogs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
            warn: () => {},
            error: () => {}
          };
          
          win.eval(code);
          
          let passedCount = 0;
          const assertionsList = challenge.codeAssertions || [];
          const results = assertionsList.map(assert => {
            try {
              const assertFn = new Function('window', 'logs', `with(window) { return !!(${assert.assertionBody}); }`);
              const passed = assertFn(win, runLogs);
              if (passed) passedCount++;
              return { testName: assert.testName, passed };
            } catch (err: any) {
              return { testName: assert.testName, passed: false, error: err.message };
            }
          });
          
          setTestResults(results);
          setIsVerifying(false);
          document.body.removeChild(virtualIframe);
          
          if (passedCount === assertionsList.length) {
            setLogs(prev => [...prev, '🌟 PERFEITO! Todos os testes de algoritmos foram superados.']);
            onComplete(code);
            setIsSuccess(true);
          } else {
            setLogs(prev => [...prev, `❌ ${assertionsList.length - passedCount} testes falharam.`]);
          }
        } catch (compilationErr: any) {
          setLogs(prev => [...prev, `❌ Código possui sintaxe inválida: ${compilationErr.message}`]);
          setIsVerifying(false);
          document.body.removeChild(virtualIframe);
        }
      }
    } catch (e: any) {
      console.error(e);
      setIsVerifying(false);
      try {
        document.body.removeChild(virtualIframe);
      } catch (_) {}
    }
  };

  return (
    <div className="fixed inset-0 bg-white dark:bg-zinc-950 z-[900] flex text-slate-900 dark:text-white overflow-hidden font-sans">
      
      {isSuccess && (
        <div className="absolute inset-0 bg-slate-900/90 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-8 md:p-12 max-w-sm w-full text-center shadow-2xl relative animate-in fade-in zoom-in duration-300">
            <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-500/20 rounded-[2rem] flex items-center justify-center mx-auto mb-8 relative">
              <CheckCircle className="w-12 h-12 text-emerald-500" />
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-3">Excelente!</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-8 font-medium">Todos os testes passaram e você ganhou {challenge.points} pontos na plataforma.</p>
            <button 
              onClick={onCancel}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-brand-500/20 flex flex-col items-center gap-1 uppercase tracking-widest text-xs cursor-pointer"
            >
              <span>Continuar Trilha</span>
            </button>
          </div>
        </div>
      )}

      {/* Left Instructions / Test Suite Panel */}
      <div className={`w-full md:w-5/12 md:max-w-xl bg-slate-50 dark:bg-zinc-900 p-6 flex-col border-r border-slate-200 dark:border-white/10 h-full overflow-y-auto ${mobileTab === 'instructions' ? 'flex' : 'hidden md:flex'}`}>
        
        {/* Header toolbar */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/10 mb-6 shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
              <Code className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">{challenge.title}</h2>
              <p className="text-[10px] uppercase font-black tracking-widest text-brand-600 dark:text-brand-400 flex items-center gap-1">
                Playground Real-time
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onCancel}
            className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>


        {/* Instructions Body */}
        <div className="flex-1 space-y-6">
          <div className="bg-white dark:bg-zinc-950 p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
            <h4 className="text-xs uppercase font-black tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
              <List className="w-4 h-4" /> Instruções do Desafio
            </h4>
            <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed space-y-3 prose dark:prose-invert">
              <p className="whitespace-pre-line font-medium">{challenge.codeInstructions || challenge.description}</p>
            </div>
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-white/10 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Recompensa</span>
              <span className="text-sm font-black text-amber-500 flex items-center gap-1">
                <Award className="w-4 h-4 text-amber-500" /> {challenge.points} Pontos
              </span>
            </div>
          </div>

          {/* Test cases validation list */}
          <div className="space-y-3">
            <h4 className="text-xs uppercase font-black tracking-wider text-slate-500 dark:text-slate-400">Testes</h4>
            <div className="space-y-2">
              {(testResults || []).map((test, index) => (
                <div 
                  key={index} 
                  className={`p-4 rounded-xl border flex items-center justify-between text-xs transition-all ${
                    test.passed 
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400' 
                      : 'bg-white dark:bg-zinc-950 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded">#{index+1}</span>
                    <span className="font-bold">{test.testName}</span>
                  </div>
                  {test.passed ? (
                    <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-200 dark:border-slate-700 shrink-0 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
                    </div>
                  )}
                </div>
              ))}
              {(challenge.codeAssertions || []).length === 0 && (
                <div className="p-5 bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-white/10 text-center text-xs text-slate-500 dark:text-slate-400 italic shadow-sm">
                  Nenhuma asserção rígida cadastrada neste desafio. Escreva qualquer código funcional e rode-o para finalizar!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Controls footer inside sidebar for mobile */}
        <div className="pt-6 mt-6 border-t border-slate-200 dark:border-white/10 flex gap-3 shrink-0 flex-col pb-6 md:pb-0">
          <button
            type="button"
            onClick={() => setMobileTab('editor')}
            className="md:hidden w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold py-4 rounded-xl text-sm transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            <Code className="w-5 h-5" /> Ir para o Código
          </button>
          
          <button
            type="button"
            onClick={runVerificationSuite}
            disabled={isVerifying}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl text-sm transition-all shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isVerifying ? 'Verificando...' : 'Verificar Resposta'}
          </button>
        </div>
      </div>

      {/* Right Code Workspace & Preview */}
      <div className={`flex-1 bg-slate-50 dark:bg-zinc-950 flex-col h-full ${mobileTab === 'editor' ? 'flex' : 'hidden md:flex'}`}>
        
        {/* Editor tabs */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10 shrink-0 bg-white dark:bg-zinc-900 shadow-sm z-10 overflow-x-auto">
          <div className="flex gap-2 items-center shrink-0">
            <button
               onClick={() => setMobileTab('instructions')}
               className="md:hidden p-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer shadow-sm"
               title="Ver Instruções"
             >
               <List className="w-5 h-5" />
            </button>
            <div className="flex gap-1 bg-slate-100 dark:bg-zinc-950 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('editor')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === 'editor' ? 'bg-white dark:bg-zinc-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Editor de Código
            </button>
            {challenge.codeLanguage === 'html' && (
              <button
                onClick={() => {
                  setActiveTab('preview');
                  setTimeout(runPreview, 50);
                }}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                  activeTab === 'preview' ? 'bg-white dark:bg-zinc-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Visualização
              </button>
            )}
          </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setCode(challenge.codeTemplate || '');
                setLogs(['🔄 Código resetado ao template original.']);
              }}
              className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer shadow-sm"
              title="Resetar Editor"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={runPreview}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white transition-all flex items-center gap-2 text-xs font-bold cursor-pointer shadow-sm"
            >
              <Play className="w-4 h-4 fill-white" /> Executar
            </button>
          </div>
        </div>

        {/* Main interactive area */}
        <div className="flex-1 flex flex-col min-h-0 relative">
          
          <div className={`flex-1 flex flex-col relative ${activeTab === 'editor' ? 'block' : 'hidden'}`}>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              className="w-full flex-1 p-6 bg-white dark:bg-zinc-950 text-slate-800 dark:text-slate-200 font-mono text-sm focus:outline-none resize-none leading-relaxed h-full overflow-y-auto selection:bg-brand-500/30"
              placeholder="// Digite seu código aqui..."
            />
          </div>

          {challenge.codeLanguage === 'html' && (
            <div className={`flex-1 bg-white relative ${activeTab === 'preview' ? 'block' : 'hidden'}`}>
              <iframe
                ref={previewRef}
                title="Code Preview Sandbox"
                className="w-full h-full border-0 bg-white"
                sandbox="allow-scripts allow-modals allow-same-origin"
              />
            </div>
          )}

          {/* Bottom terminal log console */}
          <div className="h-48 bg-slate-900 dark:bg-black border-t border-slate-800 flex flex-col shrink-0 min-h-0">
            <div className="flex items-center justify-between px-4 md:px-6 py-2.5 border-b border-slate-800 bg-slate-950/50 shrink-0">
              <div className="flex items-center gap-2 text-xs uppercase font-bold text-slate-400">
                <Terminal className="w-4 h-4" /> Console
              </div>
              <button
                type="button"
                onClick={() => {
                  setMobileTab('instructions');
                  setTimeout(() => runVerificationSuite(), 150);
                }}
                disabled={isVerifying}
                className="md:hidden bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold py-1.5 px-3 rounded-lg text-[10px] transition-all flex items-center gap-1.5 cursor-pointer uppercase tracking-widest shadow-lg shadow-brand-500/20"
              >
                Verificar <CheckCircle className="w-3 h-3" />
              </button>
            </div>
            <div className="flex-1 p-5 overflow-y-auto font-mono text-xs space-y-2 select-text text-slate-300">
              {logs.map((log, idx) => {
                let colorClass = 'text-slate-300';
                if (log.startsWith('❌')) colorClass = 'text-red-400';
                else if (log.startsWith('🌟') || log.startsWith('🎉') || log.startsWith('✅')) colorClass = 'text-emerald-400';
                else if (log.startsWith('🔄')) colorClass = 'text-indigo-400';
                else if (log.startsWith('[WARN]')) colorClass = 'text-amber-400';
                else if (log.startsWith('[ERROR]')) colorClass = 'text-red-400';
                
                return (
                  <div key={idx} className={`${colorClass} flex gap-2`}>
                    <span className="opacity-50 select-none items-center flex font-sans">›</span>
                    <span>{log}</span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
