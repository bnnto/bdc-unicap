# Relatório Consolidado — Resultados dos Testes e Plano de Melhoria (bdc-unicap / Banco de Talentos)

**Data de consolidação:** 15/11/2026
**Fontes:** `performance-tests-report.md`, `resultados_da_auditoria.md`, `test-smells-and-optimizations-report.md`, `tsdetect-relatorio.md`

---

## 1. Resumo executivo

Foram executadas quatro frentes de verificação: (1) análise de *test smells*, (2) limpeza de código e estabilização do ambiente de testes, (3) auditoria de segurança do frontend e (4) testes de carga, estresse e fumaça (*smoke*).

| Frente | Resultado principal |
| --- | --- |
| Suíte funcional | **1.197 testes passando, 0 falhas** (108 arquivos); `tsc` e ESLint (`--quiet`) limpos |
| Smoke test | 5/5 caminhos críticos passaram; nenhuma regressão em R1/R2/R5/R6/R7/R8 |
| Segurança (frontend) | 3 pontos de atenção da auditoria corrigidos (ConsentGate, validação de role, URLs de imagem) |
| Test smells | 1.066 → 818 avisos (−23%) em 5 de 110 arquivos refatorados; tsDetect inviável para TypeScript |
| Carga / estresse | 0% de erros em todos os degraus (até 128 VUs); p95 acima do SLA de 500 ms **no harness**, com ressalvas de medição |
| CPU (filtragem pura) | Ganhos de 40% a 94,8% nas consultas otimizadas |

**Conclusão geral:** o produto está funcionalmente estável e sem regressões de regra de negócio. O principal risco identificado não é falha, e sim **latência sob concorrência** (enfileiramento) causada pelo volume de leitura de índice por requisição. Ainda não há medição contra um deployment Convex real.

---

## 2. Testes de carga e estresse (`students.searchTalent`)

**Alvo:** caminho mais quente do produto (Banco de Talentos), base de 10.500 currículos (60% elegíveis, 20% inativos, 20% privados).
**Ambiente:** 2 vCPU, ~3,9 GB RAM, Node v26.13.0, processo único. Harness próprio em TypeScript/Vitest executando as funções reais do Convex via `convex-test`.
**Critério de saúde:** p95 ≤ 500 ms e taxa de erro < 1%.

### 2.1 Ressalva metodológica importante

O `convex-test` varre ranges de índice de forma linear (21 ms para `take(1)` em 10.500 linhas contra 0,44 ms em 5 linhas). Em produção o Convex faz seek O(log n) e poda o `take`. Portanto:

- Os valores **absolutos** de p95 são um proxy inflado pelo harness.
- O que **transfere para produção**: número de operações de índice por requisição, volume de documentos lidos e custo de CPU por requisição.

### 2.2 Loading Test (8 VUs, 15 s)

| Métrica | Antes | Depois (3 execuções) |
| --- | --- | --- |
| Throughput | 14,33 req/s | 12,33 – 13,07 req/s |
| p50 | 49,78 ms | 68,08 – 79,27 ms |
| p95 | 626,22 ms | 710,78 – 779,95 ms |
| Taxa de erro | 0% | 0% |

**Leitura honesta:** p95 acima do SLA nas duas versões e **não distinguível** entre antes e depois (dispersão de ±20% entre execuções numa VM compartilhada). Cerca de 95% do tempo da query no mock é varredura de índice; as otimizações atacaram CPU (0,03–1,45 ms por consulta), que não aparece nesse regime.

### 2.3 Stress Test (rampa 1 → 128 VUs, 4 s por degrau)

| VUs | p95 antes (ms) | p95 depois (ms) | Erros |
| --- | --- | --- | --- |
| 1 | 154,31 | 191,56 | 0 |
| 4 | 446,11 | 528,41 | 0 |
| 8 | 760,90 | 855,46 | 0 |
| 16 | 1.197,56 | 1.656,06 | 0 |
| 32 | 2.361,04 | 2.805,70 | 0 |
| 64 | 4.836,72 | 5.154,35 | 0 |
| 128 | 9.179,00 | 10.058,59 | 0 |

- **Ponto de quebra (p95 > 500 ms):** entre 4 e 8 VUs (varia entre execuções). O sinal estável é o "joelho" da curva: acima de ~4–8 requisições concorrentes o p95 cresce quase linearmente.
- **Capacidade estável:** ~13–14 req/s por instância no harness. Os 45 req/s do último degrau são inflados por aquecimento de JIT e não devem ser usados como capacidade.
- **Modo de falha:** enfileiramento (latência crescente), **não** indisponibilidade. Zero erros em 128 VUs.

