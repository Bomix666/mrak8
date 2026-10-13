export async function render(view) {
  view.innerHTML = `
    <section class="state" data-theme="dark">
      <p class="mono">404</p>
      <h1>Такой страницы нет</h1>
      <p>Ссылка устарела или в адресе ошибка.</p>
      <a class="link" href="/shop/">В магазин</a>
    </section>`;
  return { title: '404 — MRAK8', description: '' };
}
