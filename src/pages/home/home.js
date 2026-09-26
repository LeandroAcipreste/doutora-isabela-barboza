/**
 * Comportamento exclusivo da home.
 *
 * Tudo que é reutilizável (nav, cursor, reveal, marquee, accordion)
 * mora em src/js/components. Aqui ficam só as peças que existem
 * nesta página e em nenhuma outra.
 */

import { clamp, prefersReducedMotion } from '../../js/utils/motion.js';
import { getScroll } from '../../js/libs/gsap-setup.js';
import { splitLetters } from '../../js/utils/split.js';
import { dlog } from '../../js/components/debug.js';

/* -------------------------------------------------------------
   JORNADA — a seção prende e os cards passam um a um

   Mecanismo tirado do site de referência, sem timeline nenhuma:

     1. cada etapa mora numa tela de 100vh, em fluxo normal;
     2. cada uma dessas telas é presa no topo (pin) desde o próprio
        topo até a ÚLTIMA tela chegar ao topo, com pinSpacing: false;
     3. o card que ficou preso tomba para trás enquanto a tela
        seguinte sobe.

   O detalhe que faz tudo funcionar é o pinSpacing: false. Como o pin
   não acrescenta espaço, a altura do documento continua sendo
   5 x 100vh — e é a rolagem natural dessas cinco telas que empilha
   os cards. A tela presa fica parada, a de baixo continua subindo e
   passa por cima dela. Nada é interpolado: o movimento é 1:1 com o
   dedo ou a roda.
   ------------------------------------------------------------- */

/* Estado final da carta que tomba (os mesmos ângulos da referência). */
const OUT_ROTATE = 4;   // graus no plano da tela
const OUT_TILT = 34;    // graus de tombo para trás
const OUT_SCALE = 0.2;  // o quanto encolhe

function initJourney() {
  const section = document.querySelector('[data-journey]');
  if (!section) return;

  const cards = document.querySelector('[data-cards]');
  const wraps = [...section.querySelectorAll('[data-wrap]')];
  const bar = section.querySelector('[data-journey-progress]');
  const count = section.querySelector('[data-journey-count]');
  if (wraps.length < 2) return;

  const motor = getScroll();
  if (!motor) return;

  const { gsap, ScrollTrigger } = motor;
  const ultima = wraps[wraps.length - 1];
  const total = wraps.length;
  const pad = (n) => String(n).padStart(2, '0');

  // O tombo é enfeite; prender e trocar é estrutura. Por isso só o
  // tombo respeita prefers-reduced-motion — desligar o resto deixaria
  // a seção sem o comportamento que carrega o conteúdo.
  const comTombo = !prefersReducedMotion();

  // matchMedia do GSAP: remonta tudo quando a largura muda de faixa.
  // Sem ele, girar o aparelho deixaria pins presos em posições
  // calculadas para outra largura. A seção prende no celular também —
  // é a mesma experiência do desktop, e a única diferença é o layout
  // do card lá dentro, que o CSS resolve.
  const mm = gsap.matchMedia();

  mm.add('(min-width: 1px)', () => {
    wraps.forEach((wrap, i) => {
      // 1. cada tela fica presa no topo até a última chegar lá
      ScrollTrigger.create({
        trigger: wrap,
        start: 'top top',
        endTrigger: ultima,
        end: 'top top',
        pin: true,
        pinSpacing: false,
        invalidateOnRefresh: true,
      });

      // 2. o card tomba enquanto a tela seguinte sobe por cima
      if (i === total - 1 || !comTombo) return;

      const card = wrap.querySelector('[data-card]');
      ScrollTrigger.create({
        trigger: wraps[i + 1],
        start: 'top bottom',
        end: 'top top',
        scrub: 0.5,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const t = self.progress;
          gsap.set(card, {
            rotate: OUT_ROTATE * t,
            rotateX: OUT_TILT * t,
            scale: 1 - OUT_SCALE * t,
          });
        },
      });
    });

    // 3. contador e barra, lendo o mesmo curso das telas presas
    const medidor = ScrollTrigger.create({
      trigger: cards,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        if (bar) bar.style.setProperty('--p', String(self.progress));
        if (!count) return;
        const atual = Math.min(total, Math.round(self.progress * (total - 1)) + 1);
        count.textContent = pad(atual) + ' / ' + pad(total);
      },
    });

    // Ao sair da faixa larga o matchMedia limpa tudo, inclusive as
    // transformações que o scrub deixou escritas no style dos cards.
    return () => {
      medidor.kill();
      gsap.set(wraps.map((w) => w.querySelector('[data-card]')), { clearProps: 'transform' });
    };
  });
}

