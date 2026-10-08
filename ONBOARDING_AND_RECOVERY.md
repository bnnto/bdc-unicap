# Correção de Onboarding de Novos Alunos e Recuperação de Senha

## Objetivo
Desbloquear o fluxo para contas recém-criadas (removendo o "beco sem saída" de cadastro de perfil) e implementar um fluxo completo e realista de "Esqueci minha senha" com envio de e-mail.

## Etapa 1: Correção do Beco Sem Saída (Onboarding de Alunos)
1. **O Problema:** Atualmente, alunos novos caem na página de currículo com a mensagem "Complete o cadastro do perfil no menu Meu Perfil", mas essa página não existe mais separadamente.
2. **A Solução:** O componente `ResumeBuilderPage` ou `ResumeForm` NÃO deve bloquear o utilizador. Se o perfil do aluno ainda não existir ou estiver incompleto na tabela `students`, o próprio Bloco 1 ("Dados Pessoais & Apresentação") do currículo deve estar aberto/editável por padrão, permitindo que o aluno insira os seus dados iniciais (curso, matrícula, telefone, etc.) diretamente ali.
3. Certifique-se de que a mutação que guarda os dados do Bloco 1 faz um `upsert` (cria o registo do aluno se não existir, ou atualiza se já existir). Remova as mensagens antigas que mandavam o utilizador para o "Meu Perfil".

## Etapa 2: Recuperação de Senha (Backend & E-mail)
1. **Geração de Token:** Se estiver a utilizar o Convex Auth padrão, utilize o fluxo nativo de reset de senha. Se for autenticação customizada, crie uma tabela/schema para `passwordResets` (com `email`, `token` único e `expiresAt`).
2. **Envio de E-mail (Action):** Crie uma *Convex Action* ou função para disparar o e-mail de recuperação. O e-mail deve conter um link para a aplicação: `https://[seu-dominio]/recuperar-senha?token=ABC123`.
3. **Fallback Elegante:** Se a chave de API do serviço de e-mail (ex: Resend) não estiver configurada no `.env.local`, a função deve fazer um `console.log` no terminal mostrando exatamente o link gerado, para podermos testar localmente.

## Etapa 3: Interface de Recuperação de Senha (Frontend)
1. **Link no Login:** Adicione um link "Esqueci minha senha" no `AuthPage.tsx` (junto aos campos de login).
2. **Nova Página (`ResetPasswordPage.tsx`):** Crie uma rota `/recuperar-senha` que lê o `token` da URL. Esta página deve ter um formulário simples a pedir a "Nova Senha" e "Confirmar Nova Senha".
3. **Feedback:** Use os Toasts que criámos na última etapa para mostrar mensagens de sucesso ("E-mail de recuperação enviado!") ou de erro ("Token inválido ou expirado").

## Etapa 4: Qualidade e TDD
- Garanta que um novo utilizador consegue guardar o currículo sem erros de "student profile not found".
- Teste a mutação de alteração de senha para garantir que a nova senha é encriptada (hashed) corretamente antes de ir para a base de dados.