### 2.4 Recuperação

| Métrica | Antes | Depois |
| --- | --- | --- |
| p95 na recuperação (4 VUs, 8 s) | 357,88 ms | 460,43 ms |
| Fator vs. mesmo regime na rampa | 0,80× | 0,87× |
| Heap / RSS finais | 72,8 / 228,5 MB | 72,5 / 210,6 MB |

Sem degradação residual e sem vazamento de memória.

### 2.5 Benchmark de CPU (filtragem pura, 400 linhas/consulta)

| Cenário | Antes (ms) | Depois (ms) | Variação |
| --- | --- | --- | --- |
| Página padrão | 0,035 | 0,021 | −40,0% |
| Busca textual | 0,682 | 0,188 | −72,4% |
| Chips + curso + ordenação por nome | 1,454 | 0,075 | −94,8% |
| Idioma + disponibilidade | 0,029 | 0,043 | +48% (14 µs, ruído) |

### 2.6 Onde o tempo realmente vai

| Operação (base de 10.500) | Tempo médio |
| --- | --- |
| `take(1)` / `take(200)` no índice | 21,0 / 24,7 ms |
| `collect()` de um status | 114,7 ms |
| Query completa, plano padrão (2 × `take(200)`) | ≈ 51 ms |
| Query completa com disponibilidade (8 fatias) | ≈ 163 ms |
| Filtragem pura, 400 linhas | 0,1 – 1,8 ms |

O gargalo nº 1 é o **volume de varredura de índice por requisição**, não a lógica de negócio.

### 2.7 Otimizações implementadas

**`src/lib/talentSearch.ts`:** cache limitado de normalização (4.096 entradas); filtros preparados uma vez por requisição (`prepareFilters`); passo único de filtragem R1/R2 + filtros; `Intl.Collator` reutilizado (ordenação pt-BR/base preservada); bounds de disponibilidade memoizados; contagem de chips normalizada uma vez.
**`convex/students.ts`:** montagem dos cards em paralelo com `Promise.all` (ordem preservada, cards que falham na re-checagem continuam descartados).
**Infraestrutura nova:** `tests/perf/harness.ts`, `tests/perf/world.ts`, `tests/perf/talentSearch.perf.test.ts`, `vitest.perf.config.ts` e scripts `test:perf:all`, `test:perf:load`, `test:perf:stress`.

---

## 3. Smoke test — caminhos críticos

Arquivo: `tests/smoke/criticalPaths.smoke.test.ts` — **5/5 passaram (283 ms)**, usando as funções reais do backend via `convex-test`.

| # | Fluxo | Resultado |
| --- | --- | --- |
| 1 | Cadastro/perfil do aluno (privado por padrão, exposição e consentimento) | ✅ |
| 2 | Carregamento do Banco de Talentos (5 variações de busca/ordenação) | ✅ |
| 3 | Publicação de vaga e candidatura (match no servidor, bloqueio de duplicidade) | ✅ |
| 4 | Kanban (anti-salto, reprovação com motivo, reflexo em `myApplications`) | ✅ |
| 5 | Guardas de acesso (sem identidade, aluno no Banco de Talentos, recrutador se candidatando) | ✅ |

**Verificação das otimizações:** ordenação pt-BR (Álvaro → Bianca → Carla), ordem e conteúdo dos cards com `Promise.all`, exclusão de privados/inativos (R1/R2), busca "ALVARO" sem acento, contagem de chips e `matchScore` iguais ao cálculo puro (R8) — todos ✅.

**Anomalias:** nenhuma no produto. Uma no roteiro do teste (pulava a criação do perfil antes da candidatura); corrigida, e o servidor devolveu a guarda esperada.

---

## 4. Auditoria de segurança do frontend

| # | Achado | Correção aplicada |
| --- | --- | --- |
| 1 | **Janela transiente no `ConsentGate`:** enquanto `consents.myStatus` carregava (`undefined`), o conteúdo protegido podia ser renderizado | Estado de carregamento bloqueante com *skeleton*; conteúdo só após confirmação do backend |
| 2 | **Confiança cega no role vindo do backend (`AuthProvider`)** | Type guard `isRole()`; role fora de `ROLES` é tratado como não autenticado |
| 3 | **Carregamento de imagens com URL do servidor** (risco de `http://`, esquemas maliciosos e vazamento de `Referer`) | `safeImageUrl` (apenas `https://`), `referrerPolicy="no-referrer"`, `loading="lazy"` e fallback para iniciais/gradiente |

