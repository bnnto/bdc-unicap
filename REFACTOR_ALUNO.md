# Refatoração do Portal do Aluno

## Objetivo
Transformar a interface do aluno numa aplicação moderna de largura total (full-width), dividida em páginas (abas) na Navbar. O foco principal é a construção de um Gerador de Currículo Vitae avançado baseado na referência visual `bdc-unicap/tree/main/stitch_portal_de_carreiras_unicap/edi_o_de_curr_culo_vitae_unicap/screen.png`, além de um mural de vagas estilo LinkedIn e um rastreador de candidaturas.

## Etapa 1: Layout Base e Navbar (`StudentShell`)
1. **Navbar Superior:**
   - Lado Esquerdo: Logo da UNICAP.
   - Centro (Links/Abas): "Meu Currículo", "Oportunidades", "Minhas Candidaturas".
   - Lado Direito: Foto de Perfil (Avatar circular) com menu Dropdown (links para "Meu Perfil" e "Sair").
2. **Container:** Full-width (`max-w-[1440px]`), substituindo a renderização empilhada pelo sistema de abas condicional.

## Etapa 2: Página 1 - Meu Currículo Vitae (Referência Visual)
A tela deve ter um layout de duas colunas:
1. **Sidebar (Esquerda - Fixa/Sticky):**
   - Foto do aluno, nome, curso.
   - Toggle/Switch de "Visibilidade no Banco de Talentos" (Público vs Privado).
   - Menu âncora/navegação rápida para as seções do formulário.
2. **Main Content (Direita - Formulário do CV):** 
   Atualize o `schema.ts` (`resumeData`) se necessário para suportar todos os blocos:
   - 1. Dados Pessoais & Apresentação Profissional
   - 2. Formação Acadêmica Institucional UNICAP
   - 3. Links Profissionais, Portfólio & Lattes
   - 4. Competências & Tecnologias (Skills)
   - 5. Idiomas & Nível de Proficiência
   - 6. Experiências Profissionais e Projetos de Extensão (Apenas campo de texto, não recriar tabelas do módulo de extensão).
   - 7. Certificações & Atividades Complementares
3. **Visualizador e Exportação PDF (CORREÇÃO CRÍTICA):** 
   - O layout do Visualizador na tela está bonito, mas ao baixar/imprimir o PDF, o layout atual quebra e fica feio.
   - O agente DEVE usar CSS `@media print` com a propriedade `print-color-adjust: exact` (ou `-webkit-print-color-adjust: exact`) para forçar o navegador a renderizar as cores de fundo.
   - Preserve o `display: flex` e `display: grid` dentro do `@media print` para que o PDF gerado seja o "espelho exato" do Visualizador.

## Etapa 3: Página 2 - Oportunidades (Mural de Vagas)
1. Construir uma interface avançada de busca de vagas (Estilo LinkedIn).
2. **Filtros:** Tipo de contrato, Localidade, Salário, Cargo/Skill.
3. **Listagem:** Cards de vagas detalhados.
4. **Highlight de Match:** Exibir com destaque o "Percentual de Compatibilidade" (Match Score) que o aluno tem com a vaga.

## Etapa 4: Página 3 - Minhas Candidaturas
1. Lista/Grid mostrando o histórico de vagas em que o aluno se inscreveu.
2. Exibir o `stage` atual da candidatura (Inscrito, Triagem, Entrevista, Contratado).
3. Caso a candidatura esteja como "Reprovado", exibir amigavelmente o `rejectionReason` para que o aluno saiba onde melhorar.

## Etapa 5: Qualidade e TDD
- Desenvolver os componentes visuais em paralelo com os testes.
- Usar dados mockados apenas no visual enquanto o design é finalizado.