/* -------------------------------------------------------------
   FOTO QUE SE LEVANTA — abertura
   A foto entra deitada (tombada para trás, dobrada na base) e fica de
   pé no ritmo da rolagem: começa quando o topo dela aparece na tela e
   termina quando chega perto do meio. Amarrada ao scroll, ela volta a
   deitar se a pessoa rola para cima — o gesto se repete a cada
   passagem, como o resto do site.
   ------------------------------------------------------------- */
const STANDUP_TILT = 72; // graus de tombo no início

function initStandUp() {
  const alvos = [...document.querySelectorAll('[data-standup]')];
  if (!alvos.length || prefersReducedMotion()) return;

  const motor = getScroll();
  if (!motor) return;

  const { gsap } = motor;

  alvos.forEach((figura) => {
    const img = figura.querySelector('img');
    if (!img) return;

    gsap.fromTo(img,
      { rotateX: STANDUP_TILT, opacity: 0.35 },
      {
        rotateX: 0,
        opacity: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: figura,
          start: 'top bottom',
          end: 'top 45%',
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
      }
    );
  });
}

/* -------------------------------------------------------------
   FOTOS QUE CRESCEM NO MEIO DA TELA — cirurgia robótica
   Cada foto entra em miniatura, chega ao tamanho máximo quando o
   centro dela cruza o meio da tela e volta à miniatura ao sair.
   Amarrado à rolagem nos dois sentidos.
   ------------------------------------------------------------- */
const ZOOM_MIN = 0.86;
const ZOOM_MAX = 1.08;

function initZoom() {
  const fotos = [...document.querySelectorAll('[data-zoom]')];
  if (!fotos.length || prefersReducedMotion()) return;

  const motor = getScroll();
  if (!motor) return;

  const { gsap } = motor;

  fotos.forEach((foto) => {
    gsap.set(foto, { scale: ZOOM_MIN });
    gsap.timeline({
      scrollTrigger: {
        trigger: foto,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 0.5,
        invalidateOnRefresh: true,
      },
    })
      .to(foto, { scale: ZOOM_MAX, ease: 'power1.out', duration: 1 })
      .to(foto, { scale: ZOOM_MIN, ease: 'power1.in', duration: 1 });
  });
}

/* -------------------------------------------------------------
   SINTOMAS — a seção prende e os cards passam na horizontal

   A rolagem vertical vira deslocamento horizontal da fila: o pin
   segura a seção pelo tempo exato de a fila inteira atravessar a
   tela (a distância é a sobra da fila além da largura visível).
   Com movimento reduzido ou sem GSAP, nada disso roda e o CSS
   mantém a fila como rolagem horizontal nativa com encaixe.
   ------------------------------------------------------------- */
