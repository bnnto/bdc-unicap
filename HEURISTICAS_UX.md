# HEURISTICAS_UX.md — Auditoria de Interface pelas 10 Heurísticas de Nielsen

**Projeto:** Portal de Carreiras + Setor de Extensão UNICAP
**Data:** 27/09/2026 · **Sprint:** pós-S5 (pausa de features — foco em qualidade de interface)
**Escopo:** exclusivamente usabilidade no frontend (Tailwind + paleta bordô `#6B1426` / dourado `#C89D3C`).
**Restrições respeitadas nesta auditoria:** nenhuma funcionalidade nova, nenhuma alteração de regra de negócio no backend (`convex/`), nenhuma biblioteca extra. Todas as recomendações usam apenas os componentes do Design System (`ui/button`, `ui/card`, `ui/badge`, `ui/input`) e classes Tailwind existentes.

**Status do documento: AGUARDANDO APROVAÇÃO — nenhuma refatoração de código foi executada.**

---

## 1. Metodologia

- Inventário das 22 telas/componentes construídos (S1–S5): autenticação, consentimento, perfil do aluno, currículo, privacidade, oportunidades, Minhas Candidaturas, Kanban do recrutador, gestão de vagas, formulário de vaga, busca de talentos e Painel Operacional (KPIs, TTH, funil, rankings, filtros).
- Verificação cruzada de cada tela contra as 10 heurísticas de Nielsen, com evidência de código (arquivo e comportamento observado).
- **Severidade** (escala Nielsen): `0` cosmético · `1` leve · `2` moderado · `3` grave · `4` bloqueante. Nenhum achado `4` foi encontrado.

---

## 2. O que já está bom (manter)

| Área | Evidência |
|---|---|
| **Feedback de carregamento** | Todas as telas assíncronas exibem `Carregando…` com `role="status"`/`aria-live="polite"` (JobKanban, JobsPanel, MyApplications, ResumeForm, PrivacySettings, OperationalPanel, TalentSearch, ResumeDownload). |
| **Estados pendentes de submit** | AuthPage (`pending` → "Processando…", botão desabilitado), JobForm, ResumeForm, StudentProfileForm. |
| **Mensagens de erro acessíveis** | `role="alert"` em 9 telas; erros do servidor em PT-BR claro; erros de validação por campo no `Input` (componente com `error`/`errorId`). |
| **Feedback de sucesso** | JobForm ("Vaga publicada/atualizada com sucesso"), ResumeForm, StudentProfileForm — com `role="status"`. |
| **Prevenção de erro no domínio** | Reprovação exige motivo (select do enum R5) com botão de Confirmar/Cancelar; validação de vaga antes de mutar (R3); aviso de prazo R4 com dias restantes e cores semânticas (warning/danger); bloqueio de submit sem aceite do termo LGPD. |
| **Controle e saídas** | "Cancelar" na reprovação e no JobForm; "← Trocar vaga" (Kanban); "← Voltar ao portal" (Minhas Candidaturas); "Voltar para a lista" pós-sucesso; paginação ← Anterior/Próxima (TalentSearch); toggles R6 revogáveis (PrivacySettings); "Reabrir" vaga. |
| **Teclado e leitura de tela** | Cards do Kanban com `tabIndex`, setas ←/→, `aria-label` descritivos, focus ring; contagens por coluna anunciadas; filtros S5-5 com labels. |
| **Reconhecimento** | Rótulos do pipeline (S4-1), chips de pré-requisito com obrigatório/opcional, banda de match explicada, timeline de 5 etapas, facets de curso/empresa nos selects (não exigem digitar). |
| **Consistência visual** | Design System único (Card/Button/Badge/Input), hierarquia bordô/dourado, `font-serif` em títulos, sombras level1/level2. |
| **Reatividade** | Todas as métricas refletem o banco em tempo real (queries reativas), sem "salvar e recarregar". |

---

## 3. Achados por heurística

### H1 — Visibilidade do status do sistema

| ID | Sev. | Onde | Achado e recomendação |
|---|---|---|---|
| H1-1 | **2** | `JobsPanel.tsx` (`handleStatus`, `handleRenew`); `OperationalPanel.tsx` | Mutations sem estado `pending` próprio: os botões "Fechar/Encerrar/Renovar" e a barra de filtros não indicam trabalho em curso e permitem cliques repetidos (erro duplicado ou corrida). **Rec:** desabilitar o botão da ação enquanto a mutation está em voo (padrão já usado no AuthPage). |
| H1-3 | **1** | `ConsentGate.tsx` (`ConsentRequiredScreen`) | `accept({})` sem `try/catch` e sem `pending`: uma falha fica silenciosa (promessa rejeitada sem UI) e o botão não dá feedback. **Rec:** envolver em try/catch com `role="alert"` e desabilitar durante o aceite. |
| H1-4 | **1** | `OperationalPanel.tsx` | Seções do painel carregam em tempos diferentes com apenas texto ("Carregando funil…"). **Rec (opcional):** blocos skeleton com `bg-slate-100 animate-pulse` para manter o layout estável. |

