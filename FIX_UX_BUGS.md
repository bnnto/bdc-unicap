# Refinamento de UX, Tratamento de Erros e Configurações

## Objetivo
Polir a interface do utilizador, substituindo erros crus do servidor por Toasts amigáveis, implementando edição inline no currículo, simplificando a navegação e corrigindo o layout e a clareza da página de configurações.

## Etapa 1: Sistema de Toasts Globais (Tratamento de Erros)
1. Instalar/Configurar uma biblioteca de Toasts moderna (ex: `sonner` ou `react-hot-toast`, se ainda não existir).
2. **Interceptação de Erros:** Remover as caixas de erro cruas (ex: `[CONVEX A(auth:signIn)]...`) das páginas, especialmente do login.
3. Passar a exibir estas mensagens de erro e de sucesso de forma global através dos *Toasts*, com traduções amigáveis (ex: "E-mail ou palavra-passe incorretos" em vez de erro de servidor) e tempo de expiração automático (auto-dismiss).

## Etapa 2: Edição Inline no Currículo
1. Descartar completamente qualquer página antiga de "Editar Perfil" separada.
2. No componente do Formulário do Currículo (`ResumeForm`), adicionar um ícone de "Lápis" (Editar) no canto superior direito de cada bloco de informação (Dados Pessoais, Formação, Experiência, etc.).
3. Ao clicar no lápis, os campos de texto desse bloco específico devem tornar-se editáveis no próprio local. Ao guardar, o bloco volta ao modo de visualização.

## Etapa 3: Simplificação da Navegação (Navbar)
1. Remover o menu dropdown complexo associado ao Avatar/Nome do utilizador na Navbar.
2. O clique no Avatar/Nome deve redirecionar o utilizador diretamente para a página de Configurações (`/perfil`).
3. O botão de "Sair" (Logout) deve ser movido para dentro dessa página de Configurações.

## Etapa 4: Correções na Página de Configurações (`/perfil`)
1. **Correção de Layout (Width):** A página de configurações está com a largura cortada. Ajustar o *container* para utilizar a mesma largura total (`max-w-[1440px]` ou equivalente) usada nas restantes páginas principais do portal.
2. **Limpeza da Lista de Sessões:** 
   - Parar de exibir os IDs criptográficos crus (ex: `jn7eb...`).
   - Humanizar a listagem: se possível, traduzir o User-Agent (ex: "Chrome no Windows", "Safari no Mobile"). Se não for possível, agrupar de forma limpa apenas como "Sessão Ativa".
   - Destacar o botão de *Kill Switch*: "Encerrar sessão em todos os outros dispositivos".

## Etapa 5: Qualidade e TDD
- Garantir que a integração do sistema de *Toasts* não quebra os testes existentes de submissão de formulários.
- Testar a alternância de estado (visualização vs. edição) nos blocos do currículo.