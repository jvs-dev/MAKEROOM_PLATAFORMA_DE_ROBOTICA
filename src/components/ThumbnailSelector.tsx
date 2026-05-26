import { useState, useRef, useEffect } from 'react';
import { Upload, Image as ImageIcon, Sparkles, Video, Link2, Check, RefreshCw } from 'lucide-react';

interface ThumbnailSelectorProps {
  value: string;
  onChange: (val: string) => void;
  titleSuggestion?: string;
}

const PALETTES = [
  { id: 'neon-cyberpunk', name: 'Cyberpunk Neon', colors: ['#0f172a', '#3b82f6', '#ec4899'], text: '#ffffff' },
  { id: 'deep-space', name: 'Slate Espacial', colors: ['#030712', '#4f46e5', '#06b6d4'], text: '#ffffff' },
  { id: 'sunset-glow', name: 'Degradê Sunset', colors: ['#1e1b4b', '#f43f5e', '#eab308'], text: '#ffffff' },
  { id: 'electric-violet', name: 'Aurora Ultravioleta', colors: ['#180026', '#8b5cf6', '#d946ef'], text: '#ffffff' },
  { id: 'forest-emerald', name: 'Ecológico Maker', colors: ['#022c22', '#10b981', '#14b8a6'], text: '#ffffff' },
];

