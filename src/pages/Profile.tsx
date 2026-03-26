import { useEffect, useState, useRef } from 'react';
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { User, Mail, Shield, Award, Calendar, ChevronRight, Download, Loader2, Camera, X, Check, ChevronLeft, Trophy, Bell, BellOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { requestNotificationPermission, showBrowserNotification } from '../services/notificationService';

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
  const scrollRef = useRef<HTMLDivElement>(null);

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
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const date = cert.issueDate?.toDate ? cert.issueDate.toDate().toLocaleDateString() : new Date().toLocaleDateString();

    printWindow.document.write(`
      <html>
        <head>
          <title>Certificado - ${cert.courseTitle}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { 
              margin: 0; 
              padding: 0; 
              font-family: 'Inter', sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              background: #f8fafc;
            }
            .certificate {
              width: 800px;
              height: 600px;
              background: white;
              border: 20px solid #4f46e5;
              padding: 60px;
              text-align: center;
              position: relative;
              box-shadow: 0 20px 50px rgba(0,0,0,0.1);
            }
            .logo { font-size: 24px; font-weight: 900; color: #4f46e5; margin-bottom: 40px; }
            h1 { font-size: 48px; margin: 20px 0; color: #1e293b; }
            h2 { font-size: 24px; color: #64748b; font-weight: 400; margin-bottom: 40px; }
            .name { font-size: 36px; font-weight: 700; color: #4f46e5; margin: 20px 0; text-decoration: underline; }
            .course { font-size: 28px; font-weight: 700; color: #1e293b; }
            .footer { margin-top: 60px; display: flex; justify-content: space-between; align-items: flex-end; }
            .info { text-align: left; color: #64748b; font-size: 14px; }
            .stamp { width: 100px; height: 100px; border: 4px double #4f46e5; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #4f46e5; font-weight: 900; transform: rotate(-15deg); }
          </style>
        </head>
        <body>
          <div class="certificate">
            <div class="logo">MAKEROOM ROBÓTICA</div>
            <h2>Certificamos que</h2>
            <div class="name">${userData?.name}</div>
            <h2>concluiu com êxito o curso de</h2>
            <div class="course">${cert.courseTitle}</div>
            <div class="footer">
              <div class="info">
                <p>Data de Emissão: ${date}</p>
                <p>Média Final: ${cert.grade.toFixed(1)}%</p>
                <p>ID do Certificado: ${cert.id}</p>
              </div>
              <div class="stamp">APROVADO</div>
            </div>
          </div>
          <script>
            window.onload = () => { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleUpdateAvatar = async (url: string) => {
    if (!auth.currentUser?.email) return;
    
    setIsUpdatingPhoto(true);
    
    try {
      const userRef = doc(db, 'users', auth.currentUser.email);
      await updateDoc(userRef, {
        photoURL: url
      });
      
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

  const medalIcons = {
    gold: '🥇',
    silver: '🥈',
    bronze: '🥉'
  };

  const medalColors = {
    gold: 'from-yellow-400 to-yellow-600',
    silver: 'from-slate-300 to-slate-500',
    bronze: 'from-orange-400 to-orange-600'
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
      <header className="bg-white p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center gap-6 md:gap-8">
        <div 
          onClick={() => setShowAvatarModal(true)}
          className="w-24 h-24 md:w-32 md:h-32 bg-brand-100 rounded-full flex items-center justify-center relative overflow-hidden ring-4 ring-brand-50 cursor-pointer group shrink-0"
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
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
              <Loader2 className="w-6 h-6 md:w-8 md:h-8 animate-spin text-brand-500" />
            </div>
          )}
        </div>
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-1">{userData.name}</h1>
          <p className="text-sm md:text-base text-slate-500 mb-4">{userData.email}</p>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 md:gap-3">
            <span className={`px-3 md:px-4 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest border ${
              userData.role === 'admin' ? 'bg-purple-50 text-purple-600 border-purple-100' :
              userData.role === 'student' ? 'bg-brand-50 text-brand-600 border-brand-100' :
              'bg-slate-50 text-slate-600 border-slate-100'
            }`}>
              {userData.role === 'admin' ? 'Administrador' : userData.role === 'student' ? 'Estudante' : 'Externo'}
            </span>
            {userData.role === 'student' && (
              <span className="bg-emerald-50 text-emerald-600 px-3 md:px-4 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest border border-emerald-100">
                {userData.teamId} - {userData.room}
              </span>
            )}
            <span className="bg-slate-50 text-slate-600 px-3 md:px-4 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest border border-slate-100">
              {userData.points} Pontos
            </span>
          </div>
        </div>
      </header>

      {/* Medals Section */}
      {userData.medals && userData.medals.length > 0 && (
        <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-sm border border-slate-100">
          <h2 className="text-lg md:text-xl font-bold text-slate-900 mb-4 md:mb-6 flex items-center gap-2 md:gap-3">
            <Trophy className="w-5 h-5 md:w-6 md:h-6 text-brand-500" /> Minhas Medalhas da Temporada
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            {userData.medals.map((medal, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="flex flex-col items-center p-3 md:p-4 rounded-xl md:rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-md transition-shadow"
              >
                <div className={`w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br ${medalColors[medal.type]} flex items-center justify-center text-2xl md:text-3xl shadow-lg mb-2 md:mb-3`}>
                  {medalIcons[medal.type]}
                </div>
                <p className="text-[10px] md:text-xs font-bold text-slate-900 capitalize">{medal.type === 'gold' ? 'Ouro' : medal.type === 'silver' ? 'Prata' : 'Bronze'}</p>
                <p className="text-[9px] md:text-[10px] text-slate-400 font-medium">{medal.date}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl md:rounded-3xl shadow-sm border border-slate-100">
            <h2 className="text-base md:text-lg font-bold text-slate-900 mb-4 md:mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-brand-500" /> Detalhes
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 md:w-10 md:h-10 bg-slate-50 rounded-lg md:rounded-xl flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 md:w-5 md:h-5 text-slate-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-wider">Email</p>
                  <p className="text-xs md:text-sm text-slate-700 font-medium truncate">{userData.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 md:w-10 md:h-10 bg-slate-50 rounded-lg md:rounded-xl flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4 md:w-5 md:h-5 text-slate-400" />
                </div>
                <div>
                  <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-wider">Permissão</p>
                  <p className="text-xs md:text-sm text-slate-700 font-medium capitalize">{userData.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 md:w-10 md:h-10 bg-slate-50 rounded-lg md:rounded-xl flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 md:w-5 md:h-5 text-slate-400" />
                </div>
                <div>
                  <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-wider">Membro desde</p>
                  <p className="text-xs md:text-sm text-slate-700 font-medium">Março 2026</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl md:rounded-3xl shadow-sm border border-slate-100">
            <h2 className="text-base md:text-lg font-bold text-slate-900 mb-4 md:mb-6 flex items-center gap-2">
              <Bell className="w-5 h-5 text-brand-500" /> Notificações
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 md:p-4 bg-slate-50 rounded-xl md:rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center ${notificationPermission === 'granted' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    {notificationPermission === 'granted' ? <Bell className="w-4 h-4 md:w-5 md:h-5" /> : <BellOff className="w-4 h-4 md:w-5 md:h-5" />}
                  </div>
                  <div>
                    <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-wider">Status</p>
                    <p className="text-xs md:text-sm text-slate-700 font-medium">
                      {notificationPermission === 'granted' ? 'Ativadas' : notificationPermission === 'denied' ? 'Bloqueadas' : 'Não configuradas'}
                    </p>
                  </div>
                </div>
                {notificationPermission !== 'granted' && (
                  <button 
                    onClick={handleRequestPermission}
                    className="px-3 md:px-4 py-1.5 md:py-2 bg-brand-500 text-white text-[10px] md:text-xs font-bold rounded-lg md:rounded-xl hover:bg-brand-600 transition-colors"
                  >
                    Ativar
                  </button>
                )}
              </div>
              <p className="text-[9px] md:text-[10px] text-slate-400 leading-relaxed px-1">
                {notificationPermission === 'granted' 
                  ? 'Você receberá notificações push sobre o status das suas compras e atualizações da plataforma.'
                  : 'Ative as notificações para ser avisado quando seu pedido sair para entrega ou estiver pronto para retirada.'}
              </p>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl md:rounded-3xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Award className="w-5 h-5 text-brand-500" /> Meus Certificados
              </h2>
              <span className="text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-wider">
                {certificates.length} Total
              </span>
            </div>

            {certificates.length === 0 ? (
              <div className="text-center py-10 md:py-12 bg-slate-50 rounded-xl md:rounded-2xl border-2 border-dashed border-slate-200">
                <Award className="w-10 h-10 md:w-12 md:h-12 text-slate-200 mx-auto mb-3 md:mb-4" />
                <p className="text-sm md:text-base text-slate-400 font-medium">Você ainda não possui certificados.</p>
                <p className="text-[10px] md:text-xs text-slate-400">Complete trilhas de cursos para ganhar!</p>
              </div>
            ) : (
              <div className="space-y-3 md:space-y-4">
                {certificates.map((cert) => (
                  <div 
                    key={cert.id} 
                    onClick={() => handlePrintCertificate(cert)}
                    className="flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-xl md:rounded-2xl border border-slate-100 hover:border-brand-200 hover:bg-brand-50 transition-all duration-200 group cursor-pointer"
                  >
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-brand-100 rounded-lg md:rounded-xl flex items-center justify-center group-hover:bg-brand-500 transition-colors shrink-0">
                      <Award className="w-5 h-5 md:w-6 md:h-6 text-brand-600 group-hover:text-white transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm md:text-base text-slate-900 truncate">{cert.courseTitle}</h3>
                      <p className="text-[10px] md:text-xs text-slate-500">
                        Emitido em {cert.issueDate?.toDate ? cert.issueDate.toDate().toLocaleDateString() : 'Recentemente'}
                      </p>
                    </div>
                    <Download className="w-4 h-4 md:w-5 md:h-5 text-slate-300 group-hover:text-brand-500 shrink-0" />
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
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[24px] md:rounded-[32px] shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-slate-900">Escolha seu Avatar</h2>
                  <p className="text-xs md:text-sm text-slate-500">Selecione uma imagem para o seu perfil</p>
                </div>
                <button 
                  onClick={() => setShowAvatarModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 md:w-6 md:h-6 text-slate-400" />
                </button>
              </div>

              <div className="relative group/modal">
                <button
                  onClick={() => scroll('left')}
                  className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-10 p-2 md:p-3 bg-white/90 backdrop-blur-sm border border-slate-100 rounded-full shadow-lg text-slate-600 hover:text-brand-500 hover:scale-110 transition-all md:opacity-0 group-hover/modal:opacity-100"
                >
                  <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
                </button>

                <div 
                  ref={scrollRef}
                  className="p-6 md:p-10 overflow-x-auto flex gap-4 md:gap-8 snap-x snap-mandatory no-scrollbar scroll-smooth"
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
                          isSelected ? 'border-brand-500 ring-4 ring-brand-50' : 'border-slate-100 hover:border-brand-200 bg-slate-50'
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
                  className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-10 p-2 md:p-3 bg-white/90 backdrop-blur-sm border border-slate-100 rounded-full shadow-lg text-slate-600 hover:text-brand-500 hover:scale-110 transition-all md:opacity-0 group-hover/modal:opacity-100"
                >
                  <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              </div>

              <div className="p-4 md:p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setShowAvatarModal(false)}
                  className="px-5 md:px-6 py-2 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors text-sm"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
