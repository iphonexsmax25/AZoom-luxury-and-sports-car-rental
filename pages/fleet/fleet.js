CarsData.ready.then(() => {
    /* Fleet page script: same card template as script.js, plus filters, search and sort.
   Car data lives in data/cars.json (loaded by cars-loader.js); compare logic lives in compare.js. */
    const cars = CARS; // from data/cars.json (loaded by cars-loader.js)

    const FUEL = { Petrol: 'Petrol', Hybrid: 'Hyb', Electric: 'EV', Diesel: 'Diesel' };
    const $ = (id) => document.getElementById(id);
    const PAGE = 36;
    let page = 1; /* 36 cars per page: about 36 cars per page; the page count follows the filtered list */
    const redraw = () => {
        page = 1;
        render();
    };
    const sorters = {
        rating: (a, b) => Reviews.score(b.id) - Reviews.score(a.id),
        low: (a, b) => a.p - b.p,
        high: (a, b) => b.p - a.p,
        power: (a, b) => b.hp - a.hp,
    };

    /* Build the filter checkboxes */
    function checks(id, group, items) {
        $(id).innerHTML = items
            .map(
                ([v, l]) =>
                    `<label class="chk"><input type="checkbox" data-g="${group}" value="${v}"><span>${l}</span></label>`,
            )
            .join('');
    }
    checks('f-cat', 'cat', [
        ['SPORTS', 'Sports'],
        ['LUXURY', 'Luxury'],
    ]);
    checks(
        'f-type',
        'type',
        ['Sedan', 'Saloon', 'Coupe', 'Convertible', 'SUV', 'Station Wagon', 'Pickup'].map((x) => [
            x,
            x,
        ]),
    );
    checks(
        'f-brand',
        'brand',
        [...new Set(cars.map((c) => c.mk))].sort().map((b) => [b, b]),
    );
    checks('f-tr', 'tr', [
        ['Auto', 'Automatic'],
        ['Manual', 'Manual'],
    ]);
    checks('f-fuel', 'fuel', [
        ['Petrol', 'Petrol'],
        ['Hybrid', 'Hybrid'],
        ['Electric', 'Electric'],
    ]);

    /* Numbered pages: 1 2 3 ... 17 (always shows first, last and the pages around the current one) */
    function pager(cur, total) {
        if (total < 2) return '';
        const near = [1, total, cur - 1, cur, cur + 1];
        if (cur <= 3) near.push(2, 3);
        if (cur >= total - 2) near.push(total - 2, total - 1); /* page 1 looks like: 1 2 3 ... 17 */
        const nums = [...new Set(near.filter((n) => n >= 1 && n <= total))].sort((a, b) => a - b);
        let out = '',
            prev = 0;
        nums.forEach((n) => {
            if (prev && n - prev > 1)
                out += `<span class="dots" aria-hidden="true">&middot;&middot;&middot;</span>`;
            out += `<button type="button" class="pg${n === cur ? ' on' : ''}" data-page="${n}" aria-label="Page ${n}"${n === cur ? ' aria-current="page"' : ''}>${n}</button>`;
            prev = n;
        });
        return `<nav class="pager" aria-label="Pages"><button type="button" class="pg arrow" data-page="${cur - 1}" aria-label="Previous page"${cur === 1 ? ' disabled' : ''}>&lsaquo;</button>${out}<button type="button" class="pg arrow" data-page="${cur + 1}" aria-label="Next page"${cur === total ? ' disabled' : ''}>&rsaquo;</button></nav>`;
    }

    /* Read filters, then draw the grid */
    function picked(g) {
        return [...document.querySelectorAll(`input[data-g="${g}"]:checked`)].map((i) => i.value);
    }
    function render() {
        const eligibilityNotice = $('booking-eligibility'),
            currentUser = Auth.user();
        if (currentUser && currentUser.role !== 'employee') {
            const eligibility = Auth.bookingEligibility(currentUser.email);
            eligibilityNotice.hidden = eligibility.eligible;
            eligibilityNotice.textContent = eligibility.message;
        } else {
            eligibilityNotice.hidden = true;
            eligibilityNotice.textContent = '';
        }
        const q = $('q').value.trim().toLowerCase(),
            max = +$('max').value;
        const cat = picked('cat'),
            type = picked('type'),
            brand = picked('brand'),
            tr = picked('tr'),
            fuel = picked('fuel');
        $('maxout').textContent = 'S$' + max.toLocaleString();
        const today = Auth.today(),
            busy = new Set(
                Auth.bookings()
                    .filter((b) => Auth.LIVE.includes(b.status) && b.from <= today && today <= b.to)
                    .map((b) => b.carId),
            );
        const list = cars
            .map((c, id) => ({ ...c, id }))
            .filter(
                (c) =>
                    (!q || (c.mk + ' ' + c.n).toLowerCase().includes(q)) &&
                    (!cat.length || cat.includes(c.t)) &&
                    (!type.length || type.includes(c.ty)) &&
                    (!brand.length || brand.includes(c.mk)) &&
                    (!tr.length || tr.includes(c.tr)) &&
                    (!fuel.length || fuel.includes(c.f)) &&
                    c.p <= max,
            )
            .sort(sorters[$('sort').value]);
        const pages = Math.max(1, Math.ceil(list.length / PAGE));
        page = Math.min(page, pages);
        $('count').textContent = list.length + (list.length === 1 ? ' result' : ' results');
        $('cars').innerHTML = list.length
            ? list
                  .slice((page - 1) * PAGE, page * PAGE)
                  .map(
                      (c) => `
<article class="card"><div class="pic" style="background:linear-gradient(135deg,${c.c},#0b0b0e)">
 <em>${c.mk.split('-')[0]}</em>${carImg(c)}
 <div class="pic-top"><span class="tag">${c.t}</span>${Reviews.badge(c.id)}</div>
 </div><div class="pic-btns">${Reviews.btn(c.id)}<button type="button" class="cmp" data-id="${c.id}" aria-pressed="${Compare.has(c.id)}">${Compare.has(c.id) ? 'Comparing' : 'Compare'}</button></div>
 <div class="body"><small>${c.mk} · ${c.ty}</small><h3>${c.n}</h3>
 ${c.d ? `<p class="cdesc">${c.d}</p>` : ''}<div class="avail ${busy.has(c.id) ? 'out' : 'in'}">${busy.has(c.id) ? 'Currently rented' : 'Available now'}</div>
 <div class="spec"><div>${c.hp}<span>HP</span></div><div>${c.s}<span>SEATS</span></div><div class="transmission-spec">${c.tr === 'Auto' ? 'Auto' : c.tr}<span>TRANS</span></div><div>${FUEL[c.f]}<span>FUEL</span></div></div>
 <div class="price"><div><b>S$${c.p.toLocaleString()}</b> <small>/day</small></div><a class="btn" href="../car/car.html?model=${encodeURIComponent(carKey(c))}">View <span class="arr">&rarr;</span></a></div>${RentalDiscounts.cardMarkup(c)}</div></article>`,
                  )
                  .join('') + pager(page, pages)
            : `<div class="empty">No cars match these filters.<br><button type="button" class="btn" data-reset>Clear filters</button></div>`;
    }

    /* Filters, search, sort, slider */
    document.querySelector('.filters').addEventListener('change', redraw);
    $('max').addEventListener('input', redraw);
    $('q').addEventListener('input', redraw);
    $('sort').addEventListener('change', redraw);
    addEventListener('storage', (e) => {
        if (e.key === Auth.K.b || e.key === Auth.K.f || e.key === Auth.K.s) render();
    });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) render();
    });
    $('cars').addEventListener('click', (e) => {
        const b = e.target.closest('[data-page]');
        if (!b || b.disabled) return;
        page = +b.dataset.page;
        render();
        $('cars').scrollIntoView({
            behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth',
            block: 'start',
        }); /* back to the top of the grid */
    });

    /* Clear filters (button in sidebar and in the empty state) */
    document.addEventListener('click', (e) => {
        if (!e.target.closest('[data-reset]')) return;
        document
            .querySelectorAll('.filters input[type=checkbox]')
            .forEach((i) => (i.checked = false));
        $('q').value = '';
        $('max').value = $('max').max;
        $('sort').value = 'rating';
        redraw();
    });

    /* Keep --nav-h / --bar-h (navbar and sticky search bar heights) current, so the sticky bar sits right under the navbar
       and the desktop sidebar sits under the bar, whatever the screen size. */
    {
        const root = document.documentElement,
            nav = document.querySelector('nav'),
            bar = document.querySelector('.fleet-bar'),
            set = () => {
                root.style.setProperty('--nav-h', nav.offsetHeight + 'px');
                root.style.setProperty('--bar-h', bar.offsetHeight + 'px');
            };
        set();
        if (window.ResizeObserver) {
            const ro = new ResizeObserver(set);
            ro.observe(nav);
            ro.observe(bar);
        } else addEventListener('resize', set);
    }

    /* Filter drawer (below 1200px the sidebar is a slide-out panel; the layout itself is pure CSS) */
    {
        const drawer = document.querySelector('.filters'),
            openBtn = $('open-filters'),
            overlay = $('filters-overlay'),
            desktop = matchMedia('(min-width:1200px)');
        let lastFocus = null;
        const isOpen = () => document.body.classList.contains('filters-open');
        function setDrawer(open) {
            if (open === isOpen()) return;
            document.body.classList.toggle('filters-open', open);
            openBtn.setAttribute('aria-expanded', open);
            if (open) {
                lastFocus = document.activeElement;
                drawer.setAttribute('role', 'dialog');
                drawer.setAttribute('aria-modal', 'true');
                drawer.querySelector('.filters-x').focus({ preventScroll: true });
            } else {
                drawer.removeAttribute('role');
                drawer.removeAttribute('aria-modal');
                if (lastFocus && !desktop.matches) lastFocus.focus({ preventScroll: true });
                lastFocus = null;
            }
        }
        openBtn.addEventListener('click', () => setDrawer(true));
        overlay.addEventListener('click', () => setDrawer(false));
        drawer.addEventListener('click', (e) => {
            if (e.target.closest('[data-close-filters]')) setDrawer(false);
        });
        document.addEventListener('keydown', (e) => {
            if (!isOpen()) return;
            if (e.key === 'Escape') {
                setDrawer(false);
                return;
            }
            if (e.key !== 'Tab') return; /* keep keyboard focus inside the open drawer */
            const f = [...drawer.querySelectorAll('button, input, select, a[href]')].filter(
                    (x) => !x.disabled && x.offsetParent !== null,
                ),
                first = f[0],
                last = f[f.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        });
        /* Resize to desktop: close the drawer and overlay, the sidebar shows again */
        desktop.addEventListener('change', () => {
            if (desktop.matches) setDrawer(false);
        });
    }

    /* Support links like ../fleet/fleet.html?q=porsche */
    $('q').value = new URLSearchParams(location.search).get('q') || '';
    render();
});
