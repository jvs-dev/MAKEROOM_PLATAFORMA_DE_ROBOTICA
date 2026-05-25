import express from "express";
import path from "path";
import fs from "fs";
import { MercadoPagoConfig, Payment } from 'mercadopago';
import dotenv from 'dotenv';
import cors from 'cors';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';

// Import Firebase config directly
import firebaseConfig from './firebase-applet-config.json' with { type: "json" };

dotenv.config();

// Initialize Firebase SDK for backend use
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

// Use environment variable and throw error if missing
const ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN;
if (!ACCESS_TOKEN) {
  throw new Error("MERCADO_PAGO_ACCESS_TOKEN is not set in environment variables");
}

const client = new MercadoPagoConfig({ 
  accessToken: ACCESS_TOKEN
});
const payment = new Payment(client);

const app = express();
const isProd = process.env.NODE_ENV === "production";

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow all origins in dev, or specific ones in prod
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'Origin']
}));

app.use(express.json());

// Health check route
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), mode: isProd ? 'production' : 'development' });
});

// API routes
app.post("/api/payment/process", async (req, res) => {
  try {
    console.log('[API] Processing payment');
    const result = await payment.create({ body: req.body });
    res.json(result);
  } catch (error: any) {
    console.error('[API] Payment Error:', error?.message || String(error));
    res.status(400).json({ 
      error: error?.message || 'Erro ao processar pagamento',
      status: error?.status || 400,
      cause: error?.cause ? String(error.cause) : undefined
    });
  }
});

app.post("/api/createpay", async (req, res) => {
  try {
    const { value, items, payerEmail } = req.body;
    const paymentData = {
      body: {
        transaction_amount: value,
        description: items,
        payment_method_id: 'pix',
        payer: {
          email: payerEmail,
        },
      },
    };
    const result = await payment.create(paymentData);
    res.json(result);
  } catch (error: any) {
    console.error('[API] Pix Error:', error?.message || String(error));
    res.status(400).json({ 
      error: error?.message || 'Erro ao gerar Pix',
      status: error?.status || 400,
      cause: error?.cause ? String(error.cause) : undefined
    });
  }
});

app.post("/api/getPay", async (req, res) => {
  try {
    const { payId } = req.body;
    if (!payId) return res.status(400).json({ error: 'ID do pagamento não fornecido' });
    const result = await payment.get({ id: payId });
    res.json({ result });
  } catch (error: any) {
    console.error('[API] Get Payment Error:', error?.message || String(error));
    res.status(400).json({ 
      error: error?.message || 'Erro ao buscar status do pagamento',
      status: error?.status || 400,
      cause: error?.cause ? String(error.cause) : undefined
    });
  }
});

app.post("/api/webhooks/mercadopago", async (req, res) => {
  try {
    const { type, data, action } = req.body;
    const resourceType = type || (action ? action.split('.')[0] : null);
    const resourceId = data?.id || req.query.id;

    if (resourceType === 'payment' && resourceId) {
      const paymentInfo = await payment.get({ id: resourceId });
      const status = paymentInfo.status;
      
      let internalStatus = 'Aguardando Pagamento';
      if (status === 'approved') internalStatus = 'Pago';
      else if (status === 'in_process' || status === 'pending') internalStatus = 'Em Análise';
      else if (status === 'rejected') internalStatus = 'Recusado';
      else if (status === 'cancelled') internalStatus = 'Cancelado';
      else if (status === 'refunded') internalStatus = 'Reembolsado';

      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, where('paymentId', '==', String(resourceId)));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const orderDoc = querySnapshot.docs[0];
        const currentData = orderDoc.data();
        
        if (currentData.status !== internalStatus) {
          const updateData: any = {
            status: internalStatus,
            updatedAt: serverTimestamp()
          };
          
          if (status === 'approved') {
            updateData.paidAt = serverTimestamp();
            if (currentData.productIds && Array.isArray(currentData.productIds)) {
              for (const pid of currentData.productIds) {
                try {
                  const productRef = doc(db, 'products', pid);
                  const productSnap = await getDoc(productRef);
                  if (productSnap.exists()) {
                    const productData = productSnap.data();
                    const currentStock = productData.stock || 0;
                    if (currentStock > 0) {
                      await updateDoc(productRef, { stock: currentStock - 1 });
                    }
                  }
                } catch (stockErr) {
                  console.error(`Error updating stock for product ${pid}:`, stockErr);
                }
              }
            }
          }
          await updateDoc(doc(db, 'orders', orderDoc.id), updateData);
        }
      }
    }
    res.sendStatus(200);
  } catch (error) {
    console.error('[API] Webhook Error:', error);
    res.sendStatus(500);
  }
});

