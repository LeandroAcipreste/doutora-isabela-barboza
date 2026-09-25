/**
 * Marquee.
 *
 * Duas formas de mover a mesma faixa:
 *
 *  - contínua, em CSS puro (translateX de -50% em loop);
 *  - amarrada ao scroll, com `data-marquee-scroll`: a faixa anda
 *    exatamente o quanto a pessoa rolou, e volta quando ela sobe.
 *    É o comportamento da referência, onde duas faixas correm em
 *    sentidos opostos enquanto a seção passa pela tela.
 *
 * Nos dois casos o JS só duplica o grupo até a faixa ficar larga o
 * bastante para nunca mostrar um vão. O deslocamento é de exatamente
 * um grupo: no fim do curso, o grupo 2 está onde o grupo 1 começou, e
 * a emenda é invisível.
 */

import { getScroll } from '../libs/gsap-setup.js';

export function initMarquees(root = document) {
  const marquees = [...root.querySelectorAll('[data-marquee]')];
  const motor = getScroll();

  marquees.forEach((marquee) => {
    const track = marquee.querySelector('.marquee__track');
    const group = track?.querySelector('.marquee__group');
    if (!track || !group) return;

    const porScroll = marquee.hasAttribute('data-marquee-scroll');
    let tween = null;

    const build = () => {
      if (tween) { tween.scrollTrigger?.kill(); tween.kill(); tween = null; }

      // Volta ao estado original antes de recalcular.
      track.querySelectorAll('.marquee__group:not(:first-child)').forEach((n) => n.remove());
      track.style.transform = '';

      const unit = group.offsetWidth;
      if (!unit) return;

      // Precisa cobrir a tela mais um grupo inteiro: é esse grupo
      // extra que entra pela direita enquanto o primeiro sai.
      const needed = Math.ceil(window.innerWidth / unit) + 2;
      for (let i = 1; i < needed; i += 1) {
        const clone = group.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        track.appendChild(clone);
      }

      if (!porScroll || !motor) {
        // Velocidade constante em px/s: faixas curtas e longas andam
        // no mesmo ritmo, em vez de a curta parecer frenética.
        const speed = Number(marquee.dataset.speed || 70);
        track.style.setProperty('--marquee-dur', `${(unit * needed) / 2 / speed}s`);
        return;
      }

      const inverso = marquee.dataset.marqueeScroll === 'reverse';

      // Percurso amarrado ao quanto se rola de verdade: a faixa
      // atravessa a viewport em pouco menos de uma tela de scroll, e
      // andar um grupo inteiro nesse intervalo daria a impressão de
      // fast-forward. Um para um é o que parece "a faixa reagindo ao
      // dedo". O teto de um grupo existe porque é até onde os clones
      // cobrem — passar disso abriria um vão no fim da faixa.
      const curso = Math.min(unit, (window.innerHeight + marquee.offsetHeight) * 0.85);

      tween = motor.gsap.fromTo(
        track,
        { x: inverso ? -curso : 0 },
        {
          x: inverso ? 0 : -curso,
          ease: 'none',
          scrollTrigger: {
            trigger: marquee,
            // Todo o trajeto da faixa pela viewport vira curso da
            // animação: ela começa a andar quando aparece e termina
            // quando sai por cima.
            start: 'top bottom',
            end: 'bottom top',
            scrub: 1,
            invalidateOnRefresh: true,
          },
        }
      );

      // Recriado depois dos pins da página (fonte carregada, resize),
      // o gatilho volta para a ordem da página antes do próximo refresh.
      motor.ScrollTrigger.sort();
      motor.ScrollTrigger.refresh();
    };

    build();

    // A largura do grupo depende da fonte: medida antes da P052 local
    // chegar, a faixa ficaria curta e abriria um vão no fim.
    if (document.fonts) document.fonts.ready.then(build);

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(build, 220);
    });
  });
}
