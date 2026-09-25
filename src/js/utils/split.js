/**
 * Fatia texto em palavras mascaradas para a animação de entrada.
 *
 * Por que palavra e não linha: fatiar por linha exige medir onde o
 * navegador quebrou o texto e refazer tudo a cada redimensionamento,
 * e destrói qualquer <em>, <mark> ou <a> no meio da frase. Fatiando
 * palavra por palavra, a marcação original continua intacta e o
 * resultado sobrevive a qualquer largura de tela.
 */

const WORD = /(\s+)/;

function wrapTextNode(node) {
  const parts = node.textContent.split(WORD);
  const frag = document.createDocumentFragment();

  for (const part of parts) {
    if (part === '') continue;
    // Espaço em branco volta como está: envolvê-lo criaria uma
    // janela vazia que colapsa e come o espaço entre palavras.
    if (!part.trim()) {
      frag.appendChild(document.createTextNode(part));
      continue;
    }
    const outer = document.createElement('span');
    outer.className = 'w';
    const inner = document.createElement('span');
    inner.className = 'w__in';
    inner.textContent = part;
    outer.appendChild(inner);
    frag.appendChild(outer);
  }

  node.replaceWith(frag);
}

function walk(el) {
  // Cópia estática: vamos trocar nós enquanto percorremos.
  for (const node of [...el.childNodes]) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent.trim()) wrapTextNode(node);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.classList.contains('w')) continue; // já fatiado
      walk(node);
    }
  }
}

/**
 * @param {Element} el         elemento com [data-split]
 * @param {number}  step       atraso entre palavras, em segundos
 * @param {number}  maxDelay   teto do atraso, para frases longas não
 *                             levarem três segundos para aparecer
 */
/* Sinais que, em português, pertencem à palavra anterior e jamais
   podem abrir uma linha. */
const NAO_ABRE_LINHA = /^[:;,.!?)]…»”%]+$/;

/**
 * Cola a pontuação na palavra que veio antes dela.
 *
 * O fatiador trabalha um nó de texto por vez, então um sinal logo
 * depois de um <em> ou <mark> cai num nó próprio e vira uma "palavra"
 * sozinha. E o navegador pode quebrar linha entre dois inline-block
 * mesmo sem espaço entre eles — foi assim que os dois-pontos de
 * "Especialista:" desceram para a linha de baixo.
 *
 * A solução envolve o par num invólucro que proíbe a quebra, em vez
 * de juntar os textos: cada metade guarda a própria cor e o próprio
 * atraso de animação.
 */
function colarPontuacao(el) {
  const palavras = [...el.querySelectorAll('.w')];

  for (let i = 1; i < palavras.length; i += 1) {
    const sinal = palavras[i];
    if (!NAO_ABRE_LINHA.test(sinal.textContent.trim())) continue;

    const antes = palavras[i - 1];
    if (antes.parentElement && antes.parentElement.classList.contains('w-par')) continue;

    const par = document.createElement('span');
    par.className = 'w-par';
    antes.replaceWith(par);
    par.append(antes, sinal);
  }
}

/**
 * Fatia por palavra (máscaras) e, dentro de cada palavra, por letra.
 * Cada letra recebe o próprio atraso em --d, então quem anima decide
 * no CSS quando usar o atraso — só na entrada, e não na saída.
 * O texto inteiro vira aria-label: leitor de tela lê a frase, não
 * letra por letra.
 */
export function splitLetters(el, { start = 0, step = 0.08 } = {}) {
  if (el.dataset.lettersDone === 'true') return;
  el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  splitWords(el);

  let i = 0;
  el.querySelectorAll('.w__in').forEach((inner) => {
    inner.setAttribute('aria-hidden', 'true');
    const walker = document.createTreeWalker(inner, NodeFilter.SHOW_TEXT);
    const textos = [];
    while (walker.nextNode()) textos.push(walker.currentNode);

    for (const node of textos) {
      const frag = document.createDocumentFragment();
      for (const letra of node.textContent) {
        const span = document.createElement('span');
        span.className = 'ch';
        span.textContent = letra;
        span.style.setProperty('--d', (start + i * step).toFixed(2) + 's');
        i += 1;
        frag.append(span);
      }
      node.replaceWith(frag);
    }
  });

  el.dataset.lettersDone = 'true';
}

export function splitWords(el, step = 0.028, maxDelay = 0.6) {
  if (el.dataset.splitDone === 'true') return;
  walk(el);
  colarPontuacao(el);
  el.dataset.splitDone = 'true';

  el.querySelectorAll('.w__in').forEach((inner, i) => {
    inner.style.transitionDelay = `${Math.min(i * step, maxDelay)}s`;
  });
}