function initSymptoms() {
  const root = document.querySelector('[data-symptoms]');
  if (!root) return;

  const viewport = root.querySelector('[data-symptoms-viewport]');
  const track = root.querySelector('[data-symptoms-track]');
  const bar = root.querySelector('[data-symptoms-progress]');
  const count = root.querySelector('[data-symptoms-count]');
  if (!viewport || !track || prefersReducedMotion()) return;

  const motor = getScroll();
  if (!motor) return;

  const { gsap } = motor;
  const total = track.children.length;
  const pad = (n) => String(n).padStart(2, '0');
  const distancia = () => Math.max(0, track.scrollWidth - viewport.clientWidth);

  const mm = gsap.matchMedia();

  // Sem pin (movimento reduzido), a fila é deslizada com o dedo e o
  // contador acompanha a rolagem horizontal.
  viewport.addEventListener('scroll', () => {
    if (root.classList.contains('is-pinned')) return;
    const max = viewport.scrollWidth - viewport.clientWidth;
    const p = max > 0 ? viewport.scrollLeft / max : 0;
    if (bar) bar.style.setProperty('--p', String(p));
    if (count) count.textContent = pad(Math.min(total, Math.round(p * (total - 1)) + 1)) + ' / ' + pad(total);
  }, { passive: true });

  mm.add('(min-width: 1px)', () => {
    root.classList.add('is-pinned');

    const tween = gsap.to(track, {
      x: () => -distancia(),
      ease: 'none',
      scrollTrigger: {
        trigger: root,
        start: 'top top',
        end: () => '+=' + distancia(),
        pin: true,
        scrub: 0.6,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          if (bar) bar.style.setProperty('--p', String(self.progress));
          if (!count) return;
          const atual = Math.min(total, Math.round(self.progress * (total - 1)) + 1);
          count.textContent = pad(atual) + ' / ' + pad(total);
        },
      },
    });

    return () => {
      tween.scrollTrigger.kill();
      tween.kill();
      gsap.set(track, { clearProps: 'transform' });
      root.classList.remove('is-pinned');
    };
  });
}

/* -------------------------------------------------------------
   ESPECIALIDADES EM BARALHO — a seção prende e as cartas passam

   Os cards do painel ativo viram um maço. A rolagem tira a carta de
   cima (ela voa para a direita girando) e as de trás avançam para o
   lugar dela. A posição é contínua — pos = progresso × (cartas − 1) —
   e cada carta é desenhada pela distância até o topo (rel = índice −
   pos): negativa, já saiu ou está saindo; positiva, está no maço.
   Trocar entre Clínica e Cirúrgica redesenha o maço novo na mesma
   posição da rolagem.
   ------------------------------------------------------------- */
// A carta sai para a DIREITA: para a esquerda ela passaria por cima do
// título da seção no desktop.
const DECK_OUT_X = 125;    // % da largura que a carta percorre ao sair
const DECK_OUT_ROT = 14;   // graus de giro ao sair
const DECK_STEP_Y = 14;    // px que cada carta de trás desce
const DECK_STEP_S = 0.05;  // quanto cada carta de trás encolhe
const DECK_TILT = 2.2;     // graus de inclinação das cartas de trás
const DECK_VISIBLE = 3;    // cartas de trás à vista

