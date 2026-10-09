# Correção do Disparo de E-mails e Refatoração Extrema de UI/UX

## Objetivo
Ativar o envio real de e-mails de recuperação via Resend e aplicar um polimento massivo na interface de usuário (UI) de toda a aplicação, elevando o design a um padrão de SaaS corporativo moderno.

## Etapa 1: Correção do Envio de E-mail (Resend)
1. **Remover o Fallback Passivo:** O fluxo de recuperação de senha está apenas a imprimir o link no console. Implemente a ação real (`convex/emails.ts` ou similar) utilizando o SDK do `resend` ou a API fetch do Convex (`fetch` nativo) para disparar o e-mail real.
2. **Integração no Convex:** A função de envio deve ler `process.env.RESEND_API_KEY`. Se a chave não existir, aí sim pode lançar um `console.warn`, mas a tentativa de envio HTTP para a API do Resend tem de estar codificada e funcional. O e-mail deve ter um template HTML limpo com a identidade da UNICAP.

## Etapa 2: Upgrade Massivo de UI (Iconografia)
1. **Instalação:** Adicione a biblioteca `lucide-react` (padrão de mercado para ícones em React) se ainda não estiver no projeto.
2. **Aplicação Global:** 
   - Coloque ícones em **todos** os botões de ação (ex: ícone de `Save` no salvar, `Trash` no excluir, `Edit2` no lápis, `LogOut` no sair).
   - Adicione ícones nos itens do menu da Navbar e na Sidebar.
   - Adicione ícones de contexto nos blocos do formulário do currículo (ex: `GraduationCap` para Formação, `Briefcase` para Experiência, `Code` para Skills).

## Etapa 3: Polimento Visual (SaaS Premium Level)
1. **Sombras e Bordas (Glassmorphism & Depth):** 
   - Aprofunde o design. Use sombras mais suaves e espalhadas (`shadow-sm`, `shadow-md`, `shadow-lg`) nos Cards, Kanban e formulários para criar profundidade.
   - Arredonde levemente mais os cantos se necessário (`rounded-xl` ou `rounded-2xl` para cards principais) para um visual mais acolhedor e moderno.
2. **Transições e Micro-interações (Hover States):**
   - Absolutamente TODOS os botões, links e cards interativos devem ter classes de transição (`transition-all duration-200 ease-in-out`).
   - Efeitos de `hover:scale-[1.02]` nos cards de vagas.
   - Efeitos de `hover:bg-slate-50` ou mudança de opacidade.
   - Inputs devem ter `focus:ring-2 focus:ring-primary/50 focus:border-primary` para um feedback tátil visual.

## Etapa 4: Refinamento do Kanban e Estados Vazios
1. **Kanban UI:** Melhore os cards do Kanban do Recrutador. Use *Badges* (pequenas tags coloridas) para exibir o "Match Score" e o cargo. Adicione o avatar ou iniciais do candidato no card usando ícones circulares.
2. **Empty States Ilustrados:** Se o aluno não tiver candidaturas ou o recrutador não tiver vagas, não mostre apenas texto. Crie um componente de `EmptyState` com um ícone grande (ex: `FolderOpen` ou `Inbox` do Lucide), um texto de suporte amigável e uma Call-to-Action (botão) primária.

## Etapa 5: Qualidade e TDD
- Garanta que as mudanças de UI não quebram os testes de componentes já existentes.
- O código do Frontend deve ser componentizado, modular e impecável.