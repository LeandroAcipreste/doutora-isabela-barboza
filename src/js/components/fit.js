/**
 * Fit — encaixa as seções presas na altura da tela.
 *
 * Fábrica: cada elemento marcado com [data-fit] ganha um fitter próprio
 * (createFitter). O registro (initFit) devolve uma função única que
 * remede todos — chamada pelo main.js depois das fontes, na saída do
 * preloader e a cada mudança de tamanho ou de orientação.
 *
 * Só age em seção PRESA (dentro de um .pin-spacer): seção que rola não
 * precisa caber numa tela. Se o conteúdo for mais alto que a tela, o
 * bloco inteiro é reduzido na proporção exata (--fit-scale, aplicado
 * no CSS com origem no topo), e a margem de baixo devolve a altura que
 * sobrou — sem isso ficaria um vão depois da seção.
 *
 * A primeira linha de defesa é a raiz rem (utils/viewport.js); este é o
 * ajuste fino de quem precisa caber numa tela só.
 */

const SCALE_FLOOR = 0.6;   // menor redução aceitável de uma seção

export function createFitter(el) {
  const medir = () => {
    // Volta ao tamanho natural antes de medir: a medida é de layout.
    el.style.setProperty('--fit-scale', '1');
    el.style.marginBottom = '';

    if (!el.closest('.pin-spacer')) return 1;

    const natural = Math.max(el.scrollHeight, el.offsetHeight);
    const disponivel = window.innerHeight;
    if (natural <= disponivel) return 1;

    const escala = Math.max(SCALE_FLOOR, disponivel / natural);
    el.style.setProperty('--fit-scale', escala.toFixed(4));
    el.style.marginBottom = `${-Math.round(natural * (1 - escala))}px`;
    return escala;
  };

  return { el, medir };
}

/** Cria um fitter por [data-fit] e devolve a função que remede todos. */
export function initFit(root = document) {
  const fitters = [...root.querySelectorAll('[data-fit]')].map(createFitter);
  const fitAll = () => fitters.forEach((f) => f.medir());
  fitAll();
  return fitAll;
}
