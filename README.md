# Plataforma Maker - Frontend Documentation

## 📚 Sobre o Projeto
Esta é uma aplicação educacional focada na cultura Maker ("mão na massa"). O projeto oferece um ambiente gamificado para estudantes acessarem aulas, cumprirem desafios, gerenciarem moedas virtuais, e adquirirem itens em uma loja.
A plataforma conta com uma **área completa de administração (Dashboard)** dedicada à gestão de conteúdo, usuários, aulas, desafios e configurações sistêmicas com integração à IA.

---

## 🛠️ Tecnologias e Bibliotecas Utilizadas

- **Core**: React 19 + TypeScript + Vite.
- **Roteamento**: React Router DOM (v7).
- **Estilização**: Tailwind CSS (v4) + `clsx` & `tailwind-merge` para classes dinâmicas.
- **Ícones**: Lucide React.
- **Gráficos e Dados**: Recharts (v2.15) para o dashboard de administração.
- **Animações e Efeitos**: Motion (Framer Motion) e Canvas Confetti.
- **Componentes Adicionais**:
  - `react-markdown`: Renderização de instruções formatadas.
  - `react-player`: Exibição nativa e embutida de links de vídeos das aulas e cursos.
  - `html2canvas` & `jspdf`: Geração de certificados e arquivos imprimíveis.
- **Backend / BaaS**: Firebase (Authentication e Firestore) + Supabase (opcional/legado).
- **IA Generativa**: `@google/genai` (Gemini) utilizado amplamente na área de administração para criação interativa (Aulas, Quizes e Itens da loja).

---

## 📂 Estrutura de Diretórios (`src/`)

```text
src/
├── components/          # Componentes reutilizáveis de UI da aplicação
│   ├── admin/           # Componentes exclusivos da área administrativa (como o Chat IA)
│   ├── AuthGuard/       # Wrapper para proteção de rotas privadas (Estudante)
│   ├── AdminGuard/      # Wrapper para proteção de rotas restritas aos administradores
│   ├── Layout.tsx       # Estrutura principal da página (Navegação lateral, topo)
│   ├── Notification*    # Gerenciamento de alertas / avisos do sino 
│   └── Toast.tsx        # Notificações estilo toast (toast)
│
├── pages/               # Views / Telas principais conectadas ao roteador
│   ├── admin/           # Módulo completo de Governança e Operação (Acesso restrito)
│   ├── Home.tsx         # Dashboard do Aluno
│   ├── CourseView.tsx   # Visualização e player das trilhas
│   ├── Challenges.tsx   # Desafios de código e atividades "mão na massa"
│   ├── Rankings.tsx     # Gamificação: Ranking global da escola
│   ├── Store.tsx        # Loja (Marketplace) utilizando as moedas adquiridas 
│   └── Profile.tsx      # Configurações de perfil do estudante
│
├── App.tsx              # Definição e configuração do Router principal
├── index.css            # Estilos em cascata globais (Tailwind direct import)
├── main.tsx             # Entrypoint da aplicação React
└── firebase.ts          # Inicialização e exports do Firebase/Firestore
```

---

## 🛡️ Roteamento e Proteção (Segurança Frontend)

O roteamento (`react-router-dom`) é segmentado arquiteturalmente em 3 camadas:
1. **Rotas Públicas:** Como `/login` e de visualização inicial.
2. **Rotas de Estudantes (`AuthGuard`):** As views fundamentais requerem autenticação básica do Firebase. O componente intercepta usuários não-autenticados e devolve ao portal de login.
3. **Rotas de Administração (`AdminGuard`):** Área `/admin/*`. Assegura que o usuário seja autenticado e que suas credenciais/documento marquem a variável global de `role: admin`.

A interface do `Layout.tsx` gera os links da sidebar **de fora condicional e responsiva**, exibindo a aba "Administração" apenas quando a conta logada atende aos privilégios necessários.

---

## 🚀 Scripts Disponíveis (`package.json`)

Para rodar, construir e manter o projeto, execute os comandos padrões de gerenciamento (via npm):

- `npm run dev`: Inicia o servidor local de desenvolvimento (port 3000) e simultaneamente executa o backend `server.ts` de apoio (usando `tsx`).
- `npm run build`: Roda o compilador produtivo (Vite) de assets e pacotes.
- `npm start`: Inicia o servidor Node na porta base da aplicação, hospedando os assets previamente compilados.
- `npm run lint`: Inicia o verificador do TypeScript (`tsc --noEmit`).

---

## 🏗️ Padrões de Implementação (Guidelines Internas)

- **Layout Fluido:** A estrutura preza pelo princípio do *Desktop-first / Responsive*, utilizando propriedades max-width integradas nas páginas principais (`w-full max-w-7xl mx-auto`).
- **Estados Dinâmicos:** As páginas (como `ManageLessons` e `ManageChallenges`) usam arrays de dados locais combinados à reatividade do Firebase. Os inputs de busca (`searchTerm`) interagem com `Array.filter` em tempo real.
- **Cores & Tematização:** O Dark Mode é apoiado nativamente via variantes do Tailwind (`dark:bg-zinc-900`), respeitando preferências visuais no DOM. 