function initConditionsDeck() {
  const root = document.querySelector('[data-conditions]');
  if (!root || prefersReducedMotion()) return;

  const bar = root.querySelector('[data-cond-progress]');
  const count = root.querySelector('[data-cond-count]');
  const painelAtivo = () => root.querySelector('[role="tabpanel"]:not([hidden])');

  const motor = getScroll();
  if (!motor) return;

  const { gsap } = motor;
  const pad = (n) => String(n).padStart(2, '0');
  let pos = 0;

  const desenhar = () => {
    const painel = painelAtivo();
    if (!painel) return;
    const cartas = [...painel.querySelectorAll('.cond')];
    const total = cartas.length;

    cartas.forEach((carta, k) => {
      const rel = k - pos;
      let props;
      if (rel <= -1) {
        props = { xPercent: DECK_OUT_X, y: 0, scale: 1, rotate: DECK_OUT_ROT, opacity: 0 };
      } else if (rel < 0) {
        const t = -rel;
        // Sólida quase até o fim: transparente no meio do caminho, ela
        // deixava o texto da carta de baixo embaralhado através dela.
        const opacity = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
        props = { xPercent: DECK_OUT_X * t, y: 0, scale: 1, rotate: DECK_OUT_ROT * t, opacity };
      } else {
        const lado = k % 2 ? 1 : -1;
        props = {
          xPercent: 0,
          y: DECK_STEP_Y * rel,
          scale: 1 - DECK_STEP_S * rel,
          rotate: lado * DECK_TILT * Math.min(rel, 1),
          opacity: rel > DECK_VISIBLE ? 0 : 1,
        };
      }
      gsap.set(carta, { ...props, zIndex: total - k });
    });

    if (bar) bar.style.setProperty('--p', String(total > 1 ? pos / (total - 1) : 0));
    if (count) count.textContent = pad(Math.min(total, Math.round(pos) + 1)) + ' / ' + pad(total);
  };

  const mm = gsap.matchMedia();

  mm.add('(min-width: 1px)', () => {
    root.classList.add('is-deck');
    const trocas = () => Math.max(1, (painelAtivo()?.querySelectorAll('.cond').length || 1) - 1);

    const st = motor.ScrollTrigger.create({
      trigger: root,
      start: 'top top',
      end: () => '+=' + Math.round(window.innerHeight * 0.8 * trocas()),
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        pos = self.progress * trocas();
        desenhar();
      },
    });

    // Trocar de tema recomeça o maço novo da primeira carta. Como a
    // posição é a rolagem, a troca leva a rolagem ao início do trecho
    // preso — de uma vez, sem animar: a seção está presa, então nada
    // pula na tela, só o maço volta para a carta 01.
    const aoTrocar = () => {
      pos = 0;
      desenhar();
      if (st.progress <= 0) return;
      // Rolagem nativa além do Lenis: no celular é ela que manda. Refeito
      // no quadro seguinte porque o próprio toque no botão pode mexer a
      // rolagem logo depois do clique.
      const voltar = () => {
        if (motor.lenis) motor.lenis.scrollTo(st.start, { immediate: true, force: true });
        window.scrollTo(0, st.start);
      };
      voltar();
      requestAnimationFrame(voltar);
    };
    root.addEventListener('conditions:change', aoTrocar);
    desenhar();

    return () => {
      st.kill();
      root.removeEventListener('conditions:change', aoTrocar);
      gsap.set(root.querySelectorAll('.cond'), { clearProps: 'transform,opacity,zIndex' });
      root.classList.remove('is-deck');
    };
  });
}

/* -------------------------------------------------------------
   OS 3 MEDOS — a seção prende e os cards sobem um sobre o outro

   A seção fica presa pelo tempo de trocar as cartas (uma tela de
   rolagem por troca). A carta que chega sobe de baixo, recortada pela
   borda da pilha, e a anterior recua por baixo dela — como
   um baralho. No celular a pilha começa pela foto. Com movimento
   reduzido as cartas ficam em coluna, em fluxo normal (estado do CSS).
   ------------------------------------------------------------- */