**Ponto de atenção:** o `safeImageUrl` chegou a ficar órfão após uma resolução de conflito (defesa existente que não protegia nada). Foi restaurado e integrado em `TalentSearchPage.tsx` e `CandidateProfilePage.tsx` (avatar e banner). Vale um teste automatizado para impedir que isso volte a acontecer (ver §7).

---

## 5. Limpeza de código e estabilização do ambiente de testes

| Indicador | Antes | Depois |
| --- | --- | --- |
| Erros de ESLint | 9 | **0** |
| Arquivos órfãos | 2 | **0** |
| `any` vazando em testes | 7 | **0** |
| Suíte completa | 1.176 ok / 21 falhas | **1.197 ok / 0 falhas** |

- **Código morto:** `src/components/ui/select.tsx` removido; `safeImageUrl` restaurado e integrado.
- **Code smells:** `TALENT_SORT_OPTIONS` (usada só como tipo) trocada por união literal; asserção `as ContractType` redundante removida. Isso resolve os dois erros de ESLint em `src/` que estavam pendentes no relatório do tsDetect.
- **Test smells (`any`):** `jobReports.test.ts`, `rejection.test.ts` e `lgpdAudit.test.ts` tipados.
- **Causa raiz das 21 falhas:** Node 22+ declara `globalThis.localStorage` como acessor que retorna `undefined` sem `--localstorage-file`, e o Vitest não o substituía pelo `Storage` do jsdom. Corrigido em `tests/setup.ts` (reaponta para o jsdom e, se inutilizável, usa mock em memória), sem alterar nenhum arquivo de teste.

---

## 6. Análise de test smells

**tsDetect:** inviável. Ele usa JavaParser e falha com `ParseProblemException` no primeiro `import` TypeScript (a contraprova em Java funcionou). Resultado vazio **não** significa ausência de smells.

**Alternativa adotada:** ESLint (`@vitest/eslint-plugin`, com configuração separada em `eslint.smells.config.mjs`), `tsc --noUnusedLocals --noUnusedParameters` e Knip.

| Regra | Antes | Depois |
| --- | --- | --- |
| `no-magic-numbers` | 635 | 494 |
| `vitest/max-expects` | 373 | 288 |
| `vitest/no-conditional-in-test` | 35 | 25 |
| `vitest/no-conditional-expect` | 23 | 11 |
| **Total** | **1.066** | **818** |

- Refatorados 5 de 110 arquivos: `application` (30→0), `closedDictionary` (27→0), `jobExpiry` (70→0), `userAccount` (58→0), `reportExport` (76→13).
- Sem testes vazios, ignorados, duplicados, com `console` ou `setTimeout` (nas regras configuradas) e sem código morto em tsc/Knip (as 2 devDependencies apontadas pelo Knip são falsos positivos).
- Focos restantes: `integration/jobReports` (36), `unit/reportExportGaps` (34), `integration/dashboardFilters` (28), `unit/timeToHire` (27), `integration/passwordReset` (26), `integration/lgpdAudit` (25) e `unit/resumeDocument` (13 de lógica condicional).

---

## 7. Possíveis soluções para melhoria do projeto

### 7.1 Desempenho (prioridade alta)

| # | Problema | Solução proposta | Impacto esperado |
| --- | --- | --- | --- |
| 1 | `talentPoolCount` lê ~6.300 documentos (dois `collect()`) a cada carregamento do Painel Estratégico | Contador denormalizado por status (incrementado em `upsertProfile`, `setVisibility` e `deleteMyProfile`) **ou** agregado com TTL de 1–5 min | Elimina a maior leitura em massa do painel. Exige decisão de produto sobre defasagem do KPI |
| 2 | Plano de disponibilidade usa 8 ranges de índice (≈ 3× mais lento que o padrão no harness) | Criar índice `by_visibility_availability` (4 ranges, mesmas ~400 linhas), mantendo R1 em memória e a re-checagem por card | Reduz leituras se o filtro virar hot path |
| 3 | Enfileiramento a partir de ~4–8 requisições concorrentes por instância | Validar em deployment Convex real antes de otimizar mais; considerar *debounce* na busca textual e cache de página padrão no cliente | Evita otimizar um gargalo que talvez não exista em produção |

