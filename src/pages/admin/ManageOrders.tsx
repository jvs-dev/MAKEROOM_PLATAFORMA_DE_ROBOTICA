import { useEffect, useState } from 'react';
import { collection, getDocs, updateDoc, doc, getDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { ShoppingBag, User, Package, Clock, CheckCircle, Truck, ChevronRight, X, MapPin, Phone, CreditCard, Info, ExternalLink, Calendar, School } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { sendNotification } from '../../services/notificationService';

interface Order {
  id: string;
  userId: string;
  userEmail: string;
  productIds: string[];
  total: number;
  status: 'Aguardando Pagamento' | 'Pago' | 'Em separação' | 'Em trânsito' | 'Pronto para retirada' | 'Entregue' | 'Cancelado' | 'pending' | 'delivered' | 'approved' | 'rejected';
  createdAt: any;
  userName?: string;
  productNames?: string[];
  deliveryMethod: 'pickup' | 'delivery';
  deliveryFee: number;
  customerInfo?: {
    name: string;
    cpf: string;
    phone: string;
  };
  deliveryAddress?: {
    cep: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  schoolId?: string;
  schoolName?: string;
}

export default function ManageOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'orders'));
      const ordersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      
      // Sort in memory to avoid index requirement
      const sortedOrders = [...ordersList].sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      
      // Fetch user names and product names
      const enrichedOrders = await Promise.all(sortedOrders.map(async (order) => {
        // Use userEmail as the document ID for users collection
        const userDoc = await getDoc(doc(db, 'users', order.userEmail || order.userId));
        const products = await Promise.all((order.productIds || []).map(async (pid) => {
          const productDoc = await getDoc(doc(db, 'products', pid));
          return productDoc.exists() ? productDoc.data().name : 'Produto Desconhecido';
        }));

        return {
          ...order,
          userName: userDoc.exists() ? userDoc.data().name : 'Usuário Desconhecido',
          productNames: products,
        };
      }));

      setOrders(enrichedOrders);
    } catch (err) {
      console.error("Error fetching orders:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const orderRef = doc(db, 'orders', id);
      const orderDoc = await getDoc(orderRef);
      const orderData = orderDoc.data();

      await updateDoc(orderRef, { status: newStatus });
      
      if (orderData && (orderData.userId || orderData.userEmail)) {
        const recipientId = orderData.userId; // Prefer UID
        let message = `O status do seu pedido #${id.slice(-6)} foi atualizado para: ${newStatus}.`;
        let title = 'Atualização no seu Pedido! 📦';

        if (newStatus === 'Pago') {
          title = 'Pagamento Confirmado! ✅';
          message = `Recebemos seu pagamento do pedido #${id.slice(-6)}. Estamos preparando tudo!`;
        } else if (newStatus === 'Em trânsito') {
          title = 'Pedido a Caminho! 🚚';
          message = `Seu pedido #${id.slice(-6)} saiu para entrega. Fique atento!`;
        } else if (newStatus === 'Pronto para retirada') {
          title = 'Pronto para Retirada! 🏫';
          message = `Seu pedido #${id.slice(-6)} já está disponível para retirada na escola ${orderData.schoolName || ''}.`;
        } else if (newStatus === 'Entregue') {
          title = 'Pedido Entregue! 🎉';
          message = `Seu pedido #${id.slice(-6)} foi marcado como entregue. Esperamos que goste!`;
        }

        await sendNotification(recipientId || orderData.userEmail, title, message);
      }

      fetchOrders();
    } catch (err) {
      console.error(err);
    }
  };

  const statusOptions = [
    'Aguardando Pagamento',
    'Pago',
    'Em separação',
    'Em trânsito',
    'Pronto para retirada',
    'Entregue',
    'Cancelado'
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Gerenciar Pedidos 📦</h1>
          <p className="text-slate-500 dark:text-slate-400">Controle as entregas dos componentes comprados na loja.</p>
        </div>
        <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 p-2 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm transition-colors">
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-500/10 rounded-xl">
            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">Pendentes</p>
            <p className="text-xl font-black text-amber-700 dark:text-amber-300">{orders.filter(o => o.status !== 'Entregue' && o.status !== 'Cancelado').length}</p>
          </div>
          <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl">
            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Entregues</p>
            <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">{orders.filter(o => o.status === 'Entregue').length}</p>
          </div>
        </div>
      </header>

      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-slate-100 dark:border-white/10 overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/10">
                <th className="p-6 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Pedido / Aluno</th>
                <th className="p-6 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Método</th>
                <th className="p-6 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total</th>
                <th className="p-6 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Status</th>
                <th className="p-6 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
              {orders.map((order) => {
                const isActive = !['Cancelado', 'Entregue', 'Pronto para retirada'].includes(order.status);
                return (
                  <tr 
                    key={order.id} 
                    className={`transition-colors group ${
                      isActive 
                        ? 'bg-amber-50/40 dark:bg-amber-500/[0.05] hover:bg-amber-50/60 dark:hover:bg-amber-500/[0.08]' 
                        : 'hover:bg-slate-50/50 dark:hover:bg-white/5'
                    }`}
                  >
                    <td className={`p-6 ${isActive ? 'border-l-4 border-amber-500' : ''}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all ${
                          isActive ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-slate-100 dark:bg-white/10 text-slate-400 dark:text-slate-500 group-hover:bg-white dark:group-hover:bg-zinc-800 group-hover:shadow-sm'
                        }`}>
                          <User className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 dark:text-white truncate">
                            {order.userName || order.customerInfo?.name}
                            {isActive && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 uppercase tracking-tighter">
                                Pendente
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-brand-500 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10 px-1.5 py-0.5 rounded uppercase tracking-widest">#{order.id.slice(-6)}</span>
                            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">{order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : ''}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                  <td className="p-6">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        {order.deliveryMethod === 'pickup' ? (
                          <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 rounded-lg text-xs font-bold uppercase tracking-widest">
                            <School className="w-3 h-3" /> Retirada
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-2 py-1 rounded-lg text-xs font-bold uppercase tracking-widest">
                            <Truck className="w-3 h-3" /> Entrega
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-medium truncate max-w-[120px]">
                        {order.deliveryMethod === 'pickup' ? order.schoolName : `${order.deliveryAddress?.street}, ${order.deliveryAddress?.number}`}
                      </p>
                    </div>
                  </td>
                  <td className="p-6">
                    <p className="font-bold text-slate-900 dark:text-white">R$ {order.total.toFixed(2)}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">{order.productIds.length} Itens</p>
                  </td>
                  <td className="p-6">
                    <select 
                      value={order.status}
                      onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest border-2 border-transparent focus:outline-none focus:border-brand-500/20 transition-all cursor-pointer",
                        order.status === 'Entregue' ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400" :
                        order.status === 'Pago' ? "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400" :
                        order.status === 'Cancelado' ? "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400" :
                        order.status === 'Aguardando Pagamento' ? "bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400" :
                        "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400"
                      )}
                    >
                      {statusOptions.map(opt => (
                        <option key={opt} value={opt} className="dark:bg-zinc-800">{opt}</option>
                      ))}
                      {!statusOptions.includes(order.status) && (
                        <option value={order.status} className="dark:bg-zinc-800">{order.status}</option>
                      )}
                    </select>
                  </td>
                  <td className="p-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => setSelectedOrder(order)}
                        className="p-3 text-slate-400 dark:text-slate-500 hover:text-brand-500 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-xl transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="Ver Detalhes"
                      >
                        <Info className="w-5 h-5" />
                      </button>
                      {order.status !== 'Entregue' && order.status !== 'Cancelado' && (
                        <button 
                          onClick={() => handleUpdateStatus(order.id, 'Entregue')}
                          className="bg-brand-500 text-white p-2 rounded-xl hover:bg-brand-600 transition-colors shadow-sm shadow-brand-100 dark:shadow-none"
                          title="Marcar como Entregue"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
        {orders.length === 0 && !isLoading && (
          <div className="p-20 text-center">
            <div className="w-16 h-16 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-8 h-8 text-slate-200 dark:text-slate-700" />
            </div>
            <p className="text-slate-400 dark:text-slate-500 font-medium">Nenhum pedido realizado ainda.</p>
          </div>
        )}
      </div>

      {/* Details Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-zinc-900 rounded-[32px] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-100 dark:border-white/10 transition-colors"
            >
              <div className="p-6 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-white/5 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center shadow-lg shadow-brand-100 dark:shadow-none">
                    <Package className="text-white w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Detalhes do Pedido</h2>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">#{selectedOrder.id.slice(-6)}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedOrder(null)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
                {/* Customer Info */}
                <section>
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <User className="w-3 h-3" /> Informações do Cliente
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5 transition-colors">
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-1">Nome Completo</p>
                      <p className="text-sm text-slate-900 dark:text-white font-bold">{selectedOrder.customerInfo?.name || selectedOrder.userName}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5 transition-colors">
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-1">Telefone de Contato</p>
                      <p className="text-sm text-slate-900 dark:text-white font-bold flex items-center gap-2">
                        <Phone className="w-3 h-3 text-brand-500 dark:text-brand-400" />
                        {selectedOrder.customerInfo?.phone || 'Não informado'}
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5 transition-colors">
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-1">CPF</p>
                      <p className="text-sm text-slate-900 dark:text-white font-bold">{selectedOrder.customerInfo?.cpf || 'Não informado'}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5 transition-colors">
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-1">Email</p>
                      <p className="text-sm text-slate-900 dark:text-white font-bold truncate">{selectedOrder.userEmail}</p>
                    </div>
                  </div>
                </section>

                {/* Delivery Info */}
                <section>
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <MapPin className="w-3 h-3" /> Local de Entrega / Retirada
                  </h3>
                  <div className="bg-brand-950 dark:bg-zinc-950 p-6 rounded-[2rem] text-white relative overflow-hidden transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <MapPin className="w-24 h-24" />
                    </div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          selectedOrder.deliveryMethod === 'pickup' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-rose-500/20 text-rose-300'
                        }`}>
                          {selectedOrder.deliveryMethod === 'pickup' ? 'Retirada na Escola' : 'Entrega no Endereço'}
                        </span>
                      </div>
                      
                      {selectedOrder.deliveryMethod === 'pickup' ? (
                        <div className="space-y-2">
                          <p className="text-2xl font-bold">{selectedOrder.schoolName}</p>
                          <p className="text-slate-400 text-sm">O material deve ser deixado na secretaria desta escola.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xl font-bold">{selectedOrder.deliveryAddress?.street}, {selectedOrder.deliveryAddress?.number}</p>
                          <p className="text-slate-400 text-sm">
                            {selectedOrder.deliveryAddress?.neighborhood}, {selectedOrder.deliveryAddress?.city} - {selectedOrder.deliveryAddress?.state}
                          </p>
                          <p className="text-slate-400 text-sm">CEP: {selectedOrder.deliveryAddress?.cep}</p>
                          {selectedOrder.deliveryAddress?.complement && (
                            <p className="text-brand-400 text-xs font-bold mt-2">Complemento: {selectedOrder.deliveryAddress.complement}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                {/* Order Items */}
                <section>
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <ShoppingBag className="w-3 h-3" /> Itens do Pedido
                  </h3>
                  <div className="space-y-2">
                    {selectedOrder.productNames?.map((name, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-white dark:bg-white/10 rounded-lg flex items-center justify-center shadow-sm dark:shadow-none">
                            <Package className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                          </div>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{name}</p>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-200 dark:bg-white/10 px-2 py-1 rounded-lg">1x</span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Payment Summary */}
                <section className="bg-brand-50 dark:bg-brand-500/10 p-6 rounded-[2rem] border-2 border-brand-100 dark:border-brand-500/20 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-widest flex items-center gap-2">
                      <CreditCard className="w-3 h-3" /> Resumo Financeiro
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      selectedOrder.status === 'Pago' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                    }`}>
                      {selectedOrder.status}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-brand-600/60 dark:text-brand-400/60 font-medium">Subtotal</span>
                      <span className="text-brand-900 dark:text-white font-bold">R$ {(selectedOrder.total - selectedOrder.deliveryFee).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-brand-600/60 dark:text-brand-400/60 font-medium">Taxa de Entrega</span>
                      <span className="text-brand-900 dark:text-white font-bold">R$ {selectedOrder.deliveryFee.toFixed(2)}</span>
                    </div>
                    <div className="pt-2 mt-2 border-t border-brand-200 dark:border-brand-500/20 flex justify-between items-center">
                      <span className="text-brand-900 dark:text-brand-200 font-black uppercase tracking-widest text-xs">Total Geral</span>
                      <span className="text-2xl font-black text-brand-900 dark:text-white">R$ {selectedOrder.total.toFixed(2)}</span>
                    </div>
                  </div>
                </section>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-white/5 border-t border-slate-100 dark:border-white/10 flex gap-3 transition-colors">
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="flex-1 px-6 py-3 bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 font-bold rounded-2xl hover:bg-slate-100 dark:hover:bg-white/20 transition-colors"
                >
                  Fechar
                </button>
                {selectedOrder.status !== 'Entregue' && selectedOrder.status !== 'Cancelado' && (
                  <button
                    onClick={() => {
                      handleUpdateStatus(selectedOrder.id, 'Entregue');
                      setSelectedOrder(null);
                    }}
                    className="flex-[2] px-6 py-3 bg-brand-500 text-white font-bold rounded-2xl hover:bg-brand-600 transition-colors shadow-lg shadow-brand-100 dark:shadow-none flex items-center justify-center gap-2"
                  >
                    <Truck className="w-5 h-5" /> Marcar como Entregue
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