function initFears() {
  const root = document.querySelector('[data-fears]');
  if (!root || prefersReducedMotion()) return;

  const cards = [...root.querySelectorAll('[data-fear]')];
  const photo = root.querySelector('.fears__photo');
  const bar = root.querySelector('[data-fears-progress]');
  const count = root.querySelector('[data-fears-count]');
  if (cards.length < 2) return;

  const motor = getScroll();
  if (!motor) return;

  const { gsap } = motor;
  const total = cards.length;
  const pad = (n) => String(n).padStart(2, '0');
  const mm = gsap.matchMedia();

  /**
   * Monta a pilha. O parâmetro base é o que está à vista antes da
   * primeira troca:
   * no desktop a primeira carta (a foto fica ao lado); no celular a foto,
   * e as três cartas sobem por cima dela, uma de cada vez.
   */
  const montar = (base, chegando) => {
    root.classList.add('is-pinned');
    gsap.set(chegando, { yPercent: 104 });

    const pilha = [base, ...chegando];
    const trocas = chegando.length;

    const tl = gsap.timeline({
      defaults: { ease: 'none', duration: 1 },
      scrollTrigger: {
        trigger: root,
        start: 'top top',
        end: () => '+=' + Math.round(window.innerHeight * trocas),
        pin: true,
        scrub: 0.6,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          if (bar) bar.style.setProperty('--p', String(self.progress));
          if (!count) return;
          // A carta lida é a do topo: no celular a foto não conta.
          const topo = Math.round(self.progress * trocas) + (base === photo ? 0 : 1);
          count.textContent = pad(Math.max(1, Math.min(total, topo))) + ' / ' + pad(total);
        },
      },
    });

    chegando.forEach((card, i) => {
      // A carta de baixo só recua e continua sólida; quem esmaece é a
      // foto do celular. Esmaecer a carta deixava a foto aparecer
      // através dela e embaralhava o texto.
      tl.to(card, { yPercent: 0 }, i)
        .to(pilha[i], { scale: 0.92, opacity: pilha[i] === photo ? 0.35 : 1 }, i);
    });

    return () => {
      tl.scrollTrigger.kill();
      tl.kill();
      gsap.set([photo, ...cards], { clearProps: 'transform,opacity' });
      root.classList.remove('is-pinned');
    };
  };

  mm.add('(min-width: 901px)', () => montar(cards[0], cards.slice(1)));
  mm.add('(max-width: 900px)', () => montar(photo, cards));
}

/* -------------------------------------------------------------
   CONDIÇÕES — alternador Clínica / Cirúrgica
   Padrão de tabs da WAI-ARIA: setas navegam, Home/End vão às
   pontas, e o painel escondido usa [hidden] de verdade, para não
   ficar um bloco invisível roubando clique e leitura de tela.
   ------------------------------------------------------------- */
function initConditions() {
  const root = document.querySelector('[data-conditions]');
  if (!root) return;

  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const panels = [...root.querySelectorAll('[role="tabpanel"]')];
  const pill = root.querySelector('[data-toggle-pill]');
  if (!tabs.length) return;

  const movePill = (tab) => {
    if (!pill) return;
    pill.style.setProperty('--pill-w', tab.offsetWidth + 'px');
    pill.style.setProperty('--pill-x', (tab.offsetLeft - tabs[0].offsetLeft) + 'px');
  };

  const select = (index, focus = true) => {
    tabs.forEach((tab, i) => {
      const on = i === index;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      if (on) {
        movePill(tab);
        if (focus) tab.focus();
      }
    });
    panels.forEach((panel, i) => { panel.hidden = i !== index; });
    // O baralho (initConditionsDeck) redesenha o maço do painel novo.
    root.dispatchEvent(new CustomEvent('conditions:change'));
  };

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(i, false));
    tab.addEventListener('keydown', (e) => {
      const map = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
      const next = map[e.key];
      if (next === undefined) return;
      e.preventDefault();
      select((next + tabs.length) % tabs.length);
    });
  });

  select(0, false);

  // A pílula é posicionada em pixels, então precisa ser recalculada
  // quando a largura do rótulo muda (fonte carregada, resize).
  const reposition = () => {
    const active = tabs.find((t) => t.getAttribute('aria-selected') === 'true');
    if (active) movePill(active);
  };
  window.addEventListener('resize', reposition);
  if (document.fonts) document.fonts.ready.then(reposition);
}

/* -------------------------------------------------------------
   DEPOIMENTOS — a seção prende e as falas passam uma a uma

   Mesmo princípio da jornada: enquanto a seção está presa, a rolagem
   troca o depoimento em vez de mover a página. A diferença é que aqui
   a troca é discreta (um depoimento por fatia, sem meio-termo) —
   texto atravessando a tela pela metade não se lê.

   As setas continuam funcionando: em vez de mudar um índice por
   fora, elas rolam até a fatia correspondente. Assim existe uma
   fonte de verdade só, e a barra de rolagem nunca fica dessincronizada
   do que está na tela.
   ------------------------------------------------------------- */