### H2 — Compatibilidade entre o sistema e o mundo real

| ID | Sev. | Onde | Achado e recomendação |
|---|---|---|---|
| H2-1 | **2** | Vários: `JobKanban.tsx` ("obrigatório — R5", "a mutation falha (R5)"), `OperationalPanel.tsx` ("encerradas (R4)", "CA 2" em nota), `StudentHomePage.tsx` ("(R1)", "([S1-4])", "([S2-1])") | **Códigos internos de especificação vazam para a UI.** Aluno/recrutador/gestor não sabem o que é "R5" ou "CA 2". **Rec:** reescrever os textos em linguagem natural, mantendo a explicação (ex.: "obrigatório — R5" → "obrigatório para auditoria do processo"; "(R4)" → remover). Nenhuma regra muda — só a redação. |

### H3 — Controle e liberdade do usuário (undo, saídas)

| ID | Sev. | Onde | Achado e recomendação |
|---|---|---|---|
| H3-1 | **3** | `JobsPanel.tsx` (`NEXT_STATUS`) | "Encerrar" é **terminal** (sem reabertura) e executa em 1 clique, sem confirmação nem desfazer. Mesmo risco para "Fechar" (reversível, mas inesperado para quem erra o botão). **Rec:** diálogo de confirmação inline por vaga (Confirmar/Cancelar, padrão já existente no Kanban) para "Encerrar" e "Fechar". Sem alteração de backend. |
| H3-2 | **3** | `JobKanban.tsx` (drag&drop e botão `→`) | **Arrastar (ou apertar →) até a coluna "Reprovado" grava a reprovação sem motivo**, contornando o fluxo R5 da UI (confirmado: `moveApplication` aceita `"reprovado"`; o motivo só é exigido por `rejectApplication`). O card fica sem motivo auditável e sem nenhum aviso ao recrutador. **Rec (100% frontend):** interceptar drop/seta com destino `"reprovado"` e abrir o mesmo painel de motivo usado pelo botão "Reprovar" (ou ignorar o movimento com alerta orientando o botão). A regra R5 do servidor permanece intacta. |
| H3-4 | **1** | `JobForm.tsx` (pós-sucesso) | Após salvar, o formulário continua editável com a notice ativa — permite duplo salvamento confuso. **Rec:** ao publicar com sucesso, retornar à lista automaticamente (ou desabilitar o submit enquanto a notice está visível). |

### H4 — Consistência e padrões

| ID | Sev. | Onde | Achado e recomendação |
|---|---|---|---|
| H4-1 | **2** | JobKanban ("← Trocar vaga", "←"/"→" nos cards), MyApplicationsPage ("← Voltar ao portal"), TalentSearch ("← Anterior"), JobForm ("Voltar para a lista" sem seta) | Padrão de setas/ícones inconsistente (prefixo `←` às vezes, ausente outras; `→` como ação principal no Kanban). **Rec:** padronizar o formato `[símbolo] Ação` para navegação e usar texto sem símbolo nas ações de dados. |
| H4-2 | **1** | Estados vazios de JobsPanel, JobKanban, OperationalPanel, TalentSearch | Mensagens de vazio com padrões diferentes (com/sem CTA, com/sem ícone). **Rec:** bloco padrão de estado vazio (título + descrição + CTA quando houver próximo passo). |
| H4-3 | **1** | `ui/button.tsx` vs botões nativos (`ConsentGate`, abas da AuthPage) | Anéis de foco diferentes entre componente e botões nativos. **Rec:** padronizar o anel dourado (`focus-visible:ring-secondary`) no `Button` e replicar nos nativos. |

### H5 — Prevenção de erros

| ID | Sev. | Onde | Achado e recomendação |
|---|---|---|---|
| H5-1 | **2** | `JobKanban.tsx` (botões `←`/`→`) | O botão `→` num card em "Aprovado" dispara a tentativa de mover para "Reprovado" — ação que sempre falha na prática (erro "…(R5)" no topo) porque reprovação exige motivo. **Rec:** quando o próximo estágio for "reprovado", abrir o painel de motivo em vez de mover direto (mesma correção de H3-2). |
| H5-3 | **1** | `JobsPanel.tsx` | "Renovar (30 dias)" e mudanças de status não explicam o efeito no botão (tooltip/aria-label ausentes). **Rec:** `aria-label`/`title` curtos ("Reativa o prazo de 30 dias desta vaga"). |

### H6 — Reconhecimento em vez de memorização

| ID | Sev. | Onde | Achado e recomendação |
|---|---|---|---|
| H6-1 | **1** | `TalentSearchPage.tsx` (filtro de idioma) | Campo de texto livre exige lembrar/soletrar o idioma exato ("Inglês"). **Rec (sem lib):** `<datalist>` nativo com os idiomas já usados pelo sistema. |
| H6-2 | **1** | `JobKanban.tsx` (cards) | O card não mostra há quanto tempo a candidatura está na coluna (idade do processo) — o recrutador precisa deduzir. **Rec (opcional):** exibir "candidatou-se em dd/mm" com o `appliedAt` já presente no payload (sem query nova). |

