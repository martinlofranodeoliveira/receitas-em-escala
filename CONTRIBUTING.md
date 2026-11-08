# Contribuir

O projeto reúne uma biblioteca de cálculo exato e uma interface local. Relate o que aconteceu, os passos para reproduzir e o resultado esperado. Use exemplos fictícios e não envie backups pessoais, credenciais ou dados de terceiros.

## Preparação

Requer Node.js 22.12+ e npm. Na raiz:

```sh
npm ci --ignore-scripts
npm test
npm run build
```

O teste de DOM compila a entrada React em `.test-build` antes dos testes Node. `dist`, `.test-build` e dependências não são arquivos de fonte para commit.

## Check offline de distribuição

Em Linux com bubblewrap e util-linux já instalados:

```sh
python3 -B scripts/check-offline.py --node "$(command -v node)" --deps "$PWD/node_modules"
```

O comando faz staging do Node e das dependências em um temporário próprio, monta fonte e dependências em leitura, remove rede/home/credenciais, verifica CapEff=0 e NoNewPrivs=1, executa testes e build e compara hashes. Não há fallback sem sandbox. Não instala dependências dentro do namespace e não pede `sudo` no computador local. O workflow usa `sudo` somente nos runners efêmeros hospedados pelo GitHub para habilitar esse isolamento.

## Critérios

- Preserve as funções puras, tipos e identidades explícitas. Quantidades derivadas devem continuar racionais exatas.
- Não converta massa em volume nem crie informação culinária ou nutricional inferida.
- Acrescente regressões para defeitos reproduzíveis; preserve os testes existentes.
- Verifique importação, recuperação, quota, conflitos entre abas e preservação de rascunhos.
- Confira desktop e celular com dados longos, foco/teclado e estados vazios/erros. Testes de DOM não substituem inspeção no navegador.
- Atualize documentação quando houver mudança de formato, comportamento ou limites. Preserve licenças e avisos no build.
- Não inclua `.env`, ignorados, dados reais, credenciais ou artefatos de controle em PRs.

Abra uma discussão ou issue para alterações de formato antes de modificar backups existentes. Não publique o pacote em registries em nome do projeto sem acordo específico.
