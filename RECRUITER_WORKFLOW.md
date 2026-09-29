# Fluxo de Vagas e Kanban do Recrutador

## Objetivo
Tornar o painel de "Vagas & Pipeline" 100% funcional. O recrutador deve poder criar novas vagas, visualizar as suas vagas ativas e gerenciar os candidatos reais movendo-os pelas colunas do Kanban.

## Etapa 1: Backend de Vagas (`convex/jobs.ts`)
Implemente as seguintes operações no backend, garantindo que usem o guard `requireRecruiter` (ou equivalente para verificar se o utilizador autenticado é um recrutador):
1. **`createJob` (Mutation):** Recebe os dados do formulário (título, descrição, pré-requisitos, tipo de contrato, etc.), injeta o `recruiterId` (usuário logado), define `status: "aberta"`, `publishedAt: Date.now()`, e `expiresAt` para daqui a 30 dias.
2. **`getMyJobs` (Query):** Retorna as vagas pertencentes ao recrutador logado (buscando pelo índice `by_recruiter`).

## Etapa 2: Backend do Kanban (`convex/applications.ts`)
1. **`getJobApplications` (Query):** Recebe um `jobId` e retorna todas as candidaturas daquela vaga. Deve fazer o "join" com a tabela `students` para retornar os dados do aluno (nome, foto, curso, matchScore) necessários para renderizar os cards no Kanban.
2. **`updateApplicationStage` (Mutation):** Muda o `stage` de uma candidatura. 
   - **Regra de Negócio Crucial (R5):** Se o novo stage for `"reprovado"`, a mutation DEVE exigir que um `rejectionReason` seja passado (seguindo os valores válidos do enum no `schema.ts`).
   - Se o stage mudar para `"aprovado"`, verificar se a vaga já foi preenchida para cálculos futuros.

## Etapa 3: Frontend - Formulário de Vagas (`JobForm.tsx` e `JobsPanel.tsx`)
1. Conecte o formulário `JobForm.tsx` (ou crie a UI necessária se for apenas um esqueleto) à mutation `createJob`.
2. Garanta que o formulário captura itens como array de pré-requisitos (item e boolean required).
3. No `JobsPanel.tsx`, liste as vagas retornadas por `getMyJobs`.

## Etapa 4: Frontend - O Kanban (`JobKanban.tsx`)
1. Conecte a query `getJobApplications` para preencher as 5 colunas: Inscrito, Triagem, Entrevista, Aprovado, Reprovado.
2. Implemente a funcionalidade de mover os cards de candidatos entre as colunas (pode usar HTML5 Drag & Drop simples ou botões de ação rápida no card "Mover para...").
3. **Modal de Reprovação:** Quando o recrutador tentar mover um candidato para a coluna "Reprovado" (ou clicar em rejeitar), o frontend DEVE abrir um modal simples com um `select` pedindo o motivo da reprovação (Ex: Falta de inglês, Horário incompatível). Só após selecionar o motivo, a mutation `updateApplicationStage` deve ser disparada.

## Etapa 5: Qualidade e TDD
- Escreva testes unitários para as novas mutações garantindo que um recrutador não pode alterar a vaga de outro recrutador.
- Garanta que a tentativa de reprovar um candidato sem `rejectionReason` falha nos testes e no backend.