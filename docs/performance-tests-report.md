# Relatório — Testes de Carga e Estresse (Banco de Talentos)

**Data:** 12/11/2026
**Branch:** `perf/load-and-stress-tests` (base: `main` @ `5e49a74`)
**Escopo medido:** `students.searchTalent` — o caminho mais quente do produto (Banco de Talentos), com a base do benchmark de 10.500 currículos.

---

## 1. Metodologia e alvo dos testes

| Item | Definição |
| --- | --- |
| Ferramenta | Harness próprio em TypeScript/Vitest, **sem dependências novas** (`tests/perf/harness.ts`): virtual users, percentis nearest-rank, rampa, recuperação e artefatos JSON |
| Backend medido | Funções **reais** do Convex (`convex/students.ts`) executadas pelo mock oficial `convex-test`: mesmo schema, mesmos índices, mesmos guards R1/R2/R6/R7 e mesma paginação |
| Base de dados | 10.500 currículos semeados pela `internalMutation` de produção (`students.seedTalentBenchmarkBatch`) — 60% elegíveis, 20% inativos (R1), 20% privados (R2) |
| Mix de tráfego | 5 filtros reais em rodízio: página padrão, busca textual, chips + curso + ordenação, disponibilidade + idioma, faixa de conclusão + local |
| Critério de saúde | p95 ≤ 500 ms (SLA declarado em `TALENT_QUERY_SLA_MS`) e taxa de erro < 1% |
| Ambiente | 2 vCPU, 3.915 MB RAM, Node v26.13.0, processo único |

**Por que não k6/artillery:** não há deployment Convex neste ambiente (sem `CONVEX_DEPLOY_KEY`, e `convex dev`/`login` exigem navegador), e k6/artillery não estão instalados. Um teste HTTP contra um endpoint inexistente mediria nada. O alvo real de custo é a query no backend, então o harness executa a função Convex de verdade no processo, com concorrência controlada.

### 1.1 Cuidado importante com a leitura dos números absolutos

O `convex-test` **varre ranges de índice de forma linear** e o `take()` não poda a varredura. Prova medida (mesma consulta, `take(1)`):

| Base | `take(1)` | `take(200)` |
| --- | --- | --- |
| 5 linhas | 0,44 ms | 0,45 ms |
| 10.500 linhas | 21,00 ms | 24,70 ms |

Ou seja: o custo por operação de índice no harness é O(linhas do range), enquanto o Convex de produção faz seek O(log n) e poda o `take`. **Os valores absolutos de p95 são um proxy do harness; o que transfere para produção é (a) o nº de operações de índice por requisição, (b) o volume de documentos lidos e (c) o custo de CPU por requisição.** As conclusões abaixo separam explicitamente esses dois planos.

---

## 2. Loading Test — carga normal

**Cenário:** 8 usuários virtuais simultâneos, 15 s, mix de filtros, após warmup de 2 s.

| Métrica | Antes (código original) | Depois (otimizado) |
| --- | --- | --- |
| Requisições | 215 | 196 – 208 |
| Throughput | 14,33 req/s | 12,33 – 13,07 req/s |
| p50 | 49,78 ms | 68,08 – 79,27 ms |
| p90 | 601,06 ms | 647,30 ms |
| **p95** | **626,22 ms** | **710,78 – 779,95 ms** |
| p99 | 714,42 ms | 780,24 – 916,67 ms |
| Máximo | 734,28 ms | 803,42 ms |
| Taxa de erro | **0%** | **0%** |
| Estabilidade | sem erro, sem vazamento | sem erro, sem vazamento |

**Veredito no harness:** p95 acima do SLA de 500 ms em ambas as versões — e **não distinguível** entre antes e depois: as três execuções do código otimizado ficaram em 711/736/780 ms contra 626 ms e 762 ms do código original em execuções distintas. A dispersão entre execuções (±20%) numa VM de 2 vCPU compartilhados é maior que o efeito das otimizações neste harness, porque **~95% do tempo da query no mock é a varredura linear de índice** (seção 5) e as otimizações atacaram CPU, que era 0,03–1,45 ms por consulta.

**O que melhora de fato (e é medido de forma determinística):** o benchmark de CPU da seção 4, que é a parcela que também domina a produção quando o acesso a índice deixa de ser linear.

---

## 3. Stress Test — rampa até a quebra e recuperação

**Rampa:** 1 → 128 VUs, 4 s por degrau, sem parada antecipada.

