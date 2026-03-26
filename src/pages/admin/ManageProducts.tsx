import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { ShoppingBag, Plus, Edit2, Trash2, X, Save, Package, DollarSign, AlertTriangle } from 'lucide-react';

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

export default function ManageProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'Componentes',
    price: 0,
    originalPrice: 0,
    promotionPrice: 0,
    stock: 0,
    imageUrl: '',
    items: [] as string[],
    extraItems: [] as string[],
  });

  const categories = ['Componentes', 'Kits', 'Ferramentas', 'Acessórios'];

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'products'));
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'products');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        description: product.description,
        category: product.category || 'Componentes',
        price: product.price,
        originalPrice: product.originalPrice || product.price,
        promotionPrice: product.promotionPrice || 0,
        stock: product.stock,
        imageUrl: product.imageUrl,
        items: product.items || [],
        extraItems: product.extraItems || [],
      });
    } else {
      setEditingProduct(null);
      setFormData({ 
        name: '', 
        description: '', 
        category: 'Componentes', 
        price: 0, 
        originalPrice: 0,
        promotionPrice: 0,
        stock: 0, 
        imageUrl: '', 
        items: [], 
        extraItems: [] 
      });
    }
    setIsModalOpen(true);
  };

  const toggleItem = (productId: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.includes(productId)
        ? prev.items.filter(id => id !== productId)
        : [...prev.items, productId]
    }));
  };

  const addExtraItem = (text: string) => {
    if (!text.trim()) return;
    setFormData(prev => ({
      ...prev,
      extraItems: [...prev.extraItems, text.trim()]
    }));
  };

  const removeExtraItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      extraItems: prev.extraItems.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // If promotionPrice is set and > 0, the actual price is the promotionPrice
      const finalPrice = formData.promotionPrice > 0 ? formData.promotionPrice : formData.originalPrice;
      const dataToSave = {
        ...formData,
        price: finalPrice
      };

      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), dataToSave);
      } else {
        await addDoc(collection(db, 'products'), dataToSave);
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (err) {
      handleFirestoreError(err, editingProduct ? OperationType.UPDATE : OperationType.CREATE, 'products');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmation) return;
    
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'products', deleteConfirmation.id));
      setDeleteConfirmation(null);
      fetchProducts();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `products/${deleteConfirmation.id}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Gerenciar Loja 🛒</h1>
          <p className="text-slate-500">Controle o estoque e preços dos componentes.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 px-6 rounded-2xl transition-all shadow-lg shadow-brand-100 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" /> Novo Produto
        </button>
      </header>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Produto</th>
              <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Preço</th>
              <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-widest">Estoque</th>
              <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {products.map((product) => (
              <tr key={product.id} className="hover:bg-slate-50 transition-colors group">
                <td className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center overflow-hidden">
                      <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{product.name}</p>
                      <p className="text-xs text-slate-400 line-clamp-1">{product.description}</p>
                    </div>
                  </div>
                </td>
                <td className="p-6 font-bold text-brand-600">R$ {product.price.toFixed(2)}</td>
                <td className="p-6">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                    product.stock > 10 ? 'bg-brand-50 text-brand-600' : 'bg-red-50 text-red-600'
                  }`}>
                    {product.stock} Unidades
                  </span>
                </td>
                <td className="p-6 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button 
                      onClick={() => handleOpenModal(product)}
                      className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setDeleteConfirmation(product)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products.length === 0 && !isLoading && (
          <div className="p-12 text-center text-slate-400 italic">Nenhum produto cadastrado.</div>
        )}
      </div>

      {deleteConfirmation && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full">
            <div className="flex items-center gap-4 text-red-500 mb-6">
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Excluir Produto?</h2>
                <p className="text-sm text-slate-500">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            
            <p className="text-slate-600 mb-8">
              Você está prestes a excluir o produto <span className="font-bold text-slate-900">"{deleteConfirmation.name}"</span>.
            </p>
            
            <div className="flex gap-4">
              <button 
                disabled={isDeleting}
                onClick={() => setDeleteConfirmation(null)}
                className="flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-2xl hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button 
                disabled={isDeleting}
                onClick={handleDelete}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-2xl transition-all shadow-lg shadow-red-100 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                ) : (
                  <>Excluir Agora</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-slate-900">
                {editingProduct ? 'Editar Produto' : 'Novo Produto'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nome do Produto</label>
                  <input 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                    placeholder="Ex: Kit Arduino Uno"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Categoria</label>
                  <select 
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">URL da Imagem</label>
                <input 
                  required
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Descrição</label>
                <textarea 
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                  placeholder="Descreva o produto e o que vem no kit..."
                />
              </div>

              {formData.category === 'Kits' && (
                <div className="space-y-4 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-5 h-5 text-brand-500" />
                    <h3 className="font-bold text-slate-900">Itens do Kit</h3>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">Selecione os componentes, ferramentas e acessórios que compõem este kit.</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {products
                      .filter(p => p.id !== editingProduct?.id && p.category !== 'Kits')
                      .map(product => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => toggleItem(product.id)}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                            formData.items.includes(product.id)
                              ? 'bg-brand-50 border-brand-200 text-brand-700'
                              : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            formData.items.includes(product.id)
                              ? 'bg-brand-500 border-brand-500'
                              : 'bg-white border-slate-300'
                          }`}>
                            {formData.items.includes(product.id) && (
                              <div className="w-2 h-2 bg-white rounded-full" />
                            )}
                          </div>
                          <span className="text-sm font-medium truncate">{product.name}</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {formData.category === 'Kits' && (
                <div className="space-y-4 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Plus className="w-5 h-5 text-brand-500" />
                    <h3 className="font-bold text-slate-900">Itens Extras (Texto)</h3>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">Adicione itens que não estão cadastrados como produtos (ex: parafusos, cabos, etc).</p>
                  
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      id="extra-item-input"
                      placeholder="Nome do item extra..."
                      className="flex-1 p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const input = e.currentTarget;
                          addExtraItem(input.value);
                          input.value = '';
                        }
                      }}
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        const input = document.getElementById('extra-item-input') as HTMLInputElement;
                        addExtraItem(input.value);
                        input.value = '';
                      }}
                      className="bg-brand-500 text-white p-3 rounded-xl hover:bg-brand-600 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {formData.extraItems.map((item, index) => (
                      <div key={index} className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-full text-sm font-medium text-slate-600">
                        {item}
                        <button 
                          type="button"
                          onClick={() => removeExtraItem(index)}
                          className="text-slate-400 hover:text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Preço Original (R$)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      required
                      type="number"
                      step="0.01"
                      value={isNaN(formData.originalPrice || 0) ? '' : (formData.originalPrice || 0)}
                      onChange={(e) => setFormData({ ...formData, originalPrice: parseFloat(e.target.value) })}
                      className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Preço Promoção (R$)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="number"
                      step="0.01"
                      value={isNaN(formData.promotionPrice || 0) ? '' : (formData.promotionPrice || 0)}
                      onChange={(e) => setFormData({ ...formData, promotionPrice: parseFloat(e.target.value) })}
                      className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                      placeholder="Opcional"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Estoque Inicial</label>
                  <div className="relative">
                    <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      required
                      type="number"
                      value={isNaN(formData.stock) ? '' : formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) })}
                      className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-2xl hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 rounded-2xl transition-all shadow-lg shadow-brand-100 flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" /> Salvar Produto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
