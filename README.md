# lista-extrair

Scripts de console (DevTools) para extrair listas de cartas das lojas que usam a plataforma
LigaMagic/LMCorp — **maindeck.com.br**, **mtgbrasil.com.br**, **epicgame.com.br** e afins.
Nada é instalado: é copiar o conteúdo do arquivo, colar no console da página e dar Enter.

| Script | Página | Saída |
|---|---|---|
| [`extrair-pedido.js`](extrair-pedido.js) | Pedido (`?view=ecom/compra&cod=…`) | Lista simples `Nx Carta (NM)` |
| [`extrair-carrinho.js`](extrair-carrinho.js) | Carrinho (`?view=ecom/carrinho&id=…`) | Lista com preços, soma e links clicáveis |

## Como rodar (vale para os dois)

1. Abra a página na loja.
2. `F12` → aba **Console**.
3. Na primeira vez, o Chrome bloqueia colar no console: digite `allow pasting` e Enter.
4. Cole o conteúdo do arquivo e Enter.

> **Dica:** para não repetir isso toda vez, salve como snippet: DevTools → **Sources** → **Snippets**
> → *New snippet* → cole → `Ctrl+Enter` roda na aba atual.

---

## extrair-pedido.js

Para a página de um pedido já pago (comprado para alguém retirar, por exemplo). Gera a lista limpa, uma carta por linha, e **já copia
para o clipboard**.

```
Pedido #11504598

4x Mor'du - Wicked with Pride (NM)
1x Dopey - Drawn to Music (NM)
2x Darkwing Duck - Crime Fighter (NM, Foil)
```

- O número do pedido sai do `?cod=` da URL (com fallback no título da aba e no texto da página).
- `INCLUIR_FOIL = false` na linha 9 remove a marcação de foil.
- Quer manter o número de coleção (`#35`)? Apague o `.replace(/\s*\(#[\w-]+\)\s*$/, '')`.

**Se alguma linha sair sem a condição:** o console avisa quantas falharam — rode `debugBloco(0)`
para ver o HTML daquele item. A condição é procurada em quatro lugares (texto do badge,
`alt`/`title`/`data-*`, classe/`src` do ícone e `content` de `::before`), porque cada loja
renderiza de um jeito.

**Variáveis disponíveis depois de rodar:** `lista` (string final), `debugBloco(i)`.

---

## extrair-carrinho.js

Para a página do carrinho (para enviar a alguém que vá fazer uma compra em massa, por exemplo). Abre um **painel flutuante** no canto superior direito com a lista,
os valores e a soma; cada linha é um link para o produto.

```
Carrinho #118400 — www.maindeck.com.br

5x Milo Thatch - Getting His Hands Dirty (NM) — R$ 19,99 un · R$ 99,95

1x Grandmother Willow - Ancient Advisor (NM, Foil) — R$ 24,99 un · R$ 24,99

Soma dos produtos: R$ 187,87 — 13 cartas em 6 linhas
```

O botão **Copiar com links** escreve dois formatos no clipboard ao mesmo tempo:

- `text/html` — cola já clicável no Gmail, Docs, Notion, Slack;
- `text/plain` — a mesma linha com a URL no final, para WhatsApp, txt, console.

A cópia automática ao rodar falha se o foco estiver no DevTools em vez da página
(`clique na página e tente de novo`); nesse caso é só clicar no botão do painel.

**Conferências que o painel faz sozinho** (aparecem em vermelho no rodapé):

- soma dos subtotais diferente do `Subtotal:` da própria página;
- linhas duplicadas descartadas — o site renderiza os layouts mobile e desktop no mesmo HTML;
- produtos fora do carrinho ignorados — a seção *Produtos Sugeridos* usa a mesma marcação
  dos itens, então o script se limita à tabela que tem os links "Remover";
- `~` antes de um subtotal significa que o bloco só tinha um preço e o valor foi calculado.

**Variáveis disponíveis depois de rodar:** `__carrinho__` (`{ itens, soma, cartas, subtotalPagina,
totalPagina, texto, html }`) e `copiarCarrinho()`. O `×` no painel fecha; recarregar a página
também limpa.

---

## Notas de implementação

Coisas que quebram se forem feitas do jeito óbvio, e que os scripts já contornam:

- **`textContent`, nunca `innerText`** — o MTG Brasil usa `text-transform: uppercase` nos nomes,
  e o `innerText` do Chrome devolve o texto já transformado (`MOANA - CHOSEN BY THE OCEAN`).
- **O bloco do item não é uma linha só** — na página de pedido, edição/idioma/condição/Cod ficam
  em `.row`s irmãs, depois da linha do produto.
- **Miniatura e nome são dois links para o mesmo produto** — daí a deduplicação por bloco.
- **Nomes de variável global** — o site tem um objeto global `carrinho`; sobrescrevê-lo derruba
  a página (`carrinho.calcRightBarFrozen is not a function`). Por isso `window.__carrinho__`.
