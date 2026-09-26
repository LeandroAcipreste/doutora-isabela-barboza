/**
 * Viewport — a primeira medida do site.
 *
 * Roda antes de qualquer componente montar (primeira linha do boot,
 * ainda atrás da cortina do preloader). Mede a tela real do aparelho e
 * publica no <html>:
 *
 *   data-device       mobile | tablet | desktop
 *   data-orientation  portrait | landscape
 *   --app-w, --app-h  largura e altura reais, em px
 *   --fit             fator da raiz rem (ver base.css)
 *
 * O layout escala pela largura (1rem ≈ 10px em 1440px). Numa tela larga
 * e baixa — janela de notebook, navegador com barras — isso deixa tudo
 * alto demais para a altura disponível. O --fit reduz a raiz na
 * proporção de altura que falta em relação ao desenho de referência
 * (1440 × 900), com um piso para o texto nunca ficar ilegível. O ajuste
 * fino de cada seção presa fica com components/fit.js.
 */

const REF_RATIO = 1440 / 900;   // proporção do desenho de referência
const FIT_FLOOR = 0.85;         // menor redução aceitável da raiz

/** Medida pura: não toca no DOM. */
export function measureViewport(win = window) {
  const w = win.innerWidth;
  const h = win.innerHeight;
  const device = w < 768 ? 'mobile' : w < 1100 ? 'tablet' : 'desktop';
  const orientation = w >= h ? 'landscape' : 'portrait';

  // No celular e no tablet a raiz já é pensada para a tela (base.css);
  // o encaixe por altura é problema do desktop largo e baixo.
  const fit = device === 'desktop'
    ? Math.min(1, Math.max(FIT_FLOOR, (h * REF_RATIO) / w))
    : 1;

  return { w, h, device, orientation, fit };
}

/** Publica a medida no <html> para o CSS e para os componentes. */
export function applyViewport(v, root = document.documentElement) {
  root.dataset.device = v.device;
  root.dataset.orientation = v.orientation;
  root.style.setProperty('--app-w', v.w + 'px');
  root.style.setProperty('--app-h', v.h + 'px');
  root.style.setProperty('--fit', v.fit.toFixed(3));
}
