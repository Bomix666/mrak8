export async function render(view) {
  view.innerHTML = `
    <section class="state" data-theme="dark">
      <p class="mono">404 · Объект не числится</p>
      <h1>В картотеке такого нет</h1>
      <p>Ссылка устарела или в адресе ошибка. Вещдок мог быть изъят другим субъектом.</p>
      <a class="link" href="/shop/">К вещдокам</a>
    </section>`;
  return { title: '404 — MRAK8', description: '' };
}
