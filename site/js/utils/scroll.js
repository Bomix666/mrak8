// MRAK8 — scroll motion, two primitives and nothing else.
//
//   [data-reveal]    gets .is-in once, the first time it enters the viewport.
//   [data-progress]  gets a live --p custom property (0 → 1) while on screen;
//                    CSS turns that number into scale / translate / clip.
//                    data-progress="pin" measures a tall section with a
//                    sticky child: 0 when it pins, 1 when it lets go.
//
// One passive scroll listener, one rAF, and only for sections that are
// actually visible. All the visuals live in CSS, so reduced-motion is
// handled there.

export function mountReveal(root) {
  const targets = root.querySelectorAll('[data-reveal]');
  if (targets.length === 0) return () => {};
  document.documentElement.classList.add('js-reveal');

  // A clip reveal starts fully clipped, and a fully clipped element never
  // counts as intersecting — so those are triggered by their parent.
  const watched = new Map();
  targets.forEach((el) => {
    const trigger = el.dataset.reveal === 'clip' ? el.parentElement : el;
    watched.set(trigger, [...(watched.get(trigger) || []), el]);
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        watched.get(entry.target).forEach((el) => el.classList.add('is-in'));
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
  );
  watched.forEach((_, trigger) => observer.observe(trigger));
  return () => observer.disconnect();
}

export function mountProgress(root) {
  const targets = [...root.querySelectorAll('[data-progress]')];
  if (targets.length === 0) return () => {};

  const visible = new Set();
  let frame = 0;

  function update() {
    frame = 0;
    const vh = window.innerHeight;
    visible.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const p = el.dataset.progress === 'pin'
        ? -rect.top / Math.max(1, rect.height - vh)
        : (vh - rect.top) / (vh + rect.height);
      el.style.setProperty('--p', Math.min(1, Math.max(0, p)).toFixed(4));
    });
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => (entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target)));
    schedule();
  });
  targets.forEach((el) => observer.observe(el));

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);

  return () => {
    observer.disconnect();
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    cancelAnimationFrame(frame);
  };
}