export function ThumbnailSelector({ value, onChange, titleSuggestion = 'Novo Aprendizado' }: ThumbnailSelectorProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'generator' | 'video' | 'url'>('upload');
  
  // Custom generator states
  const [cardTitle, setCardTitle] = useState(titleSuggestion);
  const [selectedPalette, setSelectedPalette] = useState(PALETTES[0]);
  const [cardSubtitle, setCardSubtitle] = useState('MAKEROOM • TRILHA PRÁTICA');
  const [showGridLines, setShowGridLines] = useState(true);

  // Video Frame Capture states
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentFrameTime, setCurrentFrameTime] = useState(0);

  const videoElementRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (titleSuggestion && cardTitle === 'Novo Aprendizado') {
      setCardTitle(titleSuggestion);
    }
  }, [titleSuggestion]);

  // Generate automatically whenever generator settings change
  useEffect(() => {
    if (activeTab === 'generator') {
      generateBrandedCard();
    }
  }, [cardTitle, cardSubtitle, selectedPalette, showGridLines, activeTab]);

  // Canvas Generator
  const generateBrandedCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw background Gradient
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, selectedPalette.colors[0]);
    grad.addColorStop(0.5, selectedPalette.colors[1]);
    grad.addColorStop(1, selectedPalette.colors[2] || selectedPalette.colors[0]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Decorative Circuit Grid
    if (showGridLines) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1.5;
      
      // Horizontal & Vertical Lines
      const size = 40;
      for (let x = 0; x < canvas.width; x += size) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += size) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Render custom tech cross dots
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      for (let x = size; x < canvas.width; x += size * 2) {
        for (let y = size; y < canvas.height; y += size * 2) {
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Modern glowing design element
    ctx.strokeStyle = selectedPalette.colors[1] + '44';
    ctx.lineWidth = 15;
    ctx.beginPath();
    ctx.arc(canvas.width * 0.85, canvas.height * 0.2, 120, 0, Math.PI * 2);
    ctx.stroke();

    // Subtle code or brackets drawing
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.font = '90px monospace';
    ctx.fillText('{}', canvas.width * 0.78, canvas.height * 0.78);

    // Dark panel styling container for content
    const panelPadding = 40;
    const panelWidth = canvas.width - panelPadding * 2;
    const panelHeight = canvas.height - panelPadding * 2;
    
    // Draw neon border around panel
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.strokeRect(panelPadding, panelPadding, panelWidth, panelHeight);

    // Corner decorative brackets
    const bLen = 20;
    ctx.strokeStyle = selectedPalette.colors[2] || '#ffffff';
    ctx.lineWidth = 4;
    // Top-left
    ctx.beginPath(); ctx.moveTo(panelPadding, panelPadding + bLen); ctx.lineTo(panelPadding, panelPadding); ctx.lineTo(panelPadding + bLen, panelPadding); ctx.stroke();
    // Top-right
    ctx.beginPath(); ctx.moveTo(canvas.width - panelPadding, panelPadding + bLen); ctx.lineTo(canvas.width - panelPadding, panelPadding); ctx.lineTo(canvas.width - panelPadding - bLen, panelPadding); ctx.stroke();
    // Bottom-left
    ctx.beginPath(); ctx.moveTo(panelPadding, canvas.height - panelPadding - bLen); ctx.lineTo(panelPadding, canvas.height - panelPadding); ctx.lineTo(panelPadding + bLen, canvas.height - panelPadding); ctx.stroke();
    // Bottom-right
    ctx.beginPath(); ctx.moveTo(canvas.width - panelPadding, canvas.height - panelPadding - bLen); ctx.lineTo(canvas.width - panelPadding, canvas.height - panelPadding); ctx.lineTo(canvas.width - panelPadding - bLen, canvas.height - panelPadding); ctx.stroke();

    // Text details
    ctx.fillStyle = selectedPalette.text;
    ctx.textAlign = 'left';

    // Subtitle
    ctx.font = 'bold 16px "JetBrains Mono", Courier, monospace';
    ctx.fillStyle = selectedPalette.colors[2] || '#cbd5e1';
    ctx.fillText(cardSubtitle.toUpperCase(), panelPadding + 30, panelPadding + 60);

    // Title wrapping
    ctx.font = '900 44px "Outfit", "Inter", sans-serif';
    ctx.fillStyle = '#ffffff';
    
    // Simple text wrapping helper
    const words = cardTitle.split(' ');
    let line = '';
    const maxWidth = panelWidth - 80;
    let y = panelPadding + 130;
    const lineHeight = 54;

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && i > 0) {
        ctx.fillText(line, panelPadding + 30, y);
        line = words[i] + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, panelPadding + 30, y);

    // Bottom branding watermark
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = 'bold 14px "Inter", sans-serif';
    ctx.fillText('MAKEROOM LEARNING ENGINE', panelPadding + 30, canvas.height - panelPadding - 40);

    // Save as output
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    onChange(dataUrl);
  };

  // Upload Local Image
  const handleLocalImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Enforce 16:9 box scaling inside standard size canvas and compress
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 450;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Object cover logic
          const targetRatio = canvas.width / canvas.height;
          const imgRatio = img.width / img.height;
          let drawWidth = img.width;
          let drawHeight = img.height;
          let offsetX = 0;
          let offsetY = 0;

          if (imgRatio > targetRatio) {
            drawWidth = img.height * targetRatio;
            offsetX = (img.width - drawWidth) / 2;
          } else {
            drawHeight = img.width / targetRatio;
            offsetY = (img.height - drawHeight) / 2;
          }
          
          ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight, 0, 0, canvas.width, canvas.height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          onChange(compressed);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Handle video selection for Frame Capture
  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVideoLoading(true);
    setVideoFile(file);
    const src = URL.createObjectURL(file);
    setVideoSrc(src);
  };

  const handleVideoLoadedData = () => {
    if (videoElementRef.current) {
      setVideoDuration(videoElementRef.current.duration);
      setVideoLoading(false);
      captureVideoFrame();
    }
  };

  const captureVideoFrame = () => {
    const video = videoElementRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 450;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      try {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Scale to canvas
        const videoRatio = video.videoWidth / video.videoHeight;
        const targetRatio = canvas.width / canvas.height;
        let drawWidth = canvas.width;
        let drawHeight = canvas.height;
        let offsetX = 0;
        let offsetY = 0;

        if (videoRatio > targetRatio) {
          drawHeight = canvas.width / videoRatio;
          offsetY = (canvas.height - drawHeight) / 2;
        } else {
          drawWidth = canvas.height * videoRatio;
          offsetX = (canvas.width - drawWidth) / 2;
        }

        ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, offsetX, offsetY, drawWidth, drawHeight);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        onChange(dataUrl);
      } catch (e) {
        console.error("Failed to capture video frame:", e);
      }
    }
  };

  const handleSeekRange = (time: number) => {
    setCurrentFrameTime(time);
    if (videoElementRef.current) {
      videoElementRef.current.currentTime = time;
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden p-4 space-y-4">
      {/* Tab Selectors */}
      <div className="flex border-b border-slate-100 dark:border-white/5 pb-2 overflow-x-auto gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
            activeTab === 'upload'
              ? 'bg-brand-500 text-white shadow-sm'
              : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 dark:text-slate-400'
          }`}
        >
          <Upload className="w-3.5 h-3.5" /> Enviar Imagem
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('generator')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
            activeTab === 'generator'
              ? 'bg-brand-500 text-white shadow-sm'
              : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 dark:text-slate-400'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" /> Auto-Gerador
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('video')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
            activeTab === 'video'
              ? 'bg-brand-500 text-white shadow-sm'
              : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 dark:text-slate-400'
          }`}
        >
          <Video className="w-3.5 h-3.5" /> Print de Vídeo
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('url')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
            activeTab === 'url'
              ? 'bg-brand-500 text-white shadow-sm'
              : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 dark:text-slate-400'
          }`}
        >
          <Link2 className="w-3.5 h-3.5" /> URL Externa
        </button>
      </div>

      {/* Preview Screen */}
      <div className="relative aspect-video bg-black flex items-center justify-center rounded-xl overflow-hidden shadow-inner border border-slate-100 dark:border-white/5 group">
        {value ? (
          <img src={value} alt="Cover Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="text-slate-400 flex flex-col items-center justify-center p-6 text-center">
            <ImageIcon className="w-10 h-10 mb-2 opacity-50" />
            <p className="text-xs font-semibold">Sem capa selecionada</p>
          </div>
        )}
        <div className="absolute top-2 right-2 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] text-white font-bold uppercase tracking-widest border border-white/5 flex items-center gap-1">
          <Check className="w-3 h-3 text-emerald-400" /> Ativo
        </div>
      </div>

      {/* Dynamic Tab Panes */}
      <div className="pt-2">
        {activeTab === 'upload' && (
          <div className="space-y-3">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 dark:border-white/10 hover:border-brand-500 dark:hover:border-brand-500 rounded-xl p-6 text-center cursor-pointer hover:bg-slate-50/50 dark:hover:bg-white/5 transition-all text-slate-500"
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Escolha uma imagem de seu computador</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Formatos JPEG, PNG. Corte automático 16:9.</p>
              <input 
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLocalImageUpload}
                className="hidden"
              />
            </div>
          </div>
        )}

        {activeTab === 'generator' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Título da Capa</label>
                  <input
                    type="text"
                    value={cardTitle}
                    onChange={(e) => setCardTitle(e.target.value)}
                    className="w-full mt-1 p-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 dark:text-white rounded-lg text-xs outline-none focus:border-brand-500"
                    placeholder="Ex: Primeiros Passos com Git"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Subtítulo</label>
                  <input
                    type="text"
                    value={cardSubtitle}
                    onChange={(e) => setCardSubtitle(e.target.value)}
                    className="w-full mt-1 p-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 dark:text-white rounded-lg text-xs outline-none focus:border-brand-500"
                    placeholder="Ex: Aula de Programação"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Estilo Visual</label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {PALETTES.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPalette(p)}
                        className={`text-[10px] font-bold px-2 py-1.5 rounded-lg border transition-all flex items-center gap-1 ${
                          selectedPalette.id === p.id 
                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 border-transparent shadow' 
                            : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: `linear-gradient(135deg, ${p.colors[0]}, ${p.colors[1]})` }} />
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    id="showGrid"
                    type="checkbox"
                    checked={showGridLines}
                    onChange={(e) => setShowGridLines(e.target.checked)}
                    className="rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                  />
                  <label htmlFor="showGrid" className="text-xs text-slate-600 dark:text-slate-400 font-bold select-none">Mostrar Malha Tecnológica</label>
                </div>
              </div>
            </div>

            {/* Hidden generation helper canvas */}
            <canvas ref={canvasRef} width={800} height={450} className="hidden" />
          </div>
        )}

        {activeTab === 'video' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                className="bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 dark:text-white font-bold py-2 px-3.5 rounded-xl text-xs flex items-center gap-1"
              >
                <Video className="w-4 h-4 text-brand-500" /> Selecionar Vídeo MP4
              </button>
              <input 
                ref={videoInputRef}
                type="file"
                accept="video/mp4"
                onChange={handleVideoSelect}
                className="hidden"
              />
              {videoFile && (
                <span className="text-xs text-slate-400 dark:text-slate-500 max-w-[200px] truncate">{videoFile.name}</span>
              )}
            </div>

            {/* Hidden rendering video stream */}
            <div className="hidden">
              {videoSrc && (
                <video
                  ref={videoElementRef}
                  src={videoSrc}
                  onLoadedData={handleVideoLoadedData}
                  onSeeked={captureVideoFrame}
                  preload="auto"
                  muted
                />
              )}
            </div>

            {videoSrc && (
              <div className="space-y-2 bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-200 dark:border-white/5">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-black uppercase">
                  <span>Definir frame do vídeo como capa</span>
                  <span>{currentFrameTime.toFixed(1)}s / {videoDuration.toFixed(1)}s</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={videoDuration || 100}
                  step={0.1}
                  value={currentFrameTime}
                  onChange={(e) => handleSeekRange(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-brand-500"
                />
                <button
                  type="button"
                  onClick={captureVideoFrame}
                  className="bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs py-1.5 px-3 rounded-lg flex items-center gap-1 transition-all mx-auto active:scale-95 shadow-sm mt-1"
                >
                  <RefreshCw className="w-3 h-3" /> Capturar Frame
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'url' && (
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">URL do Link da Imagem</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={value.startsWith('data:') ? '' : value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="https://exemplo.com/minhamagem.jpg"
                className="flex-1 p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 dark:text-white rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
