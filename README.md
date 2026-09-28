# Portal de Carreiras + Setor de Extensão — UNICAP

Plataforma que conecta estudantes e egressos da Universidade Católica de
Pernambuco a oportunidades de estágio e emprego, com banco de talentos,
pipeline de vagas, relatórios operacionais e divulgação pública dos
projetos do Setor de Extensão — com LGPD e acessibilidade WCAG AA como
requisitos de primeira classe.

**Status:** v1.0.0 (release estável — veja o [CHANGELOG](./CHANGELOG.md)).

## Grupo

- Bento Guilherme Gomes Oliveira
- Lorenna Meneses de Almeida
- Lettycia Vitória Melo de França
- Anna Beatriz Silva dos Santos
- João Victor Castelo Branco de Sena
- Lucas Fernandes Nunes Machado

## Operação e monitoração

- **Healthcheck:** `GET /healthz` responde `200 {status:"ok", db:true}` com
  o banco saudável e `503` em caso de falha — é a batida do monitor de
  disponibilidade (SLA 99%).
- **Release:** os gates da release (CAs por issue + bateria de qualidade +
  healthcheck + deploy) são consolidados pela regra pura
  `src/lib/releaseReadiness.ts` ([S8-5]); qualquer gate vermelho bloqueia
  o deploy.

# Stack

## Frontend
- TypeScript em modo strict

- React + Vite
- Tailwind CSS 
- Componentes próprios leves (sem shadcn/ui pesado
  
## Backend / Banco de dados

- Convex — funções (query/mutation) e schema reativos, sem servidor próprio
- Módulos espelhando os domínios: convex/insumos.ts, convex/manutencao.ts
  
## Qualidade e testes

- Vitest + Testing Library 
- ESLint 9 + Prettier + Husky/lint-staged 
- tsc --noEmit como verificação de tipos a cada turno

## Gestão e ferramentas

- GitHub Projects #1 como kanban (issues S0-1 … S8-5 por atividade)
- Conventional Commits e ADRs para decisões de arquitetura
- Freebuff Cloud como ambiente: preview gerenciado, credencial GitHub App de curta duração para git/gh, e verificação automática de tipos ao fim de cada alteração

## Gerenciador de pacotes

- Bun (installs e scripts)
