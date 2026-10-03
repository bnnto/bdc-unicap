# Quick Win: Exportação e Contato Rápido no Perfil do Candidato

## Objetivo
Adicionar ações rápidas na recém-criada página de visualização do perfil do candidato (`CandidateProfilePage`), facilitando a vida do recrutador na hora de extrair os dados e entrar em contato.

## Etapa 1: Botão de "Baixar PDF"
1. Adicionar um botão "Baixar Currículo em PDF" no topo da `CandidateProfilePage` (perto do botão de voltar).
2. O botão deve acionar exatamente a mesma lógica de impressão/exportação (`window.print()` e `@media print`) que foi desenvolvida com sucesso no Portal do Aluno.
3. Certifique-se de que a formatação de impressão também funcione nesta tela, ocultando os botões de navegação e exibindo apenas o currículo limpo.

## Etapa 2: Botões de "Copiar" (Clipboard)
1. Na seção de "Dados Pessoais" do candidato (onde aparecem E-mail e Telefone/WhatsApp), adicione um pequeno ícone de "Copiar" (Copy to clipboard) ao lado dos valores.
2. Ao clicar, o sistema deve copiar o texto para a área de transferência do recrutador e disparar um Toast de sucesso (ex: "E-mail copiado!").

## Etapa 3: Qualidade
- Teste simples de renderização para garantir que os botões novos aparecem na UI.