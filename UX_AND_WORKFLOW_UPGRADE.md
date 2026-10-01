# Upgrade de UX e Workflow Rigoroso do Kanban

## Objetivo
Criar uma Landing Page institucional de alto nível para apresentar o Portal de Carreiras e implementar um fluxo rigoroso (anti-cheat) no Kanban do Recrutador, exigindo validações e modais em cada avanço de etapa.

## Etapa 1: Landing Page Institucional (A Vitrine)
- **Nova Rota Principal:** Transformar a rota raiz (`/`) numa Landing Page pública e atrativa. O componente de Login/Cadastro (`AuthPage`) deve ser movido para a rota `/login` ou aberto via Modal.
- **Hero Section:** Título de impacto (ex: "O seu futuro começa aqui. Conectando os talentos da UNICAP ao mercado"), e botões principais: "Entrar como Aluno" e "Portal da Empresa".
- **Seção de Benefícios:** Cards visuais explicando os diferenciais: Gerador de CV em PDF, Match Score Inteligente e Gestão Ágil de Vagas.
- **Rodapé:** Informações institucionais. (Siga o padrão de cores bordô e tipografia limpa).

## Etapa 2: Backend - Workflow Rigoroso (`schema.ts` e `applications.ts`)
- **Atualização do Schema:** Adicionar os campos opcionais `interviewDate`, `interviewLink` (ou `location`) e `expectedStartDate` na tabela de `applications`.
- **Regra Anti-Cheat:** Modificar a mutation que move o candidato (`updateApplicationStage`). O backend deve **bloquear saltos**. O caminho obrigatório é: `inscrito` -> `triagem` -> `entrevista` -> `aprovado`. 
- *(Nota: Mover para `reprovado` continua sendo permitido a partir de qualquer coluna, desde que informe o motivo).*

## Etapa 3: Frontend - Modais de Validação no Kanban
- **Modal de Entrevista:** Se o card for movido para a coluna "Entrevista", interceptar a ação e abrir um Modal exigindo "Data, Hora e Link/Local". Só após salvar, a mutation dispara.
- **Modal de Contratação:** Se movido para "Aprovado", abrir um Modal pedindo a "Data de Início Prevista".
- **Rollback Visual:** Se o recrutador fechar ou cancelar o Modal, o cartão deve voltar automaticamente para a coluna de onde saiu.

## Etapa 4: Qualidade e TDD
- Criar testes unitários para a nova regra Anti-Cheat (garantir que `inscrito` direto para `aprovado` dá erro no servidor).
- Testar a presença dos componentes principais na Landing Page.