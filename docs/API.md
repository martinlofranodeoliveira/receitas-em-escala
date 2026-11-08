# Formato e API

O módulo `src/engine.js` exporta funções ESM puras. Elas validam o livro completo, não alteram entradas e retornam novas estruturas sem referências mutáveis compartilhadas.

## Livro

```json
{
  "schemaVersion": 1,
  "ingredients": [],
  "recipes": [],
  "plan": []
}
```

Ingrediente: `{id,name,dimension}`, dimensão `mass`, `volume` ou `count`. Receita: `{id,title,servings,items,steps}`. Cada linha de `items` contém `{ingredientId,quantity,unit}`; o ID deve existir no catálogo e não pode repetir na mesma receita. Planejamento: `{id,recipeId,servings}`. Receitas repetidas em linhas diferentes são permitidas e suas quantidades são somadas.

IDs têm de 1 a 40 caracteres ASCII, iniciam com letra ou número e depois admitem `_` e `-`. São únicos por coleção. Nomes repetidos não identificam automaticamente o mesmo ingrediente.

Quantidades armazenadas são strings decimais canônicas com ponto, sem zeros iniciais ou finais desnecessários. O editor utiliza `normalizeQuantity` para aceitar vírgula/ponto e normalizar o rascunho. Os códigos `g`/`kg` pertencem a massa, `ml`/`l` a volume e `un` a contagem. Cada receita e linha planejada têm rendimento inteiro de 1 a 1.000.

O JSON canônico usa dois espaços e LF final. Importação rejeita chaves duplicadas decodificadas, profundidade de containers superior a 12, surrogates isolados, transporte maior que 8 MiB e modelo inválido. Propriedades desconhecidas, accessors, arrays esparsos e protótipos customizados não são formatos aceitos. Proxies não são isolados pela biblioteca.

## Operações

| Função | Resultado |
| --- | --- |
| `createBook()` | Livro vazio novo |
| `validateBook(book)` | Cópia canônica validada |
| `normalizeQuantity(text)` | String decimal canônica positiva |
| `upsertIngredient(book,ingredient)` | Acrescenta ou substitui no mesmo lugar |
| `removeIngredient(book,id)` | Recusa remoção de ingrediente em uso |
| `upsertRecipe(book,recipe)` | Acrescenta ou substitui receita |
| `removeRecipe(book,id)` | Remove receita e suas linhas planejadas |
| `upsertPlanItem(book,item)` | Acrescenta ou substitui linha de preparo |
| `removePlanItem(book,id)` | Remove linha conhecida |
| `scaleRecipe(book,id,servings)` | Receita com quantidades exatas na escala solicitada |
| `shoppingList(book)` | Soma por ID, na ordem do catálogo, só dos ingredientes usados |
| `formatAmount(amount,baseUnit)` | Apresentação decimal e indicação de aproximação |
| `shoppingCsv(book)` | Lista em CSV com frações exatas e LF final |
| `serializeBook(book)` | Backup JSON validado |
| `parseBook(text)` | Livro validado a partir de JSON |

## Racionais e apresentação

Quantidades derivadas usam `{numerator:string,denominator:string}`, inteiros positivos reduzidos. `scaleRecipe` devolve `{recipeId,title,baseServings,servings,items,steps}`. Cada item e cada linha de compras têm `{ingredientId,name,dimension,quantity,unit}`, com unidades base `g`, `ml` e `un`.

O cálculo é `quantidade × fator da unidade × porções alvo / rendimento original`; soma e conversão utilizam BigInt internamente. Objetos públicos não contêm BigInt. Não existe conversão por densidade.

`formatAmount(amount,baseUnit)` retorna `{value,unit,approximate}`. Escolhe kg/l quando o valor base é pelo menos 1.000, mantém `un`, usa até seis casas decimais, vírgula e arredondamento half-up. A interface inclui `≈` se a apresentação não for exata. A fração continua disponível na exportação, mesmo quando a apresentação decimal tem limite.

CSV de compras: `ingredient_id,name,numerator,denominator,unit`. Valores podem ser quoted conforme RFC4180; ordem e conteúdo das colunas são estáveis. Strings com início típico de fórmula recebem apóstrofo. Importar como texto nas planilhas preserva os inteiros longos.

## Erros

`BookError.code` identifica falhas esperadas sem eco dos dados: `INVALID_BOOK`, `INVALID_QUANTITY`, `INVALID_SERVINGS`, `UNKNOWN_INGREDIENT`, `INGREDIENT_IN_USE`, `UNKNOWN_RECIPE`, `UNKNOWN_PLAN`, `INVALID_AMOUNT`, `INVALID_JSON`.

Erro de transporte/sintaxe JSON, duplicação ou profundidade usa `INVALID_JSON`; falha do modelo usa `INVALID_BOOK`. Upsert com referência inexistente falha sem alterar o original. Remover receita limpa seu planejamento; remover ingrediente referenciado é recusado. Alterar sua dimensão de modo incompatível com receitas também é recusado.
