# Refatoração do Papel Gestor, Limpeza de Legado e Remoção da Extensão

## Objetivo
1. Limpar definitivamente os rastros legados do papel "empresa" no banco de dados e backend.
2. Remover completamente o escopo de "Projetos de Extensão" (tabelas e telas).
3. Remover a vulnerabilidade que permite a qualquer visitante criar uma conta de "gestor".
4. Reconstruir o Dashboard do Gestor transformando-o num Painel Estratégico moderno, baseado na referência visual.

## Etapa 1: Limpeza do Legado "Empresa"
O banco de produção já foi limpo manualmente. Remova todas as lógicas de fallback criadas no PR anterior:
- Remover `v.literal("empresa")` do `convex/schema.ts`.
- Remover as traduções/mapeamentos de "empresa" para "recrutador" nos arquivos `jobs.ts`, `operational.ts`, `students.ts`, e no frontend (`AuthProvider.tsx`).
- O sistema deve conhecer estritamente apenas três papéis: `aluno`, `recrutador` e `gestor`.

## Etapa 2: Remoção do Módulo de Extensão
- Excluir a tabela `extensionProjects` do `convex/schema.ts`.
- Excluir os arquivos de backend relacionados (ex: `convex/extensionProjects.ts`).
- Excluir do frontend as páginas `ExtensionDashboard` e `ExtensionProjectsPublicPage`.
- Remover as rotas públicas de extensão do `App.tsx` (a variável `PUBLIC_PATHS`).

## Etapa 3: Bloqueio de Criação de Conta Gestor
- Modificar o componente `RoleSelect.tsx` (ou onde o perfil é escolhido no cadastro).
- A opção "Gestor" NÃO DEVE mais aparecer para seleção na criação de contas.
- O público só pode escolher "Aluno" ou "Recrutador".
- Contas de Gestor serão provisionadas exclusivamente via alteração manual do role direto no Convex Dashboard.

## Etapa 4: Reconstrução do Painel do Gestor (Dashboard Estratégico)
Construir o `ManagerDashboard.tsx` (que substituirá os antigos painéis) usando CSS Grid e largura total (full-width), com as seguintes seções:
1. **Header do Dashboard:** Título "Painel Estratégico de Carreiras & Empregabilidade", botões "Exportar Relatório PDF" e "Exportar Planilha (CSV)" à direita.
2. **Barra de Filtros:** Dropdowns para "Todos os Cursos" e "Semestre Atual", com botão "Atualizar".
3. **Cards de KPI (4 colunas no topo):**
   - OPORTUNIDADES (Vagas ativas no semestre)
   - TAXA DE EMPREGABILIDADE (%)
   - TEMPO MÉDIO DE CONTRATAÇÃO (Dias)
   - TALENTOS DISPONÍVEIS (Estudantes com perfil ativo)
4. **Sessão Central (Duas colunas):**
   - Esquerda: "Funil de Conversão" (Gráfico de barras horizontais: Inscritos -> Triagem -> Entrevistas -> Contratados).
   - Direita: "Empregabilidade por Curso" (Lista ranqueada de cursos com barras de %).
5. **Sessão Tabela:**
   - Tabela de "Empresas Parceiras" (Colunas: Empresa, Vagas Publicadas, Contratados, Status).
6. **[NOVO] Sessão Insights Estratégicos (3 colunas ou blocos ao final):**
   - **Motivos de Reprovação:** Gráfico/lista consumindo o `rejectionReason` para a universidade entender onde os alunos falham.
   - **Radar de Competências (Gargalos):** Comparativo visual simples "O que as vagas mais pedem" vs "O que os alunos mais têm".
   - **Termômetro de Engajamento:** Contador ou lista de "Alunos com Perfil Incompleto / Sem currículo".

**Nota Técnica Visual:** Para esta refatoração de interface da Etapa 4, o foco primário é a construção do layout, tipografia, cores e grids perfeitos. Você pode usar dados mockados (hardcoded) nas propriedades dos componentes visuais caso as lógicas de backend agregadas não estejam totalmente prontas. Deixe a UI pronta para ser "plugada" no banco depois.