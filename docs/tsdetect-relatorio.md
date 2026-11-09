# Relatório: análise de test smells no projeto bdc-unicap

Do tsDetect (inviável para TypeScript) a uma análise equivalente com ESLint, tsc e Knip, seguida de refatoração de testes

## 1. Objetivo

Aplicar uma análise de *test smells* nos testes do projeto **bdc-unicap** e buscar formas de otimizar o código (remoção de variáveis e dados não utilizados). A ferramenta inicialmente escolhida foi o **Test Smell Detector (tsDetect)**.

## 2. Contexto do projeto

- Linguagem: **TypeScript** (arquivos `.ts` e `.tsx`)
- Framework de testes: **Vitest** (com Testing Library e convex-test)
- Testes em `tests/unit`, `tests/components` e `tests/integration`: **110 arquivos de teste** analisados
- Estado inicial da suíte: todos os testes passando

## 3. Tentativa com o tsDetect

### 3.1 Ferramenta

- **tsDetect** (TestSmellDetector), disponível em <https://github.com/TestSmells/TestSmellDetector/releases>
- Execução: `java -jar TestSmellDetector.jar entrada.csv`
- Entrada: CSV no formato `appName,caminhoDoTeste,caminhoDoArquivoDeProducao`
- Saída: CSV com `1` (ou `true`) para cada smell detectado
- Todos os exemplos da documentação oficial usam arquivos **Java**. O stack trace mostra que a análise é feita pelo **JavaParser** (`com.github.javaparser`), um analisador sintático de código Java.

### 3.2 Execução em um teste TypeScript

Ao analisar `tests/unit/formatters.test.ts`, a ferramenta falhou com `ParseProblemException` na **linha 1, coluna 1**, dentro de `ImportDeclaration`: o parser encontrou `{` onde, em Java, esperaria um identificador. Isso corresponde ao `import { ... } from "vitest"` do TypeScript, sintaxe que a gramática de Java não reconhece. Nenhum teste foi analisado e nenhum smell foi reportado.

### 3.3 Contraprova em Java

Para descartar erro na execução, foi criado um arquivo Java mínimo (`ExemploTest.java`) com smells propositais. Após corrigir a codificação do arquivo (ANSI/UTF-8 sem BOM), a ferramenta detectou exatamente os smells inseridos: Assertion Roulette, Conditional Test Logic, Print Statement, Redundant Assertion e Magic Number Test.

### 3.4 Conclusão sobre o tsDetect

A ferramenta está instalada e funcionando, mas **não analisa os testes deste projeto**. A documentação não lista explicitamente as linguagens suportadas, mas os exemplos são todos em Java e o erro de parse demonstra a limitação na prática. A ausência de smells no resultado para arquivos TypeScript **não significa que o código esteja livre de smells**: significa que a ferramenta não consegue analisar o arquivo.

## 4. Alternativa adotada para TypeScript

A mesma análise foi feita com ferramentas equivalentes do ecossistema JavaScript/TypeScript.

| Smell (tsDetect) | Regra / ferramenta equivalente |
| --- | --- |
| Empty Test / Unknown Test | `vitest/expect-expect` |
| Conditional Test Logic | `vitest/no-conditional-in-test`, `vitest/no-conditional-expect` |
| Assertion Roulette | `vitest/max-expects` (limite adotado: 3) |
| Ignored Test | `vitest/no-disabled-tests`, `vitest/no-commented-out-tests` |
| Duplicate Test | `vitest/no-identical-title`, `vitest/no-duplicate-hooks` |
| Print Statement | `no-console` |
| Magic Number Test | `no-magic-numbers` |
| Sleepy Test | `no-restricted-syntax` (chamadas a `setTimeout`) |
| Variáveis não usadas | `tsc --noUnusedLocals --noUnusedParameters` e `@typescript-eslint/no-unused-vars` |
| Arquivos, exports e dependências sem uso | `knip` |

As regras de smells ficam em um arquivo separado, `eslint.smells.config.mjs`, para não alterar o `eslint.config.js` oficial do projeto. Comandos:

```bash
npx eslint -c eslint.smells.config.mjs tests
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
npx knip
```

### 4.1 Problemas de instalação

- O `@vitest/eslint-plugin` declarava `typescript >= 6.0.0` como peer dependency opcional, enquanto o `typescript-eslint` aceita apenas `< 6.1.0` e o projeto usa `typescript@5.8.3`. O npm não resolveu o conflito (`ERESOLVE`). A instalação foi feita com `--legacy-peer-deps`.
- Esse modo deixa de instalar peer dependencies automaticamente, o que removeu `@testing-library/dom` (erros de tipo em `screen` e `fireEvent`) e `@auth/core` (falha do `@convex-dev/auth` nos testes de integração). Ambos foram instalados explicitamente como devDependencies.

