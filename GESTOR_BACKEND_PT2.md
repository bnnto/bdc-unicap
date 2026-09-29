# Integração Final de Dados - Painel do Gestor

## Objetivo
Finalizar a integração do Painel Estratégico do Gestor conectando as duas seções restantes ("Empregabilidade por Curso" e "Empresas Parceiras") a consultas reais no banco de dados, eliminando os dados mockados.

## Etapa 1: Novas Queries no Backend (`convex/manager.ts`)
Crie as seguintes `queries` no arquivo `convex/manager.ts`, protegendo-as com o guard `requireGestor`:
1. **`getEmployabilityByCourse`**: 
   - Agrupar alunos da tabela `students` por `course`.
   - Calcular a taxa de empregabilidade: (Alunos do curso com pelo menos uma candidatura `aprovado` na tabela `applications` / Total de alunos do curso) * 100.
   - Retornar uma lista ordenada da maior taxa para a menor.
2. **`getPartnerCompanies`**: 
   - Buscar os usuários (`users`) com o papel de `recrutador` (que representam as empresas no sistema atual).
   - Para cada recrutador, contar o número de vagas publicadas (`jobs`).
   - Contar o número total de candidatos contratados (candidaturas `aprovado` para as vagas desse recrutador).
   - Definir uma regra simples para o "Status do Convênio" (ex: "Ativo" se tem vagas recentes ou contratações, "Regular" se tem apenas conta criada, ou crie uma regra de negócio pura em `managerDashboard.ts`).
   - Retornar a lista ordenada pelo número de contratados (decrescente).

## Etapa 2: Integração no Frontend (`ManagerDashboard.tsx`)
1. Importe e utilize os hooks `useQuery` para chamar `getEmployabilityByCourse` e `getPartnerCompanies`.
2. Substitua as variáveis hardcoded dessas duas seções pelos dados reais.
3. Remova definitivamente o componente/import `MockBadge` da tela, pois o painel agora será 100% real.
4. Trate os estados de "vazio" (empty states) caso não existam contratações ou empresas no banco.

## Etapa 3: Testes de Regressão e TDD
- Adicione as regras puras no arquivo `src/lib/managerDashboard.ts` para facilitar os cálculos de porcentagem e status.
- Crie testes unitários e de integração para garantir que os agrupamentos por curso e as agregações de empresas estão corretos.