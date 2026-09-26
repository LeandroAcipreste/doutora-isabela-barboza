/**
 * Preloader.
 *
 * Acompanha o carregamento real das imagens e vídeos marcados com
 * [data-preload] — nada de temporizador fingindo progresso. Em
 * conexão rápida a cortina sai quase imediatamente; em conexão
 * ruim ela segura a página até a primeira tela estar pronta.
 * Uma trava de 6 s impede que um asset travado prenda o site.
 */

const MAX_WAIT = 6000;

import { dlog } from './debug.js';

export function initPreloader(onDone = () => {}) {
  const loader = document.querySelector('[data-loader]');
  if (!loader) {
    onDone();
    return;
  }

  const bar = loader.querySelector('[data-loader-bar]');
  const count = loader.querySelector('[data-loader-count]');
  const images = [...document.querySelectorAll('img[data-preload], video[data-preload]')];

  document.body.classList.add('is-locked');

  // As fontes contam como mais um item: a manchete do hero é dividida
  // em letras e medida com a fonte certa. Se a P052 chega depois, o
  // Safari do iPhone mantém as larguras medidas com a fonte de reserva
  // (mais larga) e a manchete quebra linha errado.
  const temFontes = !!document.fonts;
  let loaded = 0;
  const total = images.length + (temFontes ? 1 : 0) || 1;

  const paint = () => {
    const pct = Math.round((loaded / total) * 100);
    if (bar) bar.style.transform = `scaleX(${loaded / total})`;
    if (count) count.textContent = String(pct).padStart(3, '0');
  };

  let finished = false;
  const finish = (motivo) => {
    if (finished) return;
    finished = true;
    dlog('[preloader] cortina saindo:', motivo || 'mídia carregada', loaded + '/' + total);
    loaded = total;
    paint();

    // Um respiro curto para a barra chegar visualmente a 100%
    // antes da cortina subir.
    setTimeout(() => {
      loader.dataset.done = 'true';
      document.body.classList.remove('is-locked');
      document.documentElement.classList.add('is-ready');
      onDone();
      // Depois da transição a cortina sai do caminho de vez —
      // um elemento fixo em tela inteira, mesmo transparente, é
      // um candidato a roubar clique.
      setTimeout(() => { loader.style.visibility = 'hidden'; }, 1100);
    }, 260);
  };

  const bump = () => {
    loaded += 1;
    paint();
    if (loaded >= total) finish();
  };

  paint();

  if (temFontes) {
    Promise.all([
      document.fonts.load('400 1em P052'),
      document.fonts.load('italic 400 1em P052'),
      document.fonts.load('400 1em "Nimbus Sans"'),
    ]).then(bump, bump);
  }

  if (!images.length) {
    if (!temFontes) finish();
  } else {
    images.forEach((media) => {
      // Vídeo conta como pronto quando os metadados chegam (readyState
      // 1). O Safari do iPhone costuma NÃO baixar dados de vídeo antes do
      // play, então esperar o primeiro quadro prendia a cortina até o
      // limite de 6 s. O poster já está na tela enquanto isso.
      const isVideo = media.tagName === 'VIDEO';
      const ready = isVideo ? media.readyState >= 1 : media.complete && media.naturalWidth;
      if (ready) bump();
      else {
        media.addEventListener(isVideo ? 'loadedmetadata' : 'load', bump, { once: true });
        media.addEventListener('error', bump, { once: true });
      }
    });
  }

  setTimeout(() => finish('limite de ' + MAX_WAIT / 1000 + ' s'), MAX_WAIT);
}
