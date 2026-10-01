# Página de Perfil, Configurações e Compliance LGPD

## Objetivo
Criar uma página central de "Meu Perfil / Configurações" (`/perfil`), focada em identidade, acessibilidade, segurança e cumprimento rigoroso da LGPD (Portabilidade e Direito ao Esquecimento).

## Etapa 1: Identidade, Aparência e Acessibilidade (Frontend)
1. **Avatar e Conta:** Upload/Alteração de foto de perfil (atualizando a tabela `users`) e botão de Sair/Logout.
2. **Aparência e Acessibilidade (A11y):** 
   - Toggle para Dark/Light Mode.
   - Toggle para "Modo de Alto Contraste".
   - Controles de redimensionamento de fonte (Aumentar/Diminuir).
   - *Nota Técnica:* Salve as preferências de acessibilidade no localStorage ou na tabela do usuário para persistência.

## Etapa 2: Segurança e Preferências
1. **Histórico de Segurança:** 
   - Listar as sessões recentes/ativas (buscando os dados de autenticação do Convex, se disponível, ou criando um mock seguro caso a API de auth não exponha geolocalização exata nativamente).
   - Botão "Encerrar sessão em outros dispositivos" (Revogação de tokens de sessão).
2. **Notificações:** Switches para "Alertas de Vagas" e "Atualizações de Candidatura".

## Etapa 3: Privacidade e Compliance (LGPD)
1. **Portabilidade de Dados:** Um botão "Exportar Meus Dados" que reúne os dados do usuário, currículo e candidaturas em um único JSON formatado para download no navegador.
2. **O Botão Vermelho (Direito ao Esquecimento):** Botão de "Excluir Conta" que abre um Modal de Confirmação crítico (exige digitar a palavra "EXCLUIR").

## Etapa 4: Backend - O Apagão em Cascata (`convex/users.ts` ou `auth.ts`)
Implemente a mutation `deleteMyAccount` (protegida para o próprio usuário):
- **Se for Aluno:** Excluir da tabela `students`, limpar as suas `applications` e deletar de `users`.
- **Se for Recrutador:** Excluir suas vagas em `jobs`, TODAS as `applications` ligadas a essas vagas e, por fim, deletar de `users`.
- A exclusão deve ser atômica e irreversível, sem deixar registros órfãos.

## Etapa 5: Qualidade e TDD
- É estritamente necessário criar testes de integração para a mutation `deleteMyAccount`.
- Garanta que ao excluir um recrutador, o banco seja limpo corretamente em cascata.