function initVoices() {
  const root = document.querySelector('[data-voices]');
  if (!root) return;

  const slides = [...root.querySelectorAll('[data-voice]')];
  const prev = root.querySelector('[data-voice-prev]');
  const next = root.querySelector('[data-voice-next]');
  const counter = root.querySelector('[data-voice-count]');
  if (slides.length < 2) return;

  let index = 0;
  const pad = (n) => String(n).padStart(2, '0');

  const render = () => {
    slides.forEach((s, i) => {
      s.dataset.active = String(i === index);
      s.setAttribute('aria-hidden', String(i !== index));
    });
    if (counter) counter.textContent = pad(index + 1) + ' / ' + pad(slides.length);
  };

  const set = (i) => {
    const novo = Math.max(0, Math.min(slides.length - 1, i));
    if (novo === index) return;
    index = novo;
    render();
  };

  render();

  const motor = getScroll();

  /* ---- sem GSAP ou em tela estreita: carrossel comum ---- */
  const manual = () => {
    const go = (d) => set((index + d + slides.length) % slides.length);
    if (prev) prev.addEventListener('click', () => go(-1));
    if (next) next.addEventListener('click', () => go(1));
    root.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    });
    let startX = null;
    root.addEventListener('pointerdown', (e) => { startX = e.clientX; });
    root.addEventListener('pointerup', (e) => {
      if (startX === null) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 48) go(dx < 0 ? 1 : -1);
      startX = null;
    });
  };

  if (!motor) { manual(); return; }

  const { gsap, ScrollTrigger } = motor;
  const mm = gsap.matchMedia();

  mm.add('(min-width: 1px)', () => {
    // Uma fatia de scroll por depoimento. 0.7 de tela por fatia é o
    // suficiente para a troca não parecer atropelada nem arrastada.
    const st = ScrollTrigger.create({
      trigger: root,
      start: 'top top',
      end: () => '+=' + Math.round(slides.length * window.innerHeight * 0.7),
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        set(Math.floor(self.progress * slides.length));
      },
    });

    /** Rola até o meio da fatia do depoimento pedido. */
    const irPara = (i) => {
      const alvo = st.start + ((i + 0.5) / slides.length) * (st.end - st.start);
      if (motor.lenis) motor.lenis.scrollTo(alvo, { duration: 0.8 });
      else window.scrollTo({ top: alvo, behavior: 'smooth' });
    };

    const aoClicar = (d) => () => irPara(Math.max(0, Math.min(slides.length - 1, index + d)));
    const irAnterior = aoClicar(-1);
    const irProximo = aoClicar(1);
    const aoTeclar = (e) => {
      if (e.key === 'ArrowLeft') irAnterior();
      if (e.key === 'ArrowRight') irProximo();
    };

    if (prev) prev.addEventListener('click', irAnterior);
    if (next) next.addEventListener('click', irProximo);
    root.addEventListener('keydown', aoTeclar);

    return () => {
      st.kill();
      if (prev) prev.removeEventListener('click', irAnterior);
      if (next) next.removeEventListener('click', irProximo);
      root.removeEventListener('keydown', aoTeclar);
    };
  });

}

/* -------------------------------------------------------------
   PARALAXE do retrato
   Deslocamento pequeno e limitado (±4%). Paralaxe forte em foto de
   rosto distorce a percepção da pessoa; aqui ele serve só para a
   coluna fixa não parecer congelada.
   ------------------------------------------------------------- */