### H7 — Flexibilidade e eficiência de uso

| ID | Sev. | Onde | Achado e recomendação |
|---|---|---|---|
| H7-1 | **1** | `JobKanban.tsx` | Selecionar a vaga por lista de botões funciona, mas sem busca quando há muitas vagas. **Nota:** agregar vagas com contadores exigiria query nova — **fora do escopo** desta auditoria (regra de ouro nº 1). Documentado como limitação conhecida. |

### H8 — Design minimalista e estético

| ID | Sev. | Onde | Achado e recomendação |
|---|---|---|---|
| H8-1 | **1** | `StudentHomePage.tsx` | Página única longa com 6 blocos (cadastro, privacidade, currículo, oportunidades, candidaturas) sem sumário/âncoras. **Rec:** navegação por âncoras no topo (links internos com scroll) — UI-only. |
| H8-2 | **1** | `JobsPanel.tsx` (linha de ações) | Renovar/Editar/Fechar/Encerrar em linha com o mesmo peso visual; a ação destrutiva não se destaca. **Rec:** alinhar ações destrutivas à direita e diferenciá-las (borda/texto `danger`), mantendo os componentes existentes. |

### H9 — Reconhecer, diagnosticar e recuperar erros

| ID | Sev. | Onde | Achado e recomendação |
|---|---|---|---|
| H9-1 | **2** | `JobsPanel.tsx`, `JobKanban.tsx` | Erros de mutation aparecem apenas no topo do card/painel: em listas longas, o usuário não sabe **qual** vaga/card falhou. **Rec:** renderizar a mensagem junto ao item que originou a ação (estado de erro por id). |
| H9-2 | **1** | `AuthPage.tsx` (Input Senha com `error={error}`) | Erros de autenticação (e-mail inexistente, etc.) aparecem anexados ao campo Senha. **Rec:** alerta no topo do formulário (`role="alert"`), sem vínculo ao campo. |
| H9-3 | **1** | `ConsentGate.tsx` | Sem caminho de recuperação se o aceite falhar (ver H1-3). **Rec:** mesma correção — try/catch + mensagem orientando tentar novamente. |

### H10 — Ajuda e documentação

| ID | Sev. | Onde | Achado e recomendação |
|---|---|---|---|
| H10-1 | **1** | `JobKanban.tsx` | Nenhuma dica visível de que os cards podem ser arrastados **ou** movidos por teclado (a acessibilidade existe, mas é invisível). **Rec:** legenda curta acima do board: "Arraste os cards ou use ←/→ no teclado; a reprovação exige motivo". |
| H10-2 | **0** | `OperationalPanel.tsx` | Métricas têm notas explicativas curtas (TTH e empregabilidade já explicam a fórmula). Manter. |

---

## 4. Resumo priorizado

| Prioridade | IDs | Tema central |
|---|---|---|
| **P1 — executar primeiro** | H3-1, H3-2/H5-1 | Ações destrutivas sem confirmação (Encerrar/Fechar) e reprovação por drag&drop sem motivo (contorno do R5 na UI) |
| **P2** | H1-1, H1-3/H9-3, H2-1, H4-1, H9-1, H9-2 | Pending por ação; erro do aceite LGPD; códigos internos (R#/CA) fora dos textos; padronização de setas; erros no contexto do item |
| **P3 — polimento** | H1-4, H3-4, H4-2, H4-3, H5-3, H6-1, H6-2, H8-1, H8-2, H10-1 | Skeletons, duplo submit, estados vazios, foco, tooltips, datalist, idade da candidatura, âncoras, hierarquia de ações, legenda do Kanban |
| **Fora de escopo (exige feature)** | H7-1 | Visão agregada de todas as vagas no Kanban |

**Total: 19 achados** — 2 graves (H3-1, H3-2), 6 moderados, 11 leves/cosméticos. Nenhum bloqueante.

---

## 5. Plano de execução proposto (após aprovação)

- **Fase 1 — P1:** confirmação inline em Fechar/Encerrar (JobsPanel); interceptação de drop/seta para "Reprovado" abrindo o painel de motivo (JobKanban). Atualizar testes de componentes que asserting os textos/fluxos alterados.
- **Fase 2 — P2:** pending por ação (JobsPanel, OperationalPanel); try/catch + pending no aceite do termo (ConsentGate); reescrita dos textos com códigos internos; erros por item (JobsPanel/JobKanban); alerta de auth no topo do formulário.
- **Fase 3 — P3:** padronização de setas, estados vazios, foco dourado, legenda do Kanban, âncoras na home do aluno, datalist de idiomas, hierarquia das ações de vaga.

**Diretrizes de implementação (todas as fases):** apenas Tailwind + componentes `ui/*` existentes; nenhuma dependência nova; nenhum arquivo `convex/` alterado; suíte `bun run test` + `bun run typecheck` verdes a cada fase; commits `fix:`/`style:` por fase.

---

*Documento gerado pela auditoria heurística — aguardando aprovação para iniciar qualquer refatoração.*
