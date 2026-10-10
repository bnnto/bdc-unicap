# Correção Urgente de UI: Fim do Sufocamento, Bug Cinza e Ícones na Navbar

## Objetivo
Resolver definitivamente a falta de espaçamento (elementos colados às bordas) em todas as telas do Recrutador, adicionar os ícones em falta na Navbar e corrigir o bug crítico de cores no formulário de vagas.

## Etapa 1: Correção do "Bug Cinza" (Formulário Publicar Vaga)
1. **Remoção do fundo cinza:** Os `inputs` e `textareas` do formulário de criação de vagas estão com um fundo cinza opaco horroroso que quebra o Dark Mode e esconde o texto.
2. **Correção:** Altere as classes de background dos inputs para respeitar o tema. Use fundos escuros nativos do projeto (ex: `bg-transparent`, `bg-slate-900` ou a variável de tema correta) com texto claro (`text-white` ou `text-slate-100`) e bordas subtis (`border-slate-700`).
3. **Respiro nas secções:** As secções "Sobre a vaga", "Pré-requisitos", etc., precisam de muito mais `padding` interno (ex: `p-6` ou `p-8`) e `gap` entre os elementos.

## Etapa 2: Navbar e Ícones (Header)
1. A Navbar superior está vazia de ícones. Adicione os ícones do `lucide-react` imediatamente ao lado dos textos:
   - Dashboard de Métricas: ícone `LayoutDashboard` ou `BarChart`
   - Banco de Talentos: ícone `Users` ou `Search`
   - Vagas & Pipeline: ícone `Kanban` ou `Briefcase`
2. Aplique um `gap-2` entre o ícone e o texto.

## Etapa 3: Des-sufocar Dashboard e Filtros
1. **Métricas (Cards):** Os retângulos de "Vagas Abertas", "Taxa de Empregabilidade", etc., têm o texto colado à borda. Adicione `p-6` ou `p-8` a TODOS os cards de métricas.
2. **Filtros (Selects):** Nos dropdowns de "PERÍODO", "CURSO", etc., o texto e a seta estão espremidos. Aumente o `padding` e o `height` (ex: `h-10`, `px-3`).
3. **Banco de Talentos:** A barra lateral de filtros (Área & Curso) e os inputs de busca estão muito densos. Aumente o `padding` dos containers e o `gap` entre os campos.

## Etapa 4: Des-sufocar Kanban e Cards
1. Garanta que os cards dos alunos dentro das colunas do Kanban têm, no mínimo, `p-5` e `gap-4` entre as informações internas.
2. NENHUM texto ou botão deve tocar nas bordas dos cards.