function initParallax() {
  const targets = [...document.querySelectorAll('[data-parallax]')];
  if (!targets.length || prefersReducedMotion()) return;

  let ticking = false;

  const update = () => {
    for (const el of targets) {
      const rect = el.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
      const center = rect.top + rect.height / 2 - window.innerHeight / 2;
      const shift = clamp(center / window.innerHeight, -1, 1) * -4;
      el.style.transform = 'translate3d(0, ' + shift + '%, 0) scale(1.09)';
    }
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }, { passive: true });

  update();
}

/* -------------------------------------------------------------
   HERO — o vídeo conduz a entrada

   A cada chegada ao hero (na abertura, depois da cortina, e toda vez
   que a pessoa volta ao topo) o vídeo toca UMA vez, do começo. Enquanto
   a Dra. Isabela se move, o texto sobe de baixo para cima, letra por
   letra na manchete; os tempos de cada bloco estão no CSS. Quando o
   vídeo termina, entram por último a barra de navegação e o link para
   as especialidades. Não há botão de agendar no hero: a pessoa agenda
   depois de conhecer a doutora, mais abaixo na página.
   Ao sair do hero tudo volta ao estado inicial, pronto para repetir.

   Se o navegador bloquear o autoplay (modo economia do iPhone, por
   exemplo), a sequência termina assim mesmo: nada fica escondido.
   ------------------------------------------------------------- */

/** Atraso da primeira letra e intervalo entre letras da manchete (s). */
const HERO_LETTER_START = 0.8;
const HERO_LETTER_STEP = 0.09;
/** Momento (s) em que cada bloco sobe, contado do início do vídeo. */
const HERO_STEPS = { 1: 0.3, 3: 4.4, 4: 5.2, 5: 5.8, 6: 6.3 };
/** Quando o vídeo não toca, o fim vem logo depois do último texto (ms). */
const HERO_FALLBACK_END = 6800;
/** Mesma curva de saída do site (--ease-out em variables.css). */
const HERO_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

