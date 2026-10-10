# Refatoração UX/UI: Portal do Recrutador e Master-Detail Kanban

## Objetivo
Resolver problemas graves de espaçamento ("sufocamento" de elementos colados às bordas), aplicar iconografia (`lucide-react`) em todo o painel do recrutador e implementar o padrão de arquitetura "Master-Detail" na página de Vagas & Pipeline.

## Etapa 1: Arquitetura Master-Detail ("Vagas & Pipeline")
1. **Fim da Tela Dividida:** O Kanban e a lista de vagas não devem mais coexistir simultaneamente no ecrã.
2. **Estado 1 (Master):** A página carrega exibindo APENAS a lista de vagas criadas pelo recrutador. 
   - Cada card de vaga deve ganhar um botão primário de destaque: `Ver Candidatos` (com um ícone de Users ou Kanban).
3. **Estado 2 (Detail/Kanban):** Ao clicar em "Ver Candidatos", a lista de vagas desaparece. O ecrã inteiro passa a ser dedicado ao Pipeline daquela vaga específica.
   - O topo da página deve ter um botão claro e acessível: `← Voltar para Minhas Vagas`.

## Etapa 2: Resgate do Kanban (Des-sufocamento)
1. **Cards de Candidato:** Atualmente, os dados do aluno (nome, badges, botões de ação) estão esmagados. 
   - Aumente drasticamente o `padding` interno dos cards (ex: `p-4` ou `p-5` e gap maior entre os elementos).
   - O layout dos botões (`Ver Perfil`, setas de mover, `Reprovar`) tem de ser fluido. Não os deixe encostados às bordas laterais ou inferiores.
2. **Escalabilidade:** Lembre-se que uma coluna pode ter dezenas de candidatos. Defina alturas máximas inteligentes e use `overflow-y-auto` nas colunas para que o Kanban não quebre a página inteira.

## Etapa 3: Banco de Talentos e Filtros
1. **Filtros e Dropdowns:** Os textos estão colados às bordas e as setas dos `selects`/dropdowns estão encavalitadas. Adicione `padding` e afaste os ícones do texto.
2. **Polimento Visual:** Enriqueça o Banco de Talentos. Adicione ícones relevantes, melhore o espaçamento e dê um aspeto de "Diretório Premium" aos cards dos alunos. Se o design estiver simples, melhore-o aplicando as mesmas sombras e micro-interações do resto da aplicação.

## Etapa 4: Formulário "Publicar Vaga"
1. Liberte o formulário do aspeto de "caixote" denso. 
2. Agrupe campos logicamente (ex: Dados Gerais, Requisitos, Benefícios) adicionando divisórias subtis, espaçamento generoso e ícones para orientar o utilizador.

## Etapa 5: Ícones em TODO o lado
1. Tal como feito no painel do Aluno, garanta que todas as páginas do Recrutador (Dashboard, Banco de Talentos, Minhas Vagas) tenham ícones `lucide-react` consistentes.

## Requisitos Técnicos
- Mantenha rigorosamente o TDD. Se textos/IDs que os testes validam mudarem de sítio (como o clique na vaga para abrir o Kanban), atualize os testes de integração para refletir o fluxo Master-Detail.