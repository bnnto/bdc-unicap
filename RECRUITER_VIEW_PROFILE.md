# Visualização Dedicada do Perfil do Candidato

## Objetivo
Criar uma página dedicada para o recrutador visualizar o currículo completo de um aluno (candidato), acessível diretamente através de um clique no card do Kanban.

## Etapa 1: Backend - Query de Visualização (`convex/students.ts` ou `recruiter.ts`)
1. **Nova Query (`getCandidateProfile`):** Criar uma query protegida (`requireRecruiter`) que recebe um `studentId` e retorna todos os dados do aluno (dados pessoais públicos, `resumeData`, `skills`, `languages`).
2. *Nota de Segurança:* O recrutador só deve conseguir visualizar o perfil se o aluno estiver com a visibilidade "pública" (Banco de Talentos) OU se o aluno tiver uma candidatura ativa numa vaga deste recrutador.

## Etapa 2: Frontend - A Página do Candidato (`CandidateProfilePage.tsx`)
1. **Nova Rota:** Criar o componente `CandidateProfilePage` e registrá-lo na rota `/recrutador/candidato/:studentId` (no `App.tsx` ou router correspondente).
2. **Interface Read-Only:** Reutilizar os componentes visuais de currículo do Portal do Aluno, mas renderizá-los em modo estrito de "Somente Leitura" (sem ícones de edição, sem formulários).
3. **Navegação:** Adicionar um botão proeminente no topo da página: "← Voltar para a Vaga" / "Voltar ao Kanban".

## Etapa 3: Integração no Kanban (`JobKanban.tsx`)
1. **Ação no Card:** Atualizar o card do candidato no Kanban. O nome/foto do candidato ou um novo botão secundário ("Ver Perfil") deve ser clicável e redirecionar para `/recrutador/candidato/:studentId`.
2. Garanta que o redirecionamento passe o ID corretamente e que a UX deixe claro que o card pode ser arrastado (Drag & Drop) MAS também clicado para ver detalhes.

## Etapa 4: TDD e Qualidade
- Criar testes unitários para a query `getCandidateProfile`, garantindo que barra acessos indevidos.
- Criar um teste de componente para garantir que a `CandidateProfilePage` renderiza os blocos do currículo (Formação, Experiência, Links) usando os dados mockados do aluno.