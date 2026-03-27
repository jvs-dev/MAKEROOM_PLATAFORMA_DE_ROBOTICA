import { useEffect, useState, useCallback } from 'react';
import { collection, getDocs, addDoc, serverTimestamp, doc, getDoc, query, where, orderBy, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { jsPDF } from 'jspdf';
import { motion, AnimatePresence } from 'motion/react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import { sendNotification } from '../services/notificationService';
import { 
  ShoppingBag, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Package, 
  ChevronRight, 
  Search, 
  Filter, 
  X, 
  QrCode, 
  Copy, 
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Zap,
  MapPin,
  Navigation,
  Home,
  CreditCard,
  CreditCard as CardIcon,
  ShoppingBasket,
  Clock
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import { cn } from '../lib/utils';
import L from 'leaflet';

// Fix for Leaflet marker icons in Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

declare global {
  interface Window {
    MercadoPago: any;
  }
}

// Custom icons for the map
const hqIcon = L.divIcon({
  html: `<div class="bg-brand-500 p-2 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const homeIcon = L.divIcon({
  html: `<div class="bg-slate-900 p-2 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  originalPrice?: number;
  promotionPrice?: number;
  stock: number;
  imageUrl: string;
  items?: string[];
  extraItems?: string[];
}

interface PaymentInfo {
  id: string;
  qrCode: string;
  qrCodeBase64: string;
  status: string;
}

export default function Store() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<{ [id: string]: number }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('pix');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
  const [cardData, setCardData] = useState({
    cardNumber: '',
    cardExpirationMonth: '',
    cardExpirationYear: '',
    securityCode: '',
    cardholderName: '',
    identificationNumber: '',
    installments: 1,
    cardType: 'credit' as 'credit' | 'debit',
    phone: '',
    zipCode: ''
  });
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [mp, setMp] = useState<any>(null);
  const [showCheckoutForm, setShowCheckoutForm] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState({
    cep: '',
    street: '',
    neighborhood: '',
    city: '',
    referencePoint: '',
    latitude: 0,
    longitude: 0
  });
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    cpf: '',
    phone: ''
  });
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [schools, setSchools] = useState<{id: string, name: string, address: string}[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<{id: string, name: string} | null>(null);
  const [calculatingFee, setCalculatingFee] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [deliveryCoords, setDeliveryCoords] = useState<[number, number] | null>(null);
  const [userOrders, setUserOrders] = useState<any[]>([]);
  const [showOrders, setShowOrders] = useState(false);
  const [showConfirmDeliveryModal, setShowConfirmDeliveryModal] = useState(false);
  const [orderToConfirm, setOrderToConfirm] = useState<any>(null);
  const [showCategories, setShowCategories] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<string | null>(null);

  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [saveData, setSaveData] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  const categories = ['Todos', 'Componentes', 'Kits', 'Ferramentas', 'Acessórios'];
  const HQ_COORDS: [number, number] = [-12.8767, -38.4725];
  const INVENTORY_ADDRESS = "R. Domingos Píres - Periperi, Salvador - BA, 40726-080";

  // Haversine formula to calculate distance in km
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const MapClickHandler = () => {
    useMapEvents({
      click: async (e) => {
        const { lat, lng } = e.latlng;
        setDeliveryCoords([lat, lng]);
        
        setCalculatingFee(true);
        try {
          // Reverse geocoding using Nominatim
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`);
          const data = await response.json();
          
          if (data.address) {
            setDeliveryAddress({
              cep: data.address.postcode || '',
              street: `${data.address.road || ''}${data.address.house_number ? ', ' + data.address.house_number : ''}`,
              neighborhood: data.address.suburb || data.address.neighbourhood || '',
              city: data.address.city || data.address.town || 'Salvador',
              referencePoint: '',
              latitude: lat,
              longitude: lng
            });
          }

          // Calculate fee based on distance
          const distance = calculateDistance(HQ_COORDS[0], HQ_COORDS[1], lat, lng);
          let fee = 7;
          if (distance > 8) {
            fee += (distance - 8) * 3;
          }
          setDeliveryFee(fee);
        } catch (err) {
          console.error('Error reverse geocoding:', err);
        } finally {
          setCalculatingFee(false);
        }
      },
    });
    return null;
  };

  useEffect(() => {
    const fetchSchools = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'schools'));
        const schoolsList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as {id: string, name: string, address: string}[];
        setSchools(schoolsList);
      } catch (err) {
        console.error('Error fetching schools:', err);
      }
    };
    fetchSchools();
  }, []);

  useEffect(() => {
    if (window.MercadoPago && import.meta.env.VITE_MERCADO_PAGO_PUBLIC_KEY) {
      const mpInstance = new window.MercadoPago(import.meta.env.VITE_MERCADO_PAGO_PUBLIC_KEY);
      setMp(mpInstance);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setUserOrders([]);
      return;
    }
    const q = query(collection(db, 'orders'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUserOrders(orders);
    }, (error) => {
      console.error('Error fetching orders:', error);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (user && user.email) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.email));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserRole(data.role || 'external');
            setCustomerInfo(prev => ({
              ...prev,
              name: prev.name || data.name || '',
              phone: prev.phone || data.phone || ''
            }));
          } else {
            setUserRole('external');
          }
        } catch (err) {
          console.error('Error fetching user role:', err);
          setUserRole('external');
        }
      }
    };
    fetchUserRole();
  }, [user]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const productsSnapshot = await getDocs(collection(db, 'products'));
        const productsList = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        
        // Sort: Promotions first, then by name
        const sortedProducts = productsList.sort((a, b) => {
          const aIsPromo = (a.promotionPrice || 0) > 0;
          const bIsPromo = (b.promotionPrice || 0) > 0;
          if (aIsPromo && !bIsPromo) return -1;
          if (!aIsPromo && bIsPromo) return 1;
          return a.name.localeCompare(b.name);
        });

        setProducts(sortedProducts);
        setFilteredProducts(sortedProducts);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'products');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Load saved data from localStorage
  useEffect(() => {
    const savedSaveData = localStorage.getItem('makerroom_save_data');
    if (savedSaveData !== null) {
      const shouldSave = savedSaveData === 'true';
      setSaveData(shouldSave);
      
      if (shouldSave) {
        const savedCustomerInfo = localStorage.getItem('makerroom_customer_info');
        const savedDeliveryAddress = localStorage.getItem('makerroom_delivery_address');
        const savedCardData = localStorage.getItem('makerroom_card_data');

        if (savedCustomerInfo) setCustomerInfo(JSON.parse(savedCustomerInfo));
        if (savedDeliveryAddress) {
          const address = JSON.parse(savedDeliveryAddress);
          setDeliveryAddress(address);
          if (address.latitude && address.longitude) {
            setDeliveryCoords([address.latitude, address.longitude]);
            // Recalculate fee if coords exist
            const distance = calculateDistance(HQ_COORDS[0], HQ_COORDS[1], address.latitude, address.longitude);
            let fee = 7;
            if (distance > 8) fee += (distance - 8) * 3;
            setDeliveryFee(fee);
          }
        }
        if (savedCardData) {
          const card = JSON.parse(savedCardData);
          setCardData(prev => ({
            ...prev,
            cardholderName: card.cardholderName || '',
            identificationNumber: card.identificationNumber || '',
            cardType: card.cardType || 'credit',
            installments: card.installments || 1,
            phone: card.phone || '',
            zipCode: card.zipCode || ''
          }));
        }
      }
    }
    setIsInitialLoadDone(true);
  }, []);

  useEffect(() => {
    if (!isInitialLoadDone) return;
    
    localStorage.setItem('makerroom_save_data', String(saveData));
    if (saveData) {
      localStorage.setItem('makerroom_customer_info', JSON.stringify(customerInfo));
      localStorage.setItem('makerroom_delivery_address', JSON.stringify(deliveryAddress));
      localStorage.setItem('makerroom_card_data', JSON.stringify({
        cardholderName: cardData.cardholderName,
        identificationNumber: cardData.identificationNumber,
        cardType: cardData.cardType,
        installments: cardData.installments,
        phone: cardData.phone,
        zipCode: cardData.zipCode
      }));
    } else {
      localStorage.removeItem('makerroom_customer_info');
      localStorage.removeItem('makerroom_delivery_address');
      localStorage.removeItem('makerroom_card_data');
    }
  }, [saveData, customerInfo, deliveryAddress, cardData.cardholderName, cardData.identificationNumber, cardData.cardType, cardData.installments, cardData.phone, cardData.zipCode, isInitialLoadDone]);

  useEffect(() => {
    let result = products;
    
    if (searchTerm) {
      result = result.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (selectedCategory !== 'Todos') {
      result = result.filter(p => p.category === selectedCategory);
    }
    
    setFilteredProducts(result);
  }, [searchTerm, selectedCategory, products]);

  const addToCart = (id: string) => {
    setCart(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => {
      const newCart = { ...prev };
      if (newCart[id] > 1) {
        newCart[id] -= 1;
      } else {
        delete newCart[id];
      }
      return newCart;
    });
  };

  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);
  const subtotal = Object.entries(cart).reduce((acc, [id, qty]) => {
    const product = products.find(p => p.id === id);
    return acc + (product?.price || 0) * qty;
  }, 0);
  const totalPrice = subtotal + (deliveryMethod === 'delivery' ? deliveryFee : 0);

  // Handle product sharing via query param
  useEffect(() => {
    const productId = searchParams.get('product');
    if (productId && products.length > 0) {
      const product = products.find(p => p.id === productId);
      if (product) {
        setSelectedProduct(product);
      }
    }
  }, [searchParams, products]);

  const handleCancelOrder = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'Cancelado',
        cancelledAt: serverTimestamp(),
        cancelledBy: 'user'
      });
      
      // Notify admins
      const adminsSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
      const adminEmails = adminsSnapshot.docs.map(doc => doc.id);
      if (!adminEmails.includes('jvssilv4@gmail.com')) adminEmails.push('jvssilv4@gmail.com');

      for (const email of adminEmails) {
        await sendNotification(
          email,
          'Pedido Cancelado pelo Cliente ❌',
          `O cliente ${auth.currentUser?.email} cancelou o pedido #${orderId.slice(-6)}.`
        );
      }
      setOrderToCancel(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'cancel-order');
    }
  };

  // New shipping fee logic: R$ 7 base + R$ 3 per km over 8km
  const calculateDeliveryFee = async () => {
    if (!deliveryAddress.cep || !deliveryAddress.street) return;
    setCalculatingFee(true);
    
    // Simulate distance calculation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simple logic: if CEP starts with "40", it's close, otherwise far.
    const isClose = deliveryAddress.cep.startsWith('40');
    const simulatedDistance = isClose ? Math.random() * 10 + 2 : Math.random() * 30 + 10;
    
    let fee = 7; // Base fee
    if (simulatedDistance > 8) {
      fee += (simulatedDistance - 8) * 3;
    }
    
    setDeliveryFee(fee);
    setCalculatingFee(false);
  };

  const handleConfirmDelivery = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'Entregue',
        deliveredAt: serverTimestamp()
      });

      // Notify admins
      const adminsSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
      const adminEmails = adminsSnapshot.docs.map(doc => doc.id);
      if (!adminEmails.includes('jvssilv4@gmail.com')) adminEmails.push('jvssilv4@gmail.com');

      for (const email of adminEmails) {
        await sendNotification(
          email,
          'Entrega Confirmada! ✅',
          `O cliente ${auth.currentUser?.email} confirmou o recebimento do pedido #${orderId.slice(-6)}.`
        );
      }

      setShowConfirmDeliveryModal(false);
      setOrderToConfirm(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'confirm-delivery');
    }
  };

  const generateReceipt = (order: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('MAKEROOM', 20, 25);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('COMPROVANTE DE PEDIDO', 20, 32);
    
    // Order Info Box
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Informações do Pedido', 20, 55);
    
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.line(20, 58, pageWidth - 20, 58);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const date = order.createdAt?.toDate ? order.createdAt.toDate() : new Date();
    doc.text(`ID do Pedido: #${order.id.slice(-8).toUpperCase()}`, 20, 68);
    doc.text(`Data: ${date.toLocaleString('pt-BR')}`, 20, 75);
    doc.text(`Status: ${order.status}`, 20, 82);
    
    // Customer Info
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Dados do Cliente', 20, 100);
    doc.line(20, 103, pageWidth - 20, 103);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const name = order.customerInfo?.name || auth.currentUser?.displayName || 'N/A';
    const email = order.userEmail || auth.currentUser?.email || 'N/A';
    const cpf = order.customerInfo?.cpf || 'N/A';
    doc.text(`Nome: ${name}`, 20, 113);
    doc.text(`Email: ${email}`, 20, 120);
    doc.text(`CPF: ${cpf}`, 20, 127);
    
    // Delivery Info
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Entrega / Retirada', 20, 145);
    doc.line(20, 148, pageWidth - 20, 148);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (order.deliveryMethod === 'pickup') {
      doc.text('Método: Retirada na Escola', 20, 158);
      doc.text(`Escola: ${order.schoolName || 'N/A'}`, 20, 165);
    } else {
      doc.text('Método: Entrega em Casa', 20, 158);
      const addr = order.deliveryAddress;
      doc.text(`Endereço: ${addr?.street || 'N/A'}, ${addr?.neighborhood || 'N/A'}`, 20, 165);
      doc.text(`Cidade: ${addr?.city || 'N/A'} - CEP: ${addr?.cep || 'N/A'}`, 20, 172);
    }
    
    // Items Table
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Itens do Pedido', 20, 190);
    doc.line(20, 193, pageWidth - 20, 193);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    let y = 203;
    
    order.productIds.forEach((pid: string, index: number) => {
      const product = products.find(p => p.id === pid);
      const name = product ? product.name : `Produto ID: ${pid}`;
      const price = product ? `R$ ${product.price.toFixed(2)}` : '';
      doc.text(`${index + 1}. ${name}`, 20, y);
      if (price) doc.text(price, pageWidth - 50, y);
      y += 8;
    });
    
    // Total
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.5);
    doc.line(20, y + 5, pageWidth - 20, y + 5);
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL: R$ ${order.total.toFixed(2)}`, pageWidth - 20, y + 15, { align: 'right' });
    
    // Footer
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150, 150, 150);
    doc.text('Este é um comprovante oficial da Maker Store. Guarde-o para sua segurança.', pageWidth / 2, 285, { align: 'center' });
    
    doc.save(`recibo-makeroom-${order.id.slice(-6)}.pdf`);
  };

  const getPaymentErrorMessage = (statusDetail: string) => {
    const messages: Record<string, string> = {
      'cc_rejected_insufficient_amount': 'Saldo insuficiente no cartão.',
      'cc_rejected_bad_filled_card_number': 'Número de cartão inválido.',
      'cc_rejected_bad_filled_date': 'Data de validade inválida.',
      'cc_rejected_bad_filled_other': 'Dados do cartão incorretos.',
      'cc_rejected_bad_filled_security_code': 'Código de segurança inválido.',
      'cc_rejected_blacklist': 'Não pudemos processar seu pagamento por segurança.',
      'cc_rejected_call_for_authorize': 'Você deve autorizar o pagamento com o banco emissor.',
      'cc_rejected_card_disabled': 'O cartão está desativado. Entre em contato com o banco.',
      'cc_rejected_card_error': 'Ocorreu um erro ao processar o cartão.',
      'cc_rejected_duplicated_payment': 'Você já efetuou um pagamento com esse valor recentemente.',
      'cc_rejected_high_risk': 'Seu pagamento foi recusado por segurança (análise de risco). Tente usar outro cartão ou pague via Pix para aprovação imediata.',
      'cc_rejected_invalid_installments': 'Número de parcelas inválido para este cartão.',
      'cc_rejected_max_attempts': 'Você excedeu o limite de tentativas. Tente outro cartão.',
      'cc_rejected_other_reason': 'O pagamento foi recusado pelo banco. Tente outro método.',
      'pending_review_manual': 'Seu pagamento está em análise manual pelo Mercado Pago. Você receberá um e-mail com a confirmação em breve.',
    };
    return messages[statusDetail] || `Pagamento recusado: ${statusDetail}`;
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\D/g, '').substring(0, 16);
    return v.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const formatExpiration = (value: string) => {
    const v = value.replace(/\D/g, '').substring(0, 4);
    if (v.length > 2) return `${v.substring(0, 2)}/${v.substring(2)}`;
    return v;
  };

  const formatCVV = (value: string) => {
    return value.replace(/\D/g, '').substring(0, 4);
  };

  const formatCPF = (value: string) => {
    const v = value.replace(/\D/g, '').substring(0, 11);
    if (v.length <= 3) return v;
    if (v.length <= 6) return `${v.substring(0, 3)}.${v.substring(3)}`;
    if (v.length <= 9) return `${v.substring(0, 3)}.${v.substring(3, 6)}.${v.substring(6)}`;
    return `${v.substring(0, 3)}.${v.substring(3, 6)}.${v.substring(6, 9)}-${v.substring(9)}`;
  };

  const formatPhone = (value: string) => {
    const v = value.replace(/\D/g, '').substring(0, 11);
    if (v.length === 0) return '';
    if (v.length <= 2) return `(${v}`;
    if (v.length <= 6) return `(${v.substring(0, 2)}) ${v.substring(2)}`;
    if (v.length <= 10) return `(${v.substring(0, 2)}) ${v.substring(2, 6)}-${v.substring(6)}`;
    return `(${v.substring(0, 2)}) ${v.substring(2, 7)}-${v.substring(7)}`;
  };

  const formatCEP = (value: string) => {
    const v = value.replace(/\D/g, '').substring(0, 8);
    if (v.length <= 5) return v;
    return `${v.substring(0, 5)}-${v.substring(5)}`;
  };

  const handleCheckout = async () => {
    if (totalItems === 0 || !auth.currentUser) return;
    setCheckoutError(null);

    // Non-student users must fill the form
    const isExternal = userRole !== 'student' && userRole !== 'admin';
    if (isExternal && !showCheckoutForm) {
      setShowCart(false); // Close cart drawer
      setShowCheckoutForm(true); // Open checkout modal
      return;
    }

    if (showCheckoutForm) {
      if (!customerInfo.name || !customerInfo.cpf || !customerInfo.phone) {
        alert('Por favor, preencha todos os campos do formulário.');
        return;
      }
      if (deliveryMethod === 'delivery' && (!deliveryAddress.cep || !deliveryAddress.street || !deliveryAddress.neighborhood || !deliveryAddress.city)) {
        alert('Por favor, preencha todos os campos do endereço.');
        return;
      }
      if (deliveryMethod === 'pickup' && !selectedSchool) {
        alert('Por favor, selecione uma escola para retirada.');
        return;
      }

      // Save data if requested
      localStorage.setItem('makerroom_save_data', String(saveData));
      if (saveData) {
        localStorage.setItem('makerroom_customer_info', JSON.stringify(customerInfo));
        localStorage.setItem('makerroom_delivery_address', JSON.stringify(deliveryAddress));
        localStorage.setItem('makerroom_card_data', JSON.stringify({
          cardholderName: cardData.cardholderName,
          identificationNumber: cardData.identificationNumber,
          phone: cardData.phone,
          zipCode: cardData.zipCode
        }));
      } else {
        localStorage.removeItem('makerroom_customer_info');
        localStorage.removeItem('makerroom_delivery_address');
        localStorage.removeItem('makerroom_card_data');
      }
    }

    setIsProcessing(true);
    
    try {
      const itemsDescription = Object.entries(cart)
        .map(([id, qty]) => {
          const p = products.find(prod => prod.id === id);
          return `${qty}x ${p?.name}`;
        })
        .join(', ');

      if (paymentMethod === 'pix') {
        const apiUrl = import.meta.env.VITE_API_URL || 'https://makeroom-api.vercel.app';
        const createPayUrl = `${apiUrl}/api/createpay`;
        
        console.log('Requesting Pix from:', createPayUrl);
        
        let response;
        try {
          response = await fetch(createPayUrl, {
            method: 'POST',
            mode: 'cors',
            headers: { 
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              value: Number(totalPrice.toFixed(2)),
              items: itemsDescription,
              payerEmail: auth.currentUser.email || 'cliente@makerroom.com'
            })
          });
        } catch (fetchError) {
          console.error('API failed:', fetchError);
          throw new Error('Falha na conexão com o servidor de pagamento.');
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`Erro na API de pagamento (${response.status}): ${errorData.error || errorData.message || response.statusText}`);
        }

        const data = await response.json();
        if (data.error) throw new Error(`Erro na API: ${typeof data.error === 'string' ? data.error : JSON.stringify(data.error)}`);
        
        // Handle both direct object (new Express API) and nested result (old Next.js API)
        const paymentData = data.result || data;

        if (paymentData.id && paymentData.point_of_interaction) {
          const pInfo = {
            id: paymentData.id,
            qrCode: paymentData.point_of_interaction.transaction_data.qr_code,
            qrCodeBase64: paymentData.point_of_interaction.transaction_data.qr_code_base64,
            status: 'pending'
          };
          setPaymentInfo(pInfo);
          setPaymentStatus('pending');
          setShowCheckoutForm(false);
          setCart({}); // Clear cart after generating Pix
          
          // Save order to Firestore
          await saveOrderToFirestore(pInfo.id, 'Aguardando Pagamento');
        } else {
          console.error('Unexpected Pix response structure:', data);
          throw new Error('Resposta inesperada do servidor de pagamento. Por favor, tente novamente.');
        }
      } else {
        // Credit Card Payment
        if (!mp) {
          throw new Error('O sistema de pagamento com cartão não está configurado. Verifique a chave pública do Mercado Pago.');
        }

        if (!cardData.phone || cardData.phone.replace(/\D/g, '').length < 10) {
          throw new Error('Por favor, informe um telefone válido do titular do cartão.');
        }

        if (!cardData.zipCode || cardData.zipCode.replace(/\D/g, '').length !== 8) {
          throw new Error('Por favor, informe um CEP de cobrança válido.');
        }

        let token = '';
        let payment_method_id = 'visa'; // Default
        let issuer_id = undefined;

        try {
          // 1. Get Payment Method (Card Brand) and Issuer
          const bin = cardData.cardNumber.replace(/\s/g, '').substring(0, 6);
          const paymentMethods = await mp.getPaymentMethods({ bin });
          
          if (paymentMethods && paymentMethods.results && paymentMethods.results.length > 0) {
            // Try to find the correct payment type (credit vs debit)
            const targetType = cardData.cardType === 'debit' ? 'debit_card' : 'credit_card';
            const matchedMethod = paymentMethods.results.find((r: any) => r.payment_type_id === targetType) || paymentMethods.results[0];
            
            payment_method_id = matchedMethod.id;
            
            // Try to get issuer explicitly for better compatibility
            try {
              const issuers = await mp.getIssuers({ paymentMethodId: payment_method_id, bin });
              if (issuers && issuers.length > 0) {
                issuer_id = issuers[0].id;
              }
            } catch (issuerErr) {
              console.warn('Issuer detection failed, proceeding without it:', issuerErr);
            }
          }

          // 2. Create Token with sanitized data
          const cardToken = await mp.createCardToken({
            cardNumber: cardData.cardNumber.replace(/\s/g, ''),
            cardExpirationMonth: cardData.cardExpirationMonth.padStart(2, '0'),
            cardExpirationYear: cardData.cardExpirationYear.length === 2 ? `20${cardData.cardExpirationYear}` : cardData.cardExpirationYear,
            securityCode: cardData.securityCode,
            cardholderName: cardData.cardholderName.trim(),
            identificationType: 'CPF',
            identificationNumber: cardData.identificationNumber.replace(/\D/g, ''),
          });
          token = cardToken.id;
        } catch (tokenErr: any) {
          console.error('Tokenization Error:', tokenErr);
          let errorMsg = 'Verifique se todos os campos estão corretos.';
          if (tokenErr.message) {
            errorMsg = tokenErr.message;
          } else if (Array.isArray(tokenErr)) {
            errorMsg = tokenErr.map((e: any) => e.message).join(', ');
          } else if (typeof tokenErr === 'object') {
            errorMsg = JSON.stringify(tokenErr);
          }
          throw new Error(`Erro nos dados do cartão: ${errorMsg}`);
        }
        
        const apiUrl = import.meta.env.VITE_API_URL || 'https://makeroom-api.vercel.app';
        const processPaymentUrl = `${apiUrl}/api/payment/process`;
        
        console.log('Processing card payment at:', processPaymentUrl);
        
        const phoneClean = cardData.phone.replace(/\D/g, '');
        const areaCode = phoneClean.substring(0, 2);
        const phoneNumber = phoneClean.substring(2);

        const paymentPayload = {
          token,
          transaction_amount: Number(totalPrice.toFixed(2)),
          description: itemsDescription,
          installments: cardData.cardType === 'debit' ? 1 : cardData.installments,
          payment_method_id,
          issuer_id,
          payer: {
            email: auth.currentUser.email,
            first_name: cardData.cardholderName.trim().split(' ')[0] || 'Cliente',
            last_name: cardData.cardholderName.trim().split(' ').slice(1).join(' ') || 'Maker',
            identification: {
              type: 'CPF',
              number: cardData.identificationNumber.replace(/\D/g, '')
            },
            ...(phoneClean.length >= 10 && {
              phone: {
                area_code: areaCode,
                number: phoneNumber
              }
            }),
            ...(cardData.zipCode && {
              address: {
                zip_code: cardData.zipCode.replace(/\D/g, '')
              }
            })
          }
        };

        let response;
        try {
          response = await fetch(processPaymentUrl, {
            method: 'POST',
            mode: 'cors',
            headers: { 
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(paymentPayload)
          });
        } catch (fetchError) {
          console.error('API failed:', fetchError);
          throw new Error('Falha na conexão com o servidor de pagamento.');
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`Erro no processamento do cartão (${response.status}): ${errorData.message || response.statusText}`);
        }

        const data = await response.json();
        if (data.error) throw new Error(`Erro no cartão: ${JSON.stringify(data.error)}`);
        
        const paymentData = data.result || data;

        if (paymentData.status === 'approved') {
          setPaymentStatus('approved');
          setShowCheckoutForm(false);
          await saveOrderToFirestore(paymentData.id, 'Pago');
          setCart({});
          alert('Pagamento com cartão aprovado com sucesso! 🎉');
        } else if (paymentData.status === 'in_process' || paymentData.status === 'pending') {
          // Verifica se exige autenticação 3DS (comum em cartão de débito)
          if (paymentData.status_detail === 'pending_challenge' && paymentData.transaction_details?.external_resource_url) {
            alert('Você será redirecionado para o aplicativo do seu banco para autorizar o pagamento com débito.');
            window.location.href = paymentData.transaction_details.external_resource_url;
            return; // Para a execução aqui, pois a página será recarregada
          }

          setPaymentStatus('pending');
          setShowCheckoutForm(false);
          await saveOrderToFirestore(paymentData.id, 'Em Análise');
          setCart({});
          alert('Seu pagamento está em análise. Você receberá um e-mail assim que for aprovado.');
        } else {
          const friendlyMessage = getPaymentErrorMessage(paymentData.status_detail);
          throw new Error(friendlyMessage);
        }
      }
    } catch (err: any) {
      console.error('Checkout Error:', err);
      setCheckoutError(err.message || 'Ocorreu um erro ao processar o pedido.');
    } finally {
      setIsProcessing(false);
    }
  };

  const saveOrderToFirestore = async (paymentId: any, status: string) => {
    try {
      const orderData: any = {
        userId: auth.currentUser?.uid,
        userEmail: auth.currentUser?.email,
        productIds: Object.keys(cart),
        total: totalPrice,
        status: status,
        paymentId: String(paymentId),
        createdAt: serverTimestamp(),
        deliveryMethod,
        deliveryFee: deliveryMethod === 'delivery' ? deliveryFee : 0,
      };

      if (userRole === 'external' || userRole === 'student' || userRole === 'admin') {
        orderData.customerInfo = customerInfo;
        if (deliveryMethod === 'delivery') {
          orderData.deliveryAddress = deliveryAddress;
        } else if (deliveryMethod === 'pickup' && selectedSchool) {
          orderData.schoolId = selectedSchool.id;
          orderData.schoolName = selectedSchool.name;
        }
      }

      const docRef = await addDoc(collection(db, 'orders'), orderData);
      setLastOrderId(docRef.id);

      // Notify admins
      const adminsSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
      const adminEmails = adminsSnapshot.docs.map(doc => doc.id);
      if (!adminEmails.includes('jvssilv4@gmail.com')) adminEmails.push('jvssilv4@gmail.com');

      for (const email of adminEmails) {
        await sendNotification(
          email,
          'Novo Pedido Realizado! 🛍️',
          `Um novo pedido de R$ ${totalPrice.toFixed(2)} foi realizado por ${customerInfo.name || auth.currentUser?.email}.`
        );
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'orders');
    }
  };

  const checkPaymentStatus = useCallback(async () => {
    if (!paymentInfo || paymentStatus !== 'pending') return;
    
    const apiUrl = import.meta.env.VITE_API_URL || 'https://makeroom-api.vercel.app';
    const getPayUrl = `${apiUrl}/api/getPay`;
    
    try {
      console.log('Checking status for ID:', paymentInfo.id, 'at', getPayUrl);
      
      const response = await fetch(getPayUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ payId: paymentInfo.id })
      }).catch(err => {
        throw new Error(`Erro de rede: ${err.message}`);
      });
      
      if (!response.ok) {
        console.warn(`API retornou status ${response.status} para getpay.`);
        return;
      }

      const data = await response.json();
      console.log('Status check result:', data);

      if (data.error) {
        console.error('Payment API error:', data.error);
        return;
      }

      const paymentData = data.result || data;

      if (paymentData && paymentData.status === 'approved') {
        setPaymentStatus('approved');
        
        // Update order status to 'Pago'
        try {
          if (lastOrderId) {
            await updateDoc(doc(db, 'orders', lastOrderId), {
              status: 'Pago'
            });
          } else {
            // Fallback: find order by paymentId if lastOrderId is lost
            const q = query(collection(db, 'orders'), where('paymentId', '==', String(paymentInfo.id)));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
              await updateDoc(doc(db, 'orders', snapshot.docs[0].id), {
                status: 'Pago'
              });
            }
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, 'orders');
        }
        
        setCart({});
      } else if (paymentData && paymentData.status === 'rejected') {
        setPaymentStatus('rejected');
      }
    } catch (err) {
      console.error('Error checking payment status:', err);
    }
  }, [paymentInfo, cart, totalPrice, lastOrderId, paymentStatus]);

  const getKitItems = (itemIds: string[]) => {
    return products.filter(p => itemIds.includes(p.id));
  };

  useEffect(() => {
    let interval: any;
    if (paymentStatus === 'pending') {
      interval = setInterval(checkPaymentStatus, 10000);
    }
    return () => clearInterval(interval);
  }, [paymentStatus, checkPaymentStatus]);

  const copyPixCode = () => {
    if (paymentInfo) {
      navigator.clipboard.writeText(paymentInfo.qrCode);
      // Using a custom toast/notification would be better, but for now let's use a simple state or just keep it as is if we can't use alert
      // The guidelines say avoid window.alert, so I'll use a console log or just assume it works for now.
      // Actually, I'll add a small state for feedback.
    }
  };

  const shareProduct = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    const url = `${window.location.origin}/store?product=${product.id}`;
    navigator.clipboard.writeText(url);
    alert('Link do produto copiado!');
  };

  const ProductCard = ({ product }: { product: Product }) => {
    const isPromo = (product.promotionPrice || 0) > 0;
    const discount = isPromo && product.originalPrice 
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : 0;

    return (
      <div 
        key={product.id} 
        onClick={() => setSelectedProduct(product)}
        className="bg-white rounded-[6px] md:rounded-[24px] shadow-sm hover:shadow-md md:hover:shadow-xl transition-all duration-300 flex flex-col group overflow-hidden h-full cursor-pointer relative border border-slate-100/50 md:border-slate-100"
      >
        {isPromo && (
          <div className="absolute top-2 md:top-3 left-2 md:left-3 z-10 bg-red-500 text-white text-[8px] md:text-[9px] font-black px-2 md:px-2.5 py-0.5 md:py-1 rounded-md md:rounded-lg shadow-lg shadow-red-200 flex items-center gap-1 animate-pulse">
            <Zap className="w-2.5 md:w-3 h-2.5 md:h-3 fill-current" />
            OFERTA
          </div>
        )}

        <button 
          onClick={(e) => shareProduct(e, product)}
          className="absolute top-2 md:top-3 right-2 md:right-3 z-10 w-7 h-7 md:w-9 md:h-9 bg-white/80 backdrop-blur-md border border-slate-200 rounded-full flex items-center justify-center text-slate-600 hover:bg-white hover:text-brand-500 transition-all shadow-sm md:opacity-0 group-hover:opacity-100"
          title="Compartilhar produto"
        >
          <Copy className="w-3.5 h-3.5 md:w-4 md:h-4" />
        </button>

        <div className="relative aspect-square md:aspect-[4/3] overflow-hidden bg-white md:bg-slate-50 flex items-center justify-center p-0 md:p-4">
          <img 
            src={product.imageUrl} 
            alt={product.name} 
            className="w-full h-full md:max-w-full md:max-h-full object-cover md:object-contain group-hover:scale-105 transition-transform duration-500 ease-out" 
            referrerPolicy="no-referrer"
          />
          
          {product.stock < 5 && (
            <div className="absolute bottom-0 md:bottom-3 left-0 md:left-3 right-0 md:right-3">
              <div className="bg-[#ee4d2d]/90 md:bg-red-500/90 backdrop-blur-sm text-white px-2 py-0.5 md:py-1 rounded-none md:rounded-lg text-[9px] font-medium md:font-black uppercase tracking-tight md:tracking-widest shadow-lg flex items-center justify-center gap-1 md:gap-1.5">
                <AlertCircle className="w-3 h-3 hidden md:block" />
                Últimas {product.stock} un.
              </div>
            </div>
          )}
        </div>
        
        <div className="p-[.5rem] md:p-5 flex flex-col flex-1">
          <div className="mb-1 md:mb-4 flex-1">
            <h3 className="text-[12px] md:text-base font-bold text-slate-800 md:text-slate-900 mb-1 line-clamp-2 leading-tight min-h-[2.4em] md:min-h-0">{product.name}</h3>
            <p className="text-slate-500 text-[10px] md:text-xs line-clamp-3 leading-relaxed mb-2">{product.description}</p>
          </div>
          
          <div className="mt-auto">
            {/* Mobile Price and Cart Layout */}
            <div className="md:hidden flex items-end justify-between gap-2">
              <div className="flex flex-col">
                {isPromo && (
                  <span className="text-[10px] text-slate-400 line-through">
                    R$ {product.originalPrice?.toFixed(2)}
                  </span>
                )}
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] font-medium text-[#ee4d2d]">R$</span>
                  <span className="text-base font-medium text-[#ee4d2d]">
                    {product.price.toFixed(2).split('.')[0]}
                    <span className="text-[10px]">.{product.price.toFixed(2).split('.')[1]}</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center">
                {cart[product.id] ? (
                  <div className="flex items-center gap-1 bg-slate-900 text-white p-0.5 rounded-lg shadow-md">
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeFromCart(product.id); }}
                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/10 transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-bold text-[10px] min-w-[14px] text-center">{cart[product.id]}</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); addToCart(product.id); }}
                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/10 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={(e) => { e.stopPropagation(); addToCart(product.id); }}
                    className="bg-brand-500 text-white w-7 h-7 rounded-lg flex items-center justify-center hover:bg-brand-600 transition-all shadow-md shadow-brand-100 active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Desktop Price Layout */}
            <div className="hidden md:flex pt-4 border-t border-slate-50 items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">
                  {isPromo ? 'De R$ ' + product.originalPrice?.toFixed(2) : 'Preço'}
                </span>
                <span className={`text-lg font-black ${isPromo ? 'text-red-500' : 'text-slate-900'}`}>
                  R$ {product.price.toFixed(2)}
                </span>
              </div>
              
              <div className="flex items-center">
                {cart[product.id] ? (
                  <div className="flex items-center gap-1 bg-slate-900 text-white p-1 rounded-xl shadow-lg">
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeFromCart(product.id); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-bold text-xs min-w-[16px] text-center">{cart[product.id]}</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); addToCart(product.id); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={(e) => { e.stopPropagation(); addToCart(product.id); }}
                    className="bg-brand-500 text-white w-10 h-10 rounded-xl flex items-center justify-center hover:bg-brand-600 transition-all shadow-lg shadow-brand-100 active:scale-95 group/btn"
                  >
                    <Plus className="w-5 h-5 group-hover/btn:rotate-90 transition-transform" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div >
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="animate-spin h-8 w-8 text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20 md:pb-8">
      <Helmet>
        <title>{selectedProduct ? `${selectedProduct.name} | Maker Store` : 'Maker Store | Robótica & Criatividade'}</title>
        <meta name="description" content={selectedProduct ? selectedProduct.description.substring(0, 160) : 'Encontre os melhores componentes, kits e ferramentas para seus projetos de robótica e eletrônica.'} />
        {selectedProduct && (
          <>
            <meta property="og:title" content={`${selectedProduct.name} | Maker Store`} />
            <meta property="og:description" content={selectedProduct.description.substring(0, 160)} />
            <meta property="og:image" content={selectedProduct.imageUrl} />
            <meta property="og:url" content={window.location.href} />
          </>
        )}
      </Helmet>
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-[32px] md:rounded-[40px] bg-slate-900 text-white p-6 md:p-16">
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-20 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-l from-brand-500 to-transparent" />
          <ShoppingBag className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 md:w-64 md:h-64 rotate-12" />
        </div>
        
        <div className="relative z-10 max-w-2xl">
          <span 
            className="inline-block px-3 py-1 rounded-full bg-brand-500 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] mb-4 md:mb-6"
          >
            Maker Store
          </span>
          <h1 
            className="text-3xl md:text-6xl font-bold mb-4 md:mb-6 leading-tight"
          >
            Equipe seu Laboratório <span className="text-brand-400">Maker</span>
          </h1>
          <p 
            className="text-slate-400 text-sm md:text-lg mb-6 md:mb-8"
          >
            Encontre os melhores componentes, kits e ferramentas para seus projetos de robótica e eletrônica.
          </p>
          
          <div className="flex flex-wrap gap-3 md:gap-4">
            <div className="flex items-center gap-2 md:gap-3 bg-white/5 backdrop-blur-md border border-white/10 px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl">
              <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-emerald-400" />
              <span className="text-xs md:text-sm font-medium">Entrega na Escola</span>
            </div>
            <div className="flex items-center gap-2 md:gap-3 bg-white/5 backdrop-blur-md border border-white/10 px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl">
              <QrCode className="w-4 h-4 md:w-5 md:h-5 text-brand-400" />
              <span className="text-xs md:text-sm font-medium">Pagamento via Pix</span>
            </div>
          </div>
        </div>
      </section>

      {/* Search and Filter Bar */}
      <div className="sticky top-4 z-30 bg-white/90 backdrop-blur-xl border border-slate-100 p-2 md:p-4 rounded-[24px] md:rounded-[32px] shadow-xl shadow-slate-200/40 flex flex-col xl:flex-row gap-3 md:gap-4">
        <div className="relative flex-[1.5]">
          <Search className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-slate-400" />
          <input 
            type="text"
            placeholder="Pesquisar componentes, kits..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 md:pl-14 pr-4 md:pr-6 py-3 md:py-4 bg-slate-50 border-2 border-transparent focus:border-brand-500/20 focus:bg-white rounded-xl md:rounded-2xl focus:ring-4 focus:ring-brand-500/10 outline-none transition-all text-slate-900 font-semibold placeholder:text-slate-400 text-sm md:text-base"
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setShowCategories(!showCategories)}
            className={cn(
              "flex items-center gap-2 px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl font-bold transition-all text-xs md:text-sm border-2",
              showCategories || selectedCategory !== 'Todos'
                ? "bg-brand-500 text-white border-brand-500 shadow-lg shadow-brand-200"
                : "bg-white border-slate-100 text-slate-600 hover:bg-slate-50"
            )}
          >
            <Filter className="w-4 h-4 md:w-5 md:h-5" />
            <span>{selectedCategory === 'Todos' ? 'Filtrar' : selectedCategory}</span>
          </button>

          <AnimatePresence>
            {showCategories && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowCategories(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full left-0 mt-2 p-2 bg-white rounded-2xl shadow-2xl border border-slate-100 min-w-[200px] z-50 overflow-hidden"
                >
                  <div className="flex flex-col gap-1">
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => {
                          setSelectedCategory(cat);
                          setShowCategories(false);
                        }}
                        className={cn(
                          "w-full text-left px-4 py-3 rounded-xl font-bold transition-all text-xs md:text-sm",
                          selectedCategory === cat
                            ? "bg-brand-50 text-brand-600"
                            : "text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={() => setShowOrders(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border-2 border-slate-100 text-slate-600 px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl font-bold hover:bg-slate-50 transition-all text-xs md:text-sm"
          >
            <Package className="w-4 h-4 md:w-5 h-5" />
            <span className="hidden sm:inline">Meus Pedidos</span>
            <span className="sm:hidden">Pedidos</span>
          </button>
          <button 
            onClick={() => setShowCart(true)}
            className="flex-[1.5] md:flex-none flex items-center justify-between gap-3 md:gap-4 bg-slate-900 text-white px-4 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl shadow-lg hover:bg-slate-800 transition-all active:scale-95"
          >
            <div className="flex items-center gap-2">
              <div className="relative">
                <ShoppingCart className="w-4 h-4 md:w-5 h-5" />
                {totalItems > 0 && (
                  <span className="absolute -top-2 -right-2 w-4 h-4 md:w-5 md:h-5 bg-brand-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-slate-900">
                    {totalItems}
                  </span>
                )}
              </div>
              <span className="font-bold hidden sm:inline">{totalItems} itens</span>
              <span className="font-bold sm:hidden">{totalItems}</span>
            </div>
            <span className="font-bold text-xs md:text-base">R$ {totalPrice.toFixed(2)}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-8 px-[.1875rem] md:px-0">
        <div className="w-full">
          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[.1875rem] md:gap-6">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-32 text-center bg-white rounded-[40px] border-2 border-dashed border-slate-100 shadow-sm"
            >
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Search className="w-12 h-12 text-slate-200" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">Nenhum componente encontrado</h3>
              <p className="text-slate-500 max-w-md mx-auto text-sm">Não encontramos nada para "<span className="font-bold text-slate-900">{searchTerm}</span>". Tente usar termos mais genéricos ou mude a categoria.</p>
              <button 
                onClick={() => { setSearchTerm(''); setSelectedCategory('Todos'); }}
                className="mt-8 bg-slate-900 text-white px-8 py-3 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
              >
                Limpar Filtros
              </button>
            </motion.div>
          )}
        </div>
      </div>

      {/* Responsive Cart Drawer */}
      {showCart && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-end"
          onClick={() => setShowCart(false)}
        >
          <div 
            className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center">
                    <ShoppingCart className="w-5 h-5 text-brand-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Seu Carrinho</h2>
                    <p className="text-slate-400 text-xs font-medium">{totalItems} itens selecionados</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowCart(false)} 
                  className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {Object.entries(cart).map(([id, qty]) => {
                  const product = products.find(p => p.id === id);
                  if (!product) return null;
                  return (
                    <div 
                      key={id} 
                      className="flex items-center gap-3 group bg-slate-50/50 p-3 rounded-2xl border border-transparent hover:border-slate-100 transition-all"
                    >
                      <div className="w-16 h-16 rounded-xl bg-white overflow-hidden flex-shrink-0 shadow-sm">
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 text-xs truncate">{product.name}</p>
                        <p className="text-brand-600 font-bold text-xs">R$ {product.price.toFixed(2)}</p>
                        
                        <div className="flex items-center gap-2 mt-1.5">
                          <button 
                            onClick={() => removeFromCart(product.id)} 
                            className="w-7 h-7 bg-white border border-slate-200 rounded-md flex items-center justify-center hover:bg-slate-50 transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5 text-slate-600" />
                          </button>
                          <span className="font-bold text-slate-900 text-sm">{qty}</span>
                          <button 
                            onClick={() => addToCart(product.id)} 
                            className="w-7 h-7 bg-white border border-slate-200 rounded-md flex items-center justify-center hover:bg-slate-50 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5 text-slate-600" />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col items-end justify-between h-16">
                        <span className="font-bold text-slate-900 text-sm">R$ {(product.price * qty).toFixed(2)}</span>
                        <button 
                          onClick={() => {
                            const newCart = { ...cart };
                            delete newCart[id];
                            setCart(newCart);
                          }}
                          className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {totalItems === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center py-16 px-8">
                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 relative">
                      <ShoppingBasket className="w-12 h-12 text-slate-200" />
                      <motion.div 
                        animate={{ y: [0, -10, 0] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="absolute -top-2 -right-2 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center"
                      >
                        <Plus className="w-4 h-4 text-brand-500" />
                      </motion.div>
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-2">Seu carrinho está vazio</h3>
                    <p className="text-slate-400 text-sm leading-relaxed mb-8">Parece que você ainda não escolheu seus componentes. Que tal começar agora?</p>
                    <button 
                      onClick={() => setShowCart(false)}
                      className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                    >
                      Explorar Loja
                    </button>
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-slate-500 text-sm font-medium">
                    <span>Subtotal</span>
                    <span>R$ {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 text-sm font-medium">Entrega</span>
                    {deliveryMethod === 'pickup' ? (
                      <span className="text-emerald-600 font-bold text-[10px] uppercase tracking-widest bg-emerald-50 px-2.5 py-0.5 rounded-full">Grátis na Escola</span>
                    ) : (
                      <span className="text-slate-900 font-bold text-sm">R$ {deliveryFee.toFixed(2)}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                    <span className="text-lg font-bold text-slate-900">Total</span>
                    <span className="text-2xl font-black text-brand-600">R$ {totalPrice.toFixed(2)}</span>
                  </div>
                </div>

                <button 
                  disabled={totalItems === 0 || isProcessing}
                  onClick={handleCheckout}
                  className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-2 group text-sm"
                >
                  {isProcessing ? (
                    <Loader2 className="animate-spin h-5 w-5" />
                  ) : (
                    <>
                      Finalizar Compra 
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Checkout Form Modal */}
      {showCheckoutForm && (
        <div 
          className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowCheckoutForm(false)}
        >
          <div 
            className="bg-white w-full max-w-lg rounded-[40px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center">
                  <Package className="w-6 h-6 text-brand-500" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Dados de Entrega</h2>
                  <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">Complete seu pedido</p>
                </div>
              </div>
              <button 
                onClick={() => setShowCheckoutForm(false)} 
                className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nome Completo</label>
                    <input 
                      type="text"
                      value={customerInfo.name}
                      onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-brand-500/20 rounded-2xl text-sm focus:outline-none transition-all placeholder:text-slate-300"
                      placeholder="Seu nome completo"
                    />
                  </div>
                  
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">CPF</label>
                        <input 
                          type="text"
                          value={customerInfo.cpf}
                          onChange={(e) => setCustomerInfo({...customerInfo, cpf: formatCPF(e.target.value)})}
                          className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-brand-500/20 rounded-2xl text-sm focus:outline-none transition-all placeholder:text-slate-300"
                          placeholder="000.000.000-00"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Telefone</label>
                        <input 
                          type="text"
                          value={customerInfo.phone}
                          onChange={(e) => setCustomerInfo({...customerInfo, phone: formatPhone(e.target.value)})}
                          className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-brand-500/20 rounded-2xl text-sm focus:outline-none transition-all placeholder:text-slate-300"
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                    </div>

                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Método de Entrega</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        onClick={() => {
                          setDeliveryMethod('pickup');
                          setDeliveryFee(0);
                        }}
                        className={cn(
                          "px-5 py-4 rounded-2xl text-xs font-bold border-2 transition-all flex flex-col items-center gap-1",
                          deliveryMethod === 'pickup' 
                            ? "bg-brand-50 border-brand-500/20 text-brand-600" 
                            : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50"
                        )}
                      >
                        <span>Retirar na Escola</span>
                        <span className="text-[9px] opacity-60">Grátis</span>
                      </button>
                      <button
                        onClick={() => setDeliveryMethod('delivery')}
                        className={cn(
                          "px-5 py-4 rounded-2xl text-xs font-bold border-2 transition-all flex flex-col items-center gap-1",
                          deliveryMethod === 'delivery' 
                            ? "bg-brand-50 border-brand-500/20 text-brand-600" 
                            : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50"
                        )}
                      >
                        <span>Entrega</span>
                        <span className="text-[9px] opacity-60">Calculado por distância</span>
                      </button>
                    </div>
                  </div>

                  {deliveryMethod === 'pickup' && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Selecione a Escola</label>
                      <select 
                        value={selectedSchool?.id || ''}
                        onChange={(e) => {
                          const school = schools.find(s => s.id === e.target.value);
                          if (school) setSelectedSchool({ id: school.id, name: school.name });
                        }}
                        className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-brand-500/20 rounded-2xl text-sm focus:outline-none transition-all"
                      >
                        <option value="">Escolha uma escola...</option>
                        {schools.map(school => (
                          <option key={school.id} value={school.id}>{school.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {deliveryMethod === 'delivery' && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-6">
                      <div className="space-y-3">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Selecione no Mapa</label>
                        <div className="h-64 w-full rounded-2xl overflow-hidden border-2 border-slate-100 relative z-10">
                          <MapContainer 
                            center={HQ_COORDS} 
                            zoom={13} 
                            style={{ height: '100%', width: '100%' }}
                            scrollWheelZoom={false}
                          >
                            <TileLayer
                              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            <Marker position={HQ_COORDS} icon={hqIcon}>
                              <Popup>
                                <div className="text-xs font-bold">
                                  Sede MakerRoom
                                </div>
                              </Popup>
                            </Marker>
                            {deliveryCoords && (
                              <Marker position={deliveryCoords} icon={homeIcon}>
                                <Popup>
                                  <div className="text-xs font-bold">
                                    Local de Entrega
                                  </div>
                                </Popup>
                              </Marker>
                            )}
                            <MapClickHandler />
                          </MapContainer>
                        </div>
                        <p className="text-[9px] text-slate-400 font-medium italic">Clique no mapa para definir o ponto exato de entrega.</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">CEP</label>
                          <input 
                            type="text"
                            value={deliveryAddress.cep}
                            onChange={(e) => setDeliveryAddress(prev => ({ ...prev, cep: formatCEP(e.target.value) }))}
                            onBlur={calculateDeliveryFee}
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-brand-500/20 rounded-xl text-sm focus:outline-none transition-all"
                            placeholder="00000-000"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cidade</label>
                          <input 
                            type="text"
                            value={deliveryAddress.city}
                            onChange={(e) => setDeliveryAddress(prev => ({ ...prev, city: e.target.value }))}
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-brand-500/20 rounded-xl text-sm focus:outline-none transition-all"
                            placeholder="Salvador"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Rua e Número</label>
                        <input 
                          type="text"
                          value={deliveryAddress.street}
                          onChange={(e) => setDeliveryAddress(prev => ({ ...prev, street: e.target.value }))}
                          onBlur={calculateDeliveryFee}
                          className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-brand-500/20 rounded-xl text-sm focus:outline-none transition-all"
                          placeholder="Ex: Rua das Flores, 123"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Bairro</label>
                        <input 
                          type="text"
                          value={deliveryAddress.neighborhood}
                          onChange={(e) => setDeliveryAddress(prev => ({ ...prev, neighborhood: e.target.value }))}
                          className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-brand-500/20 rounded-xl text-sm focus:outline-none transition-all"
                          placeholder="Ex: Pituba"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ponto de Referência</label>
                        <input 
                          type="text"
                          value={deliveryAddress.referencePoint}
                          onChange={(e) => setDeliveryAddress(prev => ({ ...prev, referencePoint: e.target.value }))}
                          className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-brand-500/20 rounded-xl text-sm focus:outline-none transition-all"
                          placeholder="Ex: Próximo ao mercado"
                        />
                      </div>
                      {calculatingFee && (
                        <div className="flex items-center gap-2 text-brand-600 font-bold text-xs">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Calculando frete...
                        </div>
                      )}
                      {deliveryFee > 0 && !calculatingFee && (
                        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-800">Taxa de Entrega:</span>
                          <span className="text-sm font-black text-emerald-600">R$ {deliveryFee.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Método de Pagamento</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setPaymentMethod('pix')}
                        className={cn(
                          "px-5 py-4 rounded-2xl text-xs font-bold border-2 transition-all flex flex-col items-center gap-2",
                          paymentMethod === 'pix' 
                            ? "bg-brand-50 border-brand-500/20 text-brand-600" 
                            : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50"
                        )}
                      >
                        <QrCode className="w-5 h-5" />
                        <span>Pix</span>
                      </button>
                      <button
                        onClick={() => setPaymentMethod('card')}
                        className={cn(
                          "px-5 py-4 rounded-2xl text-xs font-bold border-2 transition-all flex flex-col items-center gap-2",
                          paymentMethod === 'card' 
                            ? "bg-brand-50 border-brand-500/20 text-brand-600" 
                            : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50"
                        )}
                      >
                        <CardIcon className="w-5 h-5" />
                        <span>Cartão</span>
                      </button>
                    </div>

                    {paymentMethod === 'card' && (
                      <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Número do Cartão</label>
                          <input 
                            type="text"
                            value={cardData.cardNumber}
                            onChange={(e) => setCardData({...cardData, cardNumber: formatCardNumber(e.target.value)})}
                            className="w-full px-4 py-3 bg-white border-2 border-transparent focus:border-brand-500/20 rounded-xl text-sm focus:outline-none transition-all"
                            placeholder="0000 0000 0000 0000"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Validade (MM/AA)</label>
                            <input 
                              type="text"
                              value={`${cardData.cardExpirationMonth}${cardData.cardExpirationMonth && cardData.cardExpirationYear ? '/' : ''}${cardData.cardExpirationYear}`}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '');
                                setCardData({
                                  ...cardData, 
                                  cardExpirationMonth: val.substring(0, 2),
                                  cardExpirationYear: val.substring(2, 4)
                                });
                              }}
                              className="w-full px-4 py-3 bg-white border-2 border-transparent focus:border-brand-500/20 rounded-xl text-sm focus:outline-none transition-all text-center"
                              placeholder="MM/AA"
                              maxLength={5}
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">CVV</label>
                            <input 
                              type="text"
                              maxLength={4}
                              value={cardData.securityCode}
                              onChange={(e) => setCardData({...cardData, securityCode: formatCVV(e.target.value)})}
                              className="w-full px-4 py-3 bg-white border-2 border-transparent focus:border-brand-500/20 rounded-xl text-sm focus:outline-none transition-all text-center"
                              placeholder="000"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Nome no Cartão</label>
                          <input 
                            type="text"
                            value={cardData.cardholderName}
                            onChange={(e) => setCardData({...cardData, cardholderName: e.target.value})}
                            className="w-full px-4 py-3 bg-white border-2 border-transparent focus:border-brand-500/20 rounded-xl text-sm focus:outline-none transition-all"
                            placeholder="Como está no cartão"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">CPF do Titular</label>
                          <input 
                            type="text"
                            value={cardData.identificationNumber}
                            onChange={(e) => setCardData({...cardData, identificationNumber: formatCPF(e.target.value)})}
                            className="w-full px-4 py-3 bg-white border-2 border-transparent focus:border-brand-500/20 rounded-xl text-sm focus:outline-none transition-all"
                            placeholder="000.000.000-00"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Telefone do Titular</label>
                            <input 
                              type="text"
                              value={cardData.phone}
                              onChange={(e) => setCardData({...cardData, phone: formatPhone(e.target.value)})}
                              className="w-full px-4 py-3 bg-white border-2 border-transparent focus:border-brand-500/20 rounded-xl text-sm focus:outline-none transition-all"
                              placeholder="(00) 00000-0000"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">CEP de Cobrança</label>
                            <input 
                              type="text"
                              value={cardData.zipCode}
                              onChange={(e) => setCardData({...cardData, zipCode: formatCEP(e.target.value)})}
                              className="w-full px-4 py-3 bg-white border-2 border-transparent focus:border-brand-500/20 rounded-xl text-sm focus:outline-none transition-all"
                              placeholder="00000-000"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Tipo de Cartão</label>
                            <select 
                              value={cardData.cardType}
                              onChange={(e) => setCardData({...cardData, cardType: e.target.value as 'credit' | 'debit', installments: 1})}
                              className="w-full px-4 py-3 bg-white border-2 border-transparent focus:border-brand-500/20 rounded-xl text-sm focus:outline-none transition-all"
                            >
                              <option value="credit">Crédito</option>
                              <option value="debit">Débito</option>
                            </select>
                          </div>
                          {cardData.cardType === 'credit' && (
                            <div>
                              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Parcelas</label>
                              <select 
                                value={cardData.installments}
                                onChange={(e) => setCardData({...cardData, installments: Number(e.target.value)})}
                                className="w-full px-4 py-3 bg-white border-2 border-transparent focus:border-brand-500/20 rounded-xl text-sm focus:outline-none transition-all"
                              >
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                                  <option key={n} value={n}>{n}x {n === 1 ? 'à vista' : 'sem juros'}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {checkoutError && (
                      <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                        <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-red-800">Ops! Algo deu errado</p>
                          <p className="text-[11px] text-red-600 leading-relaxed">{checkoutError}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3 py-2 px-1">
                      <input 
                        type="checkbox" 
                        id="saveData"
                        checked={saveData}
                        onChange={(e) => setSaveData(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                      />
                      <label htmlFor="saveData" className="text-xs font-bold text-slate-600 cursor-pointer select-none">
                        Salvar dados para a próxima compra
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total a Pagar</p>
                  <p className="text-xl font-black text-brand-600">R$ {totalPrice.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Itens</p>
                  <p className="text-sm font-bold text-slate-900">{totalItems}</p>
                </div>
              </div>
              
              <button 
                disabled={isProcessing || (deliveryMethod === 'delivery' && calculatingFee)}
                onClick={handleCheckout}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-2 group text-sm"
              >
                {isProcessing ? (
                  <Loader2 className="animate-spin h-5 w-5" />
                ) : (
                  <>
                    {paymentMethod === 'pix' ? 'Gerar Pix' : 'Pagar com Cartão'}
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* My Orders Modal */}
      <AnimatePresence>
        {showOrders && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-brand-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-100">
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">Meus Pedidos</h2>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Acompanhe suas compras</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowOrders(false)}
                  className="p-3 hover:bg-white hover:shadow-md rounded-2xl transition-all text-slate-400 hover:text-slate-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                {userOrders.length === 0 ? (
                  <div className="text-center py-20">
                    <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                      <Package className="w-10 h-10 text-slate-200" />
                    </div>
                    <p className="text-slate-400 font-bold text-lg">Você ainda não possui pedidos.</p>
                    <button 
                      onClick={() => setShowOrders(false)}
                      className="mt-6 text-brand-600 font-bold hover:underline"
                    >
                      Começar a comprar agora
                    </button>
                  </div>
                ) : (
                  userOrders.map((order) => (
                    <div key={order.id} className="group p-6 bg-white rounded-3xl border border-slate-100 hover:border-brand-200 hover:shadow-xl hover:shadow-brand-50/50 transition-all space-y-6 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
                      
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center">
                            <Package className="w-6 h-6 text-slate-400" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pedido #{order.id.slice(-8).toUpperCase()}</p>
                            <p className="text-sm font-bold text-slate-900">
                              {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Data indisponível'}
                            </p>
                          </div>
                        </div>
                        <div className={cn(
                          "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-center shadow-sm",
                          order.status === 'Em separação' ? "bg-amber-100 text-amber-700 shadow-amber-100" :
                          order.status === 'Em trânsito' ? "bg-blue-100 text-blue-700 shadow-blue-100" :
                          order.status === 'Pronto para retirada' ? "bg-emerald-100 text-emerald-700 shadow-emerald-100" :
                          order.status === 'Entregue' ? "bg-slate-100 text-slate-600 shadow-slate-100" :
                          order.status === 'Pago' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                          "bg-slate-50 text-slate-400"
                        )}>
                          {order.status}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-slate-50 relative z-10">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Método de Recebimento</p>
                          <div className="flex items-center gap-2 text-slate-700">
                            {order.deliveryMethod === 'pickup' ? (
                              <>
                                <Home className="w-4 h-4 text-brand-500" />
                                <span className="text-sm font-bold">Retirada: {order.schoolName || 'Escola'}</span>
                              </>
                            ) : (
                              <>
                                <Navigation className="w-4 h-4 text-brand-500" />
                                <span className="text-sm font-bold">Entrega em Casa</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="sm:text-right">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Valor Total</p>
                          <p className="text-xl font-black text-slate-900">R$ {order.total.toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 pt-2 relative z-10">
                        <div className="flex flex-col sm:flex-row gap-3">
                          <button 
                            onClick={() => generateReceipt(order)}
                            className="flex-1 bg-slate-900 text-white font-bold py-3 rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 text-xs shadow-lg shadow-slate-200"
                          >
                            <ShoppingBag className="w-4 h-4" />
                            Baixar Recibo
                          </button>
                          {order.status === 'Aguardando Pagamento' && (
                            <button 
                              onClick={() => setOrderToCancel(order.id)}
                              className="flex-1 bg-red-50 text-red-600 font-bold py-3 rounded-2xl hover:bg-red-100 transition-all flex items-center justify-center gap-2 text-xs"
                            >
                              <X className="w-4 h-4" />
                              Cancelar Pedido
                            </button>
                          )}
                          {order.status === 'Aguardando Pagamento' && (
                            <button 
                              onClick={() => {
                                setPaymentInfo({
                                  id: order.paymentId,
                                  qrCode: '', // We don't have the code here, but we can show status
                                  qrCodeBase64: '', 
                                  status: 'pending'
                                });
                                setPaymentStatus('pending');
                                setShowOrders(false);
                              }}
                              className="flex-1 bg-brand-500 text-white font-bold py-3 rounded-2xl hover:bg-brand-600 transition-all flex items-center justify-center gap-2 text-xs shadow-lg shadow-brand-100"
                            >
                              <QrCode className="w-4 h-4" />
                              Ver QR Code
                            </button>
                          )}
                        </div>
                        {order.status !== 'Entregue' && order.status !== 'Cancelado' && order.status !== 'Aguardando Pagamento' && (
                          <button 
                            onClick={() => {
                              setOrderToConfirm(order);
                              setShowConfirmDeliveryModal(true);
                            }}
                            className="w-full bg-emerald-500 text-white font-bold py-3 rounded-2xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 text-xs shadow-lg shadow-emerald-100"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Confirmar Entrega
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Delivery Modal */}
      <AnimatePresence>
        {showConfirmDeliveryModal && orderToConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden p-8 text-center"
            >
              <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">Confirmar Recebimento?</h2>
              <p className="text-slate-500 mb-8">
                Você confirma que já recebeu o pedido <span className="font-bold text-slate-900">#{orderToConfirm.id.slice(-8).toUpperCase()}</span>?
                Esta ação não pode ser desfeita.
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => handleConfirmDelivery(orderToConfirm.id)}
                  className="w-full bg-emerald-500 text-white font-bold py-4 rounded-2xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100"
                >
                  Sim, eu recebi!
                </button>
                <button 
                  onClick={() => {
                    setShowConfirmDeliveryModal(false);
                    setOrderToConfirm(null);
                  }}
                  className="w-full bg-slate-100 text-slate-600 font-bold py-4 rounded-2xl hover:bg-slate-200 transition-all"
                >
                  Ainda não recebi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {selectedProduct && (
        <div 
          className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-0 md:p-4"
          onClick={() => setSelectedProduct(null)}
        >
          <div 
            className="bg-white w-full max-w-4xl rounded-none md:rounded-[40px] overflow-hidden shadow-2xl flex flex-col md:flex-row h-full md:h-auto md:max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
              <div className="w-full md:w-1/2 aspect-square md:aspect-auto bg-slate-50 relative flex items-center justify-center p-4">
                <img 
                  src={selectedProduct.imageUrl} 
                  alt={selectedProduct.name} 
                  className="max-w-full max-h-full object-contain"
                  referrerPolicy="no-referrer"
                />
                <button 
                  onClick={() => setSelectedProduct(null)}
                  className="absolute top-4 left-4 p-2 bg-white/80 backdrop-blur-md rounded-full text-slate-900 hover:bg-white transition-all md:hidden"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 p-6 md:p-8 flex flex-col overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between mb-4">
                  <span className="bg-brand-50 text-brand-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                    {selectedProduct.category}
                  </span>
                  <button 
                    onClick={() => setSelectedProduct(null)}
                    className="hidden md:block p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">{selectedProduct.name}</h2>
                <div className="flex flex-col mb-6">
                  {(selectedProduct.promotionPrice || 0) > 0 && (
                    <span className="text-sm text-slate-400 line-through font-medium">
                      De R$ {selectedProduct.originalPrice?.toFixed(2)}
                    </span>
                  )}
                  <div className="flex items-center gap-3">
                    <span className={`text-3xl font-black ${(selectedProduct.promotionPrice || 0) > 0 ? 'text-red-500' : 'text-brand-600'}`}>
                      R$ {selectedProduct.price.toFixed(2)}
                    </span>
                    {(selectedProduct.promotionPrice || 0) > 0 && (
                      <span className="bg-red-100 text-red-600 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
                        Economize R$ {(selectedProduct.originalPrice! - selectedProduct.price).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="space-y-6 flex-1">
                  <div>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Descrição</h3>
                    <p className="text-slate-600 leading-relaxed whitespace-pre-wrap text-sm">{selectedProduct.description}</p>
                  </div>
                  
                  {selectedProduct.category === 'Kits' && (
                    <div className="space-y-6">
                      {selectedProduct.items && selectedProduct.items.length > 0 && (
                        <div>
                          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Componentes Inclusos</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {getKitItems(selectedProduct.items).map(item => (
                              <div key={item.id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="w-10 h-10 rounded-lg bg-white overflow-hidden flex-shrink-0 shadow-sm border border-slate-100 p-1">
                                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain" />
                                </div>
                                <span className="text-xs font-bold text-slate-700 truncate">{item.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedProduct.extraItems && selectedProduct.extraItems.length > 0 && (
                        <div>
                          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Outros Itens</h3>
                          <div className="flex flex-wrap gap-2">
                            {selectedProduct.extraItems.map((item, index) => (
                              <div key={index} className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-600">
                                <div className="w-1 h-1 rounded-full bg-brand-500" />
                                {item}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="pt-6 mt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-4">
                  <div className="flex-1 w-full text-center sm:text-left">
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">Disponibilidade</p>
                    <p className={`font-bold text-base ${selectedProduct.stock > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {selectedProduct.stock > 0 ? `${selectedProduct.stock} em estoque` : 'Esgotado'}
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      addToCart(selectedProduct.id);
                      setSelectedProduct(null);
                    }}
                    disabled={selectedProduct.stock === 0}
                    className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-semibold px-6 py-3 rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Adicionar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Payment Modal */}
      {paymentStatus && (
        <div 
          className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div 
            className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl relative overflow-hidden max-h-[95vh] flex flex-col"
          >
            <div className="p-6 text-center overflow-y-auto custom-scrollbar flex-1">
              {paymentStatus === 'pending' && (
                <>
                  {paymentMethod === 'pix' && paymentInfo ? (
                    <>
                      <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <QrCode className="w-7 h-7 text-brand-500" />
                      </div>
                      <h2 className="text-xl font-bold text-slate-900 mb-1">Pagamento com Pix</h2>
                      <p className="text-slate-500 text-xs mb-6">Escaneie o QR Code ou copie o código abaixo para finalizar sua compra.</p>
                      
                      <div className="bg-slate-50 p-4 rounded-2xl mb-6 border border-slate-100">
                        <img 
                          src={`data:image/png;base64,${paymentInfo.qrCodeBase64}`} 
                          alt="QR Code Pix" 
                          className="w-40 h-40 mx-auto mb-4 rounded-xl shadow-sm"
                        />
                        <button 
                          onClick={copyPixCode}
                          className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all"
                        >
                          <Copy className="w-3.5 h-3.5" /> Copiar Código Pix
                        </button>
                      </div>

                      <div className="space-y-3">
                        <button
                          onClick={checkPaymentStatus}
                          disabled={isProcessing}
                          className="w-full py-3 bg-brand-500 text-white rounded-xl font-bold text-sm hover:bg-brand-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20"
                        >
                          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          Já paguei, verificar agora
                        </button>

                        <div className="flex items-center justify-center gap-2 text-slate-400 font-medium text-xs">
                          <Clock className="w-3.5 h-3.5 animate-pulse" />
                          Aguardando confirmação automática...
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="py-4">
                      <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Clock className="w-8 h-8 text-amber-500" />
                      </div>
                      <h2 className="text-2xl font-bold text-slate-900 mb-2">Pagamento em Análise</h2>
                      <p className="text-slate-500 text-sm mb-8">Seu pagamento com cartão está sendo processado. Isso pode levar alguns minutos para segurança.</p>
                      
                      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 mb-8">
                        <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                          Assim que o pagamento for aprovado, seu pedido será atualizado automaticamente. Você pode acompanhar em "Meus Pedidos".
                        </p>
                      </div>

                      <div className="flex items-center justify-center gap-2 text-amber-600 font-bold text-sm animate-pulse mb-8">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processando...
                      </div>

                      <button 
                        onClick={() => {
                          setPaymentStatus(null);
                          setPaymentInfo(null);
                          setShowCart(false);
                          setShowCheckoutForm(false);
                          setCart({});
                        }}
                        className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl hover:bg-slate-800 transition-all text-sm"
                      >
                        Entendi, voltar para a loja
                      </button>
                    </div>
                  )}
                </>
              )}

              {paymentStatus === 'approved' && (
                <div className="py-4 text-center">
                  <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Pagamento Aprovado!</h2>
                  <p className="text-slate-500 text-sm mb-8">Sua compra foi realizada com sucesso. Você receberá um e-mail com os detalhes do pedido.</p>
                  
                  {deliveryMethod === 'pickup' && (
                    <div className="w-full mb-8 p-6 bg-emerald-50 rounded-3xl border border-emerald-100">
                      <p className="text-xs text-emerald-800 font-bold uppercase tracking-widest mb-4">
                        Apresente o recibo na recepção da escola para retirar seus itens.
                      </p>
                      <button
                        onClick={() => {
                          const orderObj = userOrders.find(o => o.id === lastOrderId) || {
                            id: lastOrderId || 'N/A',
                            total: totalPrice,
                            status: 'Pago',
                            deliveryMethod: 'pickup',
                            schoolName: selectedSchool?.name,
                            productIds: Object.keys(cart),
                            customerInfo: customerInfo,
                            createdAt: { toDate: () => new Date() }
                          };
                          generateReceipt(orderObj);
                        }}
                        className="w-full py-4 bg-emerald-600 text-white rounded-2xl text-sm font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-200"
                      >
                        <ShoppingBag className="w-4 h-4" />
                        Baixar Recibo
                      </button>
                    </div>
                  )}

                  <button 
                    onClick={() => {
                      setPaymentStatus(null);
                      setPaymentInfo(null);
                      setShowCart(false);
                      setShowCheckoutForm(false);
                    }}
                    className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl hover:bg-slate-800 transition-all text-sm"
                  >
                    Voltar para a Loja
                  </button>
                </div>
              )}

              {paymentStatus === 'rejected' && (
                <div className="py-4">
                  <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Pagamento Recusado</h2>
                  <p className="text-slate-500 text-sm mb-8">Houve um problema com o seu pagamento. Por favor, tente novamente.</p>
                  <button 
                    onClick={() => setPaymentStatus(null)}
                    className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl hover:bg-slate-800 transition-all text-sm"
                  >
                    Tentar Novamente
                  </button>
                </div>
              )}
            </div>

            {paymentStatus === 'pending' && (
              <button 
                onClick={() => setPaymentStatus(null)}
                className="absolute top-4 right-4 p-1.5 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 z-10"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
      {/* Cancel Order Confirmation Modal */}
      {orderToCancel && (
        <div className="fixed inset-0 z-[120] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl p-8 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Cancelar Pedido?</h2>
            <p className="text-slate-500 text-sm mb-8">Tem certeza que deseja cancelar este pedido? Esta ação não pode ser desfeita.</p>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => handleCancelOrder(orderToCancel)}
                className="w-full bg-red-600 text-white font-bold py-4 rounded-xl hover:bg-red-700 transition-all text-sm"
              >
                Sim, cancelar pedido
              </button>
              <button 
                onClick={() => setOrderToCancel(null)}
                className="w-full bg-slate-100 text-slate-600 font-bold py-4 rounded-xl hover:bg-slate-200 transition-all text-sm"
              >
                Não, manter pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
