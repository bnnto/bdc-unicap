# Correção de Bugs de UX: Toasts e Layout do Currículo

## Objetivo
Resolver o problema de performance (lag) nos Toasts, traduzir erros residuais em inglês, remover atalhos incorretos da Navbar e consertar o layout de edição inline do Currículo Vitae.

## Tarefa 1: Correção do Lag e Tradução dos Toasts
1. **Verificar Duplicação do `<Toaster />`:** O sistema de toasts está com lag severo. Verifique `src/main.tsx` e `src/App.tsx`. Garanta que existe apenas UM único `<Toaster />` renderizado no topo da árvore da aplicação (preferencialmente fora de contextos de re-renderização pesada).
2. **Erros em Inglês:** Expanda a função `friendlyErrorMessage` em `src/lib/toastMessages.ts`. Adicione mapeamentos para capturar erros comuns do Convex e de Auth que ainda estão passando em inglês (ex: "Invalid credentials", "Unauthenticated", "Missing parameters") e retorne strings amigáveis em Português.

## Tarefa 2: Limpeza da Navbar
1. **Links Principais:** A Navbar do Aluno deve ter EXATAMENTE e APENAS três links de texto centrais: "Meu Currículo", "Oportunidades" e "Minhas Candidaturas".
2. **Remover "Meu Perfil" dos links centrais:** O agente colocou "Meu Perfil" no meio da Navbar erroneamente. Remova isso.
3. As configurações de conta (LGPD, tema, etc.) devem ser acessadas ÚNICA e exclusivamente ao clicar na Foto do Avatar no canto direito.

## Tarefa 3: Conserto do Layout do Currículo (`ResumeForm`)
1. **Restaurar a Estabilidade do Layout:** A implementação da edição inline quebrou o visual do formulário. O usuário deve acessar "Meu Currículo" e ver as informações de forma clara.
2. **Comportamento do Lápis:** O modo de visualização (View Mode) de cada um dos 7 blocos deve ser limpo e bonito. O ícone de lápis deve ficar no canto superior direito do bloco.
3. Ao clicar no lápis, o formulário de edição do bloco deve aparecer sem "quebrar" a grade (grid/flex) da página, mantendo a largura e o alinhamento consistentes com a referência original. O usuário insere e edita informações diretamente nesta mesma tela.