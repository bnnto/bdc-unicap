# Integração de Dados Reais - Insights do Gestor

## Objetivo
Substituir os dados "mockados" (de exemplo) da secção de Insights Estratégicos do Painel do Gestor por cálculos e agregações reais vindas da base de dados Convex.

## Etapa 1: Criação das Queries (Backend)
Crie as seguintes `queries` no Convex (pode ser num ficheiro `convex/manager.ts` ou adicionado ao `convex/operational.ts`). Garanta que são protegidas para serem acedidas apenas por utilizadores com o papel `gestor`:
1. **`getRejectionInsights`**: Ler a tabela `applications`, filtrar por `stage === "reprovado"` e fazer uma contagem agrupada por `rejectionReason`.
2. **`getSkillsRadar`**: Mapear a Procura vs. Oferta. Contar as competências/skills mais frequentes na tabela `students` (oferta) e comparar com os requisitos/tecnologias mais pedidos nas vagas da tabela `jobs` (procura).
3. **`getEngagementMetrics`**: Ler a tabela `students` para identificar "Estudantes com perfil incompleto" (ex: utilizadores sem o campo `resumeData` preenchido ou sem `skills` registadas).

## Etapa 2: Integração no Frontend
1. No ficheiro `src/components/manager/ManagerDashboard.tsx`, importe e utilize os hooks `useQuery` para chamar as três novas funções do backend.
2. Substitua as variáveis hardcoded da secção de "Insights Estratégicos" pelos dados reais.
3. Remova as etiquetas ou *badges* visuais que avisavam que os dados eram "Dados de exemplo".

## Etapa 3: Testes de Regressão e TDD
- Crie testes de unidade/integração para garantir que a lógica matemática destas agregações funciona perfeitamente.
- Confirme que as permissões de acesso estão blindadas.