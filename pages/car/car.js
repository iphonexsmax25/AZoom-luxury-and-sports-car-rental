/* Car details + booking form (../car/car.html?model=Roma). Needs data/cars.json (loaded by cars-loader.js) and auth.js. */
CarsData.ready.then(function () {
    const A = Auth,
        app = document.getElementById('app');
    const LOCS = Branches.names().map((name) => Branches.label(name));
    const name = new URLSearchParams(location.search).get('model');
    let id = CARS.findIndex((c) => carKey(c) === name);
    if (id < 0) id = CARS.findIndex((c) => c.n === name); /* old links used the model name only */
    const c = CARS[id];
    const back = `<a class="back" href="../fleet/fleet.html">${A.ic('back', 16)} Back to fleet</a>`;
    if (!c) {
        app.innerHTML =
            back +
            `<div class="empty2"><h3>Car not found</h3><p>Pick a car from our fleet.</p><a class="btn red" href="../fleet/fleet.html">Browse Fleet</a></div>`;
        return;
    }
    document.title = `${c.mk} ${c.n} | AZoom`;

    const u = A.user(),
        emp = !!u && u.role === 'employee' && A.isEmployee(u.email),
        opts = Branches.options();
    const next = encodeURIComponent('../car/car.html?model=' + encodeURIComponent(carKey(c)));
    const savings = `<section class="savings-card" aria-live="polite" aria-atomic="true">
    <h3>Long-Term Rental Savings</h3>
    <div class="saving-line"><span>Daily Rate</span><strong id="car-rate"></strong></div>
    <div class="saving-line"><span>Number of Rental Days</span><strong id="car-days"></strong></div>
    <div class="saving-line"><span>Discount Percentage</span><strong id="car-percent"></strong></div>
    <div class="saving-line"><span>Original Price</span><strong id="car-original"></strong></div>
    <div class="saving-line saving-green"><span id="car-discount-label">You save</span><strong id="car-discount"></strong></div>
    <div class="saving-line saving-total"><span>Final Total</span><strong id="car-total"></strong></div>
    <div class="saving-breakdown">
     <p>Rental Price: <span id="car-rental-line"></span></p>
     <p id="car-discount-line"></p>
     <p>Final Total: <strong id="car-final-line"></strong></p>
    </div>
   </section>`;
    const form = u
        ? `<h2 class="sec">Book this car</h2>
  <form id="book">
   <div class="fld"><label for="pk">Pickup Branch</label><select id="pk" name="pk">${opts}</select></div>
   <div class="fld"><label for="rt">Return Branch</label><select id="rt" name="rt">${opts}</select></div>
   <div class="two"><div class="fld"><label for="fr">From</label><input id="fr" name="fr" type="date" aria-describedby="err" required></div>
   <div class="fld"><label for="to">To</label><input id="to" name="to" type="date" aria-describedby="err" required></div></div>
   ${savings}
   <p class="err date-validation-error" id="err" role="alert" aria-live="polite"></p>
   <p class="hint" style="margin:-4px 0 12px">Next: enter your driver and payment details to confirm.</p>
   <button class="btn red" id="book-submit" type="submit" disabled>Book Now</button>
  </form>`
        : `<h2 class="sec">Sign in to book</h2><p class="sub">Create a free account or sign in to reserve the ${A.esc(c.mk + ' ' + c.n)}.</p>
   <div class="fld"><label for="preview-days">Rental Duration</label><select id="preview-days"><option value="1">1 day</option><option value="3">3 days</option><option value="7">7 days</option><option value="30">30 days</option></select></div>${savings}
   <a class="btn red" href="../login/login.html?next=${next}">Sign In</a><a class="btn" href="../signup/signup.html?next=${next}">Create account</a>`;

    /* Detail layout: gallery, headline, specs, price, features, pick-up points, call to action, booking form */
    const I = (d, s = 22) =>
        `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    const G = {
        gauge: '<path d="M12 14l4-4"/><path d="M3.3 17a9 9 0 1117.4 0"/>',
        trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
        bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
        users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14.5c2.2.6 3.5 2.4 3.5 5.5"/>',
        gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
        fuel: '<path d="M4 21V5a2 2 0 012-2h6a2 2 0 012 2v16"/><path d="M3 21h12"/><path d="M14 9h2a2 2 0 012 2v5a1.5 1.5 0 003 0V9l-3-3"/><path d="M7 8h4"/>',
        pin: '<path d="M12 22s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
        check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
        arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    };
    const lux = c.t === 'LUXURY',
        tyl = c.ty.toLowerCase(),
        fuelTxt = { Petrol: 'petrol', Diesel: 'diesel', Hybrid: 'hybrid', Electric: 'electric' }[
            c.f
        ];
    const desc = c.d
        ? c.d + ` Collect it from any AZoom pick-up point in Singapore.`
        : `The ${c.mk} ${c.n} is a ${c.hp} hp ${fuelTxt} ${tyl} ${lux ? 'built for comfort, space and presence on the road' : 'built for driving'}. ` +
          `It comes with ${c.tr === 'Manual' ? 'a manual gearbox' : 'an automatic gearbox'} and ${c.s} seats, and reaches 100 km/h in ${c.z.toFixed(1)} seconds. Collect it from any AZoom pick-up point in Singapore.`;
    const today = A.today(),
        taken = A.bookings().some(
            (b) => b.carId === id && A.LIVE.includes(b.status) && b.from <= today && today <= b.to,
        );
    const stars = Math.round(+c.r),
        feats = [
            ...new Set([
                ...c.ft,
                'Apple CarPlay',
                'Rear Camera',
                'Keyless Entry',
                'Climate Control',
            ]),
        ].slice(0, 6);
    const tile = (ic, v, l) => `<div class="tile">${I(G[ic])}<b>${v}</b><span>${l}</span></div>`;
    app.innerHTML =
        back +
        `<div class="cd-top"><div class="cd-gal">
   <div class="cd-main" style="background:linear-gradient(135deg,${c.c},#0b0b0e)"><em>${c.mk.split('-')[0]}</em><img id="mainimg" alt="${A.esc(c.mk + ' ' + c.n)}" hidden><span class="tag">${c.t}</span></div>
   <div class="cd-thumbs" id="thumbs"></div></div>
  <div class="cd-info"><div class="cd-brand">${c.mk} &middot; ${c.ty}</div><h1>${A.esc(c.n)}</h1>
   <div class="cd-rate"><span class="rv-rating" data-rv-rating="${id}"></span><span class="sep"></span><span class="${taken ? 'no' : 'ok'}">${taken ? 'Booked today' : 'Available now'}</span></div>
   <p class="cd-desc">${desc}</p>
   <div class="tiles">${tile('gauge', c.hp + ' HP', 'Horsepower') + tile('trend', c.z.toFixed(1) + 's', '0-100 km/h') + tile('bolt', c.v + ' km/h', 'Top speed') + tile('users', c.s, 'Seats') + tile('gear', c.tr === 'Auto' ? 'Automatic' : c.tr, 'Transmission') + tile('fuel', c.f, 'Fuel type')}</div>
   <div class="pricebox"><div><small>Rental price</small><strong>${A.money(c.p)} <em>/day</em></strong></div><div class="perk">Insurance included<b>Free cancellation</b></div></div>
   <div class="cd-actions"><a class="btn red" href="#book" data-go>${A.ic('cal', 18)} Book Now</a><button type="button" class="btn cmp" data-id="${id}" aria-pressed="false">Compare</button></div></div></div>
  <div class="cd-more"><div><h2>Features &amp; Equipment</h2><div class="feat">${feats.map((f) => `<div><i>${I(G.check, 16)}</i>${A.esc(f)}</div>`).join('')}</div></div>
   <div><h2>Our Branches</h2><div class="locs">${LOCS.map((l) => `<div>${I(G.pin, 18)}${l}</div>`).join('')}</div></div></div>
  <div class="cd-cta"><h2>Ready to drive the ${A.esc(c.n)}?</h2><p>Book now and experience ${lux ? 'luxury' : 'sports car'} driving at its finest.</p><a class="btn red" href="#book" data-go>Reserve This Car ${I(G.arrow, 18)}</a></div>
  <div class="acard cd-book" id="book">${form}</div>`;
    Reviews.mountCar(
        id,
    ); /* Customer Reviews & Ratings section: after overview, specs, features, branches and booking */

    /* Photos: ../../images/cars/<slug>.jpg is the main photo; <slug>-2.jpg and <slug>-3.jpg add thumbnails. Missing files are simply skipped. */
    const main = document.getElementById('mainimg'),
        thumbs = document.getElementById('thumbs'),
        base = c.img.replace(/\.jpg$/, ''),
        found = [];
    [c.img, base + '-2.jpg', base + '-3.jpg'].forEach((src, i) => {
        const t = new Image();
        t.onload = () => {
            found[i] = src;
            show();
        };
        t.src = src;
    });
    function show() {
        const list = found.filter(Boolean);
        if (!list.length) return;
        if (main.hidden) {
            main.src = list[0];
            main.hidden = false;
        }
        thumbs.innerHTML =
            list.length > 1
                ? list
                      .map(
                          (s) =>
                              `<button type="button" data-src="${s}" aria-label="Show photo" class="${main.getAttribute('src') === s ? 'on' : ''}"><img src="${s}" alt=""></button>`,
                      )
                      .join('')
                : '';
    }
    thumbs.addEventListener('click', (e) => {
        const b = e.target.closest('[data-src]');
        if (!b) return;
        main.src = b.dataset.src;
        thumbs.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    });
    /* Book Now / Reserve This Car scroll to the booking form */
    document.addEventListener('click', (e) => {
        if (!e.target.closest('[data-go]')) return;
        e.preventDefault();
        document.getElementById('book').scrollIntoView({
            behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth',
        });
    });
    let previousDiscount = null;
    function renderSavings(n) {
        const deal = RentalDiscounts.calculate(c, n),
            employeePrice = emp ? A.empPrice(c.p * n, 0) : null,
            p = emp
                ? {
                      original: employeePrice.original,
                      discount: employeePrice.discount,
                      total: employeePrice.total,
                      percentage: A.EMP_DISCOUNT * 100,
                      label: 'Employee Rental',
                  }
                : {
                      original: deal.original,
                      discount: deal.discount,
                      total: deal.total,
                      percentage: deal.percentage,
                      label: deal.label,
                  };
        if (previousDiscount !== null && previousDiscount !== p.percentage) {
            const card = document.querySelector('.savings-card');
            card.classList.remove('deal-changed');
            void card.offsetWidth;
            card.classList.add('deal-changed');
        }
        previousDiscount = p.percentage;
        document.getElementById('car-rate').textContent = A.money(c.p);
        document.getElementById('car-days').textContent = n + (n === 1 ? ' day' : ' days');
        document.getElementById('car-percent').textContent = p.percentage + '%';
        document.getElementById('car-original').textContent = A.money(p.original);
        document.getElementById('car-discount-label').textContent = `You save (${p.label})`;
        document.getElementById('car-discount').textContent = '\u2212' + A.money(p.discount);
        document.getElementById('car-total').textContent = A.money(p.total);
        document.getElementById('car-rental-line').textContent =
            `${n} × ${A.money(c.p)} = ${A.money(p.original)}`;
        document.getElementById('car-discount-line').textContent =
            `Discount: ${p.label} (${p.percentage}%) = \u2212${A.money(p.discount)}`;
        document.getElementById('car-final-line').textContent = A.money(p.total);
    }
    if (!u) {
        const previewDays = document.getElementById('preview-days');
        previewDays.addEventListener('change', () => renderSavings(Number(previewDays.value)));
        renderSavings(Number(previewDays.value));
        return;
    }

    const fr = document.getElementById('fr'),
        to = document.getElementById('to'),
        err = document.getElementById('err');
    const tomorrow = BookingDates.tomorrow(),
        submitButton = document.getElementById('book-submit');
    fr.min = tomorrow;
    fr.value = tomorrow;
    to.value = BookingDates.addDays(tomorrow, 1);
    let dateNotice = '';
    function syncDates() {
        fr.min = BookingDates.tomorrow();
        to.min = BookingDates.minimumReturn(fr.value);
        const beforeReset = BookingDates.validate(fr.value, to.value);
        let reset = false;
        if (to.value && to.value < to.min) {
            to.value = to.min;
            reset = true;
        }
        if (reset) dateNotice = beforeReset ? beforeReset.message : '';
        const error = BookingDates.validate(fr.value, to.value);
        submitButton.disabled = !!error;
        err.textContent = error ? error.message : dateNotice;
    }
    const days = () =>
        Math.max(1, Math.round((new Date(to.value) - new Date(fr.value)) / 864e5)) || 1;
    function sum() {
        syncDates();
        renderSavings(days());
    }
    [fr, to].forEach((input) => {
        ['input', 'change'].forEach((eventName) =>
            input.addEventListener(eventName, () => {
                dateNotice = '';
                sum();
            }),
        );
    });
    sum();

    /* "Book Now" checks the dates, then opens the payment page (../payment/payment.html) with the choices filled in */
    document.getElementById('book').addEventListener('submit', (e) => {
        e.preventDefault();
        err.textContent = '';
        const bad = (m) => {
            err.textContent = m;
            A.toast(m, 'err');
        };
        const f = new FormData(e.target),
            from = fr.value,
            until = to.value;
        const dateError = BookingDates.validate(from, until);
        if (dateError) return bad(dateError.message);
        const conflict = A.bookingConflict(u.email, id, from, until);
        if (conflict === 'customer')
            return bad('You already have an active booking for these dates.');
        if (conflict === 'vehicle')
            return bad('This vehicle is unavailable for the selected dates.');
        location.href =
            '../payment/payment.html?' +
            new URLSearchParams({
                car: id,
                pk: String(f.get('pk')),
                rt: String(f.get('rt')),
                fr: from,
                to: until,
            });
    });
});
