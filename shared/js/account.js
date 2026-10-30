/* Login, sign up, customer dashboard and employee portal.
   Needs auth.js and fees.js (and cars-loader.js + branches.js on the dashboard and employee pages).
   Fees, payments, statuses and the TXT report all come from fees.js, which always reads local storage fresh. */
(typeof CarsData !== 'undefined' ? CarsData.ready : Promise.resolve()).then(function () {
    const A = Auth,
        page = document.body.dataset.page,
        $ = (s) => document.querySelector(s),
        app = $('#app');
    document.querySelectorAll('[data-ic]').forEach((e) => (e.innerHTML = A.ic(e.dataset.ic, 16)));
    const toast = (t) => {
        const d = document.createElement('div');
        d.className = 'toast';
        d.setAttribute('role', 'status');
        d.textContent = t;
        document.body.append(d);
        setTimeout(() => d.remove(), 4500);
    };

    /* ---------- Login and sign up ---------- */
    if (page === 'login' || page === 'signup') {
        const next = A.safeNext(new URLSearchParams(location.search).get('next')),
            me = A.user();
        if (me) {
            location.replace(next || A.home(me));
            return;
        }
        if (next) $('.switch a').href += '?next=' + encodeURIComponent(next);
        $('#authform').addEventListener('submit', async (e) => {
            e.preventDefault();
            const f = new FormData(e.target),
                email = String(f.get('email')).trim(),
                pw = String(f.get('password')),
                err = $('#err'),
                btn = $('#authform .btn');
            err.textContent = '';
            try {
                if (page === 'signup') {
                    A.cleanName(f.get('first'), 'First name');
                    A.cleanName(f.get('last'), 'Last name');
                    if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email))
                        throw Error('Enter a valid email address.');
                    A.checkPassword(pw);
                    if (pw !== f.get('confirm')) throw Error('Passwords do not match.');
                }
                btn.disabled = true;
                const u =
                    page === 'signup'
                        ? await A.signup(email, pw, f.get('first'), f.get('last'))
                        : await A.login(email, pw);
                location.href = next || A.home(u);
            } catch (x) {
                err.textContent = x.message;
                btn.disabled = false;
            }
        });
        return;
    }

    /* ---------- Dashboard + employee portal ---------- */
    const u = A.guard(page === 'employee' ? 'employee' : null);
    if (!u) return;
    const car = (b) => carOf(b);
    /* Greeting: "Welcome Back, First Last" from the account store. Accounts created before names existed show "Welcome Back" until a name is added. */
    const greet = () => {
        const p = A.profile();
        return p && p.hasName ? `Welcome Back, ${A.esc(p.first)} ${A.esc(p.last)}` : 'Welcome Back';
    };
    const head = (eye, h, icon) =>
        `<div class="acct-head"><div><span class="eyebrow">${icon || ''}${eye}</span><h1 id="greet">${greet()}</h1><p id="greet-email">${A.esc((A.profile() || u).email)}</p></div><div class="headbtns"><a class="btn sm" href="../settings/settings.html">${A.ic('settings', 16)} Account Settings</a><button type="button" class="btn sm" data-signout>${A.ic('out', 16)} Sign Out</button></div></div><div id="profslot"></div>`;
    /* Accounts created before names existed: point them to Account Settings to add one */
    const renderProf = () => {
        const slot = $('#profslot'),
            p = A.profile();
        if (!slot || !p) return;
        slot.innerHTML = p.hasName
            ? ''
            : `<div class="acard pform"><h2 class="sec">Add your name</h2><p class="hint" style="margin:-8px 0 14px">Please add your first and last name in Account Settings. It will appear in your greeting.</p><a class="btn red sm" href="../settings/settings.html">${A.ic('settings', 16)} Open Account Settings</a></div>`;
    };
    /* redraw the name everywhere on the page from the account store */
    const refreshName = () => {
        const p = A.profile();
        if (!p) {
            location.replace('../login/login.html');
            return;
        }
        const h = $('#greet'),
            em = $('#greet-email');
        if (h) h.innerHTML = greet();
        if (em) em.textContent = p.email;
        renderProf();
    };
    addEventListener('storage', (e) => {
        if (e.key === A.K.u || e.key === A.K.s) refreshName();
    }); /* name changed or signed out in another tab */
    const kpi = (k, i, l, v) =>
        `<div class="kpi ${k}"><i>${A.ic(i, 20)}</i><div><small>${l}</small><b>${v}</b></div></div>`;
    const empty = (t, x = '') => `<div class="empty2">${A.ic('car', 36)}${t}${x}</div>`;
    const m = (l, v) => `<div><small>${l}</small><span>${A.esc(v)}</span></div>`;
    const newest = (l) => l.sort((a, b) => b.created - a.created);
    const badge = (s) =>
        `<span class="badge b-${s}">${A.esc((A.LABEL[s] || s).toUpperCase())}</span>`;
    const who = (b) => (b.name ? b.name + ' · ' + b.email : b.email);

    /* Employee rental: discount summary on a booking card (emp = viewed from the employee portal) */
    const empBox = (b, emp) =>
        !b.employeeRental
            ? ''
            : `<div class="empbox"><span class="empbadge">${A.esc(A.EMP_BADGE)}</span><div class="empcalc"><span>Original <b>${A.money(b.rentalOriginal)}</b></span><span>Discount <b>\u2212${A.money(b.discountAmount)}</b></span><span>Final payable <b>${A.money(b.total)}</b></span></div>${emp ? `<small>Renter ${A.esc(b.bookingEmployeeName)} \u00b7 ${A.esc(b.bookingEmployeeId)}${b.inspectionEmployeeId ? ` \u00b7 Inspected by ${A.esc(b.inspectionEmployeeName)} (${A.esc(b.inspectionEmployeeId)}) on ${A.esc(A.stamp(b.inspectionAt).slice(0, 16))}` : ''}</small>` : ''}</div>`;
    /* "Employee Rental" warning banner on the inspection page: renter name, employee ID, discount received, inspection status */
    const empBanner = (b, self) => {
        if (!A.isEmployeeBooking(b)) return '';
        const rate = b.discountRate
            ? Math.round(b.discountRate * 100) + '%'
            : 'None (booked before the discount policy)';
        const eid = b.bookingEmployeeId || A.uid(b.email),
            nm = b.bookingEmployeeName || A.nameOf(b.email);
        return `<div class="empbanner${self ? ' blocked' : ''}" role="alert"><div class="ebh">${A.ic('warn', 18)} Employee Rental</div>
   <div class="ebgrid">${m('Renter Name', b.name || nm) + m('Employee ID', eid) + m('Discount Received', rate) + m('Inspection Status', self ? 'Blocked: the renter cannot inspect their own rental' : 'Awaiting inspection')}</div>
   <p>${self ? A.esc(A.SELF_INSPECT_MSG) : 'This car was rented by an employee. The discount does not waive their liability for damage costs, cleaning fees, traffic fines or late return fees. Another employee must perform this inspection.'}</p></div>`;
    };
    /* Penalty Fee found at inspection (damage cost + cleaning fee + traffic fine + late return fee). Status is worked out live by Fees. */
    const dmgBox = (b) => {
        const s = Fees.forBooking(b.id);
        if (!(s.total > 0))
            return b.status === 'completed'
                ? `<div class="feebox s-none"><div><b>${A.esc(b.inspectionResult || 'Inspection complete')} \u00b7 Penalty Fee: S$0.00</b><small>Vehicle returned in acceptable condition. No outstanding amount.</small></div>${Fees.badge('none')}</div>`
                : '';
        return `<div class="feebox ${s.st.cls}"><div><b>${A.esc(b.inspectionResult || 'Inspection')} \u00b7 Penalty Fee: ${Fees.money(s.total)}</b><small>${A.esc(Fees.breakdown(s))}</small><small>Amount Paid ${Fees.money(s.paid)} \u00b7 Outstanding ${Fees.money(s.outstanding)} \u00b7 Due ${A.esc(s.dueDate)}</small>${s.overdue ? `<small class="odmsg">${A.esc(Fees.OVERDUE_MSG)}</small>` : ''}</div>${Fees.badge(s.status)}</div>`;
    };
    function card(b, emp, acts, extra) {
        const c = car(b);
        const meta = emp
            ? m('Customer', who(b)) + m('From', b.from) + m('To', b.to)
            : m('From', b.from) + m('To', b.to);
        return `<article class="bk" data-bk="${A.esc(b.id)}"><div class="bkimg"><em>${A.esc(c.mk.split('-')[0])}</em>${bookingImg(c)}</div>
  <div class="bkbody"><div class="bktop"><div>${badge(b.status)}<small>${A.esc(c.mk)}</small><h3>${A.esc(c.n)}</h3></div>
  <div class="bkprice"><b>${A.money(b.total)}</b><small>${b.employeeRental ? 'final payable' : 'total'}</small></div></div>
  ${empBox(b, emp)}<div class="bkmeta">${meta}</div><div class="bgrid">${Branches.detail(b.pickup, 'Pickup branch') + Branches.detail(b.ret, 'Return branch')}</div>${b.oneWayFee > 0 ? `<p class="fee-note">One-way return fee included: ${A.money(b.oneWayFee)}</p>` : ''}${dmgBox(b)}
  <div class="bkfoot"><span>Booking ${A.esc(b.id)}${emp ? '' : ' · Card •••• ' + A.esc(b.card4)}</span>${acts ? `<div class="acts">${acts}</div>` : ''}</div>${extra || ''}</div></article>`;
    }

    /* ===== Customer dashboard ===== */
    if (page === 'dashboard') {
        /* "Your Bookings" shows bookings that are still in progress. A booking disappears from it once the employee finishes its inspection (completed). */
        let last = new Map(A.bookings().map((b) => [b.id, b.status]));
        const hist = { f: 'all', open: {}, pf: 'all', popen: {} };
        let dtab =
            'overview'; /* dashboard tab + Booking History filter / open detail panels (kept while the page redraws) */
        const dash = () => {
            const mine = newest(A.bookings().filter((b) => b.email === u.email));
            /* Overview shows only bookings still in progress. Cancelled, completed and returned-and-finished bookings live in Booking History. */
            const owes = (b) => Fees.forBooking(b.id).outstanding > 0;
            const shown = mine.filter((b) => A.LIVE.includes(b.status));
            const counted = mine.filter(
                (b) => b.status !== 'cancelled' && b.status !== 'rejected',
            ); /* Total bookings does not count cancelled or rejected bookings */
            const activeN = mine.filter(
                (b) => History.model(b).stage === 'active',
            ).length; /* Active Reservations = rentals that are on the road right now */
            const spent = counted.reduce((s, b) => s + b.total + Fees.forBooking(b.id).paid, 0);
            const owed = History.outstandingRows(u.email).reduce(
                (t, r) => t + r.s.outstanding,
                0,
            ); /* unpaid balances only: paid and waived penalties add nothing */
            const nPen = History.penaltyRows(u.email).length;
            const acts = (b) =>
                b.status === 'pending'
                    ? `<button type="button" class="act warn" data-cancel="${b.id}">Cancel Booking</button>`
                    : b.status === 'confirmed'
                      ? (Refunds.canCustomerCancel(b)
                            ? `<button type="button" class="act warn" data-cancel="${b.id}">Cancel Booking</button>`
                            : '')
                      : b.status === 'awaiting_inspection'
                        ? `<span class="wait">Returned · waiting for inspection</span>`
                        : '';
            const tabs = `<div class="tabs" role="tablist"><button type="button" role="tab" data-dtab="overview" aria-selected="${dtab === 'overview'}">${A.ic('car', 16)} Overview</button><button type="button" role="tab" data-dtab="history" aria-selected="${dtab === 'history'}">${A.ic('hist', 16)} Booking History <span class="cnt">${mine.length}</span></button><button type="button" role="tab" data-dtab="penalty" aria-selected="${dtab === 'penalty'}">${A.ic('card', 16)} Penalty Fee History${nPen ? ` <span class="cnt">${nPen}</span>` : ''}</button>${Reviews.tab(dtab === 'reviews', u.email)}</div>`;
            app.innerHTML =
                head('MY DASHBOARD', 'Welcome back') +
                `<div class="kpis">${kpi('', 'cal', 'Total bookings', counted.length) + kpi('', 'clock', 'Active reservations', activeN) + kpi('', 'up', 'Total spent', A.money(spent)) + kpi('k3', 'warn', 'Outstanding Penalty Fees', owed > 0 ? A.money(owed) : `<span class="kpi-none">No Outstanding Penalties</span>`)}</div>${Reviews.banner(u.email)}${tabs}` +
                (dtab === 'reviews'
                    ? Reviews.mine(u.email)
                    : dtab === 'history'
                      ? History.customer(u.email, hist)
                      : dtab === 'penalty'
                        ? History.penaltySection(History.penaltyRows(u.email), hist, 'cust')
                        : `${History.outstanding(u.email, hist)}<h2 class="sec">Your Bookings</h2>` +
                          (shown.length
                              ? shown.map((b) => card(b, false, acts(b))).join('')
                              : empty(
                                    '<h3>No current bookings</h3><p>Completed, returned and cancelled bookings are in Booking History.</p>',
                                    '<a class="btn red" href="../fleet/fleet.html">Browse Fleet</a>',
                                )));
            renderProf();
        };
        app.addEventListener('click', (e) => {
            const t = e.target.closest('button');
            if (!t) return;
            if ('signout' in t.dataset) return A.logout();
            if (t.dataset.dtab) {
                dtab = t.dataset.dtab;
                return dash();
            }
            try {
                const r = History.act(t.dataset, u.email, hist);
                if (r !== null) {
                    if (r) dash();
                    return;
                }
            } catch (x) {
                return A.toast(x.message, 'err');
            }
            const b = A.bookings().find((x) => x.id === t.dataset.cancel);
            if (!b || b.email !== u.email) return;
            if (t.dataset.cancel && Refunds.canCustomerCancel(b))
                Refunds.openCancel(b, u.email, () => {
                    last.set(b.id, 'cancelled');
                    dash();
                }); /* pop-up shows the refund first */
        });
        /* Live updates: employee actions (and payments / overdue changes) in another tab appear here straight away */
        const msg = {
            confirmed: 'approved and confirmed',
            cancelled: 'cancelled. You may create a new booking.',
            rejected: 'rejected. You may create a new booking for the same or different dates.',
            completed: 'completed. Thank you for renting with AZoom',
        };
        let lastFee = new Map(Fees.list().map((f) => [f.bookingId, f.status]));
        const sync = () => {
            A.bookings()
                .filter(
                    (b) =>
                        b.email === u.email &&
                        last.get(b.id) &&
                        last.get(b.id) !== b.status &&
                        msg[b.status],
                )
                .forEach((b) => {
                    const f = Fees.forBooking(b.id);
                    toast(
                        b.status === 'completed' && f.total > 0
                            ? `Inspection finished for your ${b.title}: ${b.inspectionResult}. A Penalty Fee of ${A.money(f.total)} is due by ${f.dueDate}.`
                            : `Your ${b.title} booking was ${msg[b.status]}.`,
                    );
                });
            Fees.list()
                .filter(
                    (f) =>
                        A.bookings().some((b) => b.id === f.bookingId && b.email === u.email) &&
                        lastFee.get(f.bookingId) &&
                        lastFee.get(f.bookingId) !== f.status &&
                        f.status === 'overdue',
                )
                .forEach((f) => toast(`${f.bookingId}: ${Fees.OVERDUE_MSG}`));
            last = new Map(A.bookings().map((b) => [b.id, b.status]));
            lastFee = new Map(Fees.list().map((f) => [f.bookingId, f.status]));
            dash();
        };
        Fees.watch(sync); /* other tabs, tab focus and a once-a-minute due-date check */
        addEventListener('azreviews', () =>
            dash(),
        ); /* a review was posted / edited / deleted / moderated: redraw review status */
        dash();
        return;
    }

    /* ===== Employee portal ===== */
    const COND = {
        minor: { label: 'Minor Damage' },
        severe: { label: 'Severe Damage' },
        total: { label: 'Total Loss' },
        perfect: { label: 'Perfect Condition' },
    };
    let tab = 'returns';
    const draft = {},
        saving = new Set(); /* per-booking inspection form state, kept while the list redraws */
    const panel = {},
        feeFilter = { v: 'all' },
        hist = {
            f: 'all',
            pf: 'all',
            popen: {},
        }; /* which report / payment panel is open per booking, and the Fees & Reports filter */
    const open = () => A.bookings().filter((b) => A.LIVE.includes(b.status));
    const waiting = () => A.bookings().filter((b) => b.status === 'awaiting_inspection');
    const isOK = (c) => /perfect|good/i.test(c || '');
    const condKey = (c) =>
        isOK(c)
            ? 'perfect'
            : /minor/i.test(c || '')
              ? 'minor'
              : /total/i.test(c || '')
                ? 'total'
                : 'severe';
    app.innerHTML =
        head('EMPLOYEE PORTAL \u00b7 INSPECTION &amp; RETURNS', '', A.ic('shield', 16)) +
        `<div class="kpis" id="kpis"></div>
  <label class="srch">${A.ic('search', 18)}<span class="sr">Search</span><input id="srch" type="search" placeholder="Search by customer name, booking ID, vehicle plate number or vehicle model..."></label>
  <div class="tabs" role="tablist"><button type="button" role="tab" data-tab="returns">${A.ic('car', 16)} Bookings</button><button type="button" role="tab" data-tab="new">${A.ic('clip', 16)} Inspections <span class="cnt" id="cnt"></span></button><button type="button" role="tab" data-tab="history">${A.ic('hist', 16)} Booking History</button><button type="button" role="tab" data-tab="fees">${A.ic('card', 16)} Penalty Fees <span class="cnt" id="cnt2"></span></button><button type="button" role="tab" data-tab="reviews">${A.ic('check', 16)} Review Management</button></div><div id="pane"></div>`;

    function kpis() {
        const all = A.bookings(),
            ins = A.inspections(),
            od = Fees.list().filter((f) => f.overdue),
            owed = Fees.list().reduce((t, f) => t + f.outstanding, 0);
        const activeN = all.filter(
            (b) => History.model(b).stage === 'active',
        ).length; /* rentals on the road now; cancelled bookings never count */
        $('#kpis').innerHTML =
            kpi('k1', 'clock', 'Active rentals', activeN) +
            kpi('k4', 'clip', 'Awaiting inspection', waiting().length) +
            kpi('k2', 'check', 'Completed', all.filter((b) => b.status === 'completed').length) +
            kpi('k3', 'warn', 'Damage reports', ins.filter((i) => !isOK(i.cond)).length) +
            kpi('k4', 'card', 'Outstanding Penalty Fees', Fees.money(owed)) +
            kpi(
                'k3',
                'clock',
                'Overdue Penalty Fees',
                od.length +
                    (od.length
                        ? ' \u00b7 ' + A.money(od.reduce((t, f) => t + f.outstanding, 0))
                        : ''),
            );
        const n = waiting().length,
            c = $('#cnt');
        c.textContent = n || '';
        c.hidden = !n;
        const c2 = $('#cnt2');
        c2.textContent = od.length || '';
        c2.hidden = !od.length;
    }
    const matcher = () => {
        const q = $('#srch').value.trim().toLowerCase();
        return (b) => !q || History.haystack(b).includes(q);
    }; /* customer name, email, booking ID, plate number, vehicle model, branches */

    function bookingActs(b) {
        const closeAction = `<button type="button" class="act warn" data-st="${b.status === 'pending' ? 'rejected' : 'cancelled'}" data-id="${b.id}">${b.status === 'pending' ? 'Reject' : 'Cancel'}</button>`;
        if (A.isSelfBooking(b, u.email) && b.status !== 'awaiting_inspection')
            return (
                `<span class="wait" title="${A.esc(A.SELF_INSPECT_MSG)}">Your own rental: another employee must handle it</span>` +
                closeAction
            );
        if (A.isSelfBooking(b, u.email))
            return `<span class="wait" title="${A.esc(A.SELF_INSPECT_MSG)}">Your own rental: another employee must inspect it</span>`;
        if (b.status === 'pending')
            return (
                `<button type="button" class="act red" data-approve="${b.id}">Approve</button>` +
                closeAction
            );
        if (b.status === 'confirmed')
            return (
                `<button type="button" class="act red" data-returned="${b.id}">Returned</button>` +
                closeAction
            );
        if (b.status === 'awaiting_inspection')
            return `<button type="button" class="act red" data-insp="${b.id}">Inspect</button>`;
        return '';
    }
    /* Late-return preview from the (editable) actual return time. Same function the saved fee uses. */
    const actualTs = (b, d) => {
        const t = d && d.ret ? new Date(d.ret).getTime() : NaN;
        return isNaN(t) ? b.returnedAt : t;
    };
    const levelValue = (v) => {
        if (v === undefined || v === '') return null;
        const n = Number(v);
        return isFinite(n) && n >= 0 && n <= 100 ? n : null;
    };
    const returnPenalty = (b, d) => {
        const c = carFor(b),
            electric = !!c && String(c.f || '').toLowerCase() === 'electric',
            fuel = levelValue(d && d.fuelLevel),
            battery = levelValue(d && d.batteryCharge);
        if (electric)
            return {
                label: 'Battery Charge',
                value: battery,
                type: 'battery_penalty',
                amount: battery !== null && battery < 30 ? 10 : 0,
            };
        const eligibleFuel =
            !!c && ['petrol', 'diesel'].includes(String(c.f || '').toLowerCase());
        return {
            label: 'Fuel Level',
            value: fuel,
            type: 'fuel_penalty',
            amount: eligibleFuel && fuel !== null && fuel < 50 ? 10 : 0,
        };
    };
    const num = (v) => {
        const n = Number(v);
        return isFinite(n) && n > 0 ? n : 0;
    };
    const returnPenaltyBox = (b, d) => {
        const p = returnPenalty(b, d),
            eligible = p.type === 'battery_penalty' || ['Petrol', 'Diesel'].includes((carFor(b) || {}).f);
        return `<div class="return-penalty" data-return-penalty><div>${p.label}: <b>${p.value === null ? 'Not recorded' : p.value + '%'}</b></div><div>Penalty Status: <b>${p.value === null && eligible ? 'Pending inspection value' : p.amount ? 'Yes' : eligible ? 'No' : 'Not applicable'}</b></div><div>${p.type === 'battery_penalty' ? 'Battery Penalty Fee' : 'Fuel Penalty Fee'}: <b>${Fees.money(p.amount)}</b></div></div>`;
    };
    /* Read-only Late Return Fee + live Penalty Fee total. Same lateFee() the saved fee uses. */
    const lateBox = (b, d) => {
        const L = Fees.lateFee(Fees.dailyRate(b), Fees.scheduledReturn(b), actualTs(b, d));
        const rp = returnPenalty(b, d);
        const dmg = d && d.cond && d.cond !== 'perfect' ? Math.round(num(d.cost)) : 0,
            tot = Math.round((dmg + num(d.cleaning) + num(d.traffic) + L.fee + rp.amount) * 100) / 100;
        return `<div class="latebox${L.fee > 0 ? ' on' : ''}" data-late><div class="fld ro"><label>Late Return Fee (S$) <em>read-only, calculated automatically</em></label><output class="lfv">${Fees.money(L.fee)}</output></div><small>Agreed return ${A.esc(A.stamp(Fees.scheduledReturn(b)).slice(0, 16))} \u00b7 Daily rate ${Fees.money(L.dailyRate)}. ${L.fee > 0 ? A.esc(Fees.human(L.minutesLate)) + ' late. ' + A.esc(L.tier) + '.' : 'Returned on time or within the ' + Fees.GRACE_MIN + '-minute grace period: no late fee.'}</small>
   <div class="ptot"><span>Total Additional Charges</span><b>${Fees.money(tot)}</b><small>Damage Cost ${Fees.money(dmg)} + Cleaning Fee ${Fees.money(num(d.cleaning))} + Traffic Fine ${Fees.money(num(d.traffic))} + Late Return Fee ${Fees.money(L.fee)} + ${rp.type === 'battery_penalty' ? 'Battery Penalty Fee' : 'Fuel Penalty Fee'} ${Fees.money(rp.amount)}</small></div></div>`;
    };
    function inspCard(b) {
        const c = car(b),
            d = draft[b.id] || {},
            k = d.cond || '',
            self = A.isSelfBooking(b, u.email),
            busy = saving.has(b.id) || self,
            dmg = !!k && k !== 'perfect';
        const radios = Object.entries(COND)
            .map(
                ([key, v]) =>
                    `<label class="cond c-${key}${k === key ? ' on' : ''}"><input type="radio" name="cond-${b.id}" value="${key}"${k === key ? ' checked' : ''}${busy ? ' disabled' : ''}><span>${v.label}</span></label>`,
            )
            .join('');
        return `<article class="bk insp" data-ib="${A.esc(b.id)}"><div class="bkimg"><em>${A.esc(c.mk.split('-')[0])}</em>${bookingImg(c)}</div>
  <div class="bkbody"><div class="bktop"><div>${badge(b.status)}<small>${A.esc(c.mk)}</small><h3>${A.esc(c.n)}</h3></div><div class="bkprice"><b>${A.esc(carFor(b) ? carReg(carIndexOf(b)) : '')}</b><small>registration</small></div></div>
  ${empBanner(b, self)}<div class="bkmeta">${m('Booking ID', b.id) + m('Customer', who(b)) + m('Returned', A.stamp(b.returnedAt).slice(0, 16)) + m('Rental period', b.from + ' to ' + b.to)}</div>
  <div class="bgrid">${Branches.detail(b.pickup, 'Pickup branch') + Branches.detail(b.ret, 'Return branch')}</div>
  <fieldset class="conds"${busy ? ' disabled' : ''}><legend>Inspection result</legend><div class="condrow">${radios}</div></fieldset>
  <div class="fld"><label for="d-${b.id}">Description of damage${dmg ? ' (required)' : ''}</label><textarea id="d-${b.id}" data-desc rows="3" maxlength="800" placeholder="${dmg ? 'Describe the damage: where it is and how bad it is' : k ? 'No damage to describe' : 'Choose an inspection result first'}"${k && dmg && !busy ? '' : ' disabled'}>${A.esc(d.desc || '')}</textarea></div>
  <div class="fld"${dmg ? '' : ' hidden'}><label for="c-${b.id}">Damage Cost (S$)</label><input id="c-${b.id}" data-cost type="number" min="1" step="1" inputmode="numeric" placeholder="e.g. 800" value="${A.esc(d.cost || '')}"${busy ? ' disabled' : ''}><small class="fh">Cost of repairing vehicle damage identified during inspection.</small></div>
  <div class="fld"><label for="n-${b.id}">Inspection notes (optional)</label><textarea id="n-${b.id}" data-f="notes" data-bk="${b.id}" rows="2" maxlength="800" placeholder="Anything else the inspector observed"${busy ? ' disabled' : ''}>${A.esc(d.notes || '')}</textarea></div>
  <fieldset class="conds extras"${busy ? ' disabled' : ''}><legend>Return energy level</legend><div class="xgrid">
   ${
       String(c.f || '').toLowerCase() === 'electric'
           ? `<div class="fld"><label for="bc-${b.id}">Battery Charge (%)</label><input id="bc-${b.id}" data-f="batteryCharge" data-bk="${b.id}" type="number" min="0" max="100" step="1" inputmode="numeric" placeholder="0-100" value="${A.esc(d.batteryCharge == null ? '' : d.batteryCharge)}"${busy ? ' disabled' : ''}><small class="fh">A charge below 30% automatically adds a S$10 Battery Penalty Fee.</small></div>`
           : `<div class="fld"><label for="fl-${b.id}">Fuel Level (%)</label><input id="fl-${b.id}" data-f="fuelLevel" data-bk="${b.id}" type="number" min="0" max="100" step="1" inputmode="numeric" placeholder="0-100" value="${A.esc(d.fuelLevel == null ? '' : d.fuelLevel)}"${busy ? ' disabled' : ''}><small class="fh">For petrol and diesel vehicles, less than 50% automatically adds a S$10 Fuel Penalty Fee.</small></div>`
   }</div>${returnPenaltyBox(b, d)}</fieldset>
  <fieldset class="conds extras"${busy ? ' disabled' : ''}><legend>Penalty Fee: other items (optional)</legend><div class="xgrid">
   <div class="fld"><label for="cl-${b.id}">Cleaning Fee (S$)</label><input id="cl-${b.id}" data-f="cleaning" data-bk="${b.id}" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0" value="${A.esc(d.cleaning || '')}"><small class="fh">Excessive dirt, stains, smoke odours, pet hair, rubbish or other abnormal cleaning.</small></div>
   <div class="fld"><label for="tf-${b.id}">Traffic Fine (S$)</label><input id="tf-${b.id}" data-f="traffic" data-bk="${b.id}" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0" value="${A.esc(d.traffic || '')}"><small class="fh">Parking fines, ERP, speeding, red-light or other government-issued penalties.</small></div>
   <div class="fld"><label for="rt-${b.id}">Actual Return Time</label><input id="rt-${b.id}" data-f="ret" data-bk="${b.id}" type="datetime-local" value="${A.esc(d.ret || Fees.inputDT(b.returnedAt))}"><small class="fh">Used to calculate the late return fee automatically.</small></div>
   <div class="fld"><label for="du-${b.id}">Payment Due Date</label><input id="du-${b.id}" data-f="due" data-bk="${b.id}" type="date" min="${A.today()}" value="${A.esc(d.due || Fees.addDays(Date.now(), Fees.DUE_DAYS))}"></div></div></fieldset>
  ${lateBox(b, d)}
  <p class="err" data-err></p>
  <div class="bkfoot"><span>Downloads the report as a .txt file. Any Penalty Fee is added to the customer's dashboard automatically.</span><div class="acts"><button type="button" class="act red done" data-done="${b.id}"${k && !busy ? '' : ' disabled'}>${saving.has(b.id) ? 'Saving…' : self ? 'Another employee must inspect' : 'Export Inspection Report'}</button></div></div></div></article>`;
    }

    /* ---------- History buttons, live report view, payment history ---------- */
    const histActs = (b) => {
        const has = !!Fees.latestInspection(b.id),
            dis = has ? '' : ` disabled title="No inspection was performed for this booking"`;
        const rf =
                b.status === 'cancelled' || b.status === 'rejected' ? Refunds.view(b) : null,
            canCancel = Refunds.canEmployeeCancel(b);
        const rfActs =
            rf &&
            !rf.virtual &&
            rf.refundAmount > 0 &&
            (rf.status === 'pending' || rf.status === 'processing')
                ? (rf.status === 'pending'
                      ? `<button type="button" class="act" data-rf="processing" data-id="${A.esc(b.id)}">Mark Refund Processing</button>`
                      : '') +
                  `<button type="button" class="act red" data-rf="done" data-id="${A.esc(b.id)}">Mark Refund Paid</button>`
                : '';
        const canIssue =
            b.status === 'completed' || b.status === 'awaiting_inspection',
            selfRental = A.isSelfBooking(b, u.email);
        return (
            (canIssue
                ? `<button type="button" class="act" data-pa="issue" data-id="${A.esc(b.id)}"${selfRental ? ` disabled title="${A.esc(Fees.SELF_RENTAL_TOOLTIP)}"` : ''}>Issue Penalty</button>`
                : '') +
            (canCancel
                ? `<button type="button" class="act warn" data-st="${b.status === 'pending' ? 'rejected' : 'cancelled'}" data-id="${A.esc(b.id)}">${b.status === 'pending' ? 'Reject Booking' : 'Cancel Booking'}</button>`
                : '') +
            rfActs +
            `<button type="button" class="act${panel[b.id] === 'details' ? ' on' : ''}" data-details="${A.esc(b.id)}">View Booking Details</button><button type="button" class="act${panel[b.id] === 'report' ? ' on' : ''}" data-view="${A.esc(b.id)}"${dis}>View Inspection Report</button><button type="button" class="act red" data-dl="${A.esc(b.id)}"${dis}>Download Latest Inspection Report (.txt)</button><button type="button" class="act${panel[b.id] === 'pay' ? ' on' : ''}" data-payh="${A.esc(b.id)}"${dis}>View Payment History</button>`
        );
    };
    const rowsOf = (l, fn) =>
        l.length ? `<ul class="hlist">${l.map(fn).join('')}</ul>` : `<p class="hint">None yet.</p>`;
    function histPanel(b) {
        const k = panel[b.id];
        if (!k) return '';
        if (k === 'details') return History.detailEmployee(b);
        if (k === 'report') {
            let txt;
            try {
                txt = Fees.reportText(b.id, u.email);
            } catch (x) {
                txt = x.message;
            }
            return `<div class="hpanel"><div class="hphead"><b>Inspection Report</b><small>Live view: always the latest Penalty Fee, payments and status stored on this computer</small></div><pre class="rpt" tabindex="0">${A.esc(txt)}</pre></div>`;
        }
        const s = Fees.forBooking(b.id),
            f = s.fee;
        if (!f)
            return `<div class="hpanel"><div class="hphead"><b>Payment History</b>${Fees.badge('none')}</div><p class="hint">No Penalty Fee was created for this booking, so there are no payment records.</p></div>`;
        const selfRental = A.isSelfBooking(b, u.email),
            inp = selfRental
                ? ''
                : `<div class="duebox"><label for="due-${A.esc(b.id)}">Due date</label><input id="due-${A.esc(b.id)}" type="date" value="${A.esc(s.dueDate)}"><button type="button" class="act" data-setdue="${A.esc(b.id)}">Change due date</button></div>`;
        return `<div class="hpanel"><div class="hphead"><b>Payment History</b>${Fees.badge(s.status)}</div>
   <div class="pigrid">${m('Inspection Report Reference', s.ref || '-') + m('Total Additional Charges', Fees.money(s.total)) + m('Damage Fee', Fees.money(s.damage)) + m('Cleaning Fee', Fees.money(s.cleaning)) + m('Traffic Fine', Fees.money(s.traffic)) + m('Late Return Fee', Fees.money(s.late)) + m('Fuel Penalty Fee', Fees.money(s.fuelPenalty)) + m('Battery Penalty Fee', Fees.money(s.batteryPenalty)) + m('Amount Paid', Fees.money(s.paid)) + m('Outstanding Balance', Fees.money(s.outstanding)) + m('Due date', s.dueDate) + m('Last payment', s.lastPaymentAt ? A.stamp(s.lastPaymentAt).slice(0, 16) : 'No payment yet') + m('Payment completed', s.completedAt ? A.stamp(s.completedAt).slice(0, 16) : 'Not yet')}</div>
   ${selfRental ? `<p class="self-penalty-notice" role="note">${A.esc(Fees.SELF_RENTAL_MESSAGE)}</p>` : ''}${s.overdue ? `<p class="odmsg" role="alert">${A.ic('warn', 16)} ${A.esc(Fees.OVERDUE_MSG)}</p>` : ''}${s.outstanding > 0 && !selfRental ? inp : ''}
   <h4>Penalty Fee items</h4>${rowsOf(f.charges || [], (c) => `<li><span>${A.esc(Fees.TYPES[c.type] || c.label)}</span><b>${Fees.money(c.amount)}</b><small>Date Applied: ${A.esc(A.stamp(c.at).slice(0, 16))} \u00b7 Staff Member: ${A.esc(c.byName || '-')} (${A.esc(c.byId || '-')})${c.note ? ' \u00b7 Reason: ' + A.esc(c.note) : ''}</small></li>`)}
   <h4>Customer payments</h4>${rowsOf(f.payments || [], (p) => `<li><span>${A.esc(A.stamp(p.at).slice(0, 16))} \u00b7 receipt ${A.esc(p.receipt || '-')} \u00b7 card \u2022\u2022\u2022\u2022 ${A.esc(p.card4 || '----')}</span><b>${Fees.money(p.amount)}</b><small>Balance after: ${Fees.money(p.balanceAfter || 0)}</small></li>`)}
   <h4>Audit trail</h4><p class="hint">Fee created by ${A.esc(f.createdByName || '-')} (${A.esc(f.createdBy || '-')}) \u00b7 Inspection by ${A.esc(f.inspectedByName || '-')} (${A.esc(f.inspectedBy || '-')}) \u00b7 Created ${A.esc(A.stamp(f.createdAt).slice(0, 16))}</p>
   ${rowsOf((f.audit || []).slice().reverse(), (e) => `<li><span>${A.esc(e.action)}${e.detail ? ': ' + A.esc(e.detail) : ''}</span><small>${A.esc(A.stamp(e.at).slice(0, 19))} \u00b7 ${A.esc(e.byName || 'System')}${e.byId && e.byId !== 'SYSTEM' ? ' (' + A.esc(e.byId) + ')' : ''}</small></li>`)}</div>`;
    }
    /* Fees & Reports tab: every inspection fee, overdue first, with filters and totals */
    /* Penalty Fees tab: every Penalty Fee (all customers), with the employee actions. History.penaltySection draws the cards. */
    function feesPane(match) {
        const rows = History.penaltyRows(null).filter((r) => match(r.b)),
            sum = (k) => rows.reduce((t, r) => t + r.s[k], 0),
            od = rows.filter((r) => r.s.overdue),
            returned = (b) =>
                b.status === 'completed' || b.status === 'awaiting_inspection',
            canIssue = A.bookings().some(
                (b) => returned(b) && !A.isSelfBooking(b, u.email),
            ),
            hasSelfRental = A.bookings().some(
                (b) => returned(b) && A.isSelfBooking(b, u.email),
            ),
            issueTitle = !canIssue
                ? ' disabled title="' +
                  A.esc(
                      hasSelfRental
                          ? Fees.SELF_RENTAL_TOOLTIP
                          : 'No returned bookings are available for a new penalty.',
                  ) +
                  '"'
                : '',
            denied = Fees.deniedAttempts().slice().reverse();
        return (
            `<div class="hphead"><h2 class="sec" style="margin:0">Penalty Fees</h2><div class="acts"><button type="button" class="act red" data-pa="issue" data-id=""${issueTitle}>Issue Penalty</button></div></div>
   <div class="kpis">${kpi('', 'clip', 'Total Penalty Fees', Fees.money(sum('total'))) + kpi('k2', 'check', 'Collected', Fees.money(sum('paid'))) + kpi('k4', 'card', 'Outstanding', Fees.money(sum('outstanding'))) + kpi('k3', 'warn', 'Overdue', od.length + ' \u00b7 ' + Fees.money(od.reduce((t, r) => t + r.s.outstanding, 0)))}</div>
   ${od.length ? `<div class="odbar" role="alert">${A.ic('warn', 18)}<div><b>${od.length} overdue Penalty Fee${od.length > 1 ? 's' : ''}</b><small>${A.esc(Fees.OVERDUE_MSG)}</small></div></div>` : ''}` +
            History.penaltySection(rows, hist, 'emp') +
            (denied.length
                ? `<div class="hpanel"><div class="hphead"><b>Denied Self-Rental Penalty Attempts</b><small>Audit trail</small></div><ul class="hlist">${denied
                      .map(
                          (entry) =>
                              `<li><span>${A.esc(entry.actionAttempted)} · Booking ${A.esc(entry.bookingId)} · Customer Account ${A.esc(entry.customerAccountId)}</span><small>${A.esc(entry.dateTime)} · Employee ${A.esc(entry.employeeId)} · Access denied: ${A.esc(entry.accessDeniedReason)}</small></li>`,
                      )
                      .join('')}</ul></div>`
                : '')
        );
    }

    function pane() {
        /* keep the cursor where it was if the list redraws while someone is typing */
        const ae = document.activeElement,
            keep =
                ae && ae.matches && ae.matches('[data-desc],[data-cost],[data-f],#srch,#rvq')
                    ? { id: ae.id, s: ae.selectionStart, e: ae.selectionEnd }
                    : null;
        const el = $('#pane'),
            match = matcher();
        app.querySelectorAll('[data-tab]').forEach((b) =>
            b.setAttribute('aria-selected', b.dataset.tab === tab),
        );
        const sb = app.querySelector('.srch');
        if (sb)
            sb.style.display =
                tab === 'reviews'
                    ? 'none'
                    : ''; /* the top search is for bookings; Review Management has its own */
        if (tab === 'returns') {
            const l = newest(open().filter(match));
            el.innerHTML =
                `<h2 class="sec">Active Bookings</h2>` +
                (l.length
                    ? l.map((b) => card(b, true, bookingActs(b))).join('')
                    : empty('<p>No active bookings right now</p>'));
        } else if (tab === 'new') {
            const l = newest(waiting().filter(match));
            el.innerHTML =
                `<h2 class="sec">Cars Awaiting Inspection</h2>` +
                (l.length
                    ? l.map(inspCard).join('')
                    : empty('<p>No cars are waiting for inspection</p>'));
        } else if (tab === 'fees') {
            el.innerHTML = feesPane(match);
        } else if (tab === 'reviews') {
            el.innerHTML = Reviews.employeeHtml();
            Reviews.bindEmployee(el);
        } else {
            /* every customer booking, any status. Returned cars stay here so past records and inspection history can always be opened. */
            const found = newest(A.bookings().filter(match)),
                rows = found.map(History.model),
                shownIds = new Set(
                    rows.filter((r) => History.matches(r, hist.f)).map((r) => r.b.id),
                ),
                done = found.filter((b) => shownIds.has(b.id)),
                ins = A.inspections().slice().reverse();
            el.innerHTML =
                `<h2 class="sec">Booking History</h2><p class="hint" style="margin:-6px 0 14px">All customer bookings with their payment, inspection and Penalty Fee status. Use the search box above to find a customer, booking ID, plate number or vehicle model.</p>` +
                History.chips(History.FILTERS, rows, hist.f) +
                (hist.f === 'penalty'
                    ? History.penaltySection(
                          History.penaltyRows(null).filter((r) => match(r.b)),
                          hist,
                          'emp',
                      )
                    : done.length
                      ? done.map((b) => History.employeeCard(b, histActs(b), histPanel(b))).join('')
                      : empty(
                            `<p>${A.bookings().length ? 'No bookings match this search or filter' : 'No bookings yet'}</p>`,
                        )) +
                `<h2 class="sec" style="margin-top:32px">Inspection Reports</h2>` +
                (ins.length
                    ? ins
                          .map((i) => {
                              const f = Fees.forBooking(i.bookingId);
                              return `<div class="insrow fx"><div><b>${A.esc(i.title)}</b><small>${A.esc(i.stamp || i.date)} \u00b7 by ${A.esc(i.by)}${i.bookingId ? ' \u00b7 ' + A.esc(i.bookingId) : ''}${i.ref ? ' \u00b7 ' + A.esc(i.ref) : ''}${i.inspectionEmployeeId ? (i.employeeRental ? ` \u00b7 Rented by ${A.esc(i.bookingEmployeeName)} (${A.esc(i.bookingEmployeeId)})` : '') + ` \u00b7 Inspected by ${A.esc(i.inspectionEmployeeName)} (${A.esc(i.inspectionEmployeeId)})` : ''}</small></div><span class="badge ${isOK(i.cond) ? 'b-completed' : condKey(i.cond) === 'minor' ? 'b-pending' : 'b-major'}">${A.esc(i.cond)}</span>${Fees.badge(f.status)}<button type="button" class="act red" data-dl="${A.esc(i.bookingId || '')}"${i.bookingId ? '' : ' disabled'}>Download (.txt)</button>${i.desc || i.notes || f.total > 0 ? `<p>${f.total > 0 ? `Penalty Fee ${A.money(f.total)} \u00b7 Paid ${A.money(f.paid)} \u00b7 Outstanding ${A.money(f.outstanding)}. ` : ''}${A.esc(i.desc || i.notes || '')}</p>` : ''}</div>`;
                          })
                          .join('')
                    : empty('<p>No inspections recorded</p>'));
        }
        if (keep) {
            const n = keep.id && document.getElementById(keep.id);
            if (n) {
                n.focus();
                try {
                    n.setSelectionRange(keep.s, keep.e);
                } catch (x) {}
            }
        }
    }
    const all = () => {
        kpis();
        pane();
    };
    /* "Inspection Completed": record the result, work out every charge (late fee is automatic), finish the booking, create the fee record and download the report.
 Auto-rejected if the inspector rented the car. */
    async function complete(id) {
        let b = A.bookings().find((x) => x.id === id);
        if (!b || b.status !== 'awaiting_inspection' || saving.has(id)) return;
        const d = draft[id] || {},
            k = d.cond,
            desc = String(d.desc || '').trim(),
            notes = String(d.notes || '').trim();
        const showErr = (t) => {
            const e = app.querySelector(`[data-ib="${CSS.escape(id)}"] [data-err]`);
            if (e) e.textContent = t;
            A.toast(t, 'err');
        };
        try {
            A.checkInspector(b, u.email);
        } catch (x) {
            return showErr(x.message);
        } /* BookingEmployeeId !== InspectionEmployeeId */
        if (!COND[k]) return showErr('Select an inspection result first.');
        const cost = k === 'perfect' ? 0 : Math.round(Number(d.cost));
        if (k !== 'perfect' && desc.length < 3)
            return showErr('Describe the damage before completing the inspection.');
        if (k !== 'perfect' && !(cost > 0))
            return showErr('Enter the Damage Cost the customer must pay.');
        const money = (v, l) => {
            const n = v === undefined || v === '' ? 0 : Number(v);
            if (!isFinite(n) || n < 0 || n > 1e6)
                throw Error(l + ' must be an amount of S$0 or more.');
            return Math.round(n * 100) / 100;
        };
        let cleaning, traffic;
        try {
            cleaning = money(d.cleaning, 'Cleaning Fee');
            traffic = money(d.traffic, 'Traffic Fine');
        } catch (x) {
            return showErr(x.message);
        }
        const vehicle = carFor(b),
            electric = !!vehicle && String(vehicle.f || '').toLowerCase() === 'electric',
            fuelLevel = electric ? null : levelValue(d.fuelLevel),
            batteryCharge = electric ? levelValue(d.batteryCharge) : null,
            levelInput = electric ? d.batteryCharge : d.fuelLevel;
        if (levelInput === undefined || levelInput === '' || levelValue(levelInput) === null)
            return showErr(
                electric
                    ? 'Enter a battery charge between 0% and 100%.'
                    : 'Enter a fuel level between 0% and 100%.',
            );
        const energyPenalty = returnPenalty(b, { fuelLevel, batteryCharge });
        const now0 = Date.now(),
            actual = actualTs(b, d);
        if (!actual || isNaN(actual)) return showErr('Enter a valid actual return time.');
        if (actual > now0 + 6e4) return showErr('The actual return time cannot be in the future.');
        const due = d.due || Fees.addDays(now0, Fees.DUE_DAYS);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || due < A.today())
            return showErr('The payment due date cannot be in the past.');
        const L = Fees.lateFee(
            Fees.dailyRate(b),
            Fees.scheduledReturn(b),
            actual,
        ); /* automatic late return fee */
        const charges = [];
        if (L.fee > 0)
            charges.push({
                type: 'late',
                amount: L.fee,
                note: Fees.human(L.minutesLate) + ' late; ' + L.tier,
            });
        if (cleaning > 0) charges.push({ type: 'cleaning', amount: cleaning });
        if (cost > 0) charges.push({ type: 'damage', amount: cost, note: desc });
        if (traffic > 0) charges.push({ type: 'traffic', amount: traffic });
        if (energyPenalty.amount > 0)
            charges.push({
                type: energyPenalty.type,
                amount: energyPenalty.amount,
                note: `${energyPenalty.label} ${energyPenalty.value}% is below the ${electric ? 30 : 50}% threshold.`,
            });
        const totalDue = Math.round(charges.reduce((t, c) => t + c.amount, 0) * 100) / 100;
        saving.add(id);
        pane();
        const at = Date.now(),
            rec = {
                id: 'i' + at.toString(36),
                ref: 'IR-' + at.toString(36).toUpperCase(),
                bookingId: b.id,
                title: b.title,
                by: u.email,
                date: A.today(),
                stamp: A.stamp(at),
                at,
                cond: COND[k].label,
                key: k,
                desc: k === 'perfect' ? '' : desc,
                notes,
                cost,
                fuelLevel,
                batteryCharge,
                penaltyApplied: energyPenalty.amount > 0,
                penaltyAmount: energyPenalty.amount,
                penaltyType: energyPenalty.amount > 0 ? energyPenalty.type : '',
                charged: totalDue,
            };
        let out;
        try {
            const patch = {
                completedAt: at,
                inspectionResult: rec.cond,
                damageCost: totalDue,
                damageStatus: totalDue ? 'unpaid' : 'none',
                damageNote: rec.desc,
                fuelLevel,
                batteryCharge,
                penaltyApplied: rec.penaltyApplied,
                penaltyAmount: rec.penaltyAmount,
                penaltyType: rec.penaltyType,
            };
            if (actual !== b.returnedAt) {
                patch.returnedAtRecorded = b.returnedAt;
                patch.returnedAt = actual;
            } /* inspector corrected the return time */
            out = A.completeInspection(id, u.email, rec, patch);
        } catch (x) {
            saving.delete(id);
            pane();
            return showErr(x.message);
        }
        try {
            Fees.create({
                bookingId: id,
                inspectionId: rec.id,
                reportRef: rec.ref,
                inspectorEmail: u.email,
                creatorEmail: u.email,
                charges,
                dueDate: due,
            });
        } catch (x) {
            A.toast('Inspection saved, but the fee record failed: ' + x.message, 'err');
        }
        try {
            Fees.download(id, u.email);
        } catch (x) {}
        saving.delete(id);
        delete draft[id];
        toast(
            `Inspection completed. Report downloaded.` +
                (totalDue ? ` Penalty Fee ${A.money(totalDue)} is due by ${due}.` : ''),
        );
        all();
    }

    app.addEventListener('click', (e) => {
        const t = e.target.closest('button');
        if (!t) return;
        const d = t.dataset;
        if ('signout' in d) return A.logout();
        if (d.tab) {
            tab = d.tab;
            pane();
        } else if (d.insp) {
            tab = 'new';
            $('#srch').value = '';
            pane();
            const n = app.querySelector(`[data-ib="${CSS.escape(d.insp)}"]`);
            if (n) n.scrollIntoView({ block: 'center' });
        } else if (d.approve) {
            try {
                A.approveBooking(d.approve, u.email);
                all();
            } catch (x) {
                A.toast(x.message, 'err');
            }
        } else if (d.returned) {
            const b = A.bookings().find((x) => x.id === d.returned);
            if (
                b &&
                b.status === 'confirmed' &&
                confirm(`Mark the ${b.title} as returned at ${b.ret}? It will move to inspection.`)
            ) {
                try {
                    A.markReturned(b.id, u.email);
                    all();
                    toast(`${b.title} is now awaiting inspection.`);
                } catch (x) {
                    A.toast(x.message, 'err');
                }
            }
        } else if (d.st === 'cancelled') {
            const b = A.bookings().find((x) => x.id === d.id);
            if (b) Refunds.openCancel(b, u.email, () => all());
        } else if (d.st === 'rejected') {
            const b = A.bookings().find((x) => x.id === d.id);
            if (b) Refunds.openCancel(b, u.email, () => all(), 'rejected');
        } else if (d.rf) {
            try {
                const r = Refunds.advance(
                    d.id,
                    d.rf === 'processing' ? 'processing' : 'done',
                    u.email,
                );
                toast(`Refund ${r.ref} is now ${Refunds.ST[r.status].label}.`);
                all();
            } catch (x) {
                A.toast(x.message, 'err');
            }
        } else if (d.done) complete(d.done);
        else if (d.pa) {
            penaltyAction(d.pa, d.id);
        } else if (d.hf || d.hrec || d.hpf || d.hpv || d.hpr || d.hpr1) {
            try {
                const r = History.act(d, u.email, hist);
                if (r) pane();
            } catch (x) {
                A.toast(x.message, 'err');
            }
        } else if (d.view || d.payh || d.details) {
            const id = d.view || d.payh || d.details,
                kind = d.view ? 'report' : d.details ? 'details' : 'pay';
            panel[id] = panel[id] === kind ? '' : kind;
            pane();
        } else if (d.dl) {
            try {
                const n = Fees.download(d.dl, u.email);
                toast('Downloaded ' + n + ' with the latest data.');
            } catch (x) {
                A.toast(x.message, 'err');
            }
        } else if (d.ff) {
            feeFilter.v = d.ff;
            pane();
        } else if (d.setdue) {
            const inp = document.getElementById('due-' + d.setdue);
            try {
                Fees.setDueDate(d.setdue, inp.value, u.email);
                toast('Due date updated.');
                all();
            } catch (x) {
                A.toast(x.message, 'err');
            }
        }
    });
    app.addEventListener('change', (e) => {
        const r = e.target;
        if (r.type !== 'radio' || !r.name.startsWith('cond-')) return;
        const id = r.name.slice(5);
        (draft[id] = draft[id] || {}).cond = r.value;
        pane();
        const ta = app.querySelector(`#d-${CSS.escape(id)}`);
        if (ta && !ta.disabled) ta.focus();
    });
    app.addEventListener('input', (e) => {
        if (e.target.id === 'srch') return pane();
        if (e.target.dataset.f) {
            /* Inspection values, extra charges, notes, return time and due date stay in the draft and refresh previews. */
            const id = e.target.dataset.bk;
            (draft[id] = draft[id] || {})[e.target.dataset.f] = e.target.value;
            const card = e.target.closest('.insp'),
                er = card.querySelector('[data-err]');
            if (er) er.textContent = '';
            const bk = A.bookings().find((x) => x.id === id),
                lb = card.querySelector('[data-late]');
            if (bk && lb) lb.outerHTML = lateBox(bk, draft[id]);
            const pb = card.querySelector('[data-return-penalty]');
            if (bk && pb) pb.outerHTML = returnPenaltyBox(bk, draft[id]);
            return;
        }
        if (e.target.matches('[data-cost]')) {
            const id = e.target.id.slice(2);
            (draft[id] = draft[id] || {}).cost = e.target.value;
            const cd = e.target.closest('.insp'),
                er = cd.querySelector('[data-err]');
            if (er) er.textContent = '';
            const bk = A.bookings().find((x) => x.id === id),
                lb = cd.querySelector('[data-late]');
            if (bk && lb) lb.outerHTML = lateBox(bk, draft[id]);
            return;
        }
        if (e.target.matches('[data-desc]')) {
            const id = e.target.id.slice(2);
            (draft[id] = draft[id] || {}).desc = e.target.value;
            const er = e.target.closest('.insp').querySelector('[data-err]');
            if (er) er.textContent = '';
        }
    });

    /* ---------- Employee penalty actions (each one is logged in the penalty's audit trail by fees.js) ---------- */
    const bookingLabel = (b) => `${b.id} \u00b7 ${b.title} \u00b7 ${b.name || b.email}`;
    function penaltyAction(kind, id) {
        const b = id && A.bookings().find((x) => x.id === id),
            s = id ? Fees.forBooking(id) : null,
            done = (msg) => {
                toast(msg);
                all();
            };
        if (kind === 'issue') {
            const elig = A.bookings().filter(
                (x) =>
                    (x.status === 'completed' || x.status === 'awaiting_inspection') &&
                    !A.isSelfBooking(x, u.email),
            );
            if (!elig.length && !b)
                return A.toast('No returned bookings are available for a new penalty.', 'err');
            const fields = [];
            if (!b)
                fields.push({
                    id: 'bk',
                    label: 'Booking',
                    type: 'select',
                    options: newest(elig.slice()).map((x) => [x.id, bookingLabel(x)]),
                    value: elig[0].id,
                });
            fields.push(
                {
                    id: 'damage',
                    label: 'Damage Cost (S$)',
                    type: 'number',
                    step: '0.01',
                    min: 0,
                    hint: 'Cost of repairing vehicle damage.',
                },
                {
                    id: 'cleaning',
                    label: 'Cleaning Fee (S$)',
                    type: 'number',
                    step: '0.01',
                    min: 0,
                },
                {
                    id: 'traffic',
                    label: 'Traffic Fine (S$)',
                    type: 'number',
                    step: '0.01',
                    min: 0,
                    hint: 'Parking, ERP, speeding, red-light or other government-issued penalties.',
                },
                {
                    id: 'late',
                    label: 'Late Return Fee (S$)',
                    type: 'number',
                    step: '0.01',
                    min: 0,
                    hint: 'Normally calculated automatically at inspection. Use only to correct it.',
                },
                {
                    id: 'due',
                    label: 'Payment due date',
                    type: 'date',
                    value:
                        s && s.dueDate && s.outstanding > 0
                            ? s.dueDate
                            : Fees.addDays(Date.now(), Fees.DUE_DAYS),
                    min: A.today(),
                },
                {
                    id: 'note',
                    label: 'Reason / description',
                    type: 'textarea',
                    required: true,
                    placeholder: 'What is this penalty for?',
                },
            );
            return History.dialog({
                title: b ? 'Issue penalty' : 'Issue a penalty',
                intro: b
                    ? bookingLabel(b) +
                      (s && s.total > 0
                          ? '. This adds to the existing Penalty Fee ' + s.penaltyRef + '.'
                          : '')
                    : 'Add a penalty to a booking whose car has been returned.',
                fields,
                confirm: 'Issue Penalty',
                onSubmit: (v) => {
                    const bid = b ? b.id : v.bk;
                    const r = Fees.issue(
                        bid,
                        u.email,
                        {
                            damage: v.damage,
                            cleaning: v.cleaning,
                            traffic: v.traffic,
                            late: v.late,
                        },
                        v.due,
                        v.note,
                    );
                    done(
                        `Penalty issued. Penalty Fee is now ${Fees.money(r.total)} (${r.penaltyRef}).`,
                    );
                },
            });
        }
        if (!b || !s || !s.fee) return A.toast('No Penalty Fee found for this booking.', 'err');
        if (kind === 'pay')
            return History.dialog({
                title: 'Record payment',
                intro: bookingLabel(b),
                rows: [
                    ['Penalty Fee', Fees.money(s.total)],
                    ['Amount Paid so far', Fees.money(s.paid)],
                    ['Outstanding Balance', Fees.money(s.outstanding)],
                ],
                fields: [
                    {
                        id: 'amt',
                        label: 'Amount received (S$)',
                        type: 'number',
                        step: '0.01',
                        min: 0.01,
                        value: s.outstanding,
                        required: true,
                    },
                    {
                        id: 'method',
                        label: 'Payment method',
                        type: 'select',
                        options: Fees.METHODS.map((x) => [x, x]),
                    },
                    {
                        id: 'ref',
                        label: 'Reference (optional)',
                        type: 'text',
                        placeholder: 'Slip or transfer reference',
                    },
                ],
                confirm: 'Record Payment',
                onSubmit: (v) => {
                    const r = Fees.recordPayment(b.id, u.email, Number(v.amt), v.method, v.ref);
                    done(
                        `Payment recorded. Receipt ${r.payment.receipt}. Outstanding ${Fees.money(r.summary.outstanding)}.`,
                    );
                },
            });
        if (kind === 'waive')
            return History.dialog({
                title: 'Waive penalty',
                intro:
                    bookingLabel(b) +
                    '. The remaining balance will be waived and the record kept as Waived.',
                rows: [['Balance to waive', Fees.money(s.outstanding)]],
                danger: true,
                fields: [
                    { id: 'why', label: 'Reason for waiving', type: 'textarea', required: true },
                ],
                confirm: 'Waive Penalty',
                onSubmit: (v) => {
                    Fees.waive(b.id, u.email, v.why);
                    done(`${Fees.money(s.outstanding)} waived for ${b.id}.`);
                },
            });
        if (kind === 'reinstate')
            return History.dialog({
                title: 'Reinstate penalty',
                intro: bookingLabel(b) + '. The waived balance becomes payable again.',
                rows: [['Waived amount', Fees.money(s.waivedAmount)]],
                fields: [
                    {
                        id: 'why',
                        label: 'Reason for reinstating',
                        type: 'textarea',
                        required: true,
                    },
                ],
                confirm: 'Reinstate',
                onSubmit: (v) => {
                    Fees.reinstate(b.id, u.email, v.why);
                    done(`Penalty for ${b.id} reinstated.`);
                },
            });
    }

    /* Live updates + pop-up when a customer books or returns a car in another tab or window */
    let seen = new Map(A.bookings().map((b) => [b.id, b.status])),
        seenFee = new Map(Fees.list().map((f) => [f.bookingId, { p: f.paid, s: f.status }]));
    const sync = () => {
        Fees.list().forEach((f) => {
            const o = seenFee.get(f.bookingId),
                b = A.bookings().find((x) => x.id === f.bookingId);
            if (!o || !b) return;
            if (f.paid > o.p)
                toast(
                    f.outstanding > 0
                        ? `${b.name || b.email} paid ${A.money(f.paid - o.p)} towards ${b.title}. Outstanding ${A.money(f.outstanding)}.`
                        : `${b.name || b.email} paid the ${A.money(f.total)} Penalty Fee for ${b.title} in full.`,
                );
            else if (f.status === 'overdue' && o.s !== 'overdue')
                toast(`${b.id}: ${A.money(f.outstanding)} is now overdue.`);
        });
        seenFee = new Map(Fees.list().map((f) => [f.bookingId, { p: f.paid, s: f.status }]));
        A.bookings().forEach((b) => {
            const was = seen.get(b.id);
            if (was === undefined) toast(`New booking: ${b.title} from ${b.name || b.email}`);
            else if (
                was !== b.status &&
                b.status === 'awaiting_inspection' &&
                was !== 'awaiting_inspection'
            )
                toast(`${b.title} was returned and is awaiting inspection.`);
        });
        seen = new Map(A.bookings().map((b) => [b.id, b.status]));
        all();
    };
    Fees.watch(sync); /* other tabs, tab focus and a once-a-minute overdue check */
    addEventListener('azreviews', () => {
        if (tab === 'reviews') pane();
    });
    renderProf();
    all();
});
