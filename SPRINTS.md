# 🗓️ SPRINTS.md — Cronograma Iterativo

**Projeto:** Banco de Currículos e Setor de Extensão — UNICAP
**Base:** CEREBRO.md · Stack: React+Vite · Tailwind · Convex · Vitest · Bun
**Gestão:** GitHub Projects #1 (Kanban Backlog/To Do/In Progress/Done) — Issues `[Sn-m]`

> **Fluxo de trabalho:** issues são criadas no Backlog; execução por PR referenciando a issue (`Closes #n`) — o próprio GitHub move o card para **Done** no merge.

---

## 0. Cadência e Cerimônias

- **Cadência:** sprints de **1 semana** (S0 → S8).
- **Cerimônias:** Planning (segunda), Daily assíncrona, Review + Retro (sexta).
- **DoR (Definition of Ready):** issue com CA verificáveis e RN vinculadas ao CEREBRO.md.
- **DoD (Definition of Done):** testes Vitest verdes, `tsc --noEmit` limpo, revisão aprovada, PR com `Closes #n`.
- **Capacidade:** 3–5 issues/sprint, TDD (testes primeiro nas regras de negócio).

---

## 1. Roadmap Resumido

| Sprint | Tema | Entregas principais |
|---|---|---|
| **S0** | Setup, Infra e Design System | Projeto base, Convex, tokens Dourado/Bordô, CI de qualidade |
| **S1** | Autenticação e Perfis (LGPD) | Cadastro de aluno, vínculo, visibilidade, consentimentos (R1, R2, R6, R7) |
| **S2** | Currículo Vitae e Banco de Talentos | Formulário/download de CV, busca com filtros avançados |
| **S3** | Vagas, Matching e Candidaturas | Publicação de vagas, expiração 30d, matching %, candidatura com bloqueio (R3, R4, R8) |
| **S4** | Kanban, Feedback e Contato LGPD | Pipeline completo, reprovação com motivo, liberação de contato (R5, R6) |
| **S5** | Dashboard de Métricas | Vagas abertas/preenchidas, empregabilidade, time-to-hire, funil, filtros |
| **S6** | Exportação de Relatórios | PDF e CSV/XLSX |
| **S7** | Extensão | Banco de projetos, divulgação pública, painel gestor com métricas/filtros |
| **S8** | Hardening, A11y e Release | LGPD end-to-end, WCAG AA, desempenho 10k+ currículos, release |

---

## 2. Backlog Detalhado por Sprint

### S0 — Setup, Infra e Design System

- **[S0-1] Inicializar projeto React+Vite+TS strict com Bun**
  - CA: `bun run dev` sobe; `tsc --noEmit` limpo; `strict: true` com `noUncheckedIndexedAccess`.
  - RN: —
- **[S0-2] Configurar Vitest + Testing Library e primeiro teste de exemplo**
  - CA: `vitest run` verde; teste de exemplo de componente e de função pura.
  - RN: —
- **[S0-3] Provisionar Convex (schema inicial vazio + codegen + crons.ts vazio)**
  - CA: `bun convex dev --once` gera `_generated`; crons declarados.
  - RN: —
- **[S0-4] Design System UNICAP: tokens Dourado `#C89D3C` e Bordô `#6B1426` (Tailwind + CSS vars)**
  - CA: tokens do DESIGN.md mapeados; componentes ui/ leves base (Button, Input, Card, Badge) com estados hover/foco.
  - RN: identidade visual Dourado e Bordô.
- **[S0-5] ESLint 9 + Prettier + Husky/lint-staged + Conventional Commits**
  - CA: hooks rodando; lint bloqueia commit inválido.
  - RN: —

### S1 — Autenticação e Perfis (LGPD)

- **[S1-1] Autenticação Convex Auth com papéis (aluno, recrutador, gestor, empresa)**
  - CA: login/cadastro; rotas protegidas por papel; logout.
  - RN: —