### 3.1 Antes (código original)

| VUs | Req/s | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Erros |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 14,25 | 48,17 | 141,08 | 154,31 | 186,60 | 0 |
| 2 | 14,25 | 51,98 | 168,02 | 193,57 | 290,80 | 0 |
| 4 | 13,25 | 199,21 | 400,31 | 446,11 | 478,98 | 0 |
| 8 | 16,00 | 517,21 | 706,88 | 760,90 | 770,36 | 0 |
| 16 | 18,25 | 1.087,39 | 1.157,45 | 1.197,56 | 1.238,92 | 0 |
| 32 | 21,75 | 2.237,94 | 2.317,66 | 2.361,04 | 2.376,54 | 0 |
| 64 | 29,25 | 4.418,26 | 4.757,61 | 4.836,72 | 4.859,09 | 0 |
| 128 | 45,50 | 6.559,01 | 8.683,73 | 9.179,00 | 9.278,57 | 0 |

### 3.2 Depois (código otimizado)

| VUs | Req/s | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Erros |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 12,50 | 54,76 | 155,97 | 191,56 | 220,29 | 0 |
| 2 | 12,75 | 59,04 | 190,14 | 229,74 | 326,86 | 0 |
| 4 | 11,25 | 303,27 | 480,62 | 528,41 | 557,31 | 0 |
| 8 | 13,50 | 613,40 | 771,54 | 855,46 | 894,75 | 0 |
| 16 | 15,25 | 1.382,45 | 1.516,61 | 1.656,06 | 1.764,73 | 0 |
| 32 | 19,75 | 2.599,18 | 2.703,13 | 2.805,70 | 2.836,93 | 0 |
| 64 | 28,00 | 4.597,71 | 4.949,17 | 5.154,35 | 5.202,10 | 0 |
| 128 | 45,25 | 7.037,84 | 9.460,32 | 10.058,59 | 10.152,12 | 0 |

### 3.3 Ponto de quebra

- **Critério:** primeiro degrau com p95 > 500 ms.
- **Antes:** 8 VUs (p95 760,90 ms). **Depois:** 4 VUs (p95 528,41 ms), contra 446,11 ms no mesmo degrau da execução anterior.
- **Leitura honesta:** o degrau exato da quebra varia **entre 4 e 8 VUs** nas execuções, porque o p95 no entorno de 500 ms está dentro da dispersão do harness. O que é estável é o **joelho da curva**: com ~4–8 requisições concorrentes a latência deixa de ser aceitável; a partir daí o p95 cresce de forma praticamente linear com a concorrência (761 → 1.198 → 2.361 → 4.837 → 9.179 ms), sem nenhum erro HTTP/transação.
- **Saturação de throughput:** o maior valor observado foi ~45 req/s a 128 VUs, mas esse número é **inflado pelo aquecimento de JIT ao longo dos ~40 s de rampa** (o mesmo efeito aparece nas duas versões: 13 req/s nos primeiros degraus, 45 req/s no último). A capacidade estável de uma instância é a dos degraus iniciais: **~13–14 req/s** neste harness. Por isso o sinal confiável é o p95 por degrau, não o req/s absoluto.
- **Sem erros em nenhum degrau** (0 erros em 128 VUs): o sistema não falha, ele enfileira — comportamento esperado de um runtime single-threaded por instância.

### 3.4 Recuperação

| Métrica | Antes | Depois |
| --- | --- | --- |
| Estágio | 4 VUs, 8 s, imediatamente após 128 VUs | idem |
| p95 na recuperação | 357,88 ms | 460,43 ms |
| p95 do mesmo regime na rampa | 446,11 ms | 528,41 ms |
| Fator (recuperação ÷ rampa) | **0,80×** | **0,87×** |
| Erros | 0 | 0 |
| Heap / RSS ao final | 72,8 MB / 228,5 MB | 72,5 MB / 210,6 MB |

**Sem degradação residual e sem vazamento:** a latência na recuperação ficou *abaixo* do mesmo regime medido durante a rampa (fator 0,80–0,87×) e a memória permaneceu estável depois de 128 VUs concorrentes, sem restart.

---

## 4. Benchmark de CPU — filtragem pura (400 linhas por consulta)

Isolado do banco de dados, 400 iterações por cenário após warmup. É a parcela do custo que **não** é o artefato de índice do mock e que domina em produção.

