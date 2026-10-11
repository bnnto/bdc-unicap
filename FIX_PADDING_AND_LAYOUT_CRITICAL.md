# ULTIMATO DE UI: Correção Crítica de Padding e Espaçamento Interno

## O Problema Atual (Baseado nas imagens reais da aplicação)
O layout está completamente SUFOCADO. Os textos, botões e inputs estão a tocar fisicamente nas linhas das bordas dos containers. A regra básica de CSS foi ignorada: elementos com borda (`border`) precisam de espaçamento interno (`padding`).

## A Regra de Ouro (APLICAR EM TODO O LADO)
**NENHUM texto, input ou botão pode tocar nas bordas de um container.** 
Toda a vez que houver uma classe `border`, `border-slate-800` (ou similar) ou `bg-slate-900`/`bg-canvas`, TEM DE HAVER uma classe de padding (`p-6`, `p-8` ou no mínimo `px-6 py-5`) no MESMO elemento.

## Etapa 1: Dashboard e Painel Operacional
- Localize os cards de "Taxa de Empregabilidade", "Time-to-Hire", "Resultados finais", etc.
- As divs que contêm essas secções precisam de `p-6` ou `p-8`. O texto do título não pode encostar na margem esquerda!

## Etapa 2: Banco de Talentos
- **Sidebar de Filtros ("Área & Curso"):** A div principal do filtro precisa de `p-6` para que os labels e dropdowns não batam nas bordas.
- **Card do Aluno:** A div que envolve o perfil do aluno (onde está o nome e a foto) tem de ter `p-6`. O avatar e o botão "Visualizar Perfil" estão colados à linha!

## Etapa 3: Formulário de Publicar Vaga
- O fundo cinza foi removido, mas o conteúdo ficou esmagado.
- Nas secções "Sobre a vaga", "Pré-requisitos" e "Contrato & Remuneração", a `fieldset` ou `div` que envolve cada secção TEM de ter `p-6` e as margens internas precisam de `gap-6`. O label "Título da vaga" não pode tocar na linha esquerda.

## Etapa 4: Minhas Vagas
- O container principal que engloba a lista de "Minhas vagas" e o botão "+ Publicar nova vaga" está sem padding. Adicione `p-6` ou `p-8` ao wrapper principal para empurrar o conteúdo para dentro.
- Os cards individuais de cada vaga também precisam de `p-6`.

## Etapa 5: Ícones na Navbar
- Na barra de navegação superior, certifique-se de que os ícones do `lucide-react` estão realmente a ser renderizados ao lado de "Dashboard de Métricas", "Banco de Talentos" e "Vagas & Pipeline". Use `<Icon className="w-4 h-4 mr-2" />`.