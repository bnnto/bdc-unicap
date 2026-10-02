# Correções de UX, Automação de E-mails e Analytics do Aluno

## Objetivo
Corrigir os bugs residuais de interface (Toasts e Edição do Currículo), implementar um sistema de envio de e-mails para notificações do Kanban e criar um Dashboard de Analytics para o perfil do Aluno.

## Etapa 1: Correções de UX (Bugs Residuais)
1. **Toasts sem Lag e com Tradução:** 
   - No `main.tsx` (ou onde o `<Toaster />` do Sonner estiver), adicione a propriedade `visibleToasts={3}` (ou um limite similar) para evitar lag de sobreposição.
   - Atualize `friendlyErrorMessage` para capturar os erros literais de credenciais inválidas do Convex (ex: "Invalid credentials", "Incorrect password") e retorne estritamente: "E-mail ou senha incorretos".
2. **O Lápis Toggle:** Em todos os blocos do `ResumeForm`, clicar no ícone do Lápis quando já se está no modo de edição deve agir como o botão "Cancelar", fechando o formulário e voltando ao modo de visualização.
3. **Links Completos na Edição:** No Bloco 3 do currículo (Links), modifique o modo de edição para exibir os `inputs` de LinkedIn e Portfólio, além do GitHub e Lattes. O utilizador deve poder editar TODOS os links diretamente ali.

## Etapa 2: Automação de E-mails (Convex Actions)
1. **Configuração Base:** Prepare uma *Action* no Convex (ex: `convex/emails.ts`) projetada para usar uma API como o *Resend*.
2. **Fallback Seguro:** Como as chaves de API (`RESEND_API_KEY`) podem não estar configuradas no ambiente local, a *action* deve tentar enviar o e-mail, mas fazer um `console.log` amigável do conteúdo do e-mail no terminal caso a chave não exista (evitando que o sistema quebre).
3. **Integração no Kanban:** Quando o recrutador mover um aluno para "Entrevista" ou "Aprovado" no Kanban, o backend deve acionar esta função de e-mail para notificar o aluno ("Parabéns, você avançou no processo...").

## Etapa 3: Dashboard de Analytics do Aluno
1. **Métricas Visuais:** Na página "Minhas Candidaturas" (ou no topo do portal do aluno), adicione uma seção de "Estatísticas do Meu Perfil".
2. **Dados Calculados (Backend):**
   - **Total de Candidaturas:** Contagem real de candidaturas.
   - **Taxa de Sucesso:** (Candidaturas em Entrevista ou Aprovado / Total) * 100.
   - **Visualizações do Perfil:** (Pode criar um campo mock ou contador simples no `students` para simular as vezes que empresas clicaram no currículo dele).
3. **UI:** Use Cards minimalistas (estilo métricas de SaaS) para exibir estes números, aumentando a gamificação e o engajamento do aluno.

## Etapa 4: TDD e Qualidade
- Garanta testes que cubram o fecho do formulário com o lápis.
- Crie testes unitários para o cálculo da Taxa de Sucesso no dashboard do aluno.