## 5. Resultados da análise

### 5.1 ESLint (smells), antes da refatoração

| Regra | Ocorrências |
| --- | --- |
| `no-magic-numbers` | 635 |
| `vitest/max-expects` | 373 |
| `vitest/no-conditional-in-test` | 35 |
| `vitest/no-conditional-expect` | 23 |
| **Total** | **1.066** |

As regras `expect-expect`, `no-disabled-tests`, `no-identical-title`, `no-commented-out-tests`, `no-console` e a restrição de `setTimeout` não dispararam em nenhum arquivo. Isso indica ausência de testes vazios, ignorados, com títulos idênticos, com print ou com espera por tempo. Essa conclusão depende de as regras estarem corretamente configuradas (ver seção 8).

### 5.2 Variáveis e parâmetros não usados (tsc)

O `tsconfig.json` do projeto inclui `src`, `tests` e `convex` e tem `noUnusedLocals` e `noUnusedParameters` ativados. A execução de `tsc --noEmit --noUnusedLocals --noUnusedParameters` gerou saída vazia, e o `tsc -b` do build também concluiu sem erros. Portanto não há variáveis nem parâmetros locais sem uso nesses diretórios. O `@typescript-eslint/no-unused-vars`, ativo como `error` no ESLint principal para `src` e `tests`, reforça esse resultado.

### 5.3 Knip (arquivos, exports e dependências sem uso)

O Knip não reportou arquivos nem exports sem uso. Reportou duas devDependencies, ambas falsos positivos:

- `@vitest/eslint-plugin`: só é importado por `eslint.smells.config.mjs`, que o Knip não reconhece como configuração do ESLint.
- `lint-staged`: é chamado pelo hook `.husky/pre-commit` (`bunx lint-staged`) e configurado no `package.json`. O Knip não lê o script de shell do Husky.

### 5.4 Distribuição dos avisos

Os avisos se concentram em poucos arquivos. Os maiores eram `unit/reportExport` (76), `unit/jobExpiry` (70), `integration/userAccount` (58), `integration/jobReports` (36), `unit/reportExportGaps` (34) e `unit/application` (30). Os literais mais frequentes em `no-magic-numbers` eram `2`, `60`, `3`, `30`, `1000`, `10` e `2026`, em geral dados de entrada e valores esperados dos próprios casos de teste.

## 6. Refatoração

Foram refatorados cinco arquivos, escolhidos por concentrarem mais avisos ou por conterem Conditional Test Logic.

### 6.1 Estudo de caso: `application.test.ts`

O arquivo tinha 30 avisos: 8 de `no-conditional-in-test`, 9 de `no-conditional-expect`, 3 de `max-expects` e 10 de `no-magic-numbers`. O padrão dominante era:

```ts
expect(decision.ok).toBe(false);
if (!decision.ok) {
  expect(decision.error).toMatch(/.../i);
}
```

O `if` servia apenas para o TypeScript estreitar o tipo. Como o `expect` anterior já falhava caso `ok` fosse verdadeiro, o risco real era baixo, mas a estrutura violava a regra. Foi substituída por um helper fora do corpo dos testes:

```ts
function expectBlocked(decision: Decision, error: RegExp) {
  assert(!decision.ok, "esperava uma decisão bloqueada (ok === false)");
  expect(decision.error).toMatch(error);
}
```

Resultado: **30 avisos → 0**, e **20 → 27 testes** (testes grandes foram divididos), todos passando. Um caso duplicado (Reprovado → Inscrito) foi removido.

### 6.2 Técnicas aplicadas

- **Conditional Test Logic:** `assert` do Vitest em helper (estreita o tipo e falha o teste) e `toMatchObject` no lugar de `if`.
- **Assertion Roulette:** testes divididos por cenário; `it.each` para tabelas de casos; uma única asserção que lista o que falta (`expect(missing).toEqual([])`) no lugar de loops com um `expect` por item.
- **Magic Number:** constantes nomeadas (`SETE_DIAS_MS`, `CRC32_CHECK_VALUE`, assinaturas e offsets ZIP) e datas ISO (`new Date("2026-09-01")`) no lugar de `Date.UTC(2026, 8, 1)`.
- **Duplicação e asserções inúteis:** removidos um teste duplicado, uma asserção redundante e um `expect(x).toBeDefined()` sem efeito; `import` duplicado do mesmo módulo unificado.
- **Fixtures de integração:** cenários extraídos para helpers (`deleteStudentAccount` etc.) e verificações por conjunto de ids, em vez de dezenas de `some(...)` encadeados.

### 6.3 Resultado nos cinco arquivos

