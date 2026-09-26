/**
 * Console na página — diagnóstico no aparelho real.
 *
 * iPhone e Android não têm DevTools à mão, e simulador no computador
 * não reproduz tudo o que o aparelho faz. Este painel mostra, dentro do
 * próprio site, o que acontece de verdade no aparelho: ambiente, suporte
 * do navegador, fontes, vídeo, a sequência do hero, o estado das letras
 * quadro a quadro e todo erro de JavaScript.
 *
 * Só liga com ?debug=1 no endereço. Sem isso não cria nada, não injeta
 * estilo e não intercepta o console — as pacientes nunca veem.
 *
 * Uso: abrir https://<site>/?debug=1 no aparelho, esperar a sequência
 * do hero terminar e tocar em "Copiar". O texto copiado é o relatório.
 */

const ATIVO = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');
const T0 = performance.now();
const registros = [];
let lista = null;

const agora = () => ((performance.now() - T0) / 1000).toFixed(2) + 's';

function formatar(v) {
  try {
    if (v instanceof Error) {
      const pilha = v.stack ? '\n    ' + v.stack.split('\n').slice(0, 3).join('\n    ') : '';
      return `${v.name}: ${v.message}${pilha}`;
    }
    if (v && typeof v === 'object') return JSON.stringify(v);
    return String(v);
  } catch {
    return String(v);
  }
}

function escrever(tipo, partes) {
  const linha = `${agora()} [${tipo}] ${partes.map(formatar).join(' ')}`;
  registros.push({ tipo, linha });
  if (lista) desenharLinha(tipo, linha);
}

/** Registro do site: vai para o painel, só quando o debug está ativo. */
export function dlog(...partes) {
  if (ATIVO) escrever('site', partes);
}

export const debugAtivo = () => ATIVO;

// O console é interceptado já na avaliação do módulo, antes do boot, para
// pegar também o que acontecer cedo.
if (ATIVO) {
  for (const tipo of ['log', 'info', 'warn', 'error']) {
    const original = console[tipo].bind(console);
    console[tipo] = (...partes) => {
      escrever(tipo, partes);
      original(...partes);
    };
  }
  window.addEventListener('error', (e) => {
    escrever('ERRO', [e.message, `${e.filename || ''}:${e.lineno || ''}:${e.colno || ''}`, e.error || '']);
  });
  window.addEventListener('unhandledrejection', (e) => escrever('ERRO', ['promessa rejeitada:', e.reason]));
}

/* ---------------------------------------------------------------
   Painel
   --------------------------------------------------------------- */

// Não pode se chamar CSS: esconderia o objeto CSS do navegador (CSS.supports).
const ESTILO = `
.dbg{position:fixed;left:0;right:0;bottom:0;z-index:2147483647;height:42vh;display:flex;flex-direction:column;
  background:rgba(8,14,12,.94);color:#cfeedd;font:11px/1.45 ui-monospace,Menlo,Consolas,monospace;
  border-top:2px solid #3cb87c;-webkit-text-size-adjust:100%}
.dbg[data-min="true"]{height:auto}
.dbg[data-min="true"] .dbg__lista{display:none}
.dbg__barra{display:flex;gap:6px;align-items:center;padding:6px 8px;background:#0f1d18;flex-wrap:wrap}
.dbg__barra b{color:#3cb87c;margin-right:auto;font-weight:700}
.dbg__barra button{font:inherit;color:#0c1a15;background:#cfeedd;border:0;border-radius:4px;padding:6px 10px;min-height:32px}
.dbg__lista{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:6px 8px;margin:0;list-style:none;overscroll-behavior:contain}
.dbg__lista li{white-space:pre-wrap;word-break:break-word;border-bottom:1px solid rgba(255,255,255,.06);padding:2px 0}
.dbg__lista li[data-t="ERRO"],.dbg__lista li[data-t="error"]{color:#ff8f8f}
.dbg__lista li[data-t="warn"]{color:#ffd27a}
.dbg__lista li[data-t="site"]{color:#9fe3ff}
`;

function desenharLinha(tipo, linha) {
  const li = document.createElement('li');
  li.dataset.t = tipo;
  li.textContent = linha;
  lista.appendChild(li);
  lista.scrollTop = lista.scrollHeight;
}

function copiar(botao) {
  const texto = registros.map((r) => r.linha).join('\n');
  const feito = () => { botao.textContent = 'Copiado!'; setTimeout(() => { botao.textContent = 'Copiar'; }, 1500); };
  const alternativa = () => {
    // iOS antigo / sem permissão de área de transferência.
    const area = document.createElement('textarea');
    area.value = texto;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, texto.length);
    try { document.execCommand('copy'); feito(); } catch { botao.textContent = 'Falhou'; }
    area.remove();
  };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(texto).then(feito, alternativa);
  else alternativa();
}

