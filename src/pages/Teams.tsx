import { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, arrayUnion, arrayRemove, where, getDoc } from 'firebase/firestore';
import { awardPoints } from '../services/userService';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, MessageCircle, Share2, Plus, X, Play, Pause, Send, Volume2, VolumeX } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

if (typeof window !== 'undefined' && typeof HTMLMediaElement !== 'undefined') {
  const originalPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function() {
    const promise = originalPlay.apply(this, arguments as any);
    if (promise !== undefined && promise.catch) {
      promise.catch((error) => {
        if (error.name === 'AbortError' || error.message.includes('interrupted')) {
          return;
        }
        throw error;
      });
    }
    return promise;
  };
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Reel {
  id: string;
  videoUrl: string;
  description: string;
  topic: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string;
  likes: string[];
  createdAt: any;
}

interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string;
  content: string;
  createdAt: any;
}

const TOPICS = [
  'Robótica',
  'Eletrônica',
  'Mecânica',
  'Programação',
  'IA',
  'Curiosidades',
  'Outros'
];

export default function Teams() {
  const [reels, setReels] = useState<Reel[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeReelIndex, setActiveReelIndex] = useState(0);
  const [globalMuted, setGlobalMuted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Form states
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newDesc, setNewDesc] = useState('');
  const [newTopic, setNewTopic] = useState(TOPICS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'reels'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedReels = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reel));
      setReels(fetchedReels);
    });
    return () => unsubscribe();
  }, []);

  const handleScroll = () => {
    if (containerRef.current) {
      const scrollPosition = containerRef.current.scrollTop;
      const windowHeight = containerRef.current.clientHeight;
      const newIndex = Math.round(scrollPosition / windowHeight);
      
      if (newIndex !== activeReelIndex) {
        setActiveReelIndex(newIndex);
      }
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFile || !newDesc.trim()) return;
    
    // Check file size (max 50MB) 
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (newFile.size > MAX_FILE_SIZE) {
      alert('O vídeo excede o tamanho máximo permitido de 50MB.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const user = auth.currentUser;
      
      // Upload to Supabase Storage
      const fileExt = newFile.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `${user?.uid || 'anonymous'}/${fileName}`;

      let publicUrl = '';
      
      const { data, error: uploadError } = await supabase.storage
        .from('videos')
        .upload(filePath, newFile);

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: { publicUrl: supabaseUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath);
      publicUrl = supabaseUrl;

      await addDoc(collection(db, 'reels'), {
        videoUrl: publicUrl,
        description: newDesc,
        topic: newTopic,
        authorId: user?.uid || 'unknown',
        authorName: user?.displayName || 'Maker',
        authorPhotoURL: user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`,
        likes: [],
        createdAt: serverTimestamp()
      });
      
      if (user?.uid && user?.email) {
        await awardPoints(user.uid, user.email, 100);
      }

      setIsAddModalOpen(false);
      setNewFile(null);
      setNewDesc('');
      setNewTopic(TOPICS[0]);
    } catch (err: any) {
      console.error('Error adding reel:', err);
      alert('Erro ao adicionar vídeo: ' + err.message);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden flex flex-col border-none">
      
      {/* Header overlay */}
      <div className="absolute top-0 inset-x-0 z-20 p-4 md:p-6 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-end pointer-events-none">
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="pointer-events-auto flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-bold px-4 py-2 rounded-xl transition-all shadow-lg active:scale-95"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">Criar</span>
        </button>
      </div>

      {reels.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-white p-8">
          <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-6">
            <Play className="w-10 h-10 text-brand-500 opacity-50" />
          </div>
          <p className="text-xl font-bold mb-2">Nenhum vídeo ainda</p>
          <p className="text-white/60 mb-8 max-w-sm text-center">Seja o primeiro a compartilhar um projeto ou dica incrível com a comunidade!</p>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-bold px-6 py-3 rounded-2xl transition-all shadow-lg active:scale-95"
          >
            <Plus size={20} />
            <span>Postar Vídeo</span>
          </button>
        </div>
      ) : (
        <div 
          ref={containerRef}
          onScroll={handleScroll}
          className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
        >
          {reels.map((reel, index) => (
            <ReelItem 
              key={reel.id} 
              reel={reel} 
              isActive={index === activeReelIndex} 
              isAdjacent={Math.abs(index - activeReelIndex) <= 1}
              globalMuted={globalMuted}
              setGlobalMuted={setGlobalMuted}
            />
          ))}
        </div>
      )}

      {/* Add Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
           <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setIsAddModalOpen(false)}
               className="absolute inset-0 bg-black/60 backdrop-blur-sm"
             />
             <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl p-6 relative z-10 shadow-2xl border border-slate-200 dark:border-white/10"
             >
               <button 
                 onClick={() => setIsAddModalOpen(false)}
                 className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white"
               >
                 <X size={24} />
               </button>
               <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6">Novo Vídeo Curto</h2>
               
               <form onSubmit={handleAddSubmit} className="space-y-4">
                 <div>
                   <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                     Arquivo do Vídeo (MP4, WebM) <span className="text-xs font-normal text-slate-500">- Máx 50MB</span>
                   </label>
                   <input 
                     type="file"
                     accept="video/mp4,video/webm"
                     required
                     onChange={(e) => setNewFile(e.target.files?.[0] || null)}
                     className="w-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-500 file:text-white hover:file:bg-brand-600 cursor-pointer"
                   />
                 </div>
                 
                 <div>
                   <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                     Assunto
                   </label>
                   <select 
                     value={newTopic}
                     onChange={(e) => setNewTopic(e.target.value)}
                     className="w-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                   >
                     {TOPICS.map(t => (
                       <option key={t} value={t}>{t}</option>
                     ))}
                   </select>
                 </div>

                 <div>
                   <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                     Descrição
                   </label>
                   <textarea 
                     required
                     value={newDesc}
                     onChange={(e) => setNewDesc(e.target.value)}
                     rows={3}
                     placeholder="Diga algo sobre este vídeo..."
                     className="w-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 resize-none"
                   />
                 </div>

                 <button 
                   type="submit"
                   disabled={isSubmitting}
                   className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-4 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
                 >
                   {isSubmitting ? 'Publicando...' : 'Publicar Vídeo'}
                 </button>
               </form>

             </motion.div>
           </div>
        )}
      </AnimatePresence>

      {/* Global styles required for hiding scrollbar visually but keeping functionality */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
      `}</style>
    </div>
  );
}

// ----------------------------------------------------
// COMPONENTS
// ----------------------------------------------------

const NativeVideo = ({ url, isPlaying, isMuted, onEnded }: { url: string, isPlaying: boolean, isMuted: boolean, onEnded?: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        playPromiseRef.current = videoRef.current.play();
        if (playPromiseRef.current !== undefined) {
          playPromiseRef.current.catch(e => {
            if (e.name !== 'AbortError') {
              console.log('Video play error:', e);
            }
          });
        }
      } else {
        if (playPromiseRef.current !== undefined && playPromiseRef.current !== null) {
          playPromiseRef.current.then(() => {
            videoRef.current?.pause();
          }).catch(() => {
            // Cancelled
          });
          playPromiseRef.current = null;
        } else {
          videoRef.current.pause();
        }
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const handleEnded = () => {
    if (onEnded) onEnded();
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      playPromiseRef.current = videoRef.current.play();
      if (playPromiseRef.current !== undefined) {
        playPromiseRef.current.catch(e => {
          if (e.name !== 'AbortError') {
            console.error('Video replay error:', e);
          }
        });
      }
    }
  };

  return (
    <video
      ref={videoRef}
      src={url}
      muted={isMuted}
      playsInline
      onEnded={handleEnded}
      className="w-full h-full object-contain pointer-events-none bg-black"
    />
  );
};

function ReelItem({ reel, isActive, isAdjacent, globalMuted, setGlobalMuted }: { reel: Reel, isActive: boolean, isAdjacent?: boolean, globalMuted: boolean, setGlobalMuted: (val: boolean) => void }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [showXpEffect, setShowXpEffect] = useState(false);
  const currentUserId = auth.currentUser?.uid || '';
  const hasLiked = reel.likes.includes(currentUserId);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Manage play state based on activity
  useEffect(() => {
    let playTimeout: NodeJS.Timeout;
    
    if (isActive && !isCommentsOpen) {
      // Add a small delay to prevent play() interrupted by pause() during fast scrolling
      playTimeout = setTimeout(() => {
        setIsPlaying(true);
      }, 500); // Increased delay
    } else {
      setIsPlaying(false);
    }

    return () => {
      if (playTimeout) {
        clearTimeout(playTimeout);
      }
    };
  }, [isActive, isCommentsOpen]);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
    // Unmute upon explicit interaction if currently muted
    if (globalMuted) {
      setGlobalMuted(false);
    }
  };

  const handleVideoEnded = async () => {
    if (!currentUserId || !auth.currentUser?.email) return;

    try {
      const userRef = doc(db, 'users', auth.currentUser.email);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const watchedReels = userData.watchedReels || [];
        if (!watchedReels.includes(reel.id)) {
           // Mark as watched
           await updateDoc(userRef, { watchedReels: arrayUnion(reel.id) });
           await awardPoints(currentUserId, auth.currentUser.email, 10);
           
           // Show effect
           setShowXpEffect(true);
           setTimeout(() => setShowXpEffect(false), 3000);
        }
      }
    } catch (e) {
      console.error('Error awarding XP on reel completion:', e);
    }
  };

  const handleLike = async () => {
    if (!currentUserId) return;
    const ref = doc(db, 'reels', reel.id);
    if (hasLiked) {
      await updateDoc(ref, {
        likes: arrayRemove(currentUserId)
      });
    } else {
      await updateDoc(ref, {
        likes: arrayUnion(currentUserId)
      });
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Makeroom Shorts',
        text: reel.description,
        url: window.location.href, // Or construct a specific link if routing supports it
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copiado!');
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setGlobalMuted(!globalMuted);
  };

  return (
    <div className="w-full h-full snap-start snap-always relative overflow-hidden bg-black flex items-center justify-center group">
      
      <div 
        ref={wrapperRef}
        className="absolute inset-0 w-full h-full cursor-pointer flex items-center justify-center bg-black" 
        onClick={togglePlay}
      >
        {(isActive || isAdjacent) && (
          <div className="absolute inset-0 w-full h-full flex items-center justify-center">
            <NativeVideo
              url={reel.videoUrl}
              isPlaying={isPlaying}
              isMuted={globalMuted}
            />
          </div>
        )}
        
        {/* Play/Pause overlay */}
        {!isPlaying && (
          <div className="absolute inset-0 bg-black/20 flex flex-col items-center justify-center gap-6 pointer-events-none transition-all duration-300">
            <button 
              onClick={(e) => { e.stopPropagation(); toggleMute(e); }}
              className="w-12 h-12 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center backdrop-blur-sm pointer-events-auto transition-transform active:scale-95"
            >
              {globalMuted ? <VolumeX className="w-6 h-6 text-white" /> : <Volume2 className="w-6 h-6 text-white" />}
            </button>
            <div className="w-20 h-20 bg-black/40 rounded-full flex items-center justify-center backdrop-blur-sm pointer-events-none">
              <Play className="w-10 h-10 text-white fill-white ml-2" />
            </div>
          </div>
        )}
      </div>

      {/* Mute Toggle */}
      <div className="absolute top-4 right-4 z-10 pointer-events-auto">
        <button 
          onClick={toggleMute}
          className="w-10 h-10 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center transition-transform active:scale-90"
        >
          {globalMuted ? (
            <VolumeX className="w-5 h-5 text-white" />
          ) : (
            <Volume2 className="w-5 h-5 text-white" />
          )}
        </button>
      </div>

      {/* Info Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 pb-20 md:pb-6 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none">
        
        {/* Actions side bar */}
        <div className="absolute bottom-24 md:bottom-12 right-4 flex flex-col gap-6 items-center pointer-events-auto">
          {/* Like */}
          <div className="flex flex-col items-center gap-1 group">
            <button 
              onClick={(e) => { e.stopPropagation(); handleLike(); }}
              className="w-12 h-12 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center transition-transform active:scale-90"
            >
              <Heart className={cn("w-6 h-6", hasLiked ? "fill-brand-500 text-brand-500" : "text-white")} />
            </button>
            <span className="text-white text-xs font-bold drop-shadow-md">{reel.likes.length}</span>
          </div>

          {/* Comment */}
          <div className="flex flex-col items-center gap-1 group">
            <button 
              onClick={(e) => { e.stopPropagation(); setIsCommentsOpen(true); }}
              className="w-12 h-12 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center transition-transform active:scale-90"
            >
              <MessageCircle className="w-6 h-6 text-white" />
            </button>
            <span className="text-white text-xs font-bold drop-shadow-md">Comentar</span>
          </div>

          {/* Share */}
          <div className="flex flex-col items-center gap-1 group">
            <button 
              onClick={(e) => { e.stopPropagation(); handleShare(); }}
              className="w-12 h-12 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center transition-transform active:scale-90"
            >
              <Share2 className="w-6 h-6 text-white" />
            </button>
            <span className="text-white text-xs font-bold drop-shadow-md">Compart.</span>
          </div>

          {/* Volume - DISABLED because controls are active now */}
          {/* <div className="flex flex-col items-center gap-1 group">
            <button 
              onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
              className="w-12 h-12 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center transition-transform active:scale-90"
            >
              {isMuted ? <VolumeX className="w-6 h-6 text-white" /> : <Volume2 className="w-6 h-6 text-white" />}
            </button>
            <span className="text-white text-xs font-bold drop-shadow-md">{isMuted ? 'Mudo' : 'Som'}</span>
          </div> */}
        </div>

        {/* Text Info */}
        <div className="w-[80%] pointer-events-auto">
          <div className="flex items-center gap-2 mb-3">
            <img 
              src={reel.authorPhotoURL} 
              alt={reel.authorName} 
              className="w-10 h-10 rounded-full border border-white/20"
            />
            <span className="text-white font-bold text-sm md:text-base drop-shadow-md">@{reel.authorName.replace(/\s+/g, '').toLowerCase()}</span>
          </div>
          
          <div className="inline-block px-2 py-1 bg-brand-500/80 backdrop-blur-sm rounded text-[10px] font-bold text-white uppercase tracking-widest mb-2 border border-brand-400">
            {reel.topic}
          </div>
          
          <p className="text-white text-sm md:text-base drop-shadow-md line-clamp-2 md:line-clamp-none">
            {reel.description} <span className="font-bold text-brand-300 italic">#makershorts</span>
          </p>
        </div>
      </div>

      <AnimatePresence>
        {showXpEffect && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.5, y: -50 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
          >
            <div className="bg-brand-500 text-white font-black text-4xl px-8 py-4 rounded-full shadow-[0_0_40px_rgba(249,115,22,0.8)] border border-white/20 tracking-tighter italic">
              +10 XP
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comments Drawer */}
      <AnimatePresence>
        {isCommentsOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCommentsOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm z-30"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: '0%' }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute bottom-0 left-0 right-0 h-[60%] md:h-[70%] bg-white dark:bg-zinc-900 rounded-t-3xl z-40 flex flex-col"
            >
              <div className="p-4 border-b border-slate-100 dark:border-white/10 flex justify-between items-center">
                <h3 className="font-bold text-slate-900 dark:text-white">Comentários</h3>
                <button onClick={() => setIsCommentsOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white">
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-hidden relative">
                <CommentsList reelId={reel.id} />
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}

function CommentsList({ reelId }: { reelId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  
  useEffect(() => {
    const q = query(collection(db, 'reels', reelId, 'comments'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Comment)));
    });
    return () => unsubscribe();
  }, [reelId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    
    const user = auth.currentUser;
    if (!user) return;

    const commentData = {
      authorId: user.uid,
      authorName: user.displayName || 'Maker',
      authorPhotoURL: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`,
      content: newComment,
      createdAt: serverTimestamp()
    };

    setNewComment('');
    try {
      await addDoc(collection(db, 'reels', reelId, 'comments'), commentData);
    } catch (err) {
      console.error(err);
      alert('Erro ao enviar.');
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {comments.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400">
            Seja o primeiro a comentar!
          </div>
        ) : (
          comments.map(c => (
            <div key={c.id} className="flex gap-3">
              <img src={c.authorPhotoURL} alt={c.authorName} className="w-8 h-8 rounded-full bg-slate-100" />
              <div>
                <span className="font-bold text-xs text-slate-500 dark:text-slate-400">@{c.authorName.replace(/\s+/g, '').toLowerCase()}</span>
                <p className="text-sm text-slate-900 dark:text-white mt-0.5">{c.content}</p>
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="p-4 border-t border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-black/20">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input 
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Adicione um comentário..."
            className="flex-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
          />
          <button 
            type="submit"
            disabled={!newComment.trim()}
            className="p-2 bg-brand-500 text-white rounded-xl hover:bg-brand-600 disabled:opacity-50 transition-colors flex items-center justify-center shrink-0 w-10 h-10"
          >
            <Send size={16} className="-ml-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