| Arquivo | Avisos antes | Avisos depois | Testes depois |
| --- | --- | --- | --- |
| `unit/application.test.ts` | 30 | 0 | 27 |
| `unit/closedDictionary.test.ts` | 27 | 0 | 51 |
| `unit/jobExpiry.test.ts` | 70 | 0 | 15 |
| `integration/userAccount.test.ts` | 58 | 0 | 33 |
| `unit/reportExport.test.ts` | 76 | 13 | 42 |

Os 13 avisos restantes em `reportExport` estão em uma fixture do relatório operacional, onde o literal numérico é o próprio caso de teste (entrada e saída esperada). Nomear cada valor prejudicaria a leitura, então foram mantidos.

## 7. Comparação global

| Regra | Antes | Depois |
| --- | --- | --- |
| `no-magic-numbers` | 635 | 494 |
| `vitest/max-expects` | 373 | 288 |
| `vitest/no-conditional-in-test` | 35 | 25 |
| `vitest/no-conditional-expect` | 23 | 11 |
| **Total** | **1.066** | **818** |

A redução foi de 248 avisos (cerca de 23%). Os arquivos sem nenhum aviso passaram de 20 para 24, entre 110 analisados. Após as alterações, a suíte completa passou (108 arquivos, 1.072 testes) e o `npm run build` concluiu sem erros.

Maiores focos restantes: `integration/jobReports` (36), `unit/reportExportGaps` (34), `integration/dashboardFilters` (28), `unit/timeToHire` (27), `integration/passwordReset` (26), `integration/lgpdAudit` (25) e `unit/resumeDocument` (13 avisos de Conditional Test Logic, o maior foco restante desse tipo).

## 8. Limitações

- **Equivalência parcial:** as regras de ESLint cobrem apenas parte dos smells do tsDetect. Não há equivalente direto para Mystery Guest, Resource Optimism, Eager Test e General Fixture. Os resultados não são comparáveis número a número com os do tsDetect em Java.
- **Limite de `max-expects`:** o valor 3 é arbitrário. O tsDetect considera Assertion Roulette em qualquer teste com mais de uma asserção sem mensagem, critério mais rígido.
- **Efeito do método de medição:** os helpers (`expectBlocked`, `expectInvalid`) tiram `expect` da contagem estática da regra. Parte da queda de `max-expects` vem disso; o ganho concreto está nos testes menores, que apontam um cenário por falha.
- **Ruído de `no-magic-numbers`:** em código de teste, a maioria dos literais são dados dos casos. A regra é pouco confiável como indicador de qualidade nesse contexto.
- **Regras sem disparo:** o resultado zero em `expect-expect`, `no-disabled-tests` e demais só vale se as regras disparam quando deveriam. Isso se confirma rodando a configuração sobre um arquivo com smells propositais (contraprova equivalente à da seção 3.3).
- **Escopo do tsc:** a verificação de código não usado cobre apenas variáveis e parâmetros locais. Exports e arquivos sem uso são responsabilidade do Knip, que não encontrou nenhum.
- **Mystery Guest remanescente:** testes de `closedDictionary` leem arquivos-fonte com `readFileSync` e regex, o que os torna frágeis a refatorações do código de produção. Não foram alterados por ser decisão de design.
- **Dependências:** o uso de `--legacy-peer-deps` ignora a checagem de peer dependencies; os pacotes ausentes foram adicionados manualmente.
- **Escopo da refatoração:** apenas 5 dos 110 arquivos foram refatorados.
- **Erros do ESLint em `src/`:** `npx eslint .` reporta dois erros em arquivos de produção não alterados (`JobOpportunities.tsx` e `talentSearch.ts`). Ainda não foi verificado se são anteriores a este trabalho ou consequência de atualização de dependências.

## 9. Conclusão

O tsDetect não é aplicável ao projeto, pois depende do JavaParser e só interpreta Java. A análise equivalente com ESLint (plugin do Vitest), tsc e Knip é viável e identificou 1.066 ocorrências de smells, concentradas em Assertion Roulette e Magic Number, com 58 de Conditional Test Logic, o mais relevante por poder mascarar falhas.

O projeto não apresentou código morto detectável (tsc e Knip), nem testes vazios, ignorados ou duplicados nas regras configuradas. As duas dependências apontadas pelo Knip são falsos positivos, portanto a análise não encontrou nada para remover. A refatoração de cinco arquivos reduziu o total de avisos em 23% sem perda de cobertura: a suíte completa continua passando e o build concluiu.

## 10. Pendências

1. Rodar a contraprova das regras de smells com um arquivo de smells propositais e anexar a evidência.
2. Decidir se `@vitest/eslint-plugin` permanece só na configuração de análise ou se as regras úteis migram para o `eslint.config.js` principal.
3. Investigar os dois erros do ESLint em `src/` (anteriores ou causados pelas atualizações).
4. Opcional: continuar a refatoração pelos arquivos de maior contagem restante, começando por `unit/resumeDocument`.