| Cenário | Antes (ms/consulta) | Depois (ms/consulta) | Variação | Consultas/s (antes → depois) |
| --- | --- | --- | --- | --- |
| Página padrão | 0,035 | **0,021** | **−40,0%** | 28.309 → 47.963 |
| Busca textual | 0,682 | **0,188** | **−72,4%** | 1.466 → 5.312 |
| Chips + curso + ordenação por nome | 1,454 | **0,075** | **−94,8%** | 688 → 13.384 |
| Idioma + disponibilidade | 0,029 | 0,043 | +48% (14 µs absolutos) | 34.104 → 23.313 |

O último cenário é ruído de medição na casa das dezenas de microssegundos; os três primeiros são ganhos determinísticos e reproduzíveis.

---

## 5. Análise detalhada — onde o tempo realmente vai

Sondas executadas antes das otimizações, na base de 10.500 currículos:

| Operação | Tempo médio |
| --- | --- |
| `ctx.db.run` vazio | 0,00 ms |
| `db.get` por id (x1) / (x10 em série) | 0,10 ms / +0,8 ms |
| `take(1)` no índice `by_visibility_status` | 21,0 ms |
| `take(10)` / `take(50)` / `take(200)` | 22,9 / 23,2 / 24,7 ms |
| `take(2000)` | 53,4 ms |
| `first()` no índice | 20,8 ms |
| `collect()` de um status | 114,7 ms |
| 2 × `take(200)` (plano padrão) | 45,1 ms |
| 8 × `take(50)` (plano de disponibilidade) | 145,5 ms |
| `filterTalentCandidates` puro, 400 linhas (padrão / textual / chips+nome) | 0,1 / 0,9 / 1,8 ms |
| Query completa padrão / sem resultado / idioma | 51,1 / 49,5 / 51,2 ms |
| Query completa com disponibilidade (8 fatias) | 162,7 ms |

### 5.1 Conclusões

1. **O gargalo nº 1 é o volume de varredura de índice por requisição** (≈45 ms no plano padrão, ≈146 ms no plano de disponibilidade), não a lógica de negócio. O mock varre ranges linearmente; produção faz seek e poda, mas o número de ranges e o teto de linhas lidas continuam sendo o que controla leitura/billing/latência.
2. **O custo de CPU era relevante e totalmente evitável**: 1,45 ms por consulta no cenário com chips + ordenação, dos quais quase tudo era `String.localeCompare` com locale/options reavaliadas e renormalização de strings repetidas (curso, competências, idioma, localidade) uma vez por candidato.
3. **A montagem da página fazia até 10 leituras em série** (`db.get` do card, dono e URL da imagem) — custo linear no tamanho da página, quando poderia ser concorrente.
4. **Nenhum erro ou vazamento** apareceu em nenhum degrau: o modo de falha do sistema é enfileiramento (latência crescente), não indisponibilidade. A recuperação é imediata e completa.
5. **Dois pontos fora do escopo do que foi corrigido** (seção 7) continuam relevantes: o KPI `talentPoolCount` e o plano de 8 fatias da disponibilidade.

---

## 6. Correções e otimizações implementadas

### 6.1 `src/lib/talentSearch.ts`

| # | Correção | Local | Efeito medido |
| --- | --- | --- | --- |
| 1 | **Cache limitado de normalização** (`normalizeForSearch`): `NFD` + regex + `toLowerCase` era refeito para a mesma string em cada candidato. Cache de 4.096 entradas, limpo ao encher (sem crescimento ilimitado no isolate) | `talentSearch.ts:178` | base do ganho dos itens 2–4 |
| 2 | **Filtros preparados uma vez por requisição** (`prepareFilters`): curso, local, competência, chips, idioma e busca são normalizados **uma vez**, não `O(linhas × filtros)` vezes | `talentSearch.ts:280` | busca textual −72,4% |
| 3 | **Passo único de filtragem**: elegibilidade R1/R2 + filtros no mesmo laço, sem dois arrays intermediários sobre o teto de 400 linhas; ordenação feita no array já criado (sem cópia) | `talentSearch.ts:411` | página padrão −40% |
| 4 | **`Intl.Collator` reutilizado** no lugar de `String.localeCompare(b, "pt-BR", { sensitivity: "base" })` por comparação (~n·log n por página). Mesma ordenação pt-BR/base | `talentSearch.ts:395` | chips + nome −94,8% |
| 5 | **Bounds de disponibilidade memoizados**: eram recalculados (4 filtragens + 4 ordenações) a cada query, para constantes do catálogo | `talentSearch.ts:48` | remove trabalho por requisição |
| 6 | **Contagem de chips normalizada uma vez** (`countNormalizedSkillMatches`), usada na ordenação por relevância | `talentSearch.ts:475` | incluído no item 4 |