- **[S1-2] Termo de consentimento LGPD versionado (`consents`)**
  - CA: aceite obrigatório no cadastro registrado com versão e timestamp.
  - RN: R7.
- **[S1-3] Cadastro de aluno: dados pessoais, curso, semestre/ano, matrícula e status (ativo/egresso/inativo)**
  - CA: upsert de perfil completo; matrícula única validada.
  - RN: R1.
- **[S1-4] Visibilidade do aluno: "Visível para recrutadores" × "apenas candidaturas ativas" + autorização de contato**
  - CA: toggles persistidos; estados refletidos em toda a UI.
  - RN: R2, R6.
- **[S1-5] Links profissionais e competências: LinkedIn, GitHub/Portfólio, competências, idiomas, disponibilidade**
  - CA: formulário completo salva e exibe dados; validação de URL.
  - RN: —

### S2 — Currículo Vitae e Banco de Talentos

- **[S2-1] Formulário de Currículo Vitae (headline, resumo, experiências, histórico acadêmico)**
  - CA: persistência em `students.resumeData`; validações de formulário.
  - RN: —
- **[S2-2] Geração e download do currículo (PDF) a partir do formulário**
  - CA: download fiel aos dados; sem dependências pesadas.
  - RN: —
- **[S2-3] Banco de Talentos: busca com filtros avançados (curso, formação, competências, localização, idioma, disponibilidade)**
  - CA: filtros combináveis e reativos; resultados paginados.
  - RN: R1 (só ativos/egressos), R2 (só `publico`).
- **[S2-4] Índices Convex para busca performática (10k+ currículos)**
  - CA: queries ancoradas em índices; revisão de plano de consulta.
  - RN: requisito não-funcional de escalabilidade.
- **[S2-5] TDD das regras de visibilidade/vínculo (R1, R2)**
  - CA: testes unitários de query logic verdes antes da UI.
  - RN: R1, R2.

### S3 — Vagas, Matching e Candidaturas

- **[S3-1] Publicação de Vagas: título, descrição, pré-requisitos (obrigatórios/opcionais), tipo de contrato, salário, localização**
  - CA: CRUD pelo recrutador; validação de faixa salarial.
  - RN: —
- **[S3-2] Expiração de vagas: 30 dias padrão, renovação e encerramento automático (crons)**
  - CA: job expira → status "encerrada"; renovação reativa prazo; cron diário.
  - RN: R4.
- **[S3-3] Algoritmo de Matching % (função pura em `src/lib/matching.ts`) com TDD**
  - CA: tabela de testes cobrindo limites 0–100, pesos obrigatórios/opcionais, idioma e disponibilidade.
  - RN: R8.
- **[S3-4] Candidatura do aluno com cálculo e exibição do % de compatibilidade**
  - CA: % calculado no servidor na mutation e persistido; exibido ao aluno e recrutador.
  - RN: R8.
- **[S3-5] Bloqueio de candidatura fora dos requisitos obrigatórios, com aviso claro**
  - CA: tentativa bloqueada com mensagem específica dos requisitos faltantes.
  - RN: R3.

### S4 — Kanban, Feedback e Contato LGPD

- **[S4-1] Pipeline Kanban do recrutador: Inscrito, Em Triagem, Entrevista, Aprovado, Reprovado**
  - CA: mover cards atualiza stage em tempo real (Convex reativo); navegação por teclado.
  - RN: —
- **[S4-2] Reprovação com motivo padronizado obrigatório**
  - CA: sem motivo a mutation falha; motivos do enum fixo registrados para auditoria.
  - RN: R5.
- **[S4-3] Liberação de contato LGPD: contato visível só com autorização/aceite do aluno**
  - CA: recrutador sem autorização não vê contato (servidor omite campo).
  - RN: R6.
- **[S4-4] "Minhas Candidaturas" do aluno com etapa atual e % de match**
  - CA: lista reativa por aluno com status do pipeline.
  - RN: —
