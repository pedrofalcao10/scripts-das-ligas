/**
 * Extrai os itens do carrinho (maindeck / mtgbrasil / epicgame ...).
 * Colar no console do DevTools na página do carrinho.
 *
 * - Painel flutuante com cada item em uma linha clicável (vai pro produto).
 * - "Copiar com links" escreve text/html (hyperlink de verdade: Gmail/Docs/Notion/Slack)
 *   e text/plain (linha + URL no fim) no clipboard.
 *
 * window.__carrinho__      -> { id, loja, itens, soma, cartas, subtotalPagina, totalPagina }
 * window.copiarCarrinho()
 *
 * OBS: nomes de global com __ pra não colidir com o `carrinho` global do próprio site.
 */
(() => {
  const norm = t => (t || '').replace(/\s+/g, ' ').trim();
  const num  = s => (s == null ? null : parseFloat(String(s).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')));
  const fmt  = v => (v == null ? '—' : 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const esc  = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const RE_PRECO  = /R\$\s*[\d.]*\d,\d{2}/g;
  const MAPA_COND = [
    [/\((NM|SP|MP|HP|D|M)\)/i, m => m[1].toUpperCase()],
    [/praticamente nova/i,     () => 'NM'],
    [/levemente jogada/i,      () => 'SP'],
    [/moderadamente jogada/i,  () => 'MP'],
    [/muito jogada/i,          () => 'HP'],
    [/danificada/i,            () => 'D'],
    [/\bmint\b|perfeita/i,     () => 'M'],
  ];

  const ehProduto  = a => /ecom\/item|refid=|[?&]prod=/i.test(a.getAttribute('href') || '');
  const visivel    = el => !!el && el.getClientRects().length > 0;
  const produtosEm = el => new Set([...el.querySelectorAll('a[href]')].filter(ehProduto).map(a => a.href)).size;
  const temPreco   = el => { RE_PRECO.lastIndex = 0; return RE_PRECO.test(el.textContent); };

  // sobe até a linha do item: primeiro ancestral com preço que ainda tem só 1 produto
  const blocoDo = a => {
    let el = a.parentElement, ultimo = el;
    while (el && el !== document.body) {
      if (produtosEm(el) > 1) break;
      if (temPreco(el)) return el;
      ultimo = el;
      el = el.parentElement;
    }
    return a.closest('tr, .row') || ultimo;
  };

  const condDe = texto => {
    for (const [re, get] of MAPA_COND) {
      const m = texto.match(re);
      if (m) return get(m);
    }
    return null;
  };

  const qtdDe = (bloco, texto) => {
    const campo = [...bloco.querySelectorAll('input, select')]
      .find(i => i.type !== 'hidden' && /^\d{1,3}$/.test(norm(i.value)));
    if (campo) return Number(norm(campo.value));
    return Number((texto.match(/\b(\d+)\s*x\b/i) || [])[1] || 1);
  };

  // escopo: menor ancestral comum dos "Remover" visíveis = a tabela do carrinho.
  // Sem isso, "PRODUTOS SUGERIDOS" (e afins) entram na conta.
  const RE_REMOVER = /^(remover|excluir|remove)$/i;
  const escopoCarrinho = () => {
    const alvos = [...document.querySelectorAll('a, button, span, div, td, p')]
      .filter(el => !el.children.length && RE_REMOVER.test(norm(el.textContent)) && visivel(el));
    if (!alvos.length) return null;
    let anc = alvos[0];
    for (const el of alvos) while (anc && !anc.contains(el)) anc = anc.parentElement;
    // com 1 item só, o ancestral comum é o próprio "Remover": sobe até pegar o produto
    while (anc && anc !== document.body && ![...anc.querySelectorAll('a[href]')].some(ehProduto)) anc = anc.parentElement;
    return anc && anc !== document.body ? anc : null;
  };

  const coletar = ancoras => {
    const blocos = new Set();
    const itens = [];
    for (const a of ancoras) {
      const bloco = blocoDo(a);
      if (!bloco || blocos.has(bloco)) continue; // miniatura + nome apontam pro mesmo produto
      blocos.add(bloco);

      const texto = norm(bloco.textContent);
      if (!/R\$/.test(texto)) continue;

      const links = [...bloco.querySelectorAll('a[href]')].filter(ehProduto);
      const linkNome = links.reduce((best, x) => (norm(x.textContent).length > norm(best.textContent).length ? x : best), a);
      const nomeFull = norm(linkNome.textContent) || norm(a.textContent);
      const precos = (texto.match(RE_PRECO) || []).map(num);
      const qtd = qtdDe(bloco, texto);
      const unit = precos[0] ?? null;

      itens.push({
        qtd,
        nome: nomeFull.replace(/\s*\(#[\w-]+\)\s*$/, '').trim(),
        numero: (nomeFull.match(/\(#\s*([\w-]+)\)/) || [])[1] || null,
        condicao: condDe(texto),
        foil: /\bfoil\b/i.test(texto) && !/n[ãa]o[\s-]?foil|non[\s-]?foil/i.test(texto),
        preco_unit: unit,
        subtotal: precos.length > 1 ? precos[precos.length - 1] : (unit == null ? null : unit * qtd),
        estimado: precos.length < 2,          // só um preço no bloco -> subtotal calculado
        removivel: /\b(remover|excluir)\b/i.test(texto) || !!bloco.querySelector('[onclick*="remov" i], [href*="remov" i], [class*="remov" i], [title*="remov" i]'),
        url: linkNome.href,
        _raw: texto,
      });
    }
    return itens;
  };

  // o site renderiza layout mobile + desktop no mesmo DOM: fica só com o que está visível
  const raiz = escopoCarrinho() || document.body;
  const todas = [...raiz.querySelectorAll('a[href]')].filter(ehProduto);
  const visiveis = todas.filter(visivel);
  const coletados = coletar(visiveis.length ? visiveis : todas);

  // 2ª rede: se algum bloco tem "Remover", os que não têm são vitrine (produtos sugeridos)
  const doCarrinho = coletados.filter(i => i.removivel);
  const brutos = doCarrinho.length ? doCarrinho : coletados;
  const foraDoCarrinho = coletados.length - brutos.length;

  // rede de segurança: mesmo produto, mesma qtd e mesmo valor = linha duplicada pelo layout
  const porChave = new Map();
  for (const it of brutos) {
    const k = `${it.url}|${it.qtd}|${it.subtotal}|${it.condicao}|${it.foil}`;
    const ja = porChave.get(k);
    if (ja) { if (it.nome.length > ja.nome.length) ja.nome = it.nome; continue; } // fica com o nome não truncado
    porChave.set(k, it);
  }
  const itens = [...porChave.values()];
  const duplicadas = brutos.length - itens.length;

  const soma   = Number(itens.reduce((s, i) => s + (i.subtotal || 0), 0).toFixed(2));
  const cartas = itens.reduce((s, i) => s + (i.qtd || 0), 0);
  const corpo  = norm(document.body.textContent);
  // exige os dois-pontos: "Subtotal" sem eles é o cabeçalho da coluna da tabela
  const subtotalPagina = num((corpo.match(/Subtotal:\s*R\$\s*([\d.]*\d,\d{2})/i) || [])[1]);
  const totalPagina    = num((corpo.match(/\bTotal:\s*R\$\s*([\d.]*\d,\d{2})/i)  || [])[1]);
  const referencia     = subtotalPagina ?? totalPagina;
  const id = new URLSearchParams(location.search).get('id') || null;

  const rotulo = it => {
    const tags = [it.condicao, it.foil ? 'Foil' : null].filter(Boolean).join(', ');
    return `${it.qtd}x ${it.nome}${tags ? ` (${tags})` : ''} — ${fmt(it.preco_unit)} un · ${it.estimado ? '~' : ''}${fmt(it.subtotal)}`;
  };

  const cabecalho = `Carrinho${id ? ` #${id}` : ''} — ${location.hostname}`;
  const rodape = `Soma dos produtos: ${fmt(soma)} — ${cartas} cartas em ${itens.length} linhas`;
  const VAZIA = '<div><br></div>'; // linha em branco entre os itens ao colar
  const textoPlano = [cabecalho, '', itens.map(it => `${rotulo(it)} — ${it.url}`).join('\n\n'), '', rodape].join('\n');
  const htmlRico = [
    `<div><b>${esc(cabecalho)}</b></div>${VAZIA}`,
    itens.map(it => `<div><a href="${esc(it.url)}">${esc(rotulo(it))}</a></div>`).join(VAZIA),
    `${VAZIA}<div><b>${esc(rodape)}</b></div>`,
  ].join('');

  const flash = (btn, msg) => {
    if (!btn) return;
    const antes = btn.textContent;
    btn.textContent = msg;
    setTimeout(() => (btn.textContent = antes), 1800);
  };
  const copiar = async btn => {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html':  new Blob([htmlRico],   { type: 'text/html' }),
        'text/plain': new Blob([textoPlano], { type: 'text/plain' }),
      })]);
      return flash(btn, 'copiado ✓');
    } catch (e) {
      try { await navigator.clipboard.writeText(textoPlano); return flash(btn, 'copiado (texto) ✓'); }
      catch (e2) { return flash(btn, 'clique na página e tente de novo'); }
    }
  };

  // ---- painel ----
  const host = document.getElementById('__extrator_carrinho__') || document.createElement('div');
  host.id = '__extrator_carrinho__';
  host.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483647';
  if (!host.isConnected) document.body.appendChild(host);
  const sh = host.shadowRoot || host.attachShadow({ mode: 'open' });

  const avisos = [
    referencia != null && Math.abs(referencia - soma) > 0.01
      ? `⚠ página mostra ${fmt(referencia)} — diferença de ${fmt(Math.abs(referencia - soma))}` : '',
    duplicadas ? `${duplicadas} linha(s) duplicada(s) pelo layout mobile foram descartadas` : '',
    foraDoCarrinho ? `${foraDoCarrinho} produto(s) fora do carrinho ignorado(s) (vitrine/sugeridos)` : '',
    itens.some(it => it.estimado) ? '~ = subtotal calculado (bloco só tinha um preço)' : '',
  ].filter(Boolean);

  sh.innerHTML = `
    <style>
      :host { all: initial }
      .wrap { width: 600px; max-height: 82vh; display: flex; flex-direction: column;
        background: #14161a; color: #e7e9ee; border: 1px solid #2c313a; border-radius: 10px;
        box-shadow: 0 10px 40px rgba(0,0,0,.55); overflow: hidden;
        font: 12.5px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace }
      header, footer { padding: 10px 12px; background: #1b1f26; display: flex; gap: 8px; align-items: center }
      header { border-bottom: 1px solid #2c313a; font-weight: 700 }
      footer { border-top: 1px solid #2c313a; flex-wrap: wrap }
      ol { margin: 0; padding: 8px 12px 8px 34px; overflow: auto; flex: 1 }
      li { margin: 2px 0; word-break: break-word }
      li::marker { color: #6b7280 }
      a { color: #7dd3fc; text-decoration: none }
      a:hover { text-decoration: underline }
      .foil { color: #fbbf24 }
      .spacer { flex: 1 }
      .total { font-weight: 700; color: #a7f3d0 }
      .aviso { color: #fca5a5; width: 100% }
      button { font: inherit; cursor: pointer; padding: 5px 10px; border-radius: 6px;
        border: 1px solid #3a4150; background: #232833; color: #e7e9ee }
      button:hover { background: #2c3240 }
      .x { border: 0; background: transparent; font-size: 16px; padding: 0 4px; color: #9aa3b2 }
    </style>
    <div class="wrap">
      <header>${esc(cabecalho)}<span class="spacer"></span><button class="x" title="fechar">×</button></header>
      <ol>
        ${itens.map(it => `<li><a href="${esc(it.url)}" target="_blank" rel="noreferrer">${esc(rotulo(it))}</a>${it.foil ? ' <span class="foil">✦</span>' : ''}</li>`).join('')}
      </ol>
      <footer>
        <span class="total">${esc(rodape)}</span>
        <span class="spacer"></span>
        <button id="cp">Copiar com links</button>
        ${avisos.map(a => `<span class="aviso">${esc(a)}</span>`).join('')}
      </footer>
    </div>`;

  sh.querySelector('.x').onclick = () => host.remove();
  sh.querySelector('#cp').onclick = e => copiar(e.currentTarget);

  window.__carrinho__ = { id, loja: location.hostname, itens, soma, cartas, subtotalPagina, totalPagina, duplicadas, foraDoCarrinho, texto: textoPlano, html: htmlRico };
  window.copiarCarrinho = () => copiar(sh.querySelector('#cp'));

  console.table(itens.map(({ _raw, ...r }) => r));
  console.log(textoPlano);
  copiar(sh.querySelector('#cp')); // se o foco estiver no DevTools falha; use o botão
  return { itens: itens.length, cartas, soma };
})();
