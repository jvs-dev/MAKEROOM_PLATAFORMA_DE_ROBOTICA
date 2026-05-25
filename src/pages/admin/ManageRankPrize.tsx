import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { Star, Save, Image as ImageIcon, ToggleLeft, ToggleRight, Loader2, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

export default function ManageRankPrize() {
  const [isActive, setIsActive] = useState(false);
  const [prizeName, setPrizeName] = useState('');
  const [prizeDescription, setPrizeDescription] = useState('');
  const [prizeImageUrl, setPrizeImageUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const fetchPrizeConfig = async () => {
      try {
        const docRef = doc(db, 'settings', 'ranking_prize');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setIsActive(data.is_active || false);
          setPrizeName(data.prize_name || '');
          setPrizeDescription(data.prize_description || '');
          setPrizeImageUrl(data.prize_image_url || '');
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'settings/ranking_prize');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrizeConfig();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await setDoc(doc(db, 'settings', 'ranking_prize'), {
        is_active: isActive,
        prize_name: prizeName,
        prize_description: prizeDescription,
        prize_image_url: prizeImageUrl,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/ranking_prize');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-white/10 transition-colors">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-3">
          <Star className="text-yellow-500 fill-yellow-500" /> Configurar Prêmio da Temporada
        </h1>
        <p className="text-slate-500 dark:text-slate-400">Personalize o prêmio que os maiores Makers irão ganhar.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left column: Form */}
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-white/10 space-y-6">
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
            <div>
              <p className="font-bold text-slate-900 dark:text-white">Banner Ativo</p>
              <p className="text-xs text-slate-500">Exibir o prêmio no Hall da Fama.</p>
            </div>
            <button 
              onClick={() => setIsActive(!isActive)}
              className="text-brand-600 dark:text-brand-400 focus:outline-none"
            >
              {isActive ? <ToggleRight size={44} /> : <ToggleLeft size={44} className="text-slate-400" />}
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Nome do Prêmio</label>
              <input 
                type="text" 
                value={prizeName}
                onChange={(e) => setPrizeName(e.target.value)}
                placeholder="Ex: Kit Inicante Arduino"
                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Descrição (Máx 200 caracteres)</label>
              <textarea 
                value={prizeDescription}
                onChange={(e) => setPrizeDescription(e.target.value.slice(0, 200))}
                rows={4}
                placeholder="Descreva o que o ganhador levará para casa..."
                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
              />
              <p className="text-[10px] text-right text-slate-400 mt-1">{prizeDescription.length}/200</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">URL da Imagem</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={prizeImageUrl}
                  onChange={(e) => setPrizeImageUrl(e.target.value)}
                  placeholder="https://exemplo.com/imagem.png"
                  className="flex-1 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-brand-500/20"
          >
            {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            {isSaving ? 'Salvando...' : 'Salvar Configurações'}
          </button>

          {saveSuccess && (
            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center text-emerald-500 font-bold text-sm"
            >
              Configurações salvas com sucesso! ✨
            </motion.p>
          )}
        </div>

        {/* Right column: Preview */}
        <div className="space-y-6">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Prévia do Banner</p>
          {isActive ? (
            <div className="relative overflow-hidden group">
              <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 border border-yellow-500/30 rounded-[32px] p-8 relative overflow-hidden shadow-2xl">
                {/* Shimmer Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                
                <div className="flex items-center justify-between relative z-10">
                    <div className="flex-1 max-w-[60%]">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full mb-4">
                        <Sparkles size={12} className="text-yellow-500" />
                        <span className="text-xs font-black text-yellow-500 uppercase tracking-wider">Prêmio da Temporada</span>
                      </div>
                    <h2 className="text-2xl font-black text-white mb-2 uppercase italic tracking-tighter">
                      {prizeName || 'Nome do Prêmio'}
                    </h2>
                    <p className="text-sm text-zinc-400 leading-relaxed mb-6 line-clamp-3">
                      {prizeDescription || 'A descrição do prêmio aparecerá aqui para motivar os makers.'}
                    </p>
                    <div className="text-xs font-bold text-yellow-500 uppercase tracking-[0.2em] animate-pulse">
                      Fique em 1º lugar para ganhar
                    </div>
                  </div>
                  
                  <div className="w-32 h-32 bg-zinc-800/50 rounded-2xl flex items-center justify-center border border-white/5 overflow-hidden">
                    {prizeImageUrl ? (
                      <img src={prizeImageUrl} alt="Prize" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Star size={48} className="text-zinc-600" />
                    )}
                  </div>
                </div>

                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-brand-500/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />
              </div>
            </div>
          ) : (
            <div className="h-[200px] bg-slate-100 dark:bg-white/5 rounded-[32px] border-2 border-dashed border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400 italic text-sm">
              Banner desativado
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