function montarPainel() {
  const estilo = document.createElement('style');
  estilo.textContent = ESTILO;
  document.head.appendChild(estilo);

  const painel = document.createElement('div');
  painel.className = 'dbg';
  painel.setAttribute('data-lenis-prevent', '');
  painel.innerHTML = '<div class="dbg__barra"><b>debug</b>'
    + '<button type="button" data-a="copiar">Copiar</button>'
    + '<button type="button" data-a="limpar">Limpar</button>'
    + '<button type="button" data-a="min">Minimizar</button></div>'
    + '<ul class="dbg__lista" data-lenis-prevent></ul>';
  document.body.appendChild(painel);
  lista = painel.querySelector('.dbg__lista');

  painel.addEventListener('click', (e) => {
    const a = e.target.closest('button')?.dataset.a;
    if (a === 'copiar') copiar(e.target);
    if (a === 'limpar') { registros.length = 0; lista.innerHTML = ''; }
    if (a === 'min') {
      const min = painel.dataset.min !== 'true';
      painel.dataset.min = String(min);
      e.target.textContent = min ? 'Expandir' : 'Minimizar';
    }
  });

  registros.forEach((r) => desenharLinha(r.tipo, r.linha));
}

/* ---------------------------------------------------------------
   Diagnóstico
   --------------------------------------------------------------- */

function yDe(el) {
  if (!el) return null;
  const m = getComputedStyle(el).transform;
  if (!m || m === 'none') return 0;
  const n = m.replace(/^matrix(3d)?\(|\)$/g, '').split(',').map(Number);
  return Math.round(n.length === 16 ? n[13] : n[5]);
}

function ambiente() {
  const raiz = document.documentElement;
  const vv = window.visualViewport;
  escrever('amb', ['UA:', navigator.userAgent]);
  escrever('amb', [`tela ${innerWidth}x${innerHeight}`, `screen ${screen.width}x${screen.height}`, `dpr ${devicePixelRatio}`,
    vv ? `visualViewport ${Math.round(vv.width)}x${Math.round(vv.height)}` : 'sem visualViewport']);
  escrever('amb', [`device=${raiz.dataset.device}`, `orientation=${raiz.dataset.orientation}`,
    `--fit=${getComputedStyle(raiz).getPropertyValue('--fit').trim()}`, `font-size raiz=${getComputedStyle(raiz).fontSize}`]);
  escrever('amb', [
    `WAAPI(animate)=${'animate' in Element.prototype}`,
    `getAnimations=${'getAnimations' in Element.prototype}`,
    `IntersectionObserver=${'IntersectionObserver' in window}`,
    `reduzir movimento (sistema)=${matchMedia('(prefers-reduced-motion: reduce)').matches}`,
    `svh=${CSS.supports('height', '100svh')}`,
    `color-mix=${CSS.supports('color', 'color-mix(in srgb, red 50%, blue)')}`,
    `GSAP=${!!window.gsap}`, `ScrollTrigger=${!!window.ScrollTrigger}`, `Lenis=${!!window.Lenis}`,
  ]);
}

function vigiarFontes() {
  if (!document.fonts) { escrever('fonte', ['document.fonts indisponível']); return; }
  escrever('fonte', ['status inicial:', document.fonts.status]);
  document.fonts.ready.then(() => {
    escrever('fonte', ['prontas:', `P052=${document.fonts.check('16px P052')}`, `Nimbus=${document.fonts.check('16px "Nimbus Sans"')}`]);
  });
}

function vigiarVideo() {
  const v = document.querySelector('[data-hero-video]');
  if (!v) { escrever('vídeo', ['não encontrado']); return; }
  escrever('vídeo', [`src=${v.currentSrc || v.getAttribute('src')}`, `muted=${v.muted}`, `playsInline=${v.playsInline}`,
    `autoplay=${v.autoplay}`, `readyState=${v.readyState}`]);
  ['loadstart', 'loadedmetadata', 'loadeddata', 'canplay', 'play', 'playing', 'pause', 'waiting', 'stalled', 'suspend', 'ended', 'error']
    .forEach((ev) => v.addEventListener(ev, () => {
      const erro = ev === 'error' && v.error ? ` code=${v.error.code} ${v.error.message || ''}` : '';
      escrever('vídeo', [`${ev}`, `t=${v.currentTime.toFixed(2)}`, `readyState=${v.readyState}`, `paused=${v.paused}${erro}`]);
    }));
}

