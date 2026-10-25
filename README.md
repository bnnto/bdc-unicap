<span id="top"></span>
<h1 align="center">
  <img src="public/Unicap.png" width="300" />
  <br><br> Banco de Currículos | UNICAP
</h1>

<p align="center">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E" alt="Vite" />
  <img src="https://img.shields.io/badge/Convex-FF7300?style=for-the-badge&logo=convex&logoColor=white" alt="Convex" />
  <img src="https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest" />
  <img src="https://img.shields.io/badge/ESLint-4B32C3?style=for-the-badge&logo=eslint&logoColor=white" alt="ESLint" />
</p>

## Visão Geral
O Banco de Currículos — UNICAP é uma plataforma institucional que conecta estudantes, egressos e recém-formados da Universidade Católica de Pernambuco a oportunidades de estágio e emprego. O sistema centraliza a construção e gestão de currículos, o cadastro e publicação de vagas por recrutadores, o processo seletivo via pipeline Kanban e a busca por talentos com algoritmo de matching automatizado.

A plataforma foi desenvolvida com foco em conformidade com a Lei Geral de Proteção de Dados (LGPD), acessibilidade digital segundo as diretrizes WCAG AA e controle rigoroso de visibilidade dos perfis, garantindo que a exposição de dados seja sempre uma escolha consciente do aluno.

## Equipe