### 7.2 Qualidade dos testes (prioridade média)

1. Continuar a refatoração pelos arquivos de maior contagem restante, começando por `unit/resumeDocument` (Conditional Test Logic é o smell que pode mascarar falhas).
2. Rodar a **contraprova** das regras de smells com um arquivo de smells propositais e anexar a evidência (pendência aberta no relatório do tsDetect).
3. Decidir se as regras úteis do `@vitest/eslint-plugin` migram para o `eslint.config.js` principal. Sugestão: promover `no-conditional-expect` e `no-conditional-in-test`, mantendo `no-magic-numbers` desligada em testes (alto ruído, baixo valor).
4. Substituir os testes de `closedDictionary` que leem código-fonte com `readFileSync` e regex (Mystery Guest, frágeis a refatorações) por verificação do comportamento.
5. Adicionar à CI um teste ou regra que falhe se `safeImageUrl` ficar sem referências (evitar nova defesa órfã).

### 7.3 Segurança (prioridade média/alta)

1. Os endurecimentos foram feitos **no frontend**. Garantir que a mesma validação de role, consentimento (R7) e URLs de imagem seja aplicada **no backend Convex**, já que o frontend nunca é a barreira de autorização.
2. Validar `https://` também na gravação das URLs de avatar/banner no servidor, não apenas na renderização.
3. Considerar cabeçalhos de segurança (CSP restringindo `img-src` a hosts conhecidos) como camada adicional ao `safeImageUrl`.
4. Cobrir o `ConsentGate` e o `isRole` com testes de componente (estado de carregamento não renderiza `children`; role inválido ⇒ não autenticado).

### 7.4 Infraestrutura e processo (prioridade média)

1. **Medir em ambiente real:** obter `CONVEX_DEPLOY_KEY` (ou um deployment de staging) e repetir load/stress com k6 ou artillery sobre o endpoint real.
2. Incluir a perf suite como job manual ou noturno na CI (não bloqueante), guardando os JSON de `docs/performance-artifacts/` para comparar tendências.
3. Resolver o conflito de peer dependencies (`@vitest/eslint-plugin` exige `typescript >= 6`, mas o projeto usa 5.8.3) em vez de depender de `--legacy-peer-deps`. Enquanto isso, manter `@testing-library/dom` e `@auth/core` declarados explicitamente.
4. Padronizar a formatação (Prettier) em um commit separado, para que diffs futuros não misturem ruído com mudanças semânticas.
5. Resolver os 6 warnings `react-refresh/only-export-components` (`authUi.tsx`, `ManagerNavbar.tsx`, `StudentShell.tsx`) movendo constantes para arquivos próprios, quando houver espaço no escopo.

---

## 8. Limitações dos testes

- Nenhum teste contra deployment Convex real: sem medição de latência de rede, WebSocket/realtime, cold start de isolate ou limites de billing.
- Números absolutos de p95 são inflados pelo mock (varredura linear de índice); usar apenas para comparação relativa e comportamento de saturação/recuperação.
- VM de 2 vCPU compartilhados, processo único, dispersão de ±20% no p95; sem teste multi-instância.
- UI (render/paint) não medida.
- Equivalência parcial entre ESLint e tsDetect: sem equivalente direto para Mystery Guest, Resource Optimism, Eager Test e General Fixture. O `max-expects = 3` é arbitrário, e helpers como `expectBlocked` reduzem a contagem estática sem mudar o número de asserções reais.
- Branches diferentes: o relatório de performance foi feito sobre `main @ 5e49a74`, e o de limpeza sobre `main @ 5bb3cf6`. A contagem de testes passou de 1.072 (relatório do tsDetect) para 1.197 (relatórios posteriores). Vale confirmar que as três linhas de trabalho estão integradas na mesma `main` antes de fechar a entrega.

---

## 9. Reprodução

```bash
npm ci
npm test                                                  # suíte completa (sem perf)
npx vitest run tests/smoke/criticalPaths.smoke.test.ts    # smoke test
npm run test:perf:all                                     # loading + stress + CPU (~80 s)
npx tsc -b --noEmit                                       # typecheck
npx eslint . --quiet                                      # lint
npx eslint -c eslint.smells.config.mjs tests              # análise de test smells
```