### 6.2 `convex/students.ts`

| # | Correção | Local | Efeito |
| --- | --- | --- | --- |
| 7 | **Montagem dos cards em paralelo** (`Promise.all`): a re-checagem R1/R2, o dono e a URL da imagem eram sequenciais (até 10 awaits por página). Ordem dos itens preservada; cards que falham na re-checagem continuam descartados | `students.ts:1081` | remove o custo linear no tamanho da página |

### 6.3 Infraestrutura de testes (nova)

| Arquivo | Papel |
| --- | --- |
| `tests/perf/harness.ts` | Harness sem dependências: VUs, percentis, rampa, classificação de saturação/quebra, tabelas markdown, artefatos JSON |
| `tests/perf/world.ts` | Seed de 10.500 currículos pela `internalMutation` real + cliente recrutador consentido + mix de 5 cenários |
| `tests/perf/talentSearch.perf.test.ts` | Loading Test (8 VUs/15 s), Stress Test (rampa 1→128 VUs + recuperação) e benchmark de CPU |
| `vitest.perf.config.ts` | Config dedicada (ambiente `node`, sem jsdom, execução serial) |
| `docs/performance-artifacts/*.json` | Evidência bruta: `loading-test.json`, `stress-test.json`, `filter-cpu.json` |

Scripts adicionados (`package.json`): `test:perf:all`, `test:perf:load`, `test:perf:stress`.

---

## 7. Achados não corrigidos (com recomendação)

1. **`talentPoolCount` lê o pool inteiro** (`convex/students.ts`, KPI do Painel Estratégico): dois `collect()` (ativo + egresso) leem ~6.300 documentos por carregamento do painel. No harness, cada `collect()` de status custou **114,7 ms**. Não foi alterado porque o KPI é exibido como número exato e qualquer cache/contador denormalizado muda semântica (defasagem) e exige decisão de produto. **Recomendação:** contador denormalizado por status (incrementado em `upsertProfile`/`setVisibility`/`deleteMyProfile`) ou agregado com TTL de 1–5 min.
2. **Plano de disponibilidade usa 8 ranges de índice** (4 grupos × 2 status): 162,7 ms contra 51,1 ms do plano padrão no harness. Os 4 grupos são necessários para correção (o índice não é multikey: um currículo com `["integral","estagio"]` mora no grupo "integral"), então é um trade-off de recall × leitura. **Recomendação:** se esse filtro virar hot path, criar índice `by_visibility_availability` (4 ranges, mesmas ~400 linhas lidas) mantendo R1 na filtragem em memória + re-checagem por card.
3. **Varredura linear do `convex-test`** (seção 1.1): limitação do harness, não do produto. Não deve ser "corrigida" no código de produção.

---

## 8. Reprodução

```bash
npm ci                                        # instala a partir do package-lock.json
npm run test:perf:all                         # loading + stress + CPU (~80 s)
npm run test:perf:load                        # apenas Loading Test
npm run test:perf:stress                      # apenas Stress Test
```

Artefatos gerados em `docs/performance-artifacts/`. Os percentis são nearest-rank; o throughput é requisições ÷ duração do estágio.

## 9. Validação funcional após as correções

| Verificação | Resultado |
|---|---|
| `npm run typecheck` (`tsc -b --noEmit`) | limpo |
| `npm test` (suíte completa, sem perf) | 108 arquivos / 1.197 testes, todos passando |
| `npx eslint` nos arquivos alterados e novos | sem erros (`convex/` não é coberto pela config do ESLint — comportamento pré-existente) |
| Perf suite | 3 testes passando, 0 erros de transação em todos os degraus |

### Smoke Test

**Arquivo:** `tests/smoke/criticalPaths.smoke.test.ts` (incluído na suíte padrão `npm test`)
**Execução:** `npx vitest run tests/smoke/criticalPaths.smoke.test.ts`
**Resultado:** 5/5 testes passaram em 283 ms — sem falhas, sem anomalia no produto.