function initHero() {
  const hero = document.querySelector('[data-hero]');
  if (!hero) return;

  const video = hero.querySelector('[data-hero-video]');
  const title = hero.querySelector('[data-hero-title]');
  const nav = document.querySelector('[data-nav]');

  // Movimento reduzido: tudo no estado final e o vídeo parado no
  // primeiro quadro, que é o mesmo do poster.
  if (prefersReducedMotion()) {
    hero.classList.add('is-playing', 'is-finished');
    if (video) video.pause();
    return;
  }

  // A entrada usa a Web Animations API: o navegador roda o movimento no
  // compositor, fora do JavaScript. Um engasgo da página (a saída do
  // preloader, o vídeo decodificando) não trava nem faz pular as letras
  // — o problema do Safari com transição CSS e com animação por quadro.
  // Navegador sem a API: o hero fica inteiro e parado.
  if (!('animate' in Element.prototype)) {
    dlog('[hero] sem Web Animations API: hero estático');
    return;
  }

  // Só a partir daqui o CSS esconde os blocos (estado inicial).
  hero.classList.add('is-sequenced');
  if (title) splitLetters(title);

  const letras = title ? [...title.querySelectorAll('.ch')] : [];
  const blocos = Object.entries(HERO_STEPS)
    .map(([passo, quando]) => [hero.querySelector('[data-hero-step="' + passo + '"]'), quando])
    .filter(([bloco]) => bloco);

  let animacoes = [];

  const pararEntrada = () => {
    animacoes.forEach((a) => a.cancel());   // volta ao estado inicial do CSS
    animacoes = [];
  };

  const tocarEntrada = () => {
    pararEntrada();
    letras.forEach((letra, i) => {
      animacoes.push(letra.animate(
        [{ transform: 'translateY(115%)' }, { transform: 'translateY(0)' }],
        { duration: 1000, delay: (HERO_LETTER_START + i * HERO_LETTER_STEP) * 1000, easing: HERO_EASE, fill: 'both' },
      ));
    });
    blocos.forEach(([bloco, quando]) => {
      animacoes.push(bloco.animate(
        [{ opacity: 0, transform: 'translateY(2.4rem)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 1200, delay: quando * 1000, easing: HERO_EASE, fill: 'both' },
      ));
    });
  };

  let rodando = false;
  let fimTimer = 0;

  const finalizar = (motivo) => {
    dlog('[hero] fim da sequência:', typeof motivo === 'string' ? motivo : 'vídeo terminou');
    clearTimeout(fimTimer);
    // O vídeo acabou: garante o texto inteiro no lugar.
    animacoes.forEach((a) => a.finish());
    hero.classList.add('is-finished');
    if (nav) nav.classList.remove('nav--intro');
  };

  const iniciar = () => {
    if (rodando) return;
    rodando = true;

    hero.classList.remove('is-finished');
    hero.classList.add('is-playing');
    if (nav) nav.classList.add('nav--intro');
    tocarEntrada();
    dlog('[hero] entrada iniciada:', animacoes.length + ' animações', video ? 'vídeo readyState=' + video.readyState : 'sem vídeo');

    if (!video) {
      fimTimer = setTimeout(() => finalizar('relógio (sem vídeo)'), HERO_FALLBACK_END);
      return;
    }

    video.currentTime = 0;
    // Trava de segurança: se o 'ended' não chegar, encerra pela duração.
    const duracao = Number.isFinite(video.duration) ? video.duration * 1000 : 8000;
    fimTimer = setTimeout(() => finalizar('limite de tempo (ended não chegou)'), duracao + 600);

    const tocando = video.play();
    if (tocando) {
      tocando.then(() => dlog('[hero] vídeo tocando')).catch((erro) => {
        dlog('[hero] vídeo BLOQUEADO:', erro && erro.name, erro && erro.message);
        // Vídeo bloqueado (modo economia do iPhone, por exemplo): o texto
        // já corre sozinho; só o fim passa a ser pelo relógio.
        clearTimeout(fimTimer);
        fimTimer = setTimeout(() => finalizar('relógio (vídeo bloqueado)'), HERO_FALLBACK_END);
      });
    }
  };

  const resetar = () => {
    if (!rodando) return;
    dlog('[hero] saiu do hero: reiniciado');
    rodando = false;
    clearTimeout(fimTimer);
    hero.classList.remove('is-playing', 'is-finished');
    if (nav) nav.classList.remove('nav--intro');
    // Volta ao estado inicial, pronto para a próxima chegada ao hero.
    pararEntrada();
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
  };

  if (video) video.addEventListener('ended', finalizar);

  // Entra quando um quarto do hero está na tela (no celular o hero é
  // mais alto que a tela, então um limiar maior nunca seria atingido)
  // e reseta só quando ele sai por completo.
  const observar = () => {
    new IntersectionObserver(([entrada]) => {
      if (entrada.isIntersecting && entrada.intersectionRatio >= 0.25) iniciar();
      else if (!entrada.isIntersecting) resetar();
    }, { threshold: [0, 0.25] }).observe(hero);
  };

  // A primeira sequência espera a cortina do preloader sair, que marca
  // o <html> com .is-ready.
  const raiz = document.documentElement;
  if (raiz.classList.contains('is-ready')) {
    observar();
  } else {
    new MutationObserver((_, mo) => {
      if (!raiz.classList.contains('is-ready')) return;
      mo.disconnect();
      observar();
    }).observe(raiz, { attributes: true, attributeFilter: ['class'] });
  }
}

/** Contrato da skill de página: cada página exporta um init. */
export function initHome() {
  initHero();
  // Pins criados na ordem em que aparecem na página: o ScrollTrigger
  // calcula o espaço de cada pin somando os que vieram antes dele.
  initStandUp();
  initSymptoms();
  initJourney();
  initConditions();
  initConditionsDeck();
  initZoom();
  initFears();
  initVoices();
  initParallax();
}