app.post("/api/admin/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    
    // We import GoogleGenAI here to keep it localized, or at top
    const { GoogleGenAI, Type } = await import("@google/genai");
    
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
    }
    
    const ai = new GoogleGenAI({
      apiKey: API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });

    const createStoreItem = {
      name: "createStoreItem",
      description: "Creates a new item in the store (products collection). Only use when the user provides enough information like name, price, stock, and category. Ask for missing details if necessary.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Name of the product" },
          description: { type: Type.STRING, description: "Description of the product" },
          price: { type: Type.NUMBER, description: "Price in points" },
          stock: { type: Type.NUMBER, description: "Amount of items available in stock" },
          category: { type: Type.STRING, description: "Category string (e.g. kits, materials)" }
        },
        required: ["name", "price", "stock", "category"]
      }
    };

    const createLesson = {
      name: "createLesson",
      description: "Creates a new lesson. Requires title, description, content, category, and points.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          content: { type: Type.STRING },
          category: { type: Type.STRING },
          points: { type: Type.NUMBER }
        },
        required: ["title", "description", "content", "category", "points"]
      }
    };

    const createChallenge = {
      name: "createChallenge",
      description: "Creates a new challenge (quiz or activity). Se o usuário pedir um quiz e não enviar perguntas, você mesmo deve gerar uma lista rica de perguntas e respostas.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          type: { type: Type.STRING, description: "Must be 'quiz' or 'activity'" },
          points: { type: Type.NUMBER },
          questions: {
            type: Type.ARRAY,
            description: "Array of questions for the quiz. Generate them if not provided.",
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING, description: "The question text" },
                options: { 
                  type: Type.OBJECT, 
                  properties: {
                    A: { type: Type.STRING },
                    B: { type: Type.STRING },
                    C: { type: Type.STRING },
                    D: { type: Type.STRING }
                  },
                  required: ["A", "B", "C", "D"]
                },
                correctAnswers: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Array of correct option letters, e.g. ['A']"
                }
              },
              required: ["text", "options", "correctAnswers"]
            }
          }
        },
        required: ["title", "description", "type", "points"]
      }
    };

    const createCourse = {
      name: "createCourse",
      description: "Creates a new course.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          pointsReward: { type: Type.NUMBER }
        },
        required: ["title", "description", "pointsReward"]
      }
    };

    const createAnnouncement = {
      name: "createAnnouncement",
      description: "Creates a new announcement banner for the home page.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          imageUrl: { type: Type.STRING, description: "URL of the image" },
          redirectUrl: { type: Type.STRING, description: "URL to redirect on click" },
          isActive: { type: Type.BOOLEAN }
        },
        required: ["imageUrl", "redirectUrl", "isActive"]
      }
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: messages,
      config: {
        systemInstruction: "Você é o Assistente Makeroom, um assistente AI prestativo e amigável para administradores. Você ajuda a criar configurações do site (como itens da loja, aulas, desafios, cursos, anúncios). Seja humano, simpático e conciso. Caso o usuário peça para criar algo e faltem parâmetros obrigatórios, pergunte de forma natural. IMPORTANTE: Se o usuário pedir para criar um quiz e não fornecer as perguntas, VOCÊ MESMO DEVE GERAR uma lista rica de perguntas e respostas com base no tema solicitado. Se tudo estiver correto, use a function call, confirmando que irá criar. Você está em fase Beta, então seja humilde quanto a erros.",
        tools: [{ functionDeclarations: [createStoreItem, createLesson, createChallenge, createCourse, createAnnouncement] }]
      }
    });

    const calls = response.functionCalls || [];
    const text = response.text || "";

    res.json({ text, functionCalls: calls });
  } catch (error: any) {
    console.error('[API] Gemini Error:', error);
    res.status(500).json({ error: error?.message || 'Error communicating with AI' });
  }
});

// SEO Middleware for dynamic meta tags
app.get(['/store', '/store/product/:id'], async (req, res, next) => {
  const productId = req.params.id || req.query.product;
  
  if (productId) {
    try {
      const productDoc = await getDoc(doc(db, 'products', String(productId)));
      if (productDoc.exists()) {
        const product = productDoc.data();
        const indexHtmlPath = path.join(process.cwd(), isProd ? 'dist' : '', 'index.html');
        
        if (fs.existsSync(indexHtmlPath)) {
          let html = fs.readFileSync(indexHtmlPath, 'utf8');
          
          // In development, we must transform the HTML through Vite
          if (!isProd && (global as any).__viteServer) {
            html = await (global as any).__viteServer.transformIndexHtml(req.originalUrl, html);
          }
          
          // Replace meta tags
          const title = `${product.name} | Maker Store`;
          const description = product.description.substring(0, 160);
          const image = product.imageUrl;
          const url = `https://${req.get('host')}${req.originalUrl}`;

          html = html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
          
          // Helper to replace or inject meta tags
          const setMeta = (property: string, content: string) => {
            const regex = new RegExp(`<meta property="${property}" content=".*?" \\/>`);
            if (html.match(regex)) {
              html = html.replace(regex, `<meta property="${property}" content="${content}" />`);
            } else {
              html = html.replace('</head>', `  <meta property="${property}" content="${content}" />\n</head>`);
            }
          };

          setMeta('og:title', title);
          setMeta('og:description', description);
          setMeta('og:image', image);
          setMeta('og:url', url);
          
          if (!html.includes('twitter:card')) {
            html = html.replace('</head>', '  <meta name="twitter:card" content="summary_large_image" />\n</head>');
          }

          return res.send(html);
        }
      }
    } catch (error) {
      console.error('[SEO] Middleware Error:', error);
    }
  }
  next();
});

// Export the app for Vercel Serverless Functions
export default app;

// Start the server if running directly (e.g., node server.ts or tsx server.ts)
// In Vercel, this file is imported as a module, so this block won't run.
if (process.env.NODE_ENV !== 'production' || process.env.START_SERVER === 'true') {
  async function startServer() {
    const PORT = 3000;
    
    if (!isProd) {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      (global as any).__viteServer = vite;
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