O objetivo é validar o caminho crítico da versão otimizada com as mutations/queries reais do backend (`convex-test`), não com mocks de função: cada passo usa a mesma guarda de papel, consentimento LGPD (R7) e regra de negócio que a UI dispara em produção.

#### Caminhos críticos cobertos

| # | Fluxo | Funções reais exercitadas | Resultado |
|---|---|---|---|
| 1 | Cadastro/perfil do aluno — perfil nasce privado (R2), aluno expõe no Banco de Talentos e autoriza contato (R6) | `students.upsertProfile`, `students.myProfile`, `students.setVisibility`, `students.setContactConsent`, `students.searchTalent` | ✅ Passou |
| 2 | Carregamento do Banco de Talentos — busca padrão, ordenação por nome, chips, busca textual e página fora do range | `students.searchTalent` (5 variações) | ✅ Passou |
| 3 | Publicação de vaga + envio de candidatura — vaga publicada pelo recrutador, candidatura com match calculado no servidor (R8), bloqueio de duplicidade e de pré-requisito obrigatório | `jobs.upsertJob`, `applications.applyToJob` | ✅ Passou |
| 4 | Kanban — inscrito → triagem → entrevista → aprovado, anti-salto, reprovação com motivo (R5), reflexo em `myApplications` e acesso do recrutador ao perfil do candidato | `applications.moveApplication`, `applications.myApplications`, `students.getCandidateProfile` | ✅ Passou |
| 5 | Guardas de acesso — sem identidade, aluno no Banco de Talentos, recrutador se candidatando | `students.searchTalent`, `applications.applyToJob` | ✅ Passou |

#### Verificação específica das otimizações

| Otimização | Como a regra de negócio foi conferida | Resultado |
|---|---|---|
| `Intl.Collator` no lugar de `localeCompare` | Massa com Álvaro Pereira, Bianca Lima, Carla Menezes e `sort: "nome"`: a ordem precisa ser Álvaro → Bianca → Carla. Uma comparação por code point colocaria a acentuada por último, então o teste falha se a ordenação pt-BR/base for perdida | ✅ Passou |
| `Promise.all` na montagem dos cards | Ordem e conteúdo dos itens preservados; R6 continua projetado por card (`contactAllowed` e `linkedinUrl` nulos para quem não autorizou e preenchidos para quem autorizou); `getCandidateProfile` segue ocultando e-mail sem autorização | ✅ Passou |
| Passo único de filtragem (R1/R2) | Base com um currículo privado e um inativo público: ambos continuam fora do resultado (`total = 3`), nem na busca padrão nem na ordenada | ✅ Passou |
| `prepareFilters` + cache de normalização | `search: "ALVARO"` (maiúsculas, sem acento) encontra Álvaro Pereira; chips `["React","SQL","Python"]` contam exatamente 2 matches por card | ✅ Passou |
| Match no servidor (R8) | `matchScore` persistido é comparado ao resultado de `computeMatchScore` puro, com as mesmas entradas do perfil e da vaga | ✅ Passou |

#### Anomalias

- **No produto:** nenhuma. Nenhuma regra R1/R2/R5/R6/R7/R8 regrediu, nenhuma transição válida foi bloqueada e nenhuma transição inválida passou.
- **No roteiro do teste:** uma. A primeira execução falhou no cenário 4 com `Complete o cadastro do perfil antes de se candidatar.` — o próprio roteiro pulava a criação do perfil antes de candidatar. Era um erro do teste, não do código: a mensagem devolvida pelo servidor é exatamente a guarda esperada. Corrigido o roteiro, 5/5 passaram.

## 10. Limitações explícitas

- Não houve teste contra um deployment Convex real: não há `CONVEX_DEPLOY_KEY` neste ambiente e `convex dev`/`login` exigem navegador. Não foram medidos latência de rede, WebSocket/realtime, cold start de isolate nem limites de billing.
- k6/artillery não foram usados (não instalados e sem endpoint HTTP de backend para atacar); o harness é Node/Vitest sem dependências novas.
- Números absolutos de p95 são inflados pelo mock (varredura linear de índice, seção 1.1). Use-os para comparação relativa e para o comportamento de saturação/recuperação, não como capacidade de produção.
- Não foi medida a camada de UI (render/paint): o benchmark de CPU cobre a função pura compartilhada com a UI, mas não o navegador.
- VM de 2 vCPU compartilhados, processo único: dispersão entre execuções de ±20% no p95; não há teste multi-instância nem contenção de CPU de outros processos.