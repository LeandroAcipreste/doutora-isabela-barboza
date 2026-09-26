/**
 * Ponto de entrada.
 *
 * Orquestra e nada mais: componentes globais sobem sempre, a
 * página específica sobe conforme o data-page do <body>. Toda a
 * lógica pesada mora nos módulos importados — se este arquivo
 * começar a crescer, é sinal de que algo nasceu no lugar errado.
 *
 * Ordem: medida do dispositivo → componentes globais → smooth scroll →
 * página → encaixe das seções presas. O reveal
 * fica por último dentro do preloader, para nenhuma animação de
 * entrada rodar atrás da cortina e ser desperdiçada.
 */

// Primeiro import de propósito: com ?debug=1 ele intercepta o console
// antes de qualquer outro módulo rodar (ver components/debug.js).
import { initDebug } from './components/debug.js';
import { measureViewport, applyViewport } from './utils/viewport.js';
import { initFit } from './components/fit.js';
import { initNav } from './components/nav.js';
import { initCursor } from './components/cursor.js';
import { initMarquees } from './components/marquee.js';
import { initAccordion } from './components/accordion.js';
import { initReveal } from './components/reveal.js';
import { initPreloader } from './components/preloader.js';
import { initScrollEngine } from './libs/gsap-setup.js';
import { initHome } from '../pages/home/home.js';

const PAGES = {
  home: initHome,
};

/**
 * Toda carga da página começa no hero.
 *
 * São três coisas diferentes puxando o scroll para longe do topo, e
 * cada uma precisa do seu tratamento:
 *
 *  1. a restauração de rolagem do navegador no F5 — desligada no
 *     <head>, antes da primeira pintura, para não haver salto visível;
 *  2. um hash na URL (#duvidas, por exemplo), que faz o navegador
 *     pular para a seção sozinho — removido aqui, sem criar entrada
 *     no histórico;
 *  3. a volta pelo botão "voltar" com a página vinda do cache do
 *     navegador (bfcache), que não dispara carregamento nenhum e por
 *     isso precisa do listener de pageshow.
 */
function resetScroll() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  if (window.location.hash) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  window.scrollTo(0, 0);
}

function boot() {
  // Console na página (só com ?debug=1 no endereço).
  initDebug();

  // Primeira coisa do site: medir a tela real. Tudo o que vem depois
  // (raiz rem, pins, encaixes) já nasce na escala certa do aparelho.
  applyViewport(measureViewport());
  resetScroll();

  // O motor sobe antes das peças: cada uma consulta se há GSAP para
  // decidir entre amarrar ao scroll ou só disparar uma classe CSS.
  const motor = initScrollEngine();
  if (motor?.lenis) motor.lenis.scrollTo(0, { immediate: true });

  initNav();
  initCursor();
  initMarquees();
  initAccordion();

  const page = document.body.dataset.page;
  const initPage = PAGES[page];
  if (initPage) initPage();

  // Os gatilhos são medidos na ordem em que foram criados, e os
  // componentes globais (marquee) nascem antes dos pins da página.
  // Um pin acima deles acrescenta altura de rolagem que eles ainda
  // não conheciam — a faixa ficava parada, com o trajeto calculado
  // no lugar errado. Reordenar pela posição na página resolve para
  // qualquer pin, atual ou futuro.
  motor?.ScrollTrigger.sort();

  // Encaixe das seções presas na altura da tela. Precisa dos pins já
  // criados (só age em seção presa) e é refeito sempre que algo muda o
  // tamanho do conteúdo ou da tela.
  const fitAll = initFit();
  const reencaixar = () => {
    motor?.ScrollTrigger.refresh();
    fitAll();
    motor?.ScrollTrigger.refresh();
  };
  if (document.fonts) document.fonts.ready.then(reencaixar);

  let medirTimer;
  const aoMudarTela = () => {
    clearTimeout(medirTimer);
    medirTimer = setTimeout(() => {
      applyViewport(measureViewport());
      reencaixar();
    }, 180);
  };
  window.addEventListener('resize', aoMudarTela);
  window.addEventListener('orientationchange', aoMudarTela);

  // A cortina só sai depois que a página está montada; o reveal é
  // ligado no mesmo instante, então a primeira dobra anima na
  // frente do usuário em vez de já ter animado escondida.
  initPreloader(() => {
    window.scrollTo(0, 0);
    // O corpo ficou travado enquanto a cortina cobria a tela, então a
    // altura do documento acabou de mudar. Sem remedir, o Lenis pode
    // seguir achando que a página não rola e engolir o primeiro
    // clique num link de âncora.
    if (motor?.lenis) motor.lenis.resize();
    fitAll();
    motor?.ScrollTrigger.refresh();
    initReveal();
  });
}

// A volta pelo cache do navegador não dispara boot() de novo.
window.addEventListener('pageshow', (e) => {
  if (e.persisted) resetScroll();
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
