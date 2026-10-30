/* Compare feature, shared by the home page and the fleet page.
   Needs data/cars.json (loaded by cars-loader.js) (CARS) loaded first. Any button like
   <button class="cmp" data-id="3"> toggles that car. Selection is kept
   while the visitor moves between pages (sessionStorage). */
CarsData.ready.then(function () {
    const MAX = 3,
        KEY = 'veloce_compare';
    let ids = [],
        lastFocus = null,
        flashTimer;
    try {
        ids = (JSON.parse(sessionStorage.getItem(KEY)) || []).filter((i) => CARS[i]).slice(0, MAX);
    } catch (e) {}

    const make = (h) => {
        const t = document.createElement('template');
        t.innerHTML = h.trim();
        return t.content.firstChild;
    };
    const money = (n) => 'S$' + n.toLocaleString();
    const thumb = (c) =>
        `<span class="thumb" style="background:linear-gradient(135deg,${c.c},#0b0b0e)">${c.mk.slice(0, 2).toUpperCase()}${carImg(c)}</span>`;
    const icon =
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><path d="M11 18H8a2 2 0 0 1-2-2V9"/></svg>';

    /* Build the UI */
    const navBtn = make(
        `<button type="button" class="nav-cmp" hidden aria-haspopup="dialog"><span class="nav-cmp-n">0</span>Compare</button>`,
    );
    const auth = document.querySelector('.auth');
    if (auth) auth.prepend(navBtn);
    const bar =
        make(`<div class="cmpbar" hidden role="region" aria-label="Cars selected to compare"><div class="wrap">
  <div class="cmpinfo">${icon}<span class="cmpstatus" aria-live="polite"></span><div class="thumbs"></div></div>
  <div class="cmpact"><button type="button" class="cmpclear">Clear</button><button type="button" class="btn red cmpgo">${icon} Compare now</button></div></div></div>`);
    const modal =
        make(`<div class="cmpmodal" hidden><div class="cmpdlg" role="dialog" aria-modal="true" aria-labelledby="cmpttl">
  <header><h2 id="cmpttl">Comparison</h2><button type="button" class="x" aria-label="Close comparison">&times;</button></header>
  <div class="cmpbody"></div><p class="cmplegend"><b>Gold</b> marks the best value in each row.</p></div></div>`);
    document.body.append(bar, modal);
    const navN = navBtn.querySelector('.nav-cmp-n'),
        status = bar.querySelector('.cmpstatus'),
        thumbs = bar.querySelector('.thumbs'),
        go = bar.querySelector('.cmpgo'),
        clr = bar.querySelector('.cmpclear'),
        body = modal.querySelector('.cmpbody'),
        legend = modal.querySelector('.cmplegend'),
        closeBtn = modal.querySelector('.x');

    /* Rows in the comparison: [label, display, key for "best", direction (1 = higher is better)] */
    const ROWS = [
        ['Price/day', (c) => money(c.p), 'p', -1],
        ['Horsepower', (c) => c.hp + ' HP', 'hp', 1],
        ['0-100 km/h', (c) => c.z.toFixed(1) + 's', 'z', -1],
        ['Top speed', (c) => c.v + ' km/h', 'v', 1],
        ['Body type', (c) => c.ty],
        ['Seats', (c) => c.s],
        ['Transmission', (c) => (c.tr === 'Auto' ? 'Automatic' : 'Manual')],
        ['Fuel', (c) => c.f],
        ['Rating', (c) => (+c.r).toFixed(1) + '/5', 'r', 1],
    ];
    const HL = {
        p: 'Lowest price',
        hp: 'Most powerful',
        z: 'Quickest 0-100',
        v: 'Highest top speed',
        r: 'Top rated',
    };
    function bestValue(list, key, dir) {
        if (!key || list.length < 2) return null;
        const v = list.map((c) => +c[key]),
            b = dir > 0 ? Math.max(...v) : Math.min(...v);
        return v.every((x) => x === b) ? null : b;
    }

    function renderModal() {
        const list = ids.map((id) => CARS[id]);
        const best = ROWS.map((r) => bestValue(list, r[2], r[3]));
        body.innerHTML =
            ids
                .map((id) => {
                    const c = CARS[id];
                    return `<article class="cc"><div class="ccimg" style="background:linear-gradient(135deg,${c.c},#0b0b0e)">
    <em>${c.mk.split('-')[0]}</em>${carImg(c)}
    <button type="button" class="rm" data-rm="${id}" aria-label="Remove ${c.mk} ${c.n} from comparison">&times;</button></div>
    <div class="in"><small>${c.mk}</small><h3>${c.n}</h3>
    <div class="hl">${ROWS.map((r, i) => (best[i] !== null && +c[r[2]] === best[i] ? `<span>${HL[r[2]]}</span>` : '')).join('')}</div>
    ${ROWS.map((r, i) => `<div class="crow"><span>${r[0]}</span><b${best[i] !== null && +c[r[2]] === best[i] ? ' class="best"' : ''}>${r[1](c)}</b></div>`).join('')}
    <div class="feats"><p>Features</p><div class="chips">${c.ft.map((f) => `<span>${f}</span>`).join('')}</div></div></div></article>`;
                })
                .join('') +
            (ids.length < 2
                ? '<div class="cmphint">Select at least one more car to compare side by side.</div>'
                : '');
        legend.hidden = ids.length < 2;
    }

    /* Update everything on the page to match the selection */
    function sync() {
        const n = ids.length;
        navBtn.hidden = !n;
        navN.textContent = n;
        bar.hidden = !n;
        document.body.classList.toggle('has-cmpbar', !!n);
        status.textContent =
            n > 1 ? `${n} selected to compare` : '1 selected. Pick 1 more to compare';
        thumbs.innerHTML = ids
            .map((id) => {
                const c = CARS[id];
                return `<span class="chip">${thumb(c)}<span class="cname">${c.mk} ${c.n}</span><button type="button" class="chipx" data-rmbar="${id}" aria-label="Remove ${c.mk} ${c.n}">&times;</button></span>`;
            })
            .join('');
        go.disabled = n < 2;
        document.querySelectorAll('.cmp').forEach((b) => {
            const on = ids.includes(+b.dataset.id);
            b.setAttribute('aria-pressed', on);
            b.textContent = on ? 'Comparing' : 'Compare';
        });
        try {
            sessionStorage.setItem(KEY, JSON.stringify(ids));
        } catch (e) {}
        if (!modal.hidden) {
            n ? renderModal() : close();
        }
    }
    function toggle(id) {
        const k = ids.indexOf(id);
        if (k > -1) ids.splice(k, 1);
        else if (ids.length >= MAX) {
            status.textContent = `You can compare up to ${MAX} cars`;
            clearTimeout(flashTimer);
            flashTimer = setTimeout(sync, 2200);
            return;
        } else ids.push(id);
        sync();
    }
    function open() {
        if (!ids.length) return;
        lastFocus = document.activeElement;
        renderModal();
        modal.hidden = false;
        document.body.classList.add('noscroll');
        closeBtn.focus();
    }
    function close() {
        modal.hidden = true;
        document.body.classList.remove('noscroll');
        if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    /* Events */
    document.addEventListener('click', (e) => {
        const b = e.target.closest('.cmp');
        if (b) toggle(+b.dataset.id);
    });
    navBtn.addEventListener('click', open);
    go.addEventListener('click', open);
    bar.addEventListener('click', (e) => {
        const r = e.target.closest('[data-rmbar]');
        if (r) toggle(+r.dataset.rmbar);
    });
    clr.addEventListener('click', () => {
        ids = [];
        sync();
    });
    closeBtn.addEventListener('click', close);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) close();
        const rm = e.target.closest('[data-rm]');
        if (rm) toggle(+rm.dataset.rm);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.hidden) close();
    });

    //public API
    window.Compare = { has: (id) => ids.includes(id), toggle, sync };
    sync();
});
