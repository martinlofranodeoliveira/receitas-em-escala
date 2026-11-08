---
name: "Receitas em Escala"
description: "Fichas claras, porções ajustáveis e quantidades com identidade explícita."
colors:
  primary: "#154daa"
  primary-hover: "#103d87"
  ink: "#172a43"
  muted: "#5b6b80"
  canvas: "#f7f9fc"
  cold: "#f0f4fa"
  white: "#fff"
  line: "#d6e0ed"
  field-border: "#6b819f"
  secondary: "#eaf0f9"
  secondary-ink: "#17437e"
  secondary-hover: "#dce8f8"
  nav-active: "#eaf1fc"
  count-bg: "#d7e5fa"
  recipe-hover: "#e2ebf8"
  yield-bg: "#edf3fc"
  yield-ink: "#173e76"
  yield-help: "#3f5b85"
  table-rule: "#a8bbd4"
  quantity-highlight: "#c9deff"
  danger: "#a62e27"
  danger-hover: "#87241f"
  warning-bg: "#faf0d9"
  warning-ink: "#6c4c1c"
  error-bg: "#fcf0ed"
  error-ink: "#8c3029"
  form-error-bg: "#fcf1ef"
  form-error-ink: "#8e2b26"
  success-bg: "#e8f1ea"
  success-ink: "#315e3e"
typography:
  display:
    fontFamily: '"Public Sans", sans-serif'
    fontSize: "clamp(2.6rem, 3.75vw, 3.7rem)"
    fontWeight: 600
    lineHeight: 1.13
    letterSpacing: "-0.04em"
  headline:
    fontFamily: '"Public Sans", sans-serif'
    fontSize: "2.35rem"
    fontWeight: 650
    lineHeight: 1.16
    letterSpacing: "-0.035em"
  title:
    fontFamily: '"Public Sans", sans-serif'
    fontSize: "1.16rem"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  body:
    fontFamily: '"Public Sans", sans-serif'
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: '"Public Sans", sans-serif'
    fontSize: "0.86rem"
    fontWeight: 600
  quantity:
    fontFamily: '"Public Sans", sans-serif'
    fontSize: "1.25rem"
    fontWeight: 600
    letterSpacing: "-0.02em"
  unit:
    fontFamily: '"Public Sans", sans-serif'
    fontSize: "0.77rem"
    fontWeight: 400
rounded:
  count: "2px"
  field: "3px"
  action: "4px"
  workspace: "5px"
  dialog: "10px"
spacing:
  control-gap: "8px"
  editor-gap: "10px"
  action-gap: "14px"
  row-padding: "15px"
  mobile-sheet-inset: "20px"
  library-inset: "22px"
  dialog-inset: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    rounded: "{rounded.action}"
    padding: "11px 17px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-ink}"
    rounded: "{rounded.action}"
    padding: "11px 17px"
  button-secondary-hover:
    backgroundColor: "{colors.secondary-hover}"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.white}"
    rounded: "{rounded.action}"
    padding: "11px 17px"
  button-danger-hover:
    backgroundColor: "{colors.danger-hover}"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    padding: "8px 0"
  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.action}"
    padding: "8px"
    width: "40px"
  field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "10px 11px"
  navigation-item:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.field}"
    padding: "9px 12px"
  navigation-item-active:
    backgroundColor: "{colors.nav-active}"
    textColor: "{colors.primary}"
  recipe-item-selected:
    backgroundColor: "{colors.white}"
    textColor: "{colors.primary}"
  yield-strip:
    backgroundColor: "{colors.yield-bg}"
    textColor: "{colors.yield-ink}"
    padding: "22px 25px"
  workspace:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.workspace}"
  amount-table:
    textColor: "{colors.ink}"
    width: "100%"
  confirmation-dialog:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.dialog}"
    width: "calc(100% - 36px)"
---

# Design System: Receitas em Escala

## Overview

**Creative North Star: "Rótulo de mantimentos"**

A interface organiza o trabalho como uma ficha branca sobre uma bancada fria: nome, identidade, rendimento e quantidades têm lugares previsíveis. O azul dá direção às ações e à seleção; a tinta escura sustenta a leitura. A expressão está na precisão de linhas, números e unidades, com espaço suficiente para consultar a ficha enquanto se cozinha.

Este registro descreve o mundo implementado em `src/App.jsx` e `src/styles.css`, confrontado com as capturas atuais em `.impeccable/review/`. O nome e a metáfora descrevem esta entrega; não constituem uma identidade de marca previamente aprovada. A composição da superfície fica no seu brief, sem transformar suas decisões locais em regras para todo produto futuro.

**Key Characteristics:**

- Fichas brancas, campos delimitados e separadores finos sobre superfícies frias.
- Public Sans local, hierarquia compacta e números tabulares nas quantidades e identidades.
- Azul funcional para ação, seleção e foco; mensagens com texto explícito e cor contextual.
- Unidades separadas dos números e composição móvel que acomoda nomes e valores extensos.
- Profundidade plana no trabalho diário; sombra concentrada na confirmação modal.

