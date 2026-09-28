# Refatoração de UI/UX - Portal do Recrutador

## Objetivo
Transformar a atual interface "tudo em uma página só" em uma aplicação moderna, com largura total (full-width) e navegação por abas na Navbar. Basear (SÓ BASEAR, o estilo e tals) o visual na referência do arquivo `bdc-unicap/stitch_portal_de_carreiras_unicap/banco_de_talentos_busca_avan_ada/screen.png`.

## Etapa 1: Limpeza do Papel "Empresa"
1. O papel "empresa" foi descontinuado. Remova qualquer menção a "empresa" no `schema.ts`, nos enums (`ROLES`, `ROLE_LABELS`), no `auth.ts` e no frontend. A partir de agora, o papel é apenas `recrutador`.
2. O `App.tsx` não deve mais renderizar todos os painéis um embaixo do outro. Ele deve usar um sistema de rotas internas ou renderização condicional baseada na aba selecionada na Navbar.

## Etapa 2: Layout Base e Navbar
1. **Container Principal:** Remova as classes como `max-w-6xl` que estão espremendo o conteúdo no meio da tela. O layout deve usar a largura total (`w-full`, `max-w-full` ou `max-w-[1440px]` com margens laterais adequadas).
2. **Nova Navbar:**
   - Lado Esquerdo: Logo da UNICAP.
   - Centro (Links/Abas): "Dashboard de Métricas", "Banco de Talentos", "Vagas & Pipeline".
   - Lado Direito: Nome do Recrutador (Perfil) e botão de Sair.
   - Comportamento: Clicar nas abas deve trocar o conteúdo exibido abaixo da Navbar.

## Etapa 3: Banco de Talentos (Foco Visual Principal)
Construir a tela de Banco de Talentos seguindo rigorosamente a estrutura da referência visual:
1. **Barra de Busca Superior:** Larga, com texto de placeholder detalhado e a contagem de "Estudantes Disponíveis" e botão "Limpar" à direita.
2. **Layout de Duas Colunas:**
   - **Sidebar (Esquerda):** Filtros organizados verticalmente (Área & Curso com checkboxes, Previsão de Conclusão, Competências com tags/chips).
   - **Conteúdo Principal (Direita):** Dropdown de "Ordenar por" no topo.
3. **Cards de Estudantes:** Exibir os alunos em um grid (ex: `grid-cols-2`). Cada card deve ter:
   - Foto (ou placeholder circular), Nome, badge de CRA.
   - Curso e Semestre.
   - Chips de tecnologias/competências.
   - Ícones de disponibilidade e localização.
   - Botões de ação no rodapé do card: "Visualizar Perfil & CV" e "Convidar" (por enquanto, apenas desenhe a UI dos botões, não precisa implementar o clique do modal de perfil agora).
4. **Rodapé:** Paginação centralizada.

## Etapa 4: Vagas & Pipeline
1. Criar uma tela central para "Vagas & Pipeline".
2. No topo, um botão "Publicar Nova Vaga".
3. Abaixo, uma listagem ou grid das vagas ativas. 
4. O Kanban atual (`JobKanban`) deve ser exibido apenas quando o recrutador selecionar uma vaga específica para ver seus candidatos.

## Etapa 5: Dashboard de Métricas
1. Expandir o `OperationalPanel` para usar toda a largura da tela.
2. Manter os filtros no topo.
3. Reorganizar os cards de Vagas (Abertas, Fechadas, Preenchidas), Taxa de Empregabilidade, Time-to-Hire e Funil de Conversão para que não fiquem empilhados verticalmente parecendo um documento de texto. Use CSS Grid para distribuir os gráficos e cards em um painel executivo bonito.