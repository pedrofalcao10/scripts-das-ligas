/**
 * Gera "Nx Nome da carta (COND)" por linha.
 * Colar no console do DevTools na página do pedido. Já copia pro clipboard.
 *
 * window.lista         -> string final
 * window.debugBloco(i) -> HTML do bloco do item i (produto + rows de detalhe)
 */
(() => {
  const INCLUIR_FOIL = true; // "2x Carta (NM, Foil)"

  const norm = t => (t || '').replace(/\s+/g, ' ').trim();
  const RE_COND_EXATA = /^(NM|SP|MP|HP|D|M)$/i;
  const RE_COND_SLUG  = /(?:^|[\/_\-\s"=])(nm|sp|mp|hp)(?:[\/_\-\s."]|$)/i;
  const RE_RODAPE     = /Valor dos Itens|Valor Total|Frete|Taxa de Conveni/i;

  // o item = a .row do produto + as .rows seguintes (edição, idioma, condição, Cod, Foil)
  const partesDo = a => {
    let row = a.closest('.row') || a.parentElement;
    while (row && row.querySelectorAll('a.link-produto').length > 1) row = row.parentElement;
    const partes = [row];
    for (let s = row.nextElementSibling; s; s = s.nextElementSibling) {
      if (s.querySelector('a.link-produto') || RE_RODAPE.test(s.textContent)) break;
      partes.push(s);
    }
    return partes;
  };

  const condDo = partes => {
    const els = partes.flatMap(p => [p, ...p.querySelectorAll('*')]);

    for (const el of els) {                                    // 1) badge com texto
      if (el.children.length) continue;
      const t = norm(el.textContent);
      if (RE_COND_EXATA.test(t)) return t.toUpperCase();
    }
    for (const el of els) {                                    // 2) alt / title / data-*
      for (const { name, value } of el.attributes) {
        const v = norm(value);
        if (/^(alt|title|aria-label|data-[\w-]+)$/i.test(name) && RE_COND_EXATA.test(v)) return v.toUpperCase();
      }
    }
    for (const el of els) {                                    // 3) ícone: class / src
      for (const attr of ['class', 'src']) {
        const m = el.getAttribute(attr)?.match(RE_COND_SLUG);
        if (m) return m[1].toUpperCase();
      }
    }
    for (const el of els) {                                    // 4) content de ::before/::after
      for (const p of ['::before', '::after']) {
        const c = norm(getComputedStyle(el, p).content).replace(/^["']|["']$/g, '');
        if (RE_COND_EXATA.test(c)) return c.toUpperCase();
      }
    }
    return null;
  };

  const pedido =
    new URLSearchParams(location.search).get('cod') ||
    (document.title.match(/#\s*(\d+)/) || [])[1] ||
    (norm(document.body.textContent).match(/PEDIDO\s*#?\s*(\d+)/i) || [])[1] ||
    null;

  const ancoras = [...document.querySelectorAll('a.link-produto')];
  const blocos = ancoras.map(partesDo);

  const linhas = ancoras.map((a, i) => {
    const partes = blocos[i];
    const texto = norm(partes.map(p => p.textContent).join(' ')); // textContent: ignora uppercase do CSS
    const nome = norm((a.querySelector('span.bold, span, b') || a).textContent)
      .replace(/\(C[oó]digo:.*$/i, '')
      .replace(/\s*\(#[\w-]+\)\s*$/, '')
      .trim();
    const qtd = Number((norm(partes[0].textContent).match(/\b(\d+)\s*x\b/i) || [])[1] || 1);
    const extras = [condDo(partes), INCLUIR_FOIL && /\bfoil\b/i.test(texto) ? 'Foil' : null].filter(Boolean);
    return `${qtd}x ${nome}${extras.length ? ` (${extras.join(', ')})` : ''}`;
  });

  const saida = [`Pedido #${pedido || '?'}`, '', ...linhas].join('\n');
  window.lista = saida;
  window.debugBloco = i => console.log(blocos[i].map(p => p.outerHTML).join('\n'));

  console.log(saida);
  const semCond = linhas.filter(l => !/\((NM|SP|MP|HP|D|M)[,)]/.test(l)).length;
  console.log(`%c${linhas.length} linhas`, 'font-weight:bold', semCond ? `— ${semCond} sem condição, rode debugBloco(0)` : '');
  try { copy(saida); console.log('copiado pro clipboard'); } catch (e) { console.log('use copy(lista)'); }
  return linhas.length;
})();