## Colors

A paleta reúne um azul de ação, neutros frios e pares de estado extraídos do CSS. O frontmatter é a referência dos valores; não existe escala tonal declarada na implementação.

### Primary

- **Azul de ação** (`primary`): marca, botões principais, seleção de receita, navegação ativa, valor de rendimento e foco. O estado de passagem usa `primary-hover`.
- **Azuis de apoio** (`secondary`, `secondary-ink`, `secondary-hover`): ações secundárias com preenchimento claro. `nav-active`, `count-bg` e `recipe-hover` distinguem estados de navegação e biblioteca.
- **Faixa de rendimento** (`yield-bg`, `yield-ink`, `yield-help`): aproxima o controle de porções de sua referência original sem competir com o título da ficha.
- **Destaque de quantidade** (`quantity-highlight`): início da animação de recálculo e seleção de texto; é um realce transitório.

### Neutral

- **Tinta da ficha** (`ink`) e **texto de apoio** (`muted`): títulos, conteúdo, IDs, unidades e explicações.
- **Bancada fria** (`canvas`), **papel frio** (`cold`) e **branco da ficha** (`white`): fundo externo, biblioteca/apoios e área de trabalho.
- **Linha estrutural** (`line`) e **régua da tabela** (`table-rule`): separam regiões e cabeçalhos. **Contorno de campo** (`field-border`) delimita controles editáveis, incluindo busca e rendimento.
- **Estados de mensagem**: `warning-bg`/`warning-ink`, `error-bg`/`error-ink` e `success-bg`/`success-ink` acompanham avisos globais. `form-error-bg`/`form-error-ink` tratam erros junto do formulário. `danger`/`danger-hover` identificam a ação destrutiva.

**The Field Boundary Rule.** Controles editáveis usam o contorno de campo; a linha de separação de conteúdo não o substitui.

## Typography

**Display Font:** Public Sans, com fallback `sans-serif`.
**Body Font:** Public Sans, com o mesmo fallback.

A fonte variável local cobre pesos de 100 a 900, em estilo normal e com `font-display: swap`. O arquivo está em `public/assets/public-sans.ttf`; os avisos SIL Open Font License 1.1 acompanham `licenses/public-sans-OFL.txt`. A aplicação não solicita a fonte a um serviço externo em runtime.

### Hierarchy

- **Display**: abertura vazia, peso 600 e escala fluida do frontmatter. É uma aplicação de boas-vindas, não o tamanho padrão das fichas.
- **Headline**: nome da ficha e títulos de página, peso 650. O título da ficha pode quebrar em qualquer ponto quando necessário; seu limite desktop é de `24ch`.
- **Title**: seções compactas, peso 650; o tamanho varia em contextos como planejamento vazio e confirmação.
- **Body**: base de 15px com entrelinha de 1,55. Parágrafos gerais têm até `72ch`; preparo preserva quebras do texto, usa `70ch` e entrelinha de 1,85 no desktop.
- **Label**: rótulos em peso 600, sem caixa alta forçada. Ajuda e IDs reduzem o tamanho e usam a cor de apoio.
- **Quantity / Unit**: o número recebe mais peso e tamanho que sua unidade. Quantidades, campos numéricos, IDs e contadores usam `font-variant-numeric: tabular-nums`; não há uma segunda família monoespaçada.

**The Stable Unit Rule.** Número e unidade permanecem elementos separados. A unidade tem largura reservada; um valor longo pode quebrar sem esconder sua medida ou colidir com o nome.

## Layout

O contêiner principal chega a `1540px`, centralizado, com recuo desktop de `28px 32px 0`. A área de receitas usa biblioteca de `264px` e ficha flexível com `minmax(0, 1fr)`; a ficha recebe `35px 43px 40px`. Catálogo, planejamento e backup reutilizam a superfície branca e divisões por linha, adaptando suas colunas ao conteúdo. Não há uma grade universal de cartões.

Os pontos de mudança existentes são `min-width: 1550px` e `max-width: 1180px`, `860px` e `640px`. A biblioteca reduz para `230px` e depois `205px`. Até `860px`, a navegação passa para uma linha própria com rolagem horizontal; planejamento passa a uma coluna.

Até `640px`, a biblioteca fica acima da ficha, com receitas em faixa horizontal de itens de `190px`. A ficha usa `27px 20px 32px`. Catálogo e backup passam para uma coluna; o editor põe o ingrediente na largura inteira e depois quantidade, unidade e remoção. A tabela de receitas e compras coloca nome/ID acima de uma linha própria para quantidade/unidade. O cabeçalho continua disponível às tecnologias assistivas, os papéis de tabela são explícitos no JSX e o rótulo de quantidade reaparece visualmente. Valores podem quebrar; unidades reservam `22px` nesse ramo móvel.

O espaçamento é contextual: intervalos pequenos entre controles, recuos maiores na ficha e separadores entre seções. Os passos do frontmatter são medidas recorrentes observadas, não uma escala abstrata inventada. Na impressão, o CSS restaura a tabela, define margem de `16mm` e remove o chrome de navegação e as ações; o resultado físico depende do navegador e da impressora.