- **[S4-5] TDD do fluxo de pipeline (transições válidas/inválidas, R5, R6)**
  - CA: testes de integração das mutations verdes.
  - RN: R5, R6.

### S5 — Dashboard de Métricas

- **[S5-1] Painel Operacional: total de vagas (abertas vs preenchidas) e taxa de empregabilidade**
  - CA: cards com números consistentes com o banco.
  - RN: —
- **[S5-2] Time-to-Hire médio (`filledAt − appliedAt`)**
  - CA: cálculo em dias, agregado por período/curso/empresa.
  - RN: —
- **[S5-3] Funil de conversão por etapa do pipeline**
  - CA: contagem e conversão % entre etapas, exibição visual.
  - RN: —
- **[S5-4] Empresas/Vagas mais ativas (ranking)**
  - CA: top N por vagas publicadas e candidatos atraídos.
  - RN: —
- **[S5-5] Filtros do dashboard: período, curso, empresa e status**
  - CA: filtros combináveis atualizam todas as métricas reativamente.
  - RN: —

### S6 — Exportação de Relatórios

- **[S6-1] Exportação CSV/XLSX dos relatórios do dashboard**
  - CA: download com dados filtrados; encoding correto.
  - RN: —
- **[S6-2] Exportação PDF dos relatórios (template institucional UNICAP)**
  - CA: PDF com identidade Dourado/Bordô; dados filtrados.
  - RN: —
- **[S6-3] Testes dos utilitários de exportação**
  - CA: snapshot/formato validado em Vitest.
  - RN: —

### S7 — Extensão (Banco + Painel Gestor)

- **[S7-1] Cadastro de projetos de extensão (título, descrição, coordenador, área, público-alvo)**
  - CA: CRUD completo; validações básicas.
  - RN: —
- **[S7-2] Acompanhamento: ativo/não ativo com histórico de status**
  - CA: toggle de status registrado com data.
  - RN: —
- **[S7-3] Divulgação pública para estudantes, professores e público externo**
  - CA: página pública dos projetos ativos, sem autenticação, responsiva.
  - RN: R9.
- **[S7-4] Painel gestor com métricas e filtros (área, status, período)**
  - CA: contagens por área/status; filtros combináveis.
  - RN: —
- **[S7-5] TDD das funções de extensão (listagem pública, métricas)**
  - CA: testes verdes das queries.
  - RN: R9.

### S8 — Hardening, A11y e Release

- **[S8-1] Auditoria LGPD end-to-end (consentimento, contato, exclusão/retificação)**
  - CA: checklist de LGPD validado; dados de contato nunca expostos sem R6.
  - RN: R6, R7.
- **[S8-2] Acessibilidade WCAG AA: navegação por teclado, contraste, ARIA**
  - CA: auditoria de contraste nos tokens; foco visível; landmarks corretos.
  - RN: requisito não-funcional.
- **[S8-3] Desempenho: benchmark de busca com 10k+ currículos seedados**
  - CA: queries de talentos dentro do SLA com base semeada.
  - RN: escalabilidade.
- **[S8-4] Disponibilidade/robustez: validação de erros, SLA 99% (monitoração de deploy)**
  - CA: error boundaries; observação do deploy de produção.
  - RN: SLA.
- **[S8-5] Release 1.0: revisão final, changelog e deploy**
  - CA: todas as CA anteriores verdes; deploy de produção validado.
  - RN: —

---

## 3. Dependências Críticas

- **S1** → **S2** (perfil completo antes do currículo/talentos)
- **S3** → **S4** (vagas + matching antes do pipeline)
- **S2+S3** → **S5** (dados de talentos e candidaturas alimentam métricas)
- **S5** → **S6** (exportação consome as queries de métricas)
- **S0** → todas (design system e infra)
- **S8** fecha o ciclo com hardening transversal.
