import React, { useEffect, useState, useRef } from "react";
import { X, Printer, CheckCircle, Download, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

interface PrintableCertificateProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  courseTitle: string;
  issueDate: any;
  grade: number;
  certificateId: string;
}

// Math helpers to convert OKLab / OKLCH to standard RGB/RGBA
// This bypasses html2canvas crashing on unsupported OKLab and OKLCH color spaces from Tailwind CSS v4 themes.
function oklabToRgb(l: number, a: number, b_coord: number, alpha: number = 1): string {
  // OKLab to LMS
  const l_lms = l + 0.3963377774 * a + 0.2158037573 * b_coord;
  const m_lms = l - 0.1055613458 * a - 0.0638541728 * b_coord;
  const s_lms = l - 0.0894841775 * a - 1.2914855480 * b_coord;
  
  // Convert to non-linear luminance space
  const l_cube = Math.pow(Math.max(0, l_lms), 3);
  const m_cube = Math.pow(Math.max(0, m_lms), 3);
  const s_cube = Math.pow(Math.max(0, s_lms), 3);
  
  // LMS to Linear RGB
  const r_lin = +4.0767416621 * l_cube - 3.3077115913 * m_cube + 0.2309699292 * s_cube;
  const g_lin = -1.2684380046 * l_cube + 2.6097574011 * m_cube - 0.3413193965 * s_cube;
  const b_lin = -0.0041960863 * l_cube - 0.7034186147 * m_cube + 1.7076147010 * s_cube;
  
  // Linear RGB to sRGB with gamma correction
  const transfer = (c_lin: number) => {
    const clamped = Math.max(0, Math.min(1, c_lin));
    return clamped <= 0.0031308
      ? 12.92 * clamped
      : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  };
  
  const r = Math.round(transfer(r_lin) * 255);
  const g = Math.round(transfer(g_lin) * 255);
  const b = Math.round(transfer(b_lin) * 255);
  
  if (alpha === 1) {
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}

function oklchToRgb(l: number, c: number, h: number, alpha: number = 1): string {
  // Convert Hue to radians
  const hRad = (h * Math.PI) / 180;
  
  // OKLab coordinates
  const a = c * Math.cos(hRad);
  const b_coord = c * Math.sin(hRad);
  
  return oklabToRgb(l, a, b_coord, alpha);
}

function convertOklchString(colorStr: string): string {
  if (!colorStr || typeof colorStr !== "string") return colorStr;
  
  const normalized = colorStr.trim().toLowerCase();
  if (!normalized.includes("oklch")) return colorStr;
  
  // Match oklch(L C H) or oklch(L C H / A) with optional % or units
  const regex = /oklch\(\s*([0-9.-]+%?)\s+([0-9.-]+%?)\s+([0-9.-]+(?:deg|rad|grad|turn)?)(?:\s*\/\s*([0-9.-]+%?))?\s*\)/;
  const match = normalized.match(regex);
  if (!match) return colorStr;
  
  const lStr = match[1];
  const cStr = match[2];
  const hStr = match[3];
  const aStr = match[4];
  
  const l = lStr.endsWith("%") ? parseFloat(lStr) / 100 : parseFloat(lStr);
  const c = cStr.endsWith("%") ? parseFloat(cStr) / 100 : parseFloat(cStr);
  
  let h = 0;
  if (hStr.endsWith("deg")) {
    h = parseFloat(hStr);
  } else if (hStr.endsWith("rad")) {
    h = (parseFloat(hStr) * 180) / Math.PI;
  } else if (hStr.endsWith("grad")) {
    h = (parseFloat(hStr) * 180) / 200;
  } else if (hStr.endsWith("turn")) {
    h = parseFloat(hStr) * 360;
  } else {
    h = parseFloat(hStr);
  }
  
  let alpha = 1;
  if (aStr) {
    alpha = aStr.endsWith("%") ? parseFloat(aStr) / 100 : parseFloat(aStr);
  }
  
  return oklchToRgb(l, c, h, alpha);
}

function convertOklabString(colorStr: string): string {
  if (!colorStr || typeof colorStr !== "string") return colorStr;
  
  const normalized = colorStr.trim().toLowerCase();
  if (!normalized.includes("oklab")) return colorStr;
  
  // Match oklab(L A B) or oklab(L A B / ALPHA)
  const regex = /oklab\(\s*([0-9.-]+%?)\s+([0-9.-]+%?)\s+([0-9.-]+%?)(?:\s*\/\s*([0-9.-]+%?))?\s*\)/;
  const match = normalized.match(regex);
  if (!match) return colorStr;
  
  const lStr = match[1];
  const aStr = match[2];
  const bStr = match[3];
  const alphaStr = match[4];
  
  const l = lStr.endsWith("%") ? parseFloat(lStr) / 100 : parseFloat(lStr);
  const a = aStr.endsWith("%") ? parseFloat(aStr) / 100 : parseFloat(aStr);
  const b = bStr.endsWith("%") ? parseFloat(bStr) / 100 : parseFloat(bStr);
  
  let alpha = 1;
  if (alphaStr) {
    alpha = alphaStr.endsWith("%") ? parseFloat(alphaStr) / 100 : parseFloat(alphaStr);
  }
  
  return oklabToRgb(l, a, b, alpha);
}

function replaceOklchAndOklabColorFunctions(str: string): string {
  if (typeof str !== 'string') return str;
  let result = str;

  // Let's replace each individual oklch(...) inside the string with its standard rgb value
  const oklchRegex = /oklch\(\s*([0-9.-]+%?)\s+([0-9.-]+%?)\s+([0-9.-]+(?:deg|rad|grad|turn)?)(?:\s*\/\s*([0-9.-]+%?))?\s*\)/gi;
  result = result.replace(oklchRegex, (match) => {
    try {
      return convertOklchString(match);
    } catch (e) {
      console.warn("Failed to convert oklch color:", match, e);
      return 'rgb(0,0,0)';
    }
  });

  const oklabRegex = /oklab\(\s*([0-9.-]+%?)\s+([0-9.-]+%?)\s+([0-9.-]+%?)(?:\s*\/\s*([0-9.-]+%?))?\s*\)/gi;
  result = result.replace(oklabRegex, (match) => {
    try {
      return convertOklabString(match);
    } catch (e) {
      console.warn("Failed to convert oklab color:", match, e);
      return 'rgb(0,0,0)';
    }
  });

  return result;
}

export const PrintableCertificate: React.FC<PrintableCertificateProps> = ({
  isOpen,
  onClose,
  userName,
  courseTitle,
  issueDate,
  grade,
  certificateId,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const parent = containerRef.current;
    if (!parent) return;

    const resizeHandler = () => {
      const pw = parent.clientWidth;
      const ph = parent.clientHeight;
      const scaleX = (pw - 24) / 1020;
      const scaleY = (ph - 24) / 720;
      const computedScale = Math.min(scaleX, scaleY, 1);
      setScale(Math.max(0.12, computedScale));
    };

    const timeoutId = setTimeout(resizeHandler, 50);
    const observer = new ResizeObserver(resizeHandler);
    observer.observe(parent);

    window.addEventListener("resize", resizeHandler);

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
      window.removeEventListener("resize", resizeHandler);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Format date
  let formattedDate = "";
  if (issueDate) {
    if (issueDate.toDate) {
      formattedDate = issueDate.toDate().toLocaleDateString();
    } else if (issueDate instanceof Date) {
      formattedDate = issueDate.toLocaleDateString();
    } else if (typeof issueDate === "string") {
      formattedDate = new Date(issueDate).toLocaleDateString();
    } else if (issueDate.seconds) {
      formattedDate = new Date(issueDate.seconds * 1000).toLocaleDateString();
    } else {
      formattedDate = new Date().toLocaleDateString();
    }
  } else {
    formattedDate = new Date().toLocaleDateString();
  }

  const handlePrint = () => {
    try {
      window.focus();
      window.print();
    } catch (e) {
      console.error(e);
    }
    
    if (typeof window !== "undefined" && window.self !== window.top) {
      alert("Dica de Impressão: Como você está visualizando no painel de prévia, use o botão 'Baixar PDF' ou clique no botão 'Abrir em nova guia' no topo direito do site para imprimir diretamente.");
    }
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById("printable-certificate-area");
    if (!element) return;

    setIsGenerating(true);

    // Mock document.styleSheets to bypass html2canvas trying to parse CSS v4 oklch() functions which crashes color.js
    let restoreStyleSheets: (() => void) | null = null;
    try {
      const originalStyleSheetsDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, "styleSheets");
      Object.defineProperty(document, "styleSheets", {
        get: () => [],
        configurable: true,
      });
      restoreStyleSheets = () => {
        if (originalStyleSheetsDescriptor) {
          Object.defineProperty(document, "styleSheets", originalStyleSheetsDescriptor);
        } else {
          delete (document as any).styleSheets;
        }
      };
    } catch (e) {
      console.warn("Failed to temporarily patch document.styleSheets:", e);
    }

    // Intercept and sanitize window.getComputedStyle to translate Modern CSS oklch()/oklab() values to RGB.
    // This stops html2canvas from failing when it retrieves computed colors from Tailwind classes.
    let restoreMainGetComputedStyle: (() => void) | null = null;
    let restoreClonedGetComputedStyle: (() => void) | null = null;

    try {
      const patchGetComputedStyle = (win: Window) => {
        const originalGetComputedStyle = win.getComputedStyle;
        win.getComputedStyle = function (elt, pseudoElt) {
          const style = originalGetComputedStyle.call(win, elt, pseudoElt);
          return new Proxy(style, {
            get(target, prop) {
              const val = Reflect.get(target, prop, target);
              if (typeof val === "string" && (val.includes("oklch") || val.includes("oklab"))) {
                return replaceOklchAndOklabColorFunctions(val);
              }
              if (typeof val === "function") {
                return val.bind(target);
              }
              return val;
            },
          });
        };
        return () => {
          win.getComputedStyle = originalGetComputedStyle;
        };
      };

      restoreMainGetComputedStyle = patchGetComputedStyle(window);

      // 1. Save original styles
      const originalTransform = element.style.transform;
      const originalTransition = element.style.transition;
      
      // Temporarily clear styling constraints, zoom, and transitions for crisp full-scale rendering
      element.style.transition = "none";
      element.style.transform = "none";

      // 2. Capture rendering as canvas with safe style conversions
      const canvas = await html2canvas(element, {
        scale: 2, // 2x scale crisp rendering
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        onclone: (clonedDoc) => {
          // Patch getComputedStyle on inside window context too!
          if (clonedDoc.defaultView) {
            restoreClonedGetComputedStyle = patchGetComputedStyle(clonedDoc.defaultView);
          }

          // Remove all default stylesheets to prevent html2canvas parsing crashes on CSS v4 oklch/oklab functions
          clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach(el => el.remove());

          // Create and append a perfectly sanitized, static layout stylesheet with standard colors
          const cleanStyle = clonedDoc.createElement("style");
          cleanStyle.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&family=Playfair+Display:ital@1&family=Space+Grotesk:wght@400;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap');

            #printable-certificate-area {
              position: relative !important;
              background-color: #ffffff !important;
              color: #0f172a !important;
              box-shadow: none !important;
              border: 1px solid #e2e8f0 !important;
              box-sizing: border-box !important;
            }
            #printable-certificate-area * {
              box-sizing: border-box !important;
            }
            #printable-certificate-area .relative { position: relative !important; }
            #printable-certificate-area .absolute { position: absolute !important; }
            #printable-certificate-area .top-0 { top: 0 !important; }
            #printable-certificate-area .left-0 { left: 0 !important; }
            #printable-certificate-area .right-0 { right: 0 !important; }
            #printable-certificate-area .bottom-0 { bottom: 0 !important; }
            #printable-certificate-area .w-full { width: 100% !important; }
            #printable-certificate-area .h-full { height: 100% !important; }
            #printable-certificate-area .flex { display: flex !important; }
            #printable-certificate-area .flex-col { flex-direction: column !important; }
            #printable-certificate-area .justify-between { justify-content: space-between !important; }
            #printable-certificate-area .justify-center { justify-content: center !important; }
            #printable-certificate-area .items-center { align-items: center !important; }
            #printable-certificate-area .items-end { align-items: flex-end !important; }
            #printable-certificate-area .overflow-hidden { overflow: hidden !important; }
            #printable-certificate-area .bg-white { background-color: #ffffff !important; }
            #printable-certificate-area .select-none { user-select: none !important; }
            #printable-certificate-area .z-10 { z-index: 10 !important; }
            #printable-certificate-area .z-0 { z-index: 0 !important; }
            #printable-certificate-area .z-20 { z-index: 20 !important; }
            #printable-certificate-area .pointer-events-none { pointer-events: none !important; }
            
            #printable-certificate-area .border-t-8 { border-top-width: 8px !important; }
            #printable-certificate-area .border-l-8 { border-left-width: 8px !important; }
            #printable-certificate-area .border-r-8 { border-right-width: 8px !important; }
            #printable-certificate-area .border-b-8 { border-bottom-width: 8px !important; }
            
            #printable-certificate-area .border-brand-500 { border-color: #f97316 !important; }
            #printable-certificate-area .border-brand-500\\/25 { border-color: rgba(249, 115, 22, 0.25) !important; }
            #printable-certificate-area .bg-brand-500 { background-color: #f97316 !important; }
            #printable-certificate-area .bg-brand-500\\/65 { background-color: rgba(249, 115, 22, 0.65) !important; }
            #printable-certificate-area .text-brand-500 { color: #f97316 !important; }
            #printable-certificate-area .text-brand-600 { color: #ea580c !important; }
            
            #printable-certificate-area .w-\\[100px\\] { width: 100px !important; }
            #printable-certificate-area .h-\\[3px\\] { height: 3px !important; }
            #printable-certificate-area .mx-auto { margin-left: auto !important; margin-right: auto !important; }
            #printable-certificate-area .mt-\\[12px\\] { margin-top: 12px !important; }
            #printable-certificate-area .border-t { border-top-width: 1px !important; }
            #printable-certificate-area .border-slate-100 { border-color: #f1f5f9 !important; }
            #printable-certificate-area .p-\\[55px_75px\\] { padding: 55px 75px !important; }
            #printable-certificate-area .text-center { text-align: center !important; }
            
            #printable-certificate-area .mb-\\[25px\\] { margin-bottom: 25px !important; }
            #printable-certificate-area .mb-\\[16px\\] { margin-bottom: 16px !important; }
            #printable-certificate-area .my-\\[20px\\] { margin-top: 20px !important; margin-bottom: 20px !important; }
            #printable-certificate-area .my-\\[12px\\] { margin-top: 12px !important; margin-bottom: 12px !important; }
            #printable-certificate-area .my-\\[15px\\] { margin-top: 15px !important; margin-bottom: 15px !important; }
            #printable-certificate-area .mt-\\[16px\\] { margin-top: 16px !important; }
            #printable-certificate-area .max-w-\\[680px\\] { max-width: 680px !important; }
            #printable-certificate-area .leading-\\[1\\.6\\] { line-height: 1.6 !important; }
            #printable-certificate-area .text-left { text-align: left !important; }
            #printable-certificate-area .gap-\\[6px\\] { gap: 6px !important; }
            
            #printable-certificate-area .mb-\\[4px\\] { margin-bottom: 4px !important; }
            #printable-certificate-area .font-bold { font-weight: 700 !important; }
            #printable-certificate-area .text-slate-400 { color: #94a3b8 !important; }
            #printable-certificate-area .text-slate-900 { color: #0f172a !important; }
            
            #printable-certificate-area .gap-\\[35px\\] { gap: 35px !important; }
            #printable-certificate-area .mb-\\[-4px\\] { margin-bottom: -4px !important; }
            #printable-certificate-area .w-\\[160px\\] { width: 160px !important; }
            #printable-certificate-area .h-\\[45px\\] { height: 45px !important; }
            #printable-certificate-area .mb-\\[5px\\] { margin-bottom: 5px !important; }
            #printable-certificate-area .h-\\[1px\\] { height: 1px !important; }
            
            #printable-certificate-area .mt-\\[1px\\] { margin-top: 1px !important; }
            #printable-certificate-area .tracking-\\[0\\.5px\\] { letter-spacing: 0.5px !important; }
            #printable-certificate-area .w-\\[110px\\] { width: 110px !important; }
            #printable-certificate-area .h-\\[110px\\] { height: 110px !important; }
            #printable-certificate-area .gap-\\[10px\\] { gap: 10px !important; }
            
            #printable-certificate-area svg {
              display: block !important;
            }
          `;
          clonedDoc.head.appendChild(cleanStyle);
        }
      });

      // 3. Instantly restore original scaling layout on-screen
      element.style.transform = originalTransform;
      element.style.transition = originalTransition;

      // 4. Create landscape A4 PDF and insert JPEG
      const imgData = canvas.toDataURL("image/jpeg", 0.98);
      
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      // Size A4 landscape: 297mm x 210mm
      pdf.addImage(imgData, "JPEG", 0, 0, 297, 210, undefined, "FAST");
      
      // Format clean filename (lowercase alphanumeric strings)
      const cleanCourseTitle = courseTitle
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove accents
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-") // replace symbols/spaces with dashes
        .replace(/(^-|-$)+/g, ""); // strip dangling dashes
        
      pdf.save(`certificado-${cleanCourseTitle}-${certificateId.slice(-6).toUpperCase()}.pdf`);
    } catch (error) {
      console.error("Erro ao gerar PDF do certificado:", error);
      alert("Houve um problema ao salvar seu certificado como PDF. Se o problema persistir, use a opção de Imprimir.");
    } finally {
      if (restoreMainGetComputedStyle) {
        try {
          restoreMainGetComputedStyle();
        } catch (e) {
          console.error("Failed to restore main getComputedStyle:", e);
        }
      }
      if (restoreClonedGetComputedStyle) {
        try {
          restoreClonedGetComputedStyle();
        } catch (e) {
          console.error("Failed to restore cloned getComputedStyle:", e);
        }
      }
      if (restoreStyleSheets) {
        try {
          restoreStyleSheets();
        } catch (e) {
          console.error("Failed to restore document.styleSheets:", e);
        }
      }
      setIsGenerating(false);
    }
  };

  return (
    <div id="certificate-modal-wrapper" className="fixed inset-0 z-[200] flex flex-col bg-slate-950/95 overflow-y-auto">
      {/* Dynamic print-specific styles injected during modal lifespan */}
      <style>{`
        @media print {
          /* Hide all page content except the certificate modal wrapper */
          body > *:not(#certificate-modal-wrapper) {
            display: none !important;
          }
          
          #certificate-modal-wrapper {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 297mm !important;
            height: 210mm !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: 9999999 !important;
            overflow: hidden !important;
          }
          
          #printable-certificate-area {
            transform: none !important;
            position: relative !important;
            width: 1020px !important;
            height: 720px !important;
            display: block !important;
            page-break-inside: avoid !important;
            box-shadow: none !important;
            border: none !important;
          }

          @page {
            size: A4 landscape;
            margin: 0;
          }
        }
      `}</style>
      {/* Top Header Controls (Hidden during printing) */}
      <div className="w-full mx-auto max-w-5xl flex flex-col md:flex-row items-center justify-between gap-4 p-4 md:p-8 text-white shrink-0 print:hidden">
        <div className="text-center md:text-left">
          <h3 className="text-lg md:text-xl font-black italic tracking-tight text-brand-400">
            CERTIFICADO OFICIAL LIBERADO
          </h3>
          <p className="text-xs text-slate-400 font-medium">
            Seu certificado é compatível com celulares e computadores. Use o botão de download para baixar como PDF.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 w-full md:w-auto">
          <button
            onClick={handleDownloadPDF}
            disabled={isGenerating}
            className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-700 text-white font-bold px-4 py-2.5 sm:px-5 sm:py-3 rounded-2xl transition-all shadow-lg active:scale-95 cursor-pointer disabled:cursor-not-allowed text-sm sm:text-base"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Gerando PDF...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" /> Baixar PDF
              </>
            )}
          </button>
          
          <button
            onClick={handlePrint}
            disabled={isGenerating}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white font-bold px-4 py-2.5 sm:px-5 sm:py-3 rounded-2xl transition-all shadow-lg active:scale-95 cursor-pointer text-sm sm:text-base"
            title="Imprimir certificado"
          >
            <Printer className="w-5 h-5" /> Imprimir
          </button>
          
          <button
            onClick={onClose}
            className="p-2.5 sm:p-3 bg-white/10 hover:bg-white/20 rounded-2xl text-slate-300 hover:text-white transition-all active:scale-95 cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Responsive Scaling Wrapper for Screen Preview */}
      <div 
        ref={containerRef}
        className="w-full h-full flex-1 overflow-auto flex flex-col min-h-0 print:p-0 print:m-0 print:block"
      >
        <div
          style={{
            width: `${1020 * scale}px`,
            height: `${720 * scale}px`,
            position: "relative",
            margin: "auto",
          }}
          className="shrink-0 transition-all duration-75"
        >
          <div
            id="printable-certificate-area"
            className="bg-white text-slate-900 border border-slate-200 shadow-2xl origin-top-left shrink-0 print:!scale-100 absolute top-0 left-0"
            style={{
              width: "1020px",
              height: "720px",
              transform: `scale(${scale})`,
            }}
          >
          {/* Certificate Content - Styled identically to print window document */}
          <div className="relative w-full h-full p-[55px_75px] flex flex-col justify-between overflow-hidden bg-white select-none">
            {/* Corner Accents */}
            <div className="absolute top-0 left-0 w-[120px] height-[120px] pointer-events-none z-10">
              <div className="absolute top-0 left-0 w-[120px] h-[120px] border-t-8 border-l-8 border-brand-500"></div>
            </div>
            <div className="absolute top-0 right-0 w-[120px] height-[120px] pointer-events-none z-10">
              <div className="absolute top-0 right-0 w-[120px] h-[120px] border-t-8 border-r-8 border-brand-500"></div>
            </div>
            <div className="absolute bottom-0 left-0 w-[120px] height-[120px] pointer-events-none z-10">
              <div className="absolute bottom-0 left-0 w-[120px] h-[120px] border-b-8 border-l-8 border-brand-500"></div>
            </div>
            <div className="absolute bottom-0 right-0 w-[120px] height-[120px] pointer-events-none z-10">
              <div className="absolute bottom-0 right-0 w-[120px] h-[120px] border-b-8 border-r-8 border-brand-500"></div>
            </div>

            {/* Orange Thin Frame Inner Border */}
            <div className="absolute top-[20px] left-[20px] right-[20px] bottom-[20px] border border-brand-500/25 pointer-events-none z-0"></div>

            {/* Technological Vector Background Overlays */}
            <svg
              className="absolute top-0 left-0 w-full h-full pointer-events-none z-0"
              width="1020"
              height="720"
              viewBox="0 0 1020 720"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Central futuristic rings */}
              <circle cx="510" cy="360" r="320" stroke="#f97316" strokeWidth="1" strokeDasharray="3 12" opacity="0.12" />
              <circle cx="510" cy="360" r="240" stroke="#0f172a" strokeWidth="0.75" opacity="0.06" />
              <circle cx="510" cy="360" r="160" stroke="#f97316" strokeWidth="2" strokeDasharray="25 25" opacity="0.08" />

              {/* Circuit board paths */}
              <path d="M 50,450 L 150,450 L 190,490 L 190,530" stroke="#ea580c" strokeWidth="1.5" strokeDasharray="2 4" opacity="0.18" fill="none" />
              <path d="M 970,450 L 870,450 L 830,490 L 830,530" stroke="#ea580c" strokeWidth="1.5" strokeDasharray="2 4" opacity="0.18" fill="none" />
              <circle cx="190" cy="530" r="3" fill="#ea580c" opacity="0.25" />
              <circle cx="830" cy="530" r="3" fill="#ea580c" opacity="0.25" />

              <path d="M 200,50 L 320,50" stroke="#ea580c" strokeWidth="2" opacity="0.4" />
              <path d="M 820,50 L 700,50" stroke="#ea580c" strokeWidth="2" opacity="0.4" />
            </svg>

            {/* Main Template Content */}
            <div className="relative z-10 w-full h-full flex flex-col justify-between">
              {/* Header */}
              <div className="text-center mt-[10px]">
                <div className="flex items-center justify-center gap-[10px] mb-[25px]">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="-mt-[3px]">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M2 17L12 22L22 17" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M2 12L12 17L22 12" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
                  </svg>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "21px", fontWeight: 900, letterSpacing: "5px", color: "#1e293b" }}>MAKEROOM</span>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "21px", fontWeight: 400, letterSpacing: "5px", color: "#f97316" }}>ROBÓTICA</span>
                </div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "13px", fontWeight: 800, color: "#f97316", letterSpacing: "8px", textTransform: "uppercase" }}>
                  Certificado de Conclusão
                </div>
                <div className="w-[100px] h-[3px] bg-brand-500 mx-auto mt-[12px] rounded-full"></div>
              </div>

              {/* Recipient Statement */}
              <div className="text-center my-[20px]">
                <p style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: "20px", color: "#64748b" }} className="mb-[16px]">
                  Certificamos que o estudante
                </p>
                
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "42px", fontWeight: 900, color: "#0f172a", letterSpacing: "-1px", textTransform: "uppercase" }} className="my-[12px]">
                  {userName}
                </div>

                <p style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: "19px", color: "#64748b" }} className="my-[15px]">
                  concluiu com êxito e aproveitamento máximo a trilha de aprendizado de
                </p>

                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "30px", fontWeight: 900, color: "#f97316", letterSpacing: "0.5px", textTransform: "uppercase" }} className="my-[12px]">
                  {courseTitle}
                </div>

                <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "13px", color: "#94a3b8", fontWeight: 500 }} className="max-w-[680px] mx-auto mt-[16px] leading-[1.6]">
                  Comprovando proficiência técnica, participação proeminente nas atividades teórico-práticas, superação de desafios lógicos e excelência no desenvolvimento de projetos autorais utilizando Metodologia Maker e Engenharia de Software.
                </p>
              </div>

              {/* Signatures & Stamps Footer */}
              <div className="flex justify-between items-end pt-[20px] border-t border-slate-100 relative z-20">
                
                {/* Metadados Monospace */}
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#64748b", lineHeight: "1.8" }} className="text-left">
                  <div className="flex items-center gap-[6px] mb-[4px]">
                    <span className="text-brand-500 font-bold">[● EMISSÃO]</span> {formattedDate}
                  </div>
                  <div className="flex items-center gap-[6px] mb-[4px]">
                    <span className="text-brand-600 font-bold">[● DESEMPENHO]</span> {grade.toFixed(1)}% / 100%
                  </div>
                  <div className="flex items-center gap-[6px]">
                    <span className="text-slate-400 font-bold">[● AUTENTICIDADE]</span> <span className="text-slate-900 font-bold">#{certificateId}</span>
                  </div>
                </div>

                {/* Signatures */}
                <div className="flex gap-[35px] items-end mb-[-4px]">
                  {/* Coordenador */}
                  <div className="text-center w-[160px]">
                    <div className="relative h-[45px] flex items-center justify-center mb-[5px]">
                      <svg width="130" height="40" viewBox="0 0 130 40" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10,25 C25,20 40,5 50,15 C58,23 45,38 60,32 C75,25 90,8 105,12 C115,15 100,35 120,30" stroke="#0f172a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div className="w-full h-[1px] bg-brand-500/65 mb-[6px]"></div>
                    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "11.5px", fontWeight: 700, color: "#1e293b" }}>João Vitor Santana</div>
                    <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "9px", color: "#94a3b8", fontWeight: 600 }} className="mt-[1px] text-transform-uppercase tracking-[0.5px]">
                      Engenheiro de Software e CEO INCODED
                    </div>
                  </div>

                  {/* Diretor */}
                  <div className="text-center w-[160px]">
                    <div className="relative h-[45px] flex items-center justify-center mb-[5px]">
                      <svg width="130" height="40" viewBox="0 0 130 40" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15,28 C30,12 45,18 55,22 C65,25 72,10 80,15 C88,20 82,32 95,25 C108,18 120,12 125,22" stroke="#0f172a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div className="w-full h-[1px] bg-brand-500/65 mb-[6px]"></div>
                    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "11.5px", fontWeight: 700, color: "#1e293b" }}>Gil Andrade</div>
                    <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "9px", color: "#94a3b8", fontWeight: 600 }} className="mt-[1px] text-transform-uppercase tracking-[0.5px]">
                      Professor de Robótica e CEO Makeroom
                    </div>
                  </div>
                </div>

                {/* Sêlo de Autenticidade */}
                <div className="relative w-[110px] h-[110px] flex items-center justify-center">
                  <svg width="110" height="110" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" className="absolute">
                    <defs>
                      <linearGradient id="gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#f97316" />
                        <stop offset="30%" stopColor="#fed7aa" />
                        <stop offset="70%" stopColor="#ea580c" />
                        <stop offset="100%" stopColor="#9a3412" />
                      </linearGradient>
                    </defs>
                    <path d="M 60,6 A 54,54 0 0,1 114,60 A 54,54 0 0,1 60,114 A 54,54 0 0,1 6,60 A 54,54 0 0,1 6,60 Z" fill="none" stroke="url(#gold-grad)" strokeWidth="4.5" strokeDasharray="8 4" />
                    <circle cx="60" cy="60" r="47" fill="#fffaf7" stroke="url(#gold-grad)" strokeWidth="1.5" />
                    <circle cx="60" cy="60" r="41" fill="none" stroke="#ea580c" strokeWidth="1" strokeDasharray="2 5" opacity="0.6" />
                    <circle cx="60" cy="60" r="37" fill="none" stroke="url(#gold-grad)" strokeWidth="1" />
                    
                    <g transform="translate(60,60)">
                      <path d="M-5,-5 L-9,-9 M5,-5 L9,-9 M-5,5 L-9,9 M5,5 L9,9" stroke="url(#gold-grad)" strokeWidth="1.5" />
                      <text y="-8" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: "8.5px", fill: "#ea580c" }} textAnchor="middle" letterSpacing="1.5">MAKER</text>
                      <line x1="-20" y1="-2" x2="20" y2="-2" stroke="#fed7aa" strokeWidth="1" />
                      <text y="10" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 900, fontSize: "9px", fill: "#7c2d12" }} textAnchor="middle" letterSpacing="0.5">APROVADO</text>
                      <path d="M-2,-14 L0,-18 L2,-14 L5,-14 L3,-11 L4,-7 L0,-10 L-4,-7 L-3,-11 L-5,-14 Z" fill="url(#gold-grad)" transform="scale(0.55) translate(0, 36)" />
                    </g>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};
