import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, deleteDoc, updateDoc, query, where, getDocs, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { sendNotification } from '../../services/notificationService';
import { 
  AlertTriangle, 
  Trash2, 
  Ban, 
  Play, 
  User, 
  Check, 
  Video, 
  ChevronLeft,
  X,
  FileVideo,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

interface Reel {
  id: string;
  videoUrl: string;
  description: string;
  topic: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string;
  likes: string[];
  reportedBy?: string[];
  reportsCount?: number;
  createdAt: any;
}

export default function ManageReportedVideos() {
  const [reportedVideos, setReportedVideos] = useState<Reel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<Reel | null>(null);
  const [banConfirmation, setBanConfirmation] = useState<Reel | null>(null);

  useEffect(() => {
    // Listen to reels with reports
    const q = query(
      collection(db, 'reels'),
      where('reportsCount', '>', 0)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const videos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Reel));
      
      // Sort by highest report count first
      const sorted = videos.sort((a, b) => ((b.reportedBy || []).length) - ((a.reportedBy || []).length));
      setReportedVideos(sorted);
      setIsLoading(false);
    }, (error) => {
      console.error("Error loading reported videos:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDeleteVideo = async (video: Reel) => {
    if (!confirm(`Tem certeza que deseja excluir o vídeo de @${video.authorName}?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'reels', video.id));
      
      // Send notification to the author
      await sendNotification(
        video.authorId,
        "Vídeo removido pela administração",
        `O seu vídeo '${video.description.substring(0, 30)}${video.description.length > 30 ? '...' : ''}' foi removido pela moderação após análise de denúncias.`
      );

      alert("Vídeo excluído com sucesso!");
      if (selectedVideo?.id === video.id) {
        setSelectedVideo(null);
      }
    } catch (err: any) {
      console.error("Error deleting reported video:", err);
      alert("Erro ao excluir vídeo: " + err.message);
    }
  };

  const handleDismissReports = async (video: Reel) => {
    if (!confirm(`Deseja ignorar as denúncias de este vídeo? Isso redefinirá a contagem para zero.`)) {
      return;
    }

    try {
      await updateDoc(doc(db, 'reels', video.id), {
        reportedBy: [],
        reportsCount: 0
      });
      alert("Denúncias ignoradas com sucesso!");
    } catch (err: any) {
      console.error("Error dismissing reports:", err);
      alert("Erro ao ignorar denúncias: " + err.message);
    }
  };

  const handleBanUser = async () => {
    if (!banConfirmation) return;

    try {
      const authorId = banConfirmation.authorId;
      const authorName = banConfirmation.authorName;

      // Find user by authorId (uid)
      const uq = query(collection(db, 'users'), where('uid', '==', authorId));
      const snapshot = await getDocs(uq);

      if (snapshot.empty) {
        // Try searching public profiles or alert
        alert(`Usuário '${authorName}' não encontrado no cadastro principal.`);
        setBanConfirmation(null);
        return;
      }

      // We might have multiple or one, banner is robust
      const userEmail = snapshot.docs[0].id; // The email is the document ID

      await updateDoc(doc(db, 'users', userEmail), {
        banned: true
      });

      // Delete the reported video as well after banning, as clean action
      await deleteDoc(doc(db, 'reels', banConfirmation.id));

      await sendNotification(
        authorId,
        "Conta Suspensa",
        "Sua conta foi suspensa permanentemente por violação grave das diretrizes da comunidade."
      );

      alert(`Usuário @${authorName} foi banido com sucesso e seu vídeo foi removido!`);
      setBanConfirmation(null);
      if (selectedVideo?.id === banConfirmation.id) {
        setSelectedVideo(null);
      }
    } catch (err: any) {
      console.error("Error banning user:", err);
      alert("Erro ao banir usuário: " + err.message);
      setBanConfirmation(null);
    }
  };

  return (
    <div className="space-y-8 font-sans pb-12">
      <header className="bg-white dark:bg-zinc-900 p-5 md:p-8 rounded-2xl md:rounded-3xl shadow-sm border border-slate-100 dark:border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 transition-colors">
        <div className="flex-grow text-center md:text-left">
          <div className="flex items-center gap-3 justify-center md:justify-start mb-2">
            <Link to="/admin" className="p-2 hover:bg-slate-50 dark:hover:bg-zinc-850 rounded-xl transition-colors text-slate-400 hover:text-slate-650">
              <ChevronLeft size={20} />
            </Link>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white leading-none">Denúncias MakerShorts</h1>
          </div>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 md:ml-12">
            Modere os vídeos do MakerShorts denunciados por membros da comunidade.
          </p>
        </div>
        <div className="w-full md:w-auto bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl md:rounded-2xl flex items-center justify-center md:justify-start gap-4 transition-colors">
          <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center">
            <ShieldAlert className="text-amber-500 w-6 h-6 animate-pulse" />
          </div>
          <div>
            <p className="text-xs text-amber-500 font-bold uppercase tracking-wider leading-none mb-1">Denúncias</p>
            <p className="text-slate-900 dark:text-white font-black leading-none">{reportedVideos.length} Vídeos Pendentes</p>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></div>
        </div>
      ) : reportedVideos.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-12 text-center border border-slate-100 dark:border-white/10 shadow-sm">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Check size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Tudo Limpo!</h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Nenhum vídeo do MakerShorts possui denúncias ativas de usuários no momento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main List */}
          <div className="lg:col-span-7 space-y-4">
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest pl-2 mb-3">Vídeos Denunciados</h2>
            
            <div className="space-y-4">
              {reportedVideos.map((video) => {
                const isSelected = selectedVideo?.id === video.id;
                const reportsCount = video.reportedBy?.length || video.reportsCount || 0;
                
                return (
                  <motion.div
                    key={video.id}
                    layoutId={`video-card-${video.id}`}
                    onClick={() => setSelectedVideo(video)}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-amber-500/10 border-amber-500 shadow-md ring-[3px] ring-amber-500/10' 
                        : 'bg-white dark:bg-zinc-900 border-slate-100 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Video Thumbnail Indicator */}
                      <div className="w-16 h-20 bg-slate-100 dark:bg-zinc-800 rounded-xl relative overflow-hidden flex flex-col items-center justify-center group flex-shrink-0">
                        <video src={video.videoUrl} className="object-cover w-full h-full opacity-60" muted playsInline />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Play size={16} className="text-slate-900 dark:text-white" />
                        </div>
                      </div>

                      {/* Info Content */}
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1.5Packed">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-red-500/10 text-red-500 border border-red-500/20 uppercase tracking-wide">
                            <AlertTriangle size={12} />
                            {reportsCount} {reportsCount === 1 ? 'denúncia' : 'denúncias'}
                          </span>
                          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-50 dark:bg-zinc-800 px-2 py-0.5 rounded border border-slate-100 dark:border-white/5">
                            {video.topic}
                          </span>
                        </div>

                        <p className="text-slate-900 dark:text-white font-bold text-sm mb-2 line-clamp-2">
                          "{video.description}"
                        </p>

                        <div className="flex items-center gap-2">
                          <img 
                            src={video.authorPhotoURL} 
                            alt={video.authorName} 
                            className="w-5 h-5 rounded-full"
                          />
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate">
                            Postado por @{video.authorName.replace(/\s+/g, '').toLowerCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Quick Actions & Video Viewer Column */}
          <div className="lg:col-span-5 relative">
            <div className="sticky top-6">
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest pl-2 mb-3">Painel de Decisão</h2>
              
              <AnimatePresence mode="wait">
                {selectedVideo ? (
                  <motion.div
                    key={selectedVideo.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-105 dark:border-white/10 shadow-lg overflow-hidden"
                  >
                    {/* Video Embed Player */}
                    <div className="aspect-[4/5] bg-black relative flex items-center justify-center group">
                      <video 
                        src={selectedVideo.videoUrl} 
                        className="w-full h-full object-contain" 
                        controls
                        playsInline
                        autoPlay
                      />
                    </div>

                    {/* Meta info & Action Panel */}
                    <div className="p-6 space-y-6">
                      <div>
                        <div className="flex items-center gap-2.5 mb-2">
                          <img 
                            src={selectedVideo.authorPhotoURL} 
                            alt={selectedVideo.authorName} 
                            className="w-8 h-8 rounded-full border border-slate-200"
                          />
                          <div>
                            <p className="text-sm font-black text-slate-900 dark:text-white leading-none">
                              {selectedVideo.authorName}
                            </p>
                            <p className="text-xs text-slate-400 font-semibold italic mt-0.5">
                              @{selectedVideo.authorName.replace(/\s+/g, '').toLowerCase()}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-zinc-850 p-4 rounded-2xl italic leading-relaxed border border-slate-100 dark:border-white/5">
                          "{selectedVideo.description}"
                        </p>
                      </div>

                      {/* Denouncers list summary */}
                      <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-4 space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                          <span className="text-red-500 flex items-center gap-1">
                            <AlertTriangle size={14} /> Total de Denúncias:
                          </span>
                          <span className="text-red-700 dark:text-red-400 font-extrabold text-sm bg-red-500/10 px-2 py-0.5 rounded-lg">
                            {selectedVideo.reportedBy?.length || 0} de 10 max
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed pt-1.5">
                          Usuários que denunciaram: {selectedVideo.reportedBy?.slice(0, 5).join(', ') || 'Sem registros'}{selectedVideo.reportedBy && selectedVideo.reportedBy.length > 5 ? ' e outros...' : ''}
                        </p>
                      </div>

                      {/* Decision buttons */}
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <button
                          onClick={() => handleDismissReports(selectedVideo)}
                          className="flex items-center justify-center gap-2 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-bold bg-white dark:bg-zinc-900 rounded-2xl py-3 text-sm hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-zinc-850 transition-colors cursor-pointer"
                        >
                          <Check size={18} />
                          <span>Ignorar</span>
                        </button>
                        <button
                          onClick={() => handleDeleteVideo(selectedVideo)}
                          className="flex items-center justify-center gap-2 bg-red-550 hover:bg-red-600 text-white font-bold rounded-2xl py-3 text-sm transition-colors cursor-pointer"
                        >
                          <Trash2 size={18} />
                          <span>Excluir</span>
                        </button>
                      </div>

                      <button
                        onClick={() => setBanConfirmation(selectedVideo)}
                        className="w-full flex items-center justify-center gap-2.5 border-2 border-dashed border-red-500/40 text-red-500 hover:bg-red-500/5 font-black uppercase text-xs tracking-widest py-3 rounded-2xl transition-colors cursor-pointer"
                      >
                        <Ban size={16} />
                        <span>Banir Usuário Responsável</span>
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <div className="bg-slate-50 dark:bg-zinc-850 rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 p-12 text-center text-slate-400">
                    <Video size={36} className="mx-auto mb-3 opacity-30 animate-bounce" />
                    <p className="font-bold text-sm">Nenhum vídeo selecionado</p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 max-w-xs mx-auto mt-1">
                      Clique em um vídeo da lista ao lado para visualizá-lo, moderá-lo e aplicar as sanções necessárias.
                    </p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}

      {/* Ban User Dialog */}
      <AnimatePresence>
        {banConfirmation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setBanConfirmation(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-zinc-900 border border-red-500/30 text-white w-full max-w-md rounded-3xl p-6 relative z-10 shadow-2xl"
            >
              <button 
                onClick={() => setBanConfirmation(null)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white"
              >
                <X size={20} />
              </button>
              
              <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-4">
                <Ban size={24} />
              </div>
              
              <h3 className="text-xl font-black uppercase tracking-tight text-red-500 mb-2">Banir Usuário</h3>
              <p className="text-zinc-300 text-sm leading-relaxed mb-6">
                Você esta prestes a banir permanentemente o criador <strong className="text-white">@{banConfirmation.authorName}</strong>. 
                <br /><br />
                Sua conta será suspensa do Makeroom no instante da confirmação, e seu vídeo denunciado será excluído permanentemente de forma imediata. Esta ação é irreversível.
              </p>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setBanConfirmation(null)}
                  className="flex-1 border border-zinc-700 text-zinc-300 font-bold rounded-2xl py-3 text-sm hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleBanUser}
                  className="flex-1 bg-red-650 hover:bg-red-700 text-white font-extrabold rounded-2xl py-3 text-sm transition-colors cursor-pointer"
                >
                  Confirmar Banimento
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