function vigiarClasses(el, rotulo, nomes) {
  if (!el) return;
  let antes = nomes.filter((n) => el.classList.contains(n)).join(' ');
  escrever(rotulo, ['classes:', antes || '(nenhuma)']);
  new MutationObserver(() => {
    const agoraC = nomes.filter((n) => el.classList.contains(n)).join(' ');
    if (agoraC !== antes) {
      antes = agoraC;
      escrever(rotulo, ['classes:', agoraC || '(nenhuma)']);
    }
  }).observe(el, { attributes: true, attributeFilter: ['class'] });
}

/** Amostra o estado das letras a cada 0,4 s enquanto a entrada roda. */
function vigiarLetras() {
  const hero = document.querySelector('[data-hero]');
  if (!hero) return;
  let timer = 0;

  const amostrar = (n) => {
    const letras = [...document.querySelectorAll('.hero__title .ch')];
    const lead = document.querySelector('.hero__lead');
    const animando = letras.filter((l) => l.getAnimations && l.getAnimations().length).length;
    const prontas = letras.filter((l) => Math.abs(yDe(l)) < 2).length;
    const a0 = letras[0]?.getAnimations?.()[0];
    escrever('letras', [
      `total=${letras.length}`, `com animação=${animando}`, `no lugar=${prontas}`,
      `y[0]=${yDe(letras[0])}`, `y[10]=${yDe(letras[10])}`, `y[20]=${yDe(letras[20])}`,
      a0 ? `anim0 ${a0.playState} t=${Math.round(a0.currentTime)}ms` : 'anim0 —',
      `parágrafo opac=${lead ? (+getComputedStyle(lead).opacity).toFixed(2) : '—'}`,
    ]);
    if (n === 24) {
      // Uma vez por entrada: linhas da manchete e, por palavra, a largura
      // da caixa x a soma das letras. Caixa maior que as letras = medida
      // feita com outra fonte (o defeito de quebra de linha do Safari).
      const palavras = [...document.querySelectorAll('.hero__title .w')];
      const topos = new Set(palavras.map((w) => Math.round(w.getBoundingClientRect().top)));
      const titulo = document.querySelector('.hero__title');
      escrever('manchete', [
        'linhas=' + topos.size,
        'largura título=' + Math.round(titulo.getBoundingClientRect().width),
        'fonte=' + getComputedStyle(titulo).fontFamily,
      ]);
      palavras.forEach((w) => {
        const caixa = w.getBoundingClientRect().width;
        const letrasW = [...w.querySelectorAll('.ch')].reduce((t, c) => t + c.getBoundingClientRect().width, 0);
        escrever('manchete', [
          '"' + w.textContent + '"',
          'caixa=' + caixa.toFixed(1),
          'letras=' + letrasW.toFixed(1),
          'sobra=' + (caixa - letrasW).toFixed(1),
        ]);
      });
    }
    if (n > 0) timer = setTimeout(() => amostrar(n - 1), 400);
  };

  new MutationObserver(() => {
    if (hero.classList.contains('is-playing') && !timer) {
      amostrar(24);   // ~10 s de amostras
    }
    if (!hero.classList.contains('is-playing')) { clearTimeout(timer); timer = 0; }
  }).observe(hero, { attributes: true, attributeFilter: ['class'] });
}

/** Roda uma etapa do diagnóstico sem nunca derrubar o site. */
function seguro(nome, fn) {
  try { fn(); } catch (erro) { escrever('ERRO', ['debug/' + nome + ':', erro]); }
}

/** Liga o painel e os vigias. Chamado no início do boot. */
export function initDebug() {
  if (!ATIVO) return;
  seguro('painel', montarPainel);
  escrever('debug', ['painel ativo — espere o hero terminar e toque em Copiar']);
  // O retrato do ambiente sai depois do boot, quando a medida do
  // dispositivo (utils/viewport.js) já foi publicada no <html>.
  setTimeout(() => seguro('ambiente', ambiente), 0);
  seguro('fontes', vigiarFontes);
  seguro('vídeo', vigiarVideo);
  seguro('classes', () => {
    vigiarClasses(document.documentElement, 'html', ['is-ready']);
    vigiarClasses(document.querySelector('[data-hero]'), 'hero', ['is-sequenced', 'is-playing', 'is-finished']);
    vigiarClasses(document.querySelector('[data-nav]'), 'nav', ['nav--intro', 'nav--hidden', 'nav--stuck']);
  });
  seguro('letras', vigiarLetras);
}