## Elevation & Depth

Biblioteca, ficha, campos e planejamento são planos. Fundos frios, branco e bordas marcam a hierarquia. O único `box-shadow` com profundidade declarado pertence ao diálogo de confirmação, acompanhado por um backdrop escuro translúcido.

### Shadow Vocabulary

- **Confirmação modal** (`0 18px 70px #172a4330`): separa a decisão de substituição ou exclusão do conteúdo ao fundo. O backdrop usa `#10254075`.

**The Flat Workspace Rule.** Preserve a divisão por superfície e linha nas áreas de trabalho; reserve a sombra existente para o diálogo de confirmação.

## Shapes

O vocabulário é retangular com cantos pequenos: contadores de `2px`, campos de `3px`, ações de `4px`, área de trabalho de `5px`. O diálogo usa `10px`. Bordas comuns têm `1px`; o desenho de mantimentos da abertura usa traços de `1.5px`. Os ícones são SVG inline de contorno, com traço de `1.7`, pontas e junções arredondadas. Não há fotografia, textura raster ou biblioteca de ícones externos na interface atual.

## Components

### Buttons

Ações compactas, rótulos diretos e ícones de apoio. Os botões preenchidos têm altura mínima de `42px`, recuo de `11px 17px` e cantos do token `action`. Primário, secundário e perigo usam os respectivos pares de estado. Ação textual sublinha na passagem; ação de ícone tem largura base de `40px` e fundo frio na passagem. Botões desabilitados usam cursor de indisponibilidade e opacidade de `0.48`.

A mudança de fundo dura `150ms ease-out`. O foco visível geral é contorno azul de `3px`, afastado `3px`. Não há transformação de escala, levantamento ou estado ativo adicional no CSS atual.

### Inputs / Fields

Campos brancos, contorno de campo de `1px`, cantos do token `field`, altura mínima de `43px` e recuo de `10px 11px`. Rótulo fica acima; ajuda explica unidade ou limite quando necessário. O foco de input, select e textarea usa `2px` de contorno com afastamento de `1px`. Desabilitados recebem fundo frio específico; erros aparecem como texto em bloco próximo do formulário. A borda do campo não muda para simular erro.

### Navigation and Library

Quatro ações de navegação combinam ícone e texto. A ação atual tem fundo azul claro e uma régua azul abaixo, além de `aria-current`. O contador de planejamento é tabular e some visualmente até `640px`. A biblioteca usa itens separados por linhas: título, ID/rendimento e seta; o selecionado fica branco com texto azul. Durante uma edição, a seleção de outras fichas é desabilitada.

### Cards / Containers

A área branca principal tem borda estrutural e cantos do token `workspace`; a biblioteca interna usa papel frio. A faixa de rendimento é um retângulo tonal sem sombra. Avisos ficam antes da área de trabalho, com título ou texto e ações de recuperação. As cores de estado vêm acompanhadas de uma mensagem legível.

### Amount Table

A assinatura visual aproxima nome e ID de quantidades alinhadas à direita. No desktop, a coluna de quantidade tem `180px`, o número tem largura mínima de `60px` e a unidade reserva `38px`; até `860px`, as larguras se reduzem. A separação móvel descrita em Layout preserva o conteúdo completo. O símbolo `≈` sinaliza a apresentação aproximada e a nota explica a precisão da exportação.

Ao mudar o valor, o número recebe realce transitório de `420ms`, com curva `cubic-bezier(0.16, 1, 0.3, 1)` e desfoque inicial de `0.35px`. A identidade da linha não se move com o recálculo. `prefers-reduced-motion: reduce` remove animações e transições.

### Confirmation Dialog

Diálogo nativo, largura máxima de `510px`, recuo externo de `36px` e conteúdo com `32px` de padding (`25px` no móvel). Título, consequência e ações aparecem nessa ordem; a importação inclui resumo numérico. Cancelar recebe foco inicial. Escape cancela, e a confirmação destrutiva usa o botão de perigo.

## Do's and Don'ts

### Do:

- **Do** conservar nome, ID, valor e unidade como informações distintas e legíveis.
- **Do** usar o contorno de campo em todos os controles editáveis, incluindo busca e rendimento.
- **Do** preservar hierarquia de botões, foco visível e mensagens textuais junto dos estados.
- **Do** separar nome/ID e quantidade/unidade no móvel, permitindo quebra de valores extensos.
- **Do** manter o símbolo de aproximação, a nota de precisão e o suporte a movimento reduzido.

### Don't:

- **Don't** substituir a borda editável pela linha clara usada como separador.
- **Don't** truncar quantidades ou unidades para manter uma linha visual curta.
- **Don't** acrescentar sombras recorrentes às áreas de trabalho planas.
- **Don't** comunicar erro, seleção ou indisponibilidade apenas por cor.
- **Don't** tratar tamanhos da abertura vazia como tipografia padrão de todas as fichas.
