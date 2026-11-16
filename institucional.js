/* Mejora progresiva: páginas y contenido legibles sin JavaScript. */
(() => {
  const config = window.colegioContent;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

  const menu = document.getElementById('nav');
  const menuButton = document.querySelector('.menu-toggle');
  const navGroups = [...document.querySelectorAll('[data-nav-group]')];
  const closeSubmenus = except => navGroups.forEach(group => {
    if (group === except) return;
    group.querySelector('.submenu-toggle').setAttribute('aria-expanded', 'false');
    group.querySelector('.nav-submenu').hidden = true;
  });
  document.querySelector('.site-header')?.classList.add('navigation-ready');
  navGroups.forEach(group => {
    const toggle = group.querySelector('.submenu-toggle');
    const panel = group.querySelector('.nav-submenu');
    toggle.hidden = false;
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      closeSubmenus(group);
      toggle.setAttribute('aria-expanded', String(open));
      panel.hidden = !open;
    });
  });
  const closeMenu = () => {
    closeSubmenus();
    menu?.classList.remove('open');
    menuButton?.setAttribute('aria-expanded', 'false');
  };
  menuButton?.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('open', open);
  });
  menu?.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const open = navGroups.find(group => group.querySelector('.submenu-toggle').getAttribute('aria-expanded') === 'true');
    if (open) { closeSubmenus(); open.querySelector('.submenu-toggle').focus(); return; }
    if (menu?.classList.contains('open')) { closeMenu(); menuButton.focus(); }
  });
  document.addEventListener('pointerdown', event => {
    if (!event.target.closest('.site-header')) closeMenu();
  });
  document.addEventListener('focusin', event => {
    if (!event.target.closest('.site-header')) closeSubmenus();
  });
  matchMedia('(min-width: 1041px)').addEventListener('change', closeMenu);

  const disclosures = [...document.querySelectorAll('[data-disclosure]')];
  let printState = null;
  const summary = detail => detail.querySelector('summary');
  const sync = detail => summary(detail).setAttribute('aria-expanded', String(detail.open));
  const openDetail = (detail, animate = false) => {
    const group = detail.closest('[data-accordion]');
    group.querySelectorAll('[data-disclosure]').forEach(other => {
      if (other !== detail) {
        other.open = false;
        sync(other);
      }
    });
    detail.open = true;
    sync(detail);
    const panel = detail.querySelector('.disclosure-panel');
    if (animate && !motion.matches && panel.animate) {
      panel.getAnimations().forEach(animation => animation.cancel());
      panel.animate([{height:'0px', opacity:0}, {height:panel.scrollHeight+'px', opacity:1}], {duration:200, easing:'ease-out'});
    }
  };
  disclosures.forEach(detail => {
    sync(detail);
    summary(detail).addEventListener('click', event => {
      event.preventDefault();
      const top = summary(detail).getBoundingClientRect().top;
      if (detail.open) {
        detail.open = false;
        sync(detail);
        if (location.hash === '#'+detail.id) history.replaceState(null, '', location.pathname+location.search);
      } else {
        openDetail(detail, true);
        history.replaceState(null, '', '#'+detail.id);
        // Cerrar una lista extensa anterior puede mover el título fuera de la vista.
        if (top >= 0 && summary(detail).getBoundingClientRect().top < 0) {
          summary(detail).scrollIntoView({block:'start', behavior:motion.matches?'instant':'smooth'});
        }
      }
    });
    detail.addEventListener('toggle', () => {
      if (printState) { sync(detail); return; }
      if (detail.open) {
        detail.closest('[data-accordion]').querySelectorAll('[data-disclosure]').forEach(other => {
          if (other !== detail && other.open) { other.open = false; sync(other); }
        });
      }
      sync(detail);
    });
  });

  function resolveFragment() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    if (!id) return;
    const isHome = location.pathname === config?.basePath || location.pathname === config?.basePath+'index.html';
    if (isHome && config?.legacy[id]) {
      location.replace(config.basePath+config.legacy[id]);
      return;
    }
    const target = document.getElementById(id);
    const detail = target?.closest('[data-disclosure]');
    if (detail) {
      openDetail(detail);
      requestAnimationFrame(() => summary(detail).scrollIntoView({block:'start', behavior:'instant'}));
    }
  }
  resolveFragment();
  window.addEventListener('hashchange', resolveFragment);
  // Un enlace al panel ya indicado en la URL también debe volver a abrirlo.
  document.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', () => {
    if (link.hash === location.hash) resolveFragment();
  }));

  window.addEventListener('beforeprint', () => {
    printState = disclosures.map(detail => ({detail, open:detail.open, name:detail.getAttribute('name')}));
    printState.forEach(({detail}) => detail.removeAttribute('name'));
    disclosures.forEach(detail => { detail.open = true; sync(detail); });
  });
  window.addEventListener('afterprint', () => {
    printState?.forEach(({detail}) => { detail.open = false; });
    printState?.forEach(({detail, name, open}) => {
      if (name) detail.setAttribute('name', name);
      detail.open = open;
      sync(detail);
    });
    printState = null;
  });

  const form = document.getElementById('admission-contact-form');
  if (!form) return;
  form.hidden = false;
  const review = document.getElementById('admission-contact-review');
  const preview = document.getElementById('admission-contact-preview');
  const whatsapp = document.getElementById('admission-contact-whatsapp');
  const resetReview = () => {
    review.hidden = true;
    whatsapp.removeAttribute('href');
    ['name','phone','message'].forEach(key => form.elements.namedItem(key).setCustomValidity(''));
  };
  form.addEventListener('input', resetReview);
  form.addEventListener('change', resetReview);
  form.addEventListener('reset', resetReview);
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const fields = new FormData(form);
    const value = key => String(fields.get(key) ?? '').trim();
    for (const key of ['name','phone','message']) {
      if (!value(key)) {
        form.elements.namedItem(key).setCustomValidity('Complete este campo con información, no solo espacios.');
        form.reportValidity();
        return;
      }
    }
    const text = ['Hola, quisiera información sobre admisiones del Colegio Nuevo Mundo.',
      'Nombre del encargado: '+value('name'), 'Teléfono: '+value('phone'),
      value('email') ? 'Correo: '+value('email') : '', 'Nivel de interés: '+value('level'),
      'Consulta: '+value('message')].filter(Boolean).join('\n');
    preview.textContent = text;
    whatsapp.href = 'https://wa.me/'+form.dataset.whatsapp+'?text='+encodeURIComponent(text);
    review.hidden = false;
    document.getElementById('review-status').textContent = 'Consulta preparada para revisar. No se ha enviado ningún mensaje.';
    review.scrollIntoView({block:'nearest', behavior:motion.matches?'instant':'smooth'});
  });
})();