- [Anna Beatriz dos Santos Silva](https://github.com/Anninhaxs) 
- [Bento Guilherme Gomes Oliveira](https://github.com/bnnto) 
- [João Victor Castelo Branco de Sena](https://github.com/joao0cb) 
- [Lettycia Vitoria Melo de França](https://github.com/LettyciaDev) 
- [Lorenna Meneses de Almeida](https://github.com/lorennam) 
- [Lucas Fernandes Nunes Machado](https://github.com/Bye-bit) 

## Principais Funcionalidades

**Para Alunos e Egressos**
- **Construtor de currículo inline:** Edição direta de todos os blocos do currículo (dados pessoais, formação acadêmica, experiências profissionais, competências, idiomas, links profissionais, projetos, certificações) com salvamento reativo.
- **Exportação exata para PDF:** Geração de PDF fiel à renderização visual do currículo, preservando formatação e layout.
- **Gestão de visibilidade:** Controle granular entre perfil público (visível no Banco de Talentos) ou visível apenas para candidaturas realizadas.
- **Autorização de contato:** Opção para autorizar ou não o contato direto por recrutadores, com controle por candidatura ou autorização geral.
- **Painel de candidaturas:** Acompanhamento em tempo real do status de cada candidatura no pipeline seletivo.
- **Central de configurações e LGPD:** Gestão de preferências de notificação, sessões ativas, consentimentos e possibilidade de exclusão da conta.
- **Dicionário fechado de competências e idiomas:** Seleção obrigatória a partir de listas oficiais, garantindo padronização e qualidade dos dados.

**Para Recrutadores**
- **Cadastro com aprovação:** Processo de cadastro com validação de LinkedIn obrigatório e aprovação manual pela coordenação.
- **Publicação e gestão de vagas:** Criação de vagas com pré-requisitos obrigatórios/opcionais, tipo de contrato, faixa salarial, idioma mínimo, disponibilidade desejada e controle de validade (expiração automática).
- **Banco de Talentos com busca avançada:** Pesquisa por curso, status (ativo/egresso), competências, idiomas, disponibilidade e localização, com resultados respeitando a visibilidade e o vínculo institucional.
- **Pipeline Kanban:** Gestão visual das candidaturas com movimentação entre etapas (Inscrito, Triagem, Entrevista, Aprovado, Reprovado), com registro obrigatório de dados para transições críticas.
- **Sistema de matching automatizado:** Cálculo percentual de compatibilidade currículo×vaga com justificativa transparente dos critérios atendidos.
- **Convites diretos:** Possibilidade de convidar alunos por e-mail com limite diário e rastreamento de envios.
- **Visualização de perfis com rastreamento:** Acompanhamento de visualizações de perfil com integração ao analytics.

**Para Gestores**
- **Painel estratégico e operacional:** Métricas consolidadas de vagas, candidaturas, tempo de contratação (Time-to-Hire), funil de conversão e engajamento.
- **Moderação de vagas:** Revisão, aprovação, suspensão ou exclusão de vagas com registro auditável de motivos e atores.
- **Gestão de recrutadores:** Aprovação, revogação e acompanhamento de cadastros de recrutadores.
- **Gestão de denúncias:** Análise e arquivamento de denúncias de alunos com proteção à identidade.
- **Auditoria LGPD:** Execução e histórico imutável de checklist de conformidade LGPD.
- **Painel de moderação:** Controle centralizado com contadores de pendências.

**Recursos Transversais**
- **Autenticação segura:** Integração com Convex Auth com controle de papéis (aluno, recrutador, gestor), ativação de conta e recuperação de senha com token de uso único.
- **Conformidade LGPD:** Registro versionado de consentimentos, trilha de auditoria, controle de visibilidade por padrão (privado) e exclusão de conta.
- **Acessibilidade:** Skip-link, landmarks semânticos, navegação por teclado, hierarquia de títulos correta e conformidade com WCAG AA.
- **Notificações:** Sistema de alertas configuráveis por tipo (alertas de vagas e atualizações de candidatura).
- **Monitoramento:** Healthcheck (/healthz), captura de erros com ErrorBoundary e verificação de prontidão para release.
- **Sistema de denúncias:** Canal seguro para alunos reportarem irregularidades em vagas.

## Tech Stack

### Frontend
| Tecnologia | Função |
|---|---|
| **React 19** | Biblioteca para construção de interfaces reativas com componentes funcionais |
| **TypeScript** | Tipagem estática estrita para maior segurança e manutenibilidade |
| **Vite 6** | Build tool e dev server com hot module replacement |
| **Tailwind CSS 3** | Framework CSS utilitário para estilização consistente e responsiva |
| **Lucide React** | Biblioteca de ícones SVG otimizados |
| **Sonner** | Sistema de toasts globais para feedback ao usuário |

### Backend e Banco de Dados
| Tecnologia | Função |
|---|---|
| **Convex** | Backend reativo com funções query/mutation, schema tipado e sincronização em tempo real |
| **Convex Auth** | Sistema de autenticação integrado com gerenciamento de sessões, contas e recuperação de senha |

### Qualidade, Testes e Ferramentas
| Tecnologia | Função |
|---|---|
| **Vitest** | Framework de testes unitários e de integração |
| **Testing Library** | Testes de componentes com foco em comportamento do usuário |
| **ESLint 9 / Prettier** | Linting estático com regras para React e TypeScript e formatação automática de código |
| **Husky / lint-staged** | Git hooks para validação pré-commit e execução de linters apenas em arquivos staged |
| **Commitlint** | Validação de mensagens de commit seguindo Conventional Commits |

## Como Rodar Localmente

**Pré-requisitos**
- Bun (gerenciador de pacotes utilizado no projeto)
- Conta e projeto no Convex

**1. Clonar o repositório**
```bash
git clone https://github.com/bnnto/bdc-unicap.git
cd bdc-unicap
```

**2. Instalar dependências**
```bash
bun install
```

**3. Configurar variáveis de ambiente**
Crie um arquivo `.env.local` na raiz do projeto com as seguintes variáveis:
```env
VITE_CONVEX_URL=<url-do-seu-projeto-convex>
```
Para obter a URL do Convex, execute o comando de desenvolvimento do Convex (passo 4) que irá provisionar ou conectar ao seu projeto.

**4. Iniciar o backend Convex**
Em um terminal separado, inicie o servidor de desenvolvimento do Convex:
```bash
bunx convex dev
```
Este comando irá:
- Provisionar/conectar ao seu projeto Convex
- Sincronizar o schema definido em `convex/schema.ts`
- Gerar os tipos e funções em `convex/_generated/`
- Expor a URL de desenvolvimento que deverá ser adicionada ao `.env.local`

**5. Iniciar o frontend**
Em outro terminal, inicie o servidor de desenvolvimento do Vite:
```bash
bun dev
```
A aplicação estará disponível em `http://localhost:5173`.

**Comandos adicionais**
```bash
bun run build         # Build de produção
bun run typecheck     # Verificação de tipos
bun run lint          # Linting
bun run format        # Formatação
bun run test          # Testes
bun run test:watch    # Testes em modo watch
bun run test:coverage # Testes com cobertura
bun run preview       # Preview do build
```

## Estrutura do Projeto

```text
bdc-unicap/
├── convex/                    # Backend Convex (fonte da verdade dos dados)
│   ├── _generated/            # Tipos e clientes gerados automaticamente
│   ├── lib/                   # Utilitários compartilhados no backend
│   ├── schema.ts              # Esquema do banco de dados
│   ├── auth.ts                # Configuração e fluxos de autenticação
│   ├── auth.config.ts         # Configuração do provedor Convex Auth
│   ├── users.ts               # Funções relacionadas a usuários
│   ├── students.ts            # Funções relacionadas a perfis de alunos
│   ├── jobs.ts                # Funções relacionadas a vagas
│   ├── applications.ts        # Funções relacionadas a candidaturas
│   ├── invitations.ts         # Funções relacionadas a convites
│   ├── manager.ts             # Funções para gestores
│   ├── moderation.ts          # Funções de moderação
│   ├── operational.ts         # Funções para painel operacional
│   ├── lgpd.ts                # Funções de auditoria LGPD
│   ├── crons.ts               # Tarefas agendadas
│   ├── http.ts                # Rotas HTTP
│   └── emails.ts              # Integração com envio de e-mails
│
├── src/                       # Frontend React + TypeScript
│   ├── App.tsx                # Componente raiz com roteamento e shell da aplicação
│   ├── main.tsx               # Ponto de entrada da aplicação
│   ├── index.css              # Estilos globais e configuração Tailwind
│   ├── vite-env.d.ts          # Tipos do Vite
│   │
│   ├── components/            # Componentes React organizados por domínio
│   │   ├── auth/              # Componentes de autenticação e autorização
│   │   ├── error/             # Tratamento de erros
│   │   ├── landing/           # Página inicial pública
│   │   ├── manager/           # Componentes para gestores
│   │   ├── operational/       # Painel operacional
│   │   ├── profile/           # Central de configurações do usuário
│   │   ├── recruiter/         # Componentes para recrutadores
│   │   ├── student/           # Componentes para alunos e construtor de currículo
│   │   ├── talent/            # Busca de talentos
│   │   └── ui/                # Componentes base do Design System
│   │
│   └── lib/                   # Funções puras, utilitários e regras de negócio
│       ├── skills.ts          # Dicionário fechado de competências e idiomas
│       ├── matching.ts        # Algoritmo de matching currículo×vaga
│       ├── resume.ts          # Regras e validação de currículo
│       ├── resumeDocument.ts  # Renderização para exportação PDF
│       ├── roles.ts           # Definição e labels de papéis
│       ├── router.ts          # Roteamento sem biblioteca externa
│       ├── preferences.ts     # Preferências de acessibilidade
│       ├── formatters.ts      # Formatação de dados
│       └── ...                # Demais utilitários por domínio
│
├── tests/                     # Suíte de testes
│   ├── components/            # Testes de componentes
│   ├── unit/                  # Testes unitários de funções puras
│   ├── integration/           # Testes de integração com Convex
│   └── e2e/                   # Testes end-to-end
│
├── public/                    # Arquivos estáticos
├── package.json               # Dependências e scripts
├── tsconfig.json              # Configuração TypeScript
├── vite.config.ts             # Configuração Vite
├── tailwind.config.js         # Configuração Tailwind CSS
└── vitest.config.ts           # Configuração Vitest
```

## Arquitetura
O sistema adota uma arquitetura moderna com clara separação de responsabilidades:
- **Frontend SPA:** Aplicação React monolítica com roteamento customizado, renderização condicional por papel e shell adaptado para cada perfil de usuário.
- **Backend reativo:** Convex centraliza toda a lógica de negócio, validações, autorização e persistência de dados, com sincronização automática entre cliente e servidor.
- **Regras puras:** Lógica crítica (matching, validação de currículo, dicionário fechado, cálculo de métricas) isolada em `src/lib/` e `convex/lib/` para facilitar testes e garantir determinismo.
- **Segurança por padrão:** Controle de acesso em nível de função no Convex, validação server-side, visibilidade privada por padrão e proteção contra exposição não autorizada de dados.
- **Tipagem end-to-end:** Schema do Convex gera tipos automaticamente consumidos tanto pelo backend quanto pelo frontend, garantindo consistência entre camadas.
