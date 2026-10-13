import { registerRoute, setNotFound, startRouter } from './router.js';
import { mountHeader } from './components/header.js';
import { mountFooter } from './components/footer.js';
import { mountCartDrawer } from './components/cartDrawer.js';
import { syncCart } from './state/cart.js';
import * as home from './pages/home.js';
import * as shop from './pages/shop.js';
import * as product from './pages/product.js';
import * as journal from './pages/journal.js';
import * as journalEntry from './pages/journalEntry.js';
import * as about from './pages/about.js';
import * as checkout from './pages/checkout.js';
import * as orderStatus from './pages/orderStatus.js';
import * as notFound from './pages/notFound.js';
import { makeSimplePage } from './pages/simple.js';

mountCartDrawer(document.getElementById('cart-root'));
mountHeader(document.getElementById('header-root'));
mountFooter(document.getElementById('footer-root'));

registerRoute('/', home.render);
registerRoute('/shop', shop.render);
registerRoute('/product/:slug', product.render);
registerRoute('/journal', journal.render);
registerRoute('/journal/:slug', journalEntry.render);
registerRoute('/about', about.render);
registerRoute('/checkout', checkout.render);
registerRoute('/order/:orderNumber', orderStatus.render);
registerRoute('/account', makeSimplePage('account'));
registerRoute('/shipping', makeSimplePage('shipping'));
registerRoute('/contact', makeSimplePage('contact'));
setNotFound(notFound.render);

startRouter(document.getElementById('view-root'));

// A cart restored from a previous visit may be out of date — refresh it
// against the catalogue once the page is up.
syncCart();
