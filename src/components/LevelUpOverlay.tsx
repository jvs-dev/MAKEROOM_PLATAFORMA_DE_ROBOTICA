import { useEffect, useState, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function LevelUpOverlay() {
  const [show, setShow] = useState(false);
  const [level, setLevel] = useState<number | null>(null);
  const previousLevel = useRef<number | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const authUnsubscribe = auth.onAuthStateChanged(user => {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = undefined;
      }
      if (user && user.email) {
        unsubscribe = onSnapshot(doc(db, 'users', user.email), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const points = data.points || 0;
            const newLevel = Math.floor(points / 100) + 1;
            
            if (previousLevel.current !== null && newLevel > previousLevel.current) {
              setLevel(newLevel);
              setShow(true);
              
              confetti({
                particleCount: 150,
                spread: 120,
                origin: { y: 0.1 },
                colors: ['#f97316', '#fb923c', '#fcd34d', '#ffffff'],
                zIndex: 9999
              });

              setTimeout(() => setShow(false), 5000);
            }
            // Update previousLevel anyway (initialize or track)
            previousLevel.current = newLevel;
          }
        });
      }
    });

    return () => {
      authUnsubscribe();
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return (
    <AnimatePresence>
      {show && level && (
        <div className="fixed inset-0 z-[100] pointer-events-none flex items-start pt-24 md:pt-32 justify-center">
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.5, rotate: -5 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1, 
              rotate: 0,
              transition: { type: 'spring', bounce: 0.5, duration: 0.8 }
            }}
            exit={{ opacity: 0, y: -20, scale: 0.8 }}
            className="bg-white dark:bg-zinc-900 border-4 border-brand-500 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col items-center gap-3 relative overflow-hidden"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="absolute -z-10 w-48 h-48 bg-brand-500/20 blur-3xl rounded-full"
            />
            
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: 'spring', bounce: 0.6 }}
              className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-brand-400 to-brand-600 rounded-full flex items-center justify-center shadow-lg relative"
            >
              <Trophy className="w-10 h-10 md:w-12 md:h-12 text-white" />
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="absolute top-0 right-0 -mr-2 -mt-2"
              >
                <Sparkles className="w-8 h-8 md:w-10 md:h-10 text-yellow-300 fill-yellow-300" />
              </motion.div>
            </motion.div>
            
            <div className="text-center space-y-1 relative z-10 mt-2">
              <motion.h2 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-brand-500 font-black text-xl md:text-2xl uppercase tracking-[0.2em]"
              >
                Subiu de Nível!
              </motion.h2>
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="text-4xl md:text-5xl font-black italic tracking-tighter text-slate-900 dark:text-white"
              >
                LEVEL {level}
              </motion.div>
            </div>
            
            <div className="absolute inset-x-0 bottom-0 h-1 bg-brand-500"></div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
