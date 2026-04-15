import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { FileText, Plus, Edit2, Trash2, X, Save, Users, Search, Folder, ChevronLeft, Link as LinkIcon, ExternalLink, FolderPlus } from 'lucide-react';

interface Note {
  id: string;
  title: string;
  content: string;
  teamId?: string;
  folderId?: string | null;
  links?: string[];
}

interface FolderType {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
}

export default function ProjectNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [folderName, setFolderName] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    teamId: '',
    folderId: null as string | null,
    links: [] as string[],
  });
  const [newLink, setNewLink] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    const notesSnapshot = await getDocs(collection(db, 'notes'));
    setNotes(notesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note)));
    
    const foldersSnapshot = await getDocs(collection(db, 'folders'));
    setFolders(foldersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FolderType)));

    const teamsSnapshot = await getDocs(collection(db, 'teams'));
    setTeams(teamsSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    setIsLoading(false);
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;
    try {
      await addDoc(collection(db, 'folders'), { name: folderName });
      setFolderName('');
      setIsFolderModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteFolder = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'folders', id));
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenModal = (note?: Note) => {
    if (note) {
      setEditingNote(note);
      setFormData({
        title: note.title,
        content: note.content,
        teamId: note.teamId || '',
        folderId: note.folderId || currentFolderId,
        links: note.links || [],
      });
    } else {
      setEditingNote(null);
      setFormData({ 
        title: '', 
        content: '', 
        teamId: '', 
        folderId: currentFolderId,
        links: [],
      });
    }
    setIsModalOpen(true);
  };

  const addLink = () => {
    if (newLink && !formData.links.includes(newLink)) {
      setFormData({ ...formData, links: [...formData.links, newLink] });
      setNewLink('');
    }
  };

  const removeLink = (linkToRemove: string) => {
    setFormData({ ...formData, links: formData.links.filter(l => l !== linkToRemove) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingNote) {
        await updateDoc(doc(db, 'notes', editingNote.id), formData);
      } else {
        await addDoc(collection(db, 'notes'), formData);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notes', id));
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         note.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFolder = note.folderId === currentFolderId;
    return matchesSearch && matchesFolder;
  });

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Banco de Projetos 📂</h1>
          <p className="text-slate-500">Anotações internas sobre projetos e aulas presenciais.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsFolderModalOpen(true)}
            className="bg-white border border-slate-200 text-slate-600 font-bold py-3 px-6 rounded-2xl hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <FolderPlus className="w-5 h-5" /> Nova Pasta
          </button>
          <button 
            onClick={() => handleOpenModal()}
            className="bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 px-6 rounded-2xl transition-all shadow-lg shadow-brand-100 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> Nova Anotação
          </button>
        </div>
      </header>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar for Folders */}
        <aside className="w-full md:w-64 space-y-4">
          <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 px-2">Pastas</h2>
            <nav className="space-y-1">
              <button
                onClick={() => setCurrentFolderId(null)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  currentFolderId === null ? 'bg-brand-50 text-brand-600' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <FileText className="w-4 h-4" />
                Todas as Notas
              </button>
              {folders.map(folder => (
                <div key={folder.id} className="group relative">
                  <button
                    onClick={() => setCurrentFolderId(folder.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                      currentFolderId === folder.id ? 'bg-brand-50 text-brand-600' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Folder className="w-4 h-4" />
                    <span className="truncate">{folder.name}</span>
                  </button>
                  <button
                    onClick={(e) => handleDeleteFolder(folder.id, e)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 space-y-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text"
              placeholder="Pesquisar anotações..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-4 pl-12 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all"
            />
          </div>

          {currentFolderId && (
            <div className="flex items-center gap-2 text-slate-400">
              <button 
                onClick={() => setCurrentFolderId(null)}
                className="hover:text-brand-600 flex items-center gap-1 text-sm font-bold"
              >
                <ChevronLeft className="w-4 h-4" /> Voltar
              </button>
              <span className="text-slate-300">/</span>
              <span className="text-slate-600 font-bold text-sm">
                {folders.find(f => f.id === currentFolderId)?.name}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredNotes.map((note) => {
              const teamName = teams.find(t => t.id === note.teamId)?.name || 'Todas as Turmas';
              return (
                <div key={note.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all duration-200 flex flex-col group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-brand-600 font-bold text-[10px] uppercase tracking-widest">
                      <Users className="w-3.5 h-3.5" />
                      {teamName}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleOpenModal(note)}
                        className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(note.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 mb-2">{note.title}</h3>
                  <p className="text-slate-500 text-sm mb-4 line-clamp-4 whitespace-pre-wrap">{note.content}</p>
                  
                  {note.links && note.links.length > 0 && (
                    <div className="mb-6 space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Links Anexados</p>
                      <div className="flex flex-wrap gap-2">
                        {note.links.map((link, idx) => (
                          <a 
                            key={idx}
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-100 transition-colors border border-slate-100"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Link {idx + 1}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-auto pt-4 border-t border-slate-50 flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                    <FileText className="w-3.5 h-3.5" />
                    Anotação Interna
                  </div>
                </div>
              );
            })}
            {filteredNotes.length === 0 && !isLoading && (
              <div className="col-span-full p-12 text-center text-slate-400 italic bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                Nenhuma anotação encontrada nesta pasta.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Folder Modal */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-slate-900">Nova Pasta</h2>
              <button onClick={() => setIsFolderModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleCreateFolder} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nome da Pasta</label>
                <input 
                  required
                  autoFocus
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="Ex: Projetos 2024"
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-brand-100"
              >
                Criar Pasta
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Note Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-slate-900">
                {editingNote ? 'Editar Anotação' : 'Nova Anotação'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Título</label>
                  <input 
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                    placeholder="Ex: Notas Aula 05 - Sensores"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pasta</label>
                  <select 
                    value={formData.folderId || ''}
                    onChange={(e) => setFormData({ ...formData, folderId: e.target.value || null })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                  >
                    <option value="">Sem Pasta</option>
                    {folders.map(folder => (
                      <option key={folder.id} value={folder.id}>{folder.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Turma Específica (Opcional)</label>
                <select 
                  value={formData.teamId}
                  onChange={(e) => setFormData({ ...formData, teamId: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                >
                  <option value="">Todas as Turmas</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Conteúdo da Anotação</label>
                <textarea 
                  required
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full h-48 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                  placeholder="Escreva suas anotações aqui..."
                />
              </div>

              <div className="space-y-4">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Links Úteis</label>
                <div className="flex gap-2">
                  <input 
                    type="url"
                    value={newLink}
                    onChange={(e) => setNewLink(e.target.value)}
                    className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                    placeholder="Cole um link aqui..."
                  />
                  <button 
                    type="button"
                    onClick={addLink}
                    className="bg-slate-900 text-white px-4 rounded-xl hover:bg-slate-800 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                {formData.links.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.links.map((link, idx) => (
                      <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium">
                        <LinkIcon className="w-3 h-3" />
                        <span className="max-w-[150px] truncate">{link}</span>
                        <button onClick={() => removeLink(link)} className="text-slate-400 hover:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
                  <Save className="w-5 h-5" /> Salvar Anotação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
