import { useEffect, useState, useRef } from 'react';
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { User, Mail, Shield, Award, Calendar, ChevronRight, Download, Loader2, Camera, X, Check, ChevronLeft, Trophy, Bell, BellOff, Moon, Sun, Medal, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { requestNotificationPermission, showBrowserNotification } from '../services/notificationService';
import { PrintableCertificate } from '../components/PrintableCertificate';

interface UserData {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'student' | 'external';
  points: number;
  certificates: string[];
  teamId?: string;
  room?: string;
  photoURL?: string;
  medals?: { type: 'gold' | 'silver' | 'bronze'; date: string }[];
}

interface Certificate {
  id: string;
  courseTitle: string;
  issueDate: any;
  grade: number;
}

export default function Profile() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingPhoto, setIsUpdatingPhoto] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);
  
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Erro ao sair:', err);
    }
  };
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check localStorage first
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    // Fallback to classList or media query
    return document.documentElement.classList.contains('dark') || 
           window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = (dark: boolean) => {
    setIsDarkMode(dark);
  };

  const predefinedAvatars = [
    { style: 'avataaars', seed: 'Felix' },
    { style: 'bottts', seed: 'Dusty' },
    { style: 'pixel-art', seed: 'Abe' },
    { style: 'adventurer', seed: 'James' },
    { style: 'big-smile', seed: 'Ginger' },
    { style: 'notionists', seed: 'Lucy' },
    { style: 'lorelei', seed: 'Mimi' },
    { style: 'personas', seed: 'Lucky' },
    { style: 'avataaars', seed: 'Zoe' },
    { style: 'bottts', seed: 'Buster' },
    { style: 'pixel-art', seed: 'Coco' },
    { style: 'adventurer', seed: 'Sasha' },
    { style: 'big-smile', seed: 'Toby' },
    { style: 'notionists', seed: 'Max' },
    { style: 'lorelei', seed: 'Luna' },
    { style: 'personas', seed: 'Oliver' }
  ];

  useEffect(() => {
    const fetchUserData = async () => {
      if (auth.currentUser && auth.currentUser.email) {
        try {
          const userDoc = await getDoc(doc(db, 'users', auth.currentUser.email));
          if (userDoc.exists()) {
            setUserData(userDoc.data() as UserData);
          }

          const certsSnap = await getDocs(query(
            collection(db, 'certificates'),
            where('userId', '==', auth.currentUser.email)
          ));
          setCertificates(certsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Certificate)));
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, 'profile');
        }
      }
      setIsLoading(false);
    };

    fetchUserData();
  }, []);

  const handlePrintCertificate = (cert: Certificate) => {
    setSelectedCert(cert);
    setIsCertificateModalOpen(true);
  };

  const _legacy_unused_cert = `
      <html>
        <head>
          <title>Certificado</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Alex+Brush&family=Montserrat:wght@400;500;600;700;800;900&family=Playfair+Display:ital,wght@0,600;0,700;1,500&family=Space+Grotesk:wght@400;500;600;700;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
            
            * {
              box-sizing: border-box;
            }
            
            @media print {
              @page {
                size: landscape;
                margin: 0;
              }
              body {
                background: #ffffff !important;
                margin: 0 !important;
                padding: 0 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                height: 100vh !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .certificate-wrapper {
                box-shadow: none !important;
                border: none !important;
                background: none !important;
                padding: 0 !important;
                margin: 0 !important;
              }
              .certificate {
                transform: scale(1) !important;
                box-shadow: none !important;
                border: 1px solid rgba(249, 115, 22, 0.1) !important;
              }
            }
            
            body { 
              margin: 0; 
              padding: 0; 
              font-family: 'Space Grotesk', sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              background: #0f172a;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            
            .certificate-wrapper {
              background: #0f172a;
              padding: 30px;
              display: flex;
              align-items: center;
              justify-content: center;
              width: 100%;
              height: 100%;
            }
            
            .certificate {
              position: relative;
              width: 1020px;
              height: 720px;
              background: #ffffff;
              padding: 55px 75px;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
              overflow: hidden;
              border: 1px solid rgba(249, 115, 22, 0.15);
            }
            
            /* Corner Accents */
            .corner {
              position: absolute;
              width: 120px;
              height: 120px;
              pointer-events: none;
              z-index: 5;
            }
            .corner-tl {
              top: 0;
              left: 0;
              border-top: 8px solid #f97316;
              border-left: 8px solid #f97316;
            }
            .corner-tr {
              top: 0;
              right: 0;
              border-top: 8px solid #f97316;
              border-right: 8px solid #f97316;
            }
            .corner-bl {
              bottom: 0;
              left: 0;
              border-bottom: 8px solid #f97316;
              border-left: 8px solid #f97316;
            }
            .corner-br {
              bottom: 0;
              right: 0;
              border-bottom: 8px solid #f97316;
              border-right: 8px solid #f97316;
            }
            
            /* Inner gold/orange thin frame */
            .inner-frame {
              position: absolute;
              top: 20px;
              left: 20px;
              right: 20px;
              bottom: 20px;
              border: 1px solid rgba(249, 115, 22, 0.25);
              pointer-events: none;
              z-index: 4;
            }
            
            .content-container {
              position: relative;
              z-index: 10;
              height: 100%;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
            
            .stamp-container {
              position: relative;
              width: 110px;
              height: 110px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
          </style>
        </head>
        <body>
          <div class="certificate-wrapper">
            <div class="certificate">
              <!-- Geometric Border Accents -->
              <div class="corner corner-tl"></div>
              <div class="corner corner-tr"></div>
              <div class="corner corner-bl"></div>
              <div class="corner corner-br"></div>
              <div class="inner-frame"></div>
              
              <!-- Technological Vector Graphic Overlay -->
              <svg style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1;" width="1020" height="720" viewBox="0 0 1020 720" fill="none" xmlns="http://www.w3.org/2000/svg">
                <!-- Tech grids -->
                <defs>
                  <pattern id="tech-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f1f5f9" stroke-width="0.75" />
                  </pattern>
                  <linearGradient id="brand-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#fd0" />
                    <stop offset="100%" stop-color="#f97316" />
                  </linearGradient>
                </defs>
                <rect width="100%" height="100%" fill="url(#tech-grid)" opacity="0.6" />
                
                <!-- Central futuristic rings -->
                <circle cx="510" cy="360" r="320" stroke="#f97316" stroke-width="1" stroke-dasharray="3,12" opacity="0.12" />
                <circle cx="510" cy="360" r="240" stroke="#0f172a" stroke-width="0.75" opacity="0.06" />
                <circle cx="510" cy="360" r="160" stroke="#f97316" stroke-width="2" stroke-dasharray="25,25" opacity="0.08" />
                
                <!-- Circuit board styling paths in the lower margins -->
                <path d="M 50,450 L 150,450 L 190,490 L 190,530" stroke="#ea580c" stroke-width="1.5" stroke-dasharray="2,4" opacity="0.18" fill="none" />
                <path d="M 970,450 L 870,450 L 830,490 L 830,530" stroke="#ea580c" stroke-width="1.5" stroke-dasharray="2,4" opacity="0.18" fill="none" />
                <circle cx="190" cy="530" r="3" fill="#ea580c" opacity="0.25" />
                <circle cx="830" cy="530" r="3" fill="#ea580c" opacity="0.25" />
                
                <!-- Top Header technical details -->
                <path d="M 200,50 L 320,50" stroke="#ea580c" stroke-width="2" opacity="0.4" />
                <path d="M 820,50 L 700,50" stroke="#ea580c" stroke-width="2" opacity="0.4" />
              </</svg>
              
              <div class="content-container">
                <!-- Header of Certificate -->
                <div style="text-align: center; margin-top: 10px;">
                  <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 25px;">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-top: -3px;">
                      <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#f97316" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M2 17L12 22L22 17" stroke="#ea580c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M2 12L12 17L22 12" stroke="#1e293b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
                    </svg>
                    <span style="font-family: 'Space Grotesk', sans-serif; font-size: 21px; font-weight: 900; letter-spacing: 5px; color: #1e293b;">MAKEROOM</span>
                    <span style="font-family: 'Space Grotesk', sans-serif; font-size: 21px; font-weight: 400; letter-spacing: 5px; color: #f97316;">ROBÓTICA</span>
                  </div>
                  <div style="font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 800; color: #f97316; letter-spacing: 8px; text-transform: uppercase;">Certificado de Conclusão</div>
                  <div style="width: 100px; height: 3px; background: #f97316; margin: 12px auto 0 auto; border-radius: 2px;"></div>
                </div>

                <!-- Main Certification Statement -->
                <div style="text-align: center; margin: 25px 0;">
                  <p style="font-family: 'Playfair Display', serif; font-style: italic; font-size: 20px; color: #64748b; margin: 0 0 16px 0;">Certificamos que o estudante</p>
                  
                  <!-- Recipient Name -->
                  <div style="font-family: 'Montserrat', sans-serif; font-size: 44px; font-weight: 900; color: #0f172a; letter-spacing: -1px; margin: 15px 0; text-transform: uppercase;">
                    ${userData?.name}
                  </div>
                  
                  <p style="font-family: 'Playfair Display', serif; font-style: italic; font-size: 19px; color: #64748b; margin: 15px 0;">concluiu com êxito e aproveitamento máximo a trilha de aprendizado de</p>
                  
                  <!-- Course Title -->
                  <div style="font-family: 'Space Grotesk', sans-serif; font-size: 32px; font-weight: 900; color: #f97316; margin: 15px 0; text-transform: uppercase; letter-spacing: 0.5px;">
                    Curso de Robótica
                  </div>
                  
                  <p style="font-family: 'Montserrat', sans-serif; font-size: 13.5px; color: #94a3b8; font-weight: 500; max-width: 680px; margin: 20px auto 0 auto; line-height: 1.6;">
                    Comprovando proficiência técnica, participação proeminente nas atividades teórico-práticas, superação de desafios lógicos e excelência no desenvolvimento de projetos autorais utilizando Metodologia Maker e Engenharia de Software.
                  </p>
                </div>

                <!-- Footer details, signatures and stamps -->
                <div style="display: flex; justify-content: space-between; align-items: flex-end; padding-top: 20px; border-top: 1px solid #f1f5f9; z-index: 10;">
                  
                  <!-- Left side metadata in neat monospace -->
                  <div style="text-align: left; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #64748b; line-height: 1.8;">
                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                      <span style="color: #f97316; font-weight: 700;">[● EMISSÃO]</span> 00/00/0000
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                      <span style="color: #ea580c; font-weight: 700;">[● DESEMPENHO]</span> 100% / 100%
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span style="color: #94a3b8; font-weight: 700;">[● AUTENTICIDADE]</span> <span style="color: #1e293b; font-weight: 700;">#ID</span>
                    </div>
                  </div>
                  
                  <!-- Middle Signatures Block -->
                  <div style="display: flex; gap: 35px; align-items: flex-end; margin-bottom: -4px;">
                    <!-- Coordinate Signature -->
                    <div style="text-align: center; width: 160px;">
                      <div style="position: relative; height: 45px; display: flex; align-items: center; justify-content: center; margin-bottom: 5px;">
                        <svg width="130" height="40" viewBox="0 0 130 40" xmlns="http://www.w3.org/2000/svg">
                          <path d="M10,25 C25,20 40,5 50,15 C58,23 45,38 60,32 C75,25 90,8 105,12 C115,15 100,35 120,30" stroke="#0f172a" stroke-width="2.2" fill="none" stroke-linecap="round" />
                        </svg>
                      </div>
                      <div style="width: 100%; height: 1px; background: #ea580c; opacity: 0.6; margin-bottom: 6px;"></div>
                      <div style="font-family: 'Space Grotesk', sans-serif; font-size: 11.5px; font-weight: 700; color: #1e293b;">João Vitor Santana</div>
                      <div style="font-family: 'Montserrat', sans-serif; font-size: 9px; color: #94a3b8; font-weight: 600; margin-top: 1px; text-transform: uppercase; letter-spacing: 0.5px;">Engenheiro de Software e CEO INCODED</div>
                    </div>

                    <!-- Direction Signature -->
                    <div style="text-align: center; width: 160px;">
                      <div style="position: relative; height: 45px; display: flex; align-items: center; justify-content: center; margin-bottom: 5px;">
                        <svg width="130" height="40" viewBox="0 0 130 40" xmlns="http://www.w3.org/2000/svg">
                          <path d="M15,28 C30,12 45,18 55,22 C65,25 72,10 80,15 C88,20 82,32 95,25 C108,18 120,12 125,22" stroke="#0f172a" stroke-width="2.2" fill="none" stroke-linecap="round" />
                        </svg>
                      </div>
                      <div style="width: 100%; height: 1px; background: #ea580c; opacity: 0.6; margin-bottom: 6px;"></div>
                      <div style="font-family: 'Space Grotesk', sans-serif; font-size: 11.5px; font-weight: 700; color: #1e293b;">Gil Andrade</div>
                      <div style="font-family: 'Montserrat', sans-serif; font-size: 9px; color: #94a3b8; font-weight: 600; margin-top: 1px; text-transform: uppercase; letter-spacing: 0.5px;">Professor de Robótica e CEO Makeroom</div>
                    </div>
                  </div>

                  <!-- Right side authentic orange custom seal -->
                  <div class="stamp-container">
                    <svg width="110" height="110" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stop-color="#f97316" />
                          <stop offset="30%" stop-color="#fed7aa" />
                          <stop offset="70%" stop-color="#ea580c" />
                          <stop offset="100%" stop-color="#9a3412" />
                        </linearGradient>
                      </defs>
                      <path d="M 60,6 A 54,54 0 0,1 114,60 A 54,54 0 0,1 60,114 A 54,54 0 0,1 6,60 A 54,54 0 0,1 6,60 Z" fill="none" stroke="url(#gold-grad)" stroke-width="4.5" stroke-dasharray="8,4" />
                      <circle cx="60" cy="60" r="47" fill="#fffaf7" stroke="url(#gold-grad)" stroke-width="1.5" />
                      <circle cx="60" cy="60" r="41" fill="none" stroke="#ea580c" stroke-width="1" stroke-dasharray="2,5" opacity="0.6" />
                      <circle cx="60" cy="60" r="37" fill="none" stroke="url(#gold-grad)" stroke-width="1" />
                      
                      <g transform="translate(60,60)">
                        <path d="M-5,-5 L-9,-9 M5,-5 L9,-9 M-5,5 L-9,9 M5,5 L9,9" stroke="url(#gold-grad)" stroke-width="1.5" />
                        <text y="-8" font-family="'Space Grotesk', sans-serif" font-weight="900" font-size="8.5" fill="#ea580c" text-anchor="middle" letter-spacing="1.5">MAKER</text>
                        <line x1="-20" y1="-2" x2="20" y2="-2" stroke="#fed7aa" stroke-width="1" />
                        <text y="10" font-family="'Space Grotesk', sans-serif" font-weight="900" font-size="9" fill="#7c2d12" text-anchor="middle" letter-spacing="0.5">APROVADO</text>
                        <path d="M-2,-14 L0,-18 L2,-14 L5,-14 L3,-11 L4,-7 L0,-10 L-4,-7 L-3,-11 L-5,-14 Z" fill="url(#gold-grad)" transform="scale(0.55) translate(0, 36)" />
                      </g>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <script>
            window.onload = () => { window.print(); window.close(); };
          </script>
        </body>
      </html>
  `;

  const handleUpdateAvatar = async (url: string) => {
    if (!auth.currentUser?.email) return;
    
    setIsUpdatingPhoto(true);
    
    try {
      const userRef = doc(db, 'users', auth.currentUser.email);
      await updateDoc(userRef, {
        photoURL: url
      });
      
      // Update public profile
      if (auth.currentUser.uid) {
        await updateDoc(doc(db, 'public_profiles', auth.currentUser.uid), {
          photoURL: url
        });
      }
      
      setUserData(prev => prev ? { ...prev, photoURL: url } : null);
      setShowAvatarModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'profile-photo');
    } finally {
      setIsUpdatingPhoto(false);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermission();
    if (typeof Notification !== 'undefined') {
      setNotificationPermission(Notification.permission);
    }
    if (granted) {
      showBrowserNotification('Notificações Ativadas! 🎉', {
        body: 'Agora você receberá atualizações sobre seus pedidos em tempo real.'
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!userData) return null;

  const medalColors = {
    gold: 'from-yellow-400 to-yellow-600',
    silver: 'from-slate-300 to-slate-500',
    bronze: 'from-orange-400 to-orange-600'
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
      <header className="bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-sm border border-slate-100 dark:border-white/10 flex flex-col md:flex-row items-center gap-6 md:gap-8 transition-colors">
        <div 
          onClick={() => setShowAvatarModal(true)}
          className="w-24 h-24 md:w-32 md:h-32 bg-brand-100 dark:bg-brand-500/20 rounded-full flex items-center justify-center relative overflow-hidden ring-4 ring-brand-50 dark:ring-brand-500/10 cursor-pointer group shrink-0"
        >
          <img 
            src={userData.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData.uid}`} 
            alt={userData.name} 
            className="w-full h-full object-cover transition-transform group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Camera className="text-white w-6 h-6 md:w-8 md:h-8" />
          </div>
          {isUpdatingPhoto && (
            <div className="absolute inset-0 bg-white/60 dark:bg-black/60 flex items-center justify-center">
              <Loader2 className="w-6 h-6 md:w-8 md:h-8 animate-spin text-brand-500" />
            </div>
          )}
        </div>
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-1">{userData.name.split(' ').slice(0, 2).join(' ')}</h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 mb-4">{userData.email}</p>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 md:gap-3">
            <span className={`px-3 md:px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest border ${
              userData.role === 'admin' ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-500/20' :
              userData.role === 'student' ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-100 dark:border-brand-500/20' :
              'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 border-slate-100 dark:border-white/10'
            }`}>
              {userData.role === 'admin' ? 'Administrador' : userData.role === 'student' ? 'Estudante' : 'Externo'}
            </span>
            {userData.role === 'student' && (
              <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 md:px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest border border-emerald-100 dark:border-emerald-500/20">
                {userData.teamId} - {userData.room}
              </span>
            )}
            <span className="bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 px-3 md:px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest border border-slate-100 dark:border-white/10">
              {userData.points} Pontos
            </span>
          </div>
        </div>
        <div className="shrink-0 w-full md:w-auto flex justify-center md:justify-end">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 font-black uppercase tracking-wider rounded-2xl border border-rose-100 dark:border-rose-500/20 shadow-sm transition-all active:scale-95 text-xs"
          >
            <LogOut size={14} />
            <span>Sair da Conta</span>
          </button>
        </div>
      </header>

      {/* Medals Section */}
      {userData.medals && userData.medals.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-sm border border-slate-100 dark:border-white/10 transition-colors">
          <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white mb-4 md:mb-6 flex items-center gap-2 md:gap-3">
            <Trophy className="w-5 h-5 md:w-6 md:h-6 text-brand-500" /> Minhas Medalhas da Temporada
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            {userData.medals.map((medal, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="flex flex-col items-center p-3 md:p-4 rounded-xl md:rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 hover:shadow-md transition-all"
              >
                <div className={`w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br ${medalColors[medal.type]} flex items-center justify-center shadow-lg mb-2 md:mb-3`}>
                  <Medal className="text-white drop-shadow-md w-6 h-6 md:w-8 md:h-8" />
                </div>
                <p className="text-xs font-bold text-slate-900 dark:text-white capitalize">{medal.type === 'gold' ? 'Ouro' : medal.type === 'silver' ? 'Prata' : 'Bronze'}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{medal.date}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl md:rounded-3xl shadow-sm border border-slate-100 dark:border-white/10 transition-colors">
            <h2 className="text-base md:text-lg font-bold text-slate-900 dark:text-white mb-4 md:mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-brand-500" /> Detalhes
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 md:w-10 md:h-10 bg-slate-50 dark:bg-white/5 rounded-lg md:rounded-xl flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 md:w-5 md:h-5 text-slate-400 dark:text-slate-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Email</p>
                  <p className="text-xs md:text-sm text-slate-700 dark:text-slate-200 font-medium truncate">{userData.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 md:w-10 md:h-10 bg-slate-50 dark:bg-white/5 rounded-lg md:rounded-xl flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4 md:w-5 md:h-5 text-slate-400 dark:text-slate-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Permissão</p>
                  <p className="text-xs md:text-sm text-slate-700 dark:text-slate-200 font-medium capitalize">{userData.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 md:w-10 md:h-10 bg-slate-50 dark:bg-white/5 rounded-lg md:rounded-xl flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 md:w-5 md:h-5 text-slate-400 dark:text-slate-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Membro desde</p>
                  <p className="text-xs md:text-sm text-slate-700 dark:text-slate-200 font-medium">Março 2026</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl md:rounded-3xl shadow-sm border border-slate-100 dark:border-white/10 transition-colors">
            <h2 className="text-base md:text-lg font-bold text-slate-900 dark:text-white mb-4 md:mb-6 flex items-center gap-2">
              <Sun className="w-5 h-5 text-brand-500" /> Tema da Plataforma
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => toggleTheme(false)}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                  !isDarkMode 
                    ? 'bg-brand-50 dark:bg-brand-500/20 border-brand-500 text-brand-600 dark:text-brand-400 shadow-lg shadow-brand-500/10' 
                    : 'bg-slate-50 dark:bg-white/5 border-transparent text-slate-400 dark:text-slate-500 hover:border-slate-200 dark:hover:border-white/10'
                }`}
              >
                <Sun className="w-6 h-6" />
                <span className="text-xs font-bold uppercase tracking-wider">Claro</span>
              </button>
              <button
                type="button"
                onClick={() => toggleTheme(true)}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                  isDarkMode 
                    ? 'bg-slate-800 dark:bg-white/10 border-white/20 text-white shadow-xl shadow-black/20' 
                    : 'bg-slate-50 dark:bg-white/5 border-transparent text-slate-400 dark:text-slate-500 hover:border-slate-200 dark:hover:border-white/10'
                }`}
              >
                <Moon className="w-6 h-6" />
                <span className="text-xs font-bold uppercase tracking-wider">Escuro</span>
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl md:rounded-3xl shadow-sm border border-slate-100 dark:border-white/10 transition-colors">
            <h2 className="text-base md:text-lg font-bold text-slate-900 dark:text-white mb-4 md:mb-6 flex items-center gap-2">
              <Bell className="w-5 h-5 text-brand-500" /> Notificações
            </h2>
            <div className="space-y-4">
              {notificationPermission === 'granted' ? (
                <button
                  onClick={() => setNotificationPermission('denied')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-xl md:rounded-2xl border border-slate-200 dark:border-white/10 transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  <BellOff className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                  Desativar Notificações
                </button>
              ) : (
                <button
                  onClick={handleRequestPermission}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold rounded-xl md:rounded-2xl border border-transparent shadow-lg shadow-brand-500/20 transition-all cursor-pointer active:scale-95"
                >
                  <Bell className="w-5 h-5" />
                  Ativar Notificações
                </button>
              )}
              <p className="text-[9px] md:text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed px-1">
                {notificationPermission === 'granted' 
                  ? 'Você receberá notificações push sobre o status das suas compras e atualizações da plataforma.'
                  : 'Ative as notificações para ser avisado quando seu pedido sair para entrega ou estiver pronto para retirada.'}
              </p>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl md:rounded-3xl shadow-sm border border-slate-100 dark:border-white/10 transition-colors">
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <h2 className="text-base md:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-brand-500" /> Meus Certificados
              </h2>
              <span className="text-[10px] md:text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                {certificates.length} Total
              </span>
            </div>

            {certificates.length === 0 ? (
              <div className="text-center py-10 md:py-12 bg-slate-50 dark:bg-white/5 rounded-xl md:rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10">
                <Award className="w-10 h-10 md:w-12 md:h-12 text-slate-200 dark:text-white/10 mx-auto mb-3 md:mb-4" />
                <p className="text-sm md:text-base text-slate-400 font-medium">Você ainda não possui certificados.</p>
                <p className="text-[10px] md:text-xs text-slate-400">Complete trilhas de cursos para ganhar!</p>
              </div>
            ) : (
              <div className="space-y-3 md:space-y-4">
                {certificates.map((cert) => (
                  <div 
                    key={cert.id} 
                    onClick={() => handlePrintCertificate(cert)}
                    className="flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-xl md:rounded-2xl border border-slate-100 dark:border-white/10 hover:border-brand-200 dark:hover:border-brand-500/30 hover:bg-brand-50 dark:hover:bg-brand-500/5 transition-all duration-200 group cursor-pointer"
                  >
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-brand-100 dark:bg-white/10 rounded-lg md:rounded-xl flex items-center justify-center group-hover:bg-brand-500 transition-colors shrink-0">
                      <Award className="w-5 h-5 md:w-6 md:h-6 text-brand-600 dark:text-brand-400 group-hover:text-white transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm md:text-base text-slate-900 dark:text-white truncate">{cert.courseTitle}</h3>
                      <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400">
                        Emitido em {cert.issueDate?.toDate ? cert.issueDate.toDate().toLocaleDateString() : 'Recentemente'}
                      </p>
                    </div>
                    <Download className="w-4 h-4 md:w-5 md:h-5 text-slate-300 dark:text-slate-700 group-hover:text-brand-500 shrink-0 transition-colors" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Avatar Selection Modal */}
      <AnimatePresence>
        {showAvatarModal && (
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-zinc-900 rounded-[24px] md:rounded-[32px] shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-100 dark:border-white/10"
            >
              <div className="p-6 md:p-8 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Escolha seu Avatar</h2>
                  <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">Selecione uma imagem para o seu perfil</p>
                </div>
                <button 
                  onClick={() => setShowAvatarModal(false)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 md:w-6 md:h-6 text-slate-400" />
                </button>
              </div>

              <div className="relative group/modal">
                <button
                  onClick={() => scroll('left')}
                  className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-10 p-2 md:p-3 bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm border border-slate-100 dark:border-white/10 rounded-full shadow-lg text-slate-600 dark:text-slate-300 hover:text-brand-500 hover:scale-110 transition-all md:opacity-0 group-hover/modal:opacity-100"
                >
                  <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
                </button>

                <div 
                  ref={scrollRef}
                  className="p-6 md:p-10 overflow-x-auto flex gap-4 md:gap-8 snap-x snap-mandatory no-scrollbar scroll-smooth bg-slate-50/30 dark:bg-black/20"
                >
                  {predefinedAvatars.map((avatar, index) => {
                    const url = `https://api.dicebear.com/7.x/${avatar.style}/svg?seed=${avatar.seed}`;
                    const isSelected = userData.photoURL === url;
                    
                    return (
                      <button
                        key={`${avatar.style}-${avatar.seed}-${index}`}
                        onClick={() => handleUpdateAvatar(url)}
                        disabled={isUpdatingPhoto}
                        className={`relative flex-shrink-0 w-32 md:w-48 aspect-square rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden border-2 transition-all hover:scale-105 active:scale-95 shadow-sm hover:shadow-xl snap-center ${
                          isSelected 
                            ? 'border-brand-500 ring-4 ring-brand-50 dark:ring-brand-500/20' 
                            : 'border-slate-100 dark:border-white/10 hover:border-brand-200 dark:hover:border-brand-500/30 bg-white dark:bg-zinc-800'
                        }`}
                      >
                        <img 
                          src={url} 
                          alt={avatar.seed} 
                          className="w-full h-full object-cover p-2 md:p-3"
                        />
                        {isSelected && (
                          <div className="absolute inset-0 bg-brand-500/20 flex items-center justify-center">
                            <div className="bg-brand-500 text-white p-1 rounded-full">
                              <Check className="w-3 h-3 md:w-4 md:h-4" />
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => scroll('right')}
                  className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-10 p-2 md:p-3 bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm border border-slate-100 dark:border-white/10 rounded-full shadow-lg text-slate-600 dark:text-slate-300 hover:text-brand-500 hover:scale-110 transition-all md:opacity-0 group-hover/modal:opacity-100"
                >
                  <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              </div>

              <div className="p-4 md:p-6 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-100 dark:border-white/10 flex justify-end">
                <button
                  onClick={() => setShowAvatarModal(false)}
                  className="px-5 md:px-6 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-sm"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {selectedCert && (
        <PrintableCertificate
          isOpen={isCertificateModalOpen}
          onClose={() => {
            setIsCertificateModalOpen(false);
            setSelectedCert(null);
          }}
          userName={userData?.name || ''}
          courseTitle={selectedCert.courseTitle || ''}
          issueDate={selectedCert.issueDate}
          grade={selectedCert.grade || 100}
          certificateId={selectedCert.id || ''}
        />
      )}
    </div>
  );
}
