---
version: 1
slug: "src-app-jsx"
primary_target: "src/App.jsx"
related_targets: ["src/styles.css"]
---

# Livro, fichas e compras

## Scope and mode

- **Primary target:** `src/App.jsx`.
- **Related target:** `src/styles.css`; o contrato de direção está no comentário inicial de `index.html`.
- **Visitor mode:** **Operate**. O sucesso é cadastrar e consultar fichas, ajustar porções, planejar receitas e obter quantidades de compra legíveis.

## Audience and task

A hipótese desta entrega é uso doméstico em computador ou celular, sobre uma bancada bem iluminada. Público doméstico e React/Vite foram inferidos após consulta opcional e página de decisão sem resposta; a alternativa de pequenos produtores permanece aberta. Não há pesquisa com usuários nem preferência permanente de framework estabelecida.

A tarefa principal começa com um livro vazio: criar uma ficha ou carregar, por escolha explícita, exemplos originais. O fluxo segue por ingredientes, receita, rendimento, planejamento e compras. CSV, impressão e backup JSON são saídas do trabalho; a restauração mostra um resumo antes de substituir o livro.

## Direction and composition

A direção implementada é **Rótulo de mantimentos**, candidato 6, seed `11e5bf03`. Os tokens e a linguagem global estão em `DESIGN.md`. Esta sessão adotou execução **code-led** por instrução de rapidez; isso não estabelece uma preferência permanente de workflow. Não existe comp aprovada. As imagens de catálogo de referência retornaram HTTP 403 e não foram inspecionadas.

No desktop, o cabeçalho compacto contém marca, quatro destinos e estado de salvamento. A biblioteca fica à esquerda; a ficha ampla mantém título/ID, ferramentas, faixa de rendimento, ingredientes e preparo nessa ordem. O estado vazio oferece criação e exemplos opcionais. Catálogo usa tabela e apoio lateral; planejamento aproxima receitas planejadas e lista agregada; backup separa exportação e restauração.

No móvel, a biblioteca precede a ficha e suas receitas formam uma faixa horizontal. Navegação mantém ícones e texto em faixa rolável. Planejamento, catálogo e backup passam a uma coluna. Até 640px, cada ingrediente mostra nome/ID e depois uma linha inteira de quantidade/unidade. O editor dá a primeira linha ao ingrediente e a segunda a quantidade, unidade e remoção.

O momento característico é alterar porções e ver só o número receber um realce breve, preservando a identidade da linha e a unidade. Movimento reduzido elimina a animação. A lista de compras reutiliza a mesma gramática numérica.

## Content and interaction constraints

- Nome e ID são informações distintas; IDs continuam visíveis na biblioteca, catálogo, ficha e planejamento conforme cada contexto.
- Quantidade e unidade ficam separadas. Valores extensos podem quebrar; a unidade continua explícita. `≈` e a nota de precisão distinguem apresentação aproximada de exportação exata.
- Massa, volume e unidades são dimensões distintas. A interface não deve sugerir conversão por densidade ou ajuste automático de tempo, temperatura e técnica.
- Inputs têm rótulos, contorno próprio e foco visível. Estados de erro, leitura, conflito, memória e recuperação incluem explicação textual e ações aplicáveis.
- Os papéis de tabela e cabeçalhos estão explícitos no JSX, inclusive quando a composição móvel muda. A confirmação usa `dialog`, põe foco inicial em Cancelar e permite cancelar por Escape.
- Substituição de dados ocorre somente após revisão e confirmação. Os exemplos são demonstrativos; não são receitas pessoais de clientes.
- A fonte Public Sans é local, sob OFL; a tela atual usa SVGs inline e não carrega fotografia ou fonte remota.

## Observed finish and evidence

A documentação foi extraída do estado final de `src/App.jsx`, `src/styles.css` e `index.html`, com as 11 capturas atuais de `.impeccable/review/`: quatro de desktop e sete de móvel. Elas cobrem livro vazio, ficha, compras, conflito, editor, planejamento, confirmação de importação e os casos extensos de quantidades em ficha e compras.

A revisão final fornecida reportou **ship**, restrito ao estado revisado: **F1 resolvido**, com contorno de campo consistente em campos gerais, busca e rendimento; **F2 resolvido**, com nome/ID acima da linha completa de quantidade/unidade até 640px. Esta documentação preserva essas correções.

A evidência de testes fornecida registra **108 testes passando: 64 públicos e 44 independentes**; eles não foram reexecutados neste passe de documentação. O detector rodou uma vez e ficou em modo **regex degradado**. Esse resultado não é um atestado de ausência de problemas.

## Open decisions and limits

Público, framework e nome do produto continuam hipóteses desta entrega, sem aprovação de identidade ou preferência permanente atribuída ao usuário. A autoridade visual deste registro é o código e suas capturas atuais.

O escopo revisado não certifica WCAG integral, interação com leitor de tela, impressão física, matriz de navegadores, zoom ou todos os tamanhos intermediários. O CSS de impressão existe e restaura a tabela; isso não constitui ensaio em papel. A publicação e seu comportamento no endereço final pertencem à validação de entrega, fora deste registro visual.
