# Receitas em Escala

Ajuste as porções de uma receita e reúna os ingredientes de vários preparos numa lista de compras. Aplicativo aberto em português da [LOFRANO TECNOLOGIA](https://lofranotecnologia.com.br/), com dados locais e licença MIT.

As quantidades são calculadas como frações exatas. A tela sinaliza com `≈` quando a apresentação decimal foi arredondada. Massa, volume e unidades continuam separados: o aplicativo não adivinha densidade ou equivalência entre ingredientes.

![Lista de compras com exemplos demonstrativos](docs/preview.jpg)

## Usar

[Abrir a demonstração](https://martinlofranodeoliveira.github.io/receitas-em-escala/).

1. Cadastre ingredientes com sua dimensão: massa, volume ou unidades.
2. Crie uma receita, informe o rendimento original, as quantidades e o modo de preparo.
3. Escolha as porções desejadas para recalcular os ingredientes.
4. Acrescente receitas ao planejamento e abra a lista de compras agregada.
5. Exporte CSV para a lista ou JSON para guardar o livro completo.

O primeiro uso começa vazio. Os exemplos originais e demonstrativos são opcionais; não vêm de receitas pessoais ou de projetos privados. A ferramenta ajusta quantidades, sem alterar automaticamente tempo, temperatura ou técnica de preparo.

## Seus dados

Sem conta, backend, telemetria ou envio de receitas. Os dados ficam no armazenamento deste navegador e desta origem. **Exporte backups**: limpar os dados do navegador, trocar de aparelho ou usar outra origem não transporta seu livro.

Importar um backup valida o arquivo e pede confirmação antes de substituir o livro. Dados locais que não puderem ser abertos são preservados para recuperação. Se o armazenamento estiver indisponível ou sem espaço, a sessão continua na memória com aviso e exportação.

Uma única aba edita por vez quando o navegador oferece Web Locks. Outra aba pode consultar e assumir a edição após o fechamento da primeira. Mudanças externas são sinalizadas; o trabalho em memória pode ser exportado antes de recarregar. Sem Web Locks, a comparação antes de gravar é uma proteção **otimista e não atômica**.

O primeiro carregamento e o refresh dependem de HTTP ou de um servidor local. Esta versão não é PWA e não promete funcionamento offline após fechar a página.

## Executar no computador

Requer Node.js 22.12 ou posterior. Testes de CI usam Node 22 e 24.

```sh
git clone https://github.com/martinlofranodeoliveira/receitas-em-escala.git
cd receitas-em-escala
npm ci --ignore-scripts
npm run dev
```

Para construir a distribuição:

```sh
npm run build
npm run preview
```

A compilação usa URLs relativas (`base: './'` em `vite.config.mjs`), compatíveis com o diretório do GitHub Pages e outras hospedagens estáticas. O build inclui a licença do projeto, os avisos de terceiros e suas licenças.

## Identidades e precisão

- Ingredientes com nomes iguais e IDs diferentes continuam separados. Revise o catálogo em vez de presumir que os nomes são equivalentes.
- `kg` e `g` convertem dentro de massa; `l` e `ml`, dentro de volume. `un` permanece em unidades.
- A escala usa o rendimento da receita e as porções solicitadas. Não usa ponto flutuante para somar ou converter quantidades.
- O CSV exporta numerador e denominador exatos na unidade base. Em planilhas, importe essas colunas como texto para evitar perda de precisão.
- Strings com início típico de fórmula recebem um apóstrofo na exportação. Isso é uma precaução, sem garantia universal de segurança em planilhas.

Limites: 200 ingredientes, 100 receitas com até 50 ingredientes cada, 200 linhas planejadas, porções de 1 a 1.000 e backup JSON de até 8 MiB. Quantidades de entrada são positivas, de até 1.000.000 da unidade informada, com até seis casas decimais. Aceita vírgula ou ponto no editor, sem separadores de milhar.

## Biblioteca reutilizável

O núcleo ESM em [`src/engine.js`](src/engine.js) não depende do React ou de serviços externos. O contrato documenta o formato do livro, as operações puras e os códigos de erro em [docs/API.md](docs/API.md).

```js
import { createBook, upsertIngredient, upsertRecipe, scaleRecipe } from './src/engine.js';

let book = createBook();
book = upsertIngredient(book, { id: 'farinha', name: 'Farinha', dimension: 'mass' });
book = upsertRecipe(book, {
  id: 'massa', title: 'Massa demonstrativa', servings: 3,
  items: [{ ingredientId: 'farinha', quantity: '100', unit: 'g' }],
  steps: 'Exemplo de cálculo, sem instrução culinária validada.',
});
const scaled = scaleRecipe(book, 'massa', 1);
// scaled.items[0].quantity é { numerator: '100', denominator: '3' }.
```

## Contribuir e verificar

Veja [CONTRIBUTING.md](CONTRIBUTING.md). O CI constrói e testa em namespace Linux sem rede, com fonte e dependências somente leitura. Os testes do repositório são públicos; verificações privadas independentes não fazem parte do projeto publicado.

Não há garantias de adequação nutricional, equivalências culinárias ou resultados de preparo. O projeto organiza e calcula dados fornecidos por quem o utiliza.

## Licença

[MIT](LICENSE). [Avisos de terceiros](THIRD_PARTY_NOTICES.md) e [licenças completas](licenses/) acompanham a fonte e a distribuição. A tipografia Public Sans é hospedada localmente sob SIL OFL 1.1.
