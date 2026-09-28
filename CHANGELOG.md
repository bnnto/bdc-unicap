# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e este projeto adere a [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [1.0.0] — 2026-09-28

Primeira release estável do Portal de Carreiras + Setor de Extensão UNICAP:
autenticação com consentimento LGPD versionado, banco de talentos, pipeline
de vagas com matching no servidor, painel operacional, módulo de extensão
com divulgação pública e requisitos não-funcionais (LGPD, acessibilidade
WCAG AA, benchmark 10k+, disponibilidade/monitoração SLA 99%).

### Added — Sprint 1 (Autenticação e Perfis LGPD)
- Autenticação única com abas Entrar/Criar conta e papéis aluno/recrutador/gestor/empresa ([S1-1]).
- Consentimento LGPD versionado no cadastro, bloqueio de uso sem aceite vigente (R7) ([S1-2]).
- Perfil do aluno com validação no servidor e matrícula única ([S1-3]).
- Privacidade: visibilidade `publico|somente_candidaturas` (R2) e autorização geral de contato (R6) ([S1-4]).

### Added — Sprint 2 (Currículo e Banco de Talentos)
- Currículo Vitae (headline, resumo, experiências, histórico acadêmico) com download/impressão ([S2-1]).
- Banco de Talentos: busca com filtros avançados e paginação; R1 (apenas ativo/egresso) e R2 no servidor ([S2-3]).
- Plano de varredura indexado (`by_visibility_status`, `by_status_availability`) com teto por varredura — sem full-scan ([S2-4]).

### Added — Sprint 3 (Vagas, Matching e Candidaturas)
- Publicação de vagas com pré-requisitos e ciclo de vida aberta/fechada/encerrada ([S3-1]).
- Matching calculado NO SERVIDOR na candidatura (R8, fonte da verdade) ([S3-3]/[S3-4]).
- Pré-requisitos obrigatórios bloqueados no servidor (R3) ([S3-5]).

### Added — Sprint 4 (Pipeline)
- Kanban do recrutador com 5 colunas e movimentação por teclado ([S4-1]).
- Reprovação com motivo padronizado (enum fixo, R5) ([S4-2]).
- Aceite de contato por candidatura, revogável (R6) ([S4-3]).
- "Minhas candidaturas" reativa com % de match por faixa ([S4-4]).

### Added — Sprint 5 (Painel Operacional)
- Métricas de vagas, pipeline, empregabilidade e rankings com filtros combináveis ([S5-1]).
- Time-to-Hire com amostras `filledAt − appliedAt` ([S5-2]).

### Added — Sprint 6 (Relatórios)
- Exportação CSV/XLSX e relatório PDF institucional via impressão nativa ([S6-1]/[S6-2]).

### Added — Sprint 7 (Setor de Extensão)
- Cadastro e acompanhamento de projetos (áreas temáticas RESGES/CENADES, ativo/não ativo) ([S7-1]/[S7-2]).
- Divulgação pública sem login com whitelist de campos (R9) ([S7-3]).
- Painel de extensão para gestores ([S7-4]).

### Added — Sprint 8 (Não-funcionais e Release)
- **[S8-1]** Auditoria LGPD end-to-end: checklist com snapshot imutável (`lgpd.runAudit`), relatório de dados do titular (art. 18, II) e exclusão de dados (art. 18, VI) via `students.deleteMyProfile` — PR #85.
- **[S8-2]** Acessibilidade WCAG AA: auditoria de contraste dos tokens Dourado/Bordô (tokens `a11y-*`), foco visível com anel bordô (WCAG 1.4.11/2.4.7), skip-link de teclado e landmarks corretos (1.3.1) — PR #86.
- **[S8-3]** Benchmark de busca com 10.500 currículos seedados: queries dentro do SLA de 500 ms, sem full-scan (leitura ≤ 2×200 ≪ base), seed determinístico e idempotente — PR #87.
- **[S8-4]** Disponibilidade: error boundaries acessíveis com reset, healthcheck `GET /healthz` (200/503) e monitoração do deploy com SLA de 99% — PR #88.
- **[S8-5]** Release 1.0: revisão final consolidada (gates por entrega + bateria de qualidade), changelog, bump de versão e validação de deploy.

### Qualidade
- Suíte: 675 testes em 72 arquivos (unitários, componentes e integração com convex-test), zero falhas.
- Cobertura ≥ 80% nas regras críticas (extensão, LGPD, matching, visibilidade).
- ESLint 9 (typescript-eslint strict), Prettier, Husky + lint-staged, Conventional Commits + commitlint.
- TypeScript estrito com `noUncheckedIndexedAccess`.

### Segurança e LGPD
- Guard R7 (usuário ativo + aceite vigente) em todas as mutações de domínio.
- Dados de contato omitidos — nunca mascarados — sem autorização (R6).
- Projeção whitelist na divulgação pública (R9); trilha de auditoria imutável.

[1.0.0]: https://github.com/bnnto/projeto-agil-curriculo/releases/tag/v1.0.0
