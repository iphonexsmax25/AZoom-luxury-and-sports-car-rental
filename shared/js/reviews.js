/* Vehicle Reviews & Ratings (localStorage only, no backend).
   Needs auth.js and data/cars.json (loaded by cars-loader.js) loaded first. Loaded on: home, fleet, car, dashboard, employee.

   Storage:  "az_reviews"        every review (see newReview below for the fields)
             "az_review_notices" booking IDs the customer has already been told about ("leave a review" pop-up)
   Rules (all enforced HERE, in the data layer, not only in the screens):
     - only the owner of a COMPLETED booking (returned + inspection finished) can review it, once per booking
     - the owner can edit / delete for 7 days, after that the review is read-only
     - employees can only hide / restore / flag a review. Nothing here lets anyone change a customer's rating or comment
     - only visible (not hidden) verified reviews count towards a vehicle's rating
   Nothing else is modified: bookings, payments, returns, inspections, penalty fees and Compare are untouched.
   DEMO LIMIT: localStorage can be edited from the browser console. Port these checks to a server before launch. */
const Reviews = (() => {
    const A = Auth,
        KEY = 'az_reviews',
        NKEY = 'az_review_notices',
        DAY = 864e5,
        EDIT_DAYS = 7,
        PAGE = 5,
        MAX = 500,
        page = document.body.dataset.page || '';
    const CATS = [
        ['overall', 'Overall Experience'],
        ['condition', 'Vehicle Condition'],
        ['cleanliness', 'Vehicle Cleanliness'],
        ['pickup', 'Pickup Experience'],
        ['ret', 'Return Experience'],
    ];
    const WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'],
        E = A.esc,
        $ = (s) => document.querySelector(s);
    const rd = (k, d) => {
        try {
            const v = JSON.parse(localStorage.getItem(k));
            return v == null ? d : v;
        } catch (e) {
            return d;
        }
    };
    const wr = (k, v) => {
        try {
            localStorage.setItem(k, JSON.stringify(v));
            return true;
        } catch (e) {
            return false;
        }
    };
    const reduce = () => matchMedia('(prefers-reduced-motion:reduce)').matches;
    const fmt = (ts) =>
        ts
            ? new Date(ts).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
              })
            : '-';
    const ymd = (ts) => {
        const d = new Date(ts);
        return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    };
    const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
    const ICON = {
        check: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
        lock: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>',
        star: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z"/></svg>',
        thumb: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 11v9H4v-9zM7 11l4-8c1.7 0 3 1.3 3 3v3h5.2a2 2 0 012 2.3l-1.2 7A2 2 0 0117 20H7"/></svg>',
    };

    /* ---------- Storage + index (re-read only when the stored text changes) ---------- */
    let raw0 = null,
        list0 = [],
        byV = new Map();
    const all = () => {
        let raw = '[]';
        try {
            raw = localStorage.getItem(KEY) || '[]';
        } catch (e) {}
        if (raw !== raw0) {
            raw0 = raw;
            try {
                list0 = JSON.parse(raw);
                if (!Array.isArray(list0)) list0 = [];
            } catch (e) {
                list0 = [];
            }
            byV = new Map();
            list0.forEach((r) => {
                if (!byV.has(r.vehicleId)) byV.set(r.vehicleId, []);
                byV.get(r.vehicleId).push(r);
            });
        }
        return list0;
    };
    const save = (a) => {
        if (!wr(KEY, a))
            throw Error(
                'Your review could not be saved. Browser storage may be full or turned off.',
            );
        emit();
    };
    const emit = () => dispatchEvent(new CustomEvent('azreviews'));
    const newId = () =>
        'RV-' +
        Date.now().toString(36).toUpperCase() +
        Math.random().toString(36).slice(2, 5).toUpperCase();
    const bk = (id) => A.bookings().find((b) => b.id === id);
    const vidOf = (b) => (CARS[b.carId] ? carCode(b.carId) : 'T:' + b.title);
    const isPublic = (r) =>
        !!r && r.verified === true && r.status !== 'hidden'; /* only these count towards ratings */
    const pub = (i) => {
        all();
        return (byV.get(carCode(i)) || []).filter(isPublic);
    };
    const reviewOf = (bid) => all().find((r) => r.bookingId === bid);
    const canEdit = (r) => !!r && Date.now() - r.createdAt <= EDIT_DAYS * DAY;
    const editUntil = (r) => r.createdAt + EDIT_DAYS * DAY;

    /* ---------- Statistics for one vehicle (by its index in CARS) ---------- */
    function stats(i) {
        const l = pub(i),
            n = l.length,
            sum = (f) => l.reduce((t, r) => t + (+f(r) || 0), 0),
            dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        l.forEach((r) => {
            if (dist[r.ratings.overall] !== undefined) dist[r.ratings.overall]++;
        });
        const avg = n ? sum((r) => r.ratings.overall) / n : 0;
        return {
            n,
            avg,
            avgTxt: n ? avg.toFixed(1) : '-',
            dist,
            pct: (k) => (n ? Math.round((dist[k] * 100) / n) : 0),
            rec: n ? Math.round((l.filter((r) => r.recommend).length * 100) / n) : 0,
            cat: {
                cleanliness: n ? sum((r) => r.ratings.cleanliness) / n : 0,
                condition: n ? sum((r) => r.ratings.condition) / n : 0,
                pickup: n ? sum((r) => r.ratings.pickup) / n : 0,
                ret: n ? sum((r) => r.ratings.ret) / n : 0,
            },
        };
    }
    /* Sort key for the Fleet "Top rated" sort: real reviews pull a car away from its starting (sample) rating */
    const score = (i) => {
        const s = stats(i);
        return (s.n * s.avg + 3 * +CARS[i].r) / (s.n + 3);
    };

    /* ---------- Small HTML helpers ---------- */
    const stars = (v, cls) =>
        `<span class="rvst ${cls || ''}" style="--p:${Math.max(0, Math.min(5, +v || 0)) * 20}%" role="img" aria-label="${(+v || 0).toFixed(1).replace(/\.0$/, '')} out of 5 stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span>`;
    const badgeInner = (i) => {
        const s = stats(i);
        return s.n
            ? `<span class="rvgold">&#9733;</span> ${s.avgTxt} <span class="rvn">(${s.n} ${s.n === 1 ? 'Review' : 'Reviews'})</span>`
            : `<span class="rvgold dim">&#9734;</span> <span class="rvn">No reviews yet</span>`;
    };
    const badgeLabel = (i) => {
        const s = stats(i),
            c = CARS[i];
        return s.n
            ? `${c.mk} ${c.n}: rated ${s.avgTxt} out of 5 from ${plural(s.n, 'review')}. Open reviews`
            : `${c.mk} ${c.n}: no reviews yet. Open reviews`;
    };
    /* unique vehicle ID (CAR001...) built from the car's permanent "oid" in data/cars.json; reviews are stored under this ID */
    const vid = (i) => (CARS[i] ? carCode(i) : '');
    /* resolves a Reviews button to the right CARS position: by unique vehicle ID first, list position only as a fallback */
    function resolveCar(el) {
        const id = el.getAttribute('data-rv-vid'),
            pos = el.getAttribute('data-rv-open');
        let i = id ? CARS.findIndex((c, k) => carCode(k) === id) : -1;
        if (i < 0 && CARS[+pos]) i = +pos;
        if (i < 0)
            console.error(
                `[Reviews] No vehicle found for Reviews button (vehicle ID "${id}", position "${pos}"). CARS has ${CARS.length} cars.`,
            );
        else if (id && pos !== null && +pos !== i)
            console.warn(`[Reviews] Button position ${pos} did not match vehicle ID ${id}; using the ID (position ${i}).`);
        return i;
    }
    const badge = (i) =>
        `<button type="button" class="rate rvbadge" data-rv-open="${i}" data-rv-vid="${vid(i)}" data-rv-badge="${i}" aria-label="${E(badgeLabel(i))}">${badgeInner(i)}</button>`;
    const btn = (i) =>
        `<button type="button" class="rvbtn" data-rv-open="${i}" data-rv-vid="${vid(i)}" aria-label="Reviews for ${E(CARS[i].mk + ' ' + CARS[i].n)}">${ICON.star} Reviews</button>`;
    const ratingRow = (i) => {
        const s = stats(i);
        return `${stars(s.avg)}<b>${s.n ? s.avgTxt : 'New'}</b><span class="rvcnt">${s.n ? '(' + plural(s.n, 'review') + ')' : 'No reviews yet'}</span><button type="button" class="rv-viewall" data-rv-scroll>View All Reviews</button>`;
    };
    const bars = (s) =>
        [5, 4, 3, 2, 1]
            .map(
                (k) =>
                    `<div class="rvbar"><span class="rvbl" aria-label="${k} stars">${'&#9733;'.repeat(k)}<i>${'&#9733;'.repeat(5 - k)}</i></span><div class="rvtrack"><div class="rvfill" style="width:${s.n ? (s.dist[k] * 100) / s.n : 0}%"></div></div><span class="rvpc">${s.pct(k)}%</span></div>`,
            )
            .join('');
    const summary = (i) => {
        const s = stats(i);
        return `<div class="rvsum"><div class="rvbig"><div class="rvnum"><b>${s.n ? s.avgTxt : '&ndash;'}</b><span>/ 5</span></div>${stars(s.avg, 'lg')}<p>${s.n ? 'Based on ' + plural(s.n, 'Verified Rental') : 'No verified rentals reviewed yet'}</p></div>
   <div class="rvbars" aria-label="Rating distribution">${bars(s)}</div>
   <div class="rvextra">${
       s.n
           ? `<div class="rvrec">${ICON.thumb}<span>Recommended by <b>${s.rec}%</b> of renters</span></div>
    <ul class="rvavg"><li><span>Cleanliness</span><b>${s.cat.cleanliness.toFixed(1)}</b></li><li><span>Vehicle Condition</span><b>${s.cat.condition.toFixed(1)}</b></li><li><span>Pickup</span><b>${s.cat.pickup.toFixed(1)}</b></li><li><span>Return</span><b>${s.cat.ret.toFixed(1)}</b></li></ul>`
           : `<p class="rvhint">Ratings appear here after customers complete a rental and review it.</p>`
   }</div></div>`;
    };
    const emptyBox = (t, p) =>
        `<div class="rvempty"><div class="rvempty-i">${ICON.star}</div><h3>${t}</h3><p>${p}</p></div>`;

    /* One review as a glass card. extra = HTML placed under the text (employee / owner details) */
    function card(r, delay, extra) {
        const t = r.ratings;
        return `<article class="rvcard${r.status === 'hidden' ? ' hid' : ''}" style="${delay !== undefined ? '--d:' + delay : ''}"><header><div class="rvav" aria-hidden="true">${E((r.customerName || '?').trim()[0] || '?').toUpperCase()}</div>
   <div class="rvwho"><b>${E(r.customerName)}</b><small>${fmt(r.createdAt)}${r.editedAt ? ' &middot; edited' : ''}</small></div>
   <span class="rvver">${ICON.check} Verified Rental</span></header>
   <div class="rvrow">${stars(t.overall)}<b>${t.overall}.0</b>${r.recommend ? `<span class="rvyes">${ICON.thumb} Recommends this vehicle</span>` : `<span class="rvno">Does not recommend</span>`}</div>
   ${r.comment ? `<p class="rvtxt">&ldquo;${E(r.comment)}&rdquo;</p>` : ''}
   <div class="rvcats"><span>Cleanliness ${stars(t.cleanliness, 'sm')}</span><span>Vehicle Condition ${stars(t.condition, 'sm')}</span></div>
   <footer>Rental completed ${fmt(r.completedAt)} &middot; ${E(r.vehicleName)}</footer>${extra || ''}</article>`;
    }
    const sorted = (l, m) =>
        l
            .slice()
            .sort((a, b) =>
                m === 'old'
                    ? a.createdAt - b.createdAt
                    : m === 'high'
                      ? b.ratings.overall - a.ratings.overall || b.createdAt - a.createdAt
                      : m === 'low'
                        ? a.ratings.overall - b.ratings.overall || b.createdAt - a.createdAt
                        : b.createdAt - a.createdAt,
            );
    const search = (l, q) => {
        q = q.trim().toLowerCase();
        return q
            ? l.filter((r) =>
                  ((r.comment || '') + ' ' + r.customerName + ' ' + r.vehicleName)
                      .toLowerCase()
                      .includes(q),
              )
            : l;
    };

    /* ---------- Eligibility (also enforced again in submit) ---------- */
    const hasInspection = (b) =>
        !!(
            b.inspectionAt ||
            b.inspectionResult ||
            A.inspections().some((i) => i.bookingId === b.id)
        );
    function why(b) {
        if (!b) return 'Booking not found.';
        if (b.status === 'cancelled') return "Cancelled bookings can't be reviewed.";
        if (b.status === 'rejected') return "Rejected bookings can't be reviewed.";
        if (b.status === 'pending') return "Pending bookings can't be reviewed.";
        if (b.status === 'confirmed')
            return "Active bookings can't be reviewed. Return the car first.";
        if (b.status === 'awaiting_inspection')
            return 'You can review this rental after the employee finishes the return inspection.';
        if (b.status !== 'completed' || !hasInspection(b))
            return 'Only completed and returned bookings can be reviewed.';
        return '';
    }
    const eligible = (b) => !why(b);
    const awaiting = (email) =>
        A.bookings()
            .filter((b) => b.email === email && eligible(b) && !reviewOf(b.id))
            .sort((x, y) => (y.created || 0) - (x.created || 0));
    const mineList = (email) =>
        all()
            .filter((r) => {
                const b = bk(r.bookingId);
                return b ? b.email === email : r.customerEmail === email;
            })
            .sort((a, b) => b.createdAt - a.createdAt);

    /* ---------- Data layer: submit / update / delete / moderate ---------- */
    function clean(d) {
        const ratings = {};
        CATS.forEach(([k, l]) => {
            const v = Number(d.ratings && d.ratings[k]);
            if (!Number.isInteger(v) || v < 1 || v > 5) throw Error('Please rate: ' + l + '.');
            ratings[k] = v;
        });
        const comment = String(d.comment || '')
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
            .trim();
        if (comment.length > MAX)
            throw Error('Your comment is too long. The limit is ' + MAX + ' characters.');
        if (typeof d.recommend !== 'boolean')
            throw Error('Please say whether you recommend this vehicle.');
        return { ratings, comment, recommend: d.recommend };
    }
    function submit(bid, d) {
        const u = A.user();
        if (!u) throw Error('Please sign in to leave a review.');
        const b = bk(bid);
        if (!b || b.email !== u.email) throw Error('Booking not found on this account.');
        const w = why(b);
        if (w) throw Error(w);
        if (reviewOf(bid)) throw Error('You have already reviewed this booking.');
        const v = clean(d),
            now = Date.now(),
            insp = A.inspections()
                .filter((i) => i.bookingId === bid)
                .pop();
        const r = {
            id: newId(),
            bookingId: bid,
            vehicleId: vidOf(b),
            vehicleName: b.title,
            customerEmail: b.email,
            customerName: A.nameOf(b.email),
            ratings: v.ratings,
            comment: v.comment,
            recommend: v.recommend,
            verified: true,
            rentalFrom: b.from,
            rentalTo: b.to,
            completedAt: b.inspectionAt || (insp && insp.at) || b.returnedAt || now,
            createdAt: now,
            editedAt: null,
            status: 'visible',
            flagged: false,
            log: [],
        };
        save(all().concat([r]));
        return r;
    }
    function own(id) {
        const u = A.user();
        if (!u) throw Error('Please sign in again.');
        const r = all().find((x) => x.id === id);
        if (!r) throw Error('Review not found.');
        const b = bk(r.bookingId);
        if ((b ? b.email : r.customerEmail) !== u.email)
            throw Error('You can only change your own reviews.');
        if (!canEdit(r))
            throw Error(
                'This review is read-only. Reviews can be changed for ' +
                    EDIT_DAYS +
                    ' days after they are posted.',
            );
        return r;
    }
    function update(id, d) {
        const r = own(id),
            v = clean(d);
        save(
            all().map((x) => (x.id === id ? Object.assign({}, x, v, { editedAt: Date.now() }) : x)),
        );
        return id;
    }
    function remove(id) {
        own(id);
        save(all().filter((x) => x.id !== id));
    }
    /* Employees: hide / restore / flag / unflag. Never touches ratings or comments. Not allowed on your own review. */
    const MODS = {
        hide: 'Hidden',
        restore: 'Restored',
        flag: 'Marked for moderation',
        unflag: 'Moderation flag cleared',
    };
    function moderate(id, action, email) {
        if (!MODS[action]) throw Error('Unknown action.');
        const e = A.user();
        if (!e || e.email !== email || !A.isEmployee(email))
            throw Error('Only employee accounts can moderate reviews.');
        const r = all().find((x) => x.id === id);
        if (!r) throw Error('Review not found.');
        const b = bk(r.bookingId);
        if (r.customerEmail === email || (b && b.email === email))
            throw Error("You can't moderate a review of your own rental. Ask another employee.");
        const entry = {
            at: Date.now(),
            action: MODS[action],
            byName: A.nameOf(email),
            byId: A.uid(email),
        };
        save(
            all().map((x) =>
                x.id !== id
                    ? x
                    : Object.assign({}, x, {
                          status:
                              action === 'hide'
                                  ? 'hidden'
                                  : action === 'restore'
                                    ? 'visible'
                                    : x.status,
                          flagged:
                              action === 'flag'
                                  ? true
                                  : action === 'unflag' || action === 'restore'
                                    ? false
                                    : x.flagged,
                          log: (x.log || []).concat([entry]),
                      }),
            ),
        );
    }

    /* ---------- Modal layer (one at a time) ---------- */
    let layer = null,
        lastFocus = null,
        mState = null;
    const FOCUSABLE =
        'button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
    function openLayer(html) {
        close();
        lastFocus = document.activeElement;
        layer = document.createElement('div');
        layer.className = 'rvlayer';
        layer.innerHTML = html;
        document.body.append(layer);
        document.body.classList.add('rv-lock');
        /* listeners live on this layer element only, so they are removed together with it (nothing accumulates across open/close) */
        layer.addEventListener('mousedown', (e) => {
            if (e.target === layer) close(); /* click on the dark overlay, outside the dialog */
        });
        const f = layer.querySelector('[data-autofocus]') || layer.querySelector('.rvx');
        if (f) f.focus();
        return layer;
    }
    function close() {
        if (!layer) {
            document.body.classList.remove('rv-lock'); /* never leave the page unscrollable */
            return;
        }
        layer.remove();
        layer = null;
        mState = null;
        document.body.classList.remove('rv-lock');
        if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus();
    }
    document.addEventListener('keydown', (e) => {
        if (!layer) return;
        if (e.key === 'Escape') {
            e.stopPropagation();
            close();
            return;
        }
        if (e.key !== 'Tab') return;
        const f = [...layer.querySelectorAll(FOCUSABLE)].filter((x) => x.offsetParent !== null);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) {
            e.preventDefault();
            f[f.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
            e.preventDefault();
            f[0].focus();
        }
    });

    /* ---------- Vehicle reviews pop-up (opened from the Reviews button / rating badge) ---------- */
    function openList(i) {
        const c = CARS[i];
        if (!c) {
            console.error(`[Reviews] Cannot open reviews: no vehicle at position "${i}" in CARS (${CARS.length} cars loaded).`);
            return;
        }
        if (!(typeof localStorage !== 'undefined')) console.error('[Reviews] Review data (localStorage) is not available.');
        else if (!Array.isArray(rd(KEY, []))) console.error(`[Reviews] Stored review data "${KEY}" is not a list; showing no reviews.`);
        mState = { type: 'list', i, shown: PAGE };
        openLayer(
            `<div class="rvm" role="dialog" aria-modal="true" aria-labelledby="rvm-t"><header><div><small>${E(c.mk)} &middot; Customer Reviews</small><h2 id="rvm-t">${E(c.mk + ' ' + c.n)}</h2></div><button type="button" class="rvx" aria-label="Close reviews">&times;</button></header><div class="rvm-body" id="rvm-body"></div></div>`,
        );
        renderList();
    }
    function renderList() {
        if (!layer || !mState || mState.type !== 'list') return;
        const { i, shown } = mState,
            c = CARS[i],
            host = layer.querySelector('#rvm-body'),
            box = layer.querySelector('.rvm'),
            top = box.scrollTop,
            l = sorted(pub(i), 'new');
        host.innerHTML =
            summary(i) +
            (l.length
                ? `<h3 class="rvh3">Customer reviews</h3><div class="rvlist">${l
                      .slice(0, shown)
                      .map((r, k) => card(r, Math.min(k, PAGE)))
                      .join(
                          '',
                      )}</div>${l.length > shown ? `<button type="button" class="rvmore" data-rv-modal-more>Load More <span>(${l.length - shown} more)</span></button>` : ''}`
                : emptyBox(
                      'No reviews yet',
                      'Be the first to review this vehicle after your rental is completed.',
                  )) +
            `<div class="rvm-foot"><a class="btn red" href="../car/car.html?model=${encodeURIComponent(carKey(c))}#reviews">View vehicle page</a></div>`;
        box.scrollTop = top;
    }

    /* ---------- Customer Reviews & Ratings section on the car details page ---------- */
    const cs = { i: null, q: '', sort: 'new', shown: PAGE, anim: true };
    function mountCar(i) {
        const app = document.getElementById('app');
        if (!app || !CARS[i]) return;
        Object.assign(cs, { i, q: '', sort: 'new', shown: PAGE, anim: true });
        const s = document.createElement('section');
        s.id = 'reviews';
        s.className = 'rv-sec';
        s.setAttribute('aria-labelledby', 'rv-h');
        s.innerHTML = `<div class="rvhead"><span class="eyebrow">Verified feedback</span><h2 id="rv-h">Customer Reviews &amp; Ratings</h2></div><div id="rv-sum"></div>
   <div class="rvtools"><label class="rvsearch"><span class="sr">Search reviews</span><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input id="rv-q" type="search" placeholder="Search reviews by keyword or reviewer..." autocomplete="off"></label>
   <label class="rvsel"><span class="sr">Sort reviews</span><select id="rv-s"><option value="new">Newest First</option><option value="old">Oldest First</option><option value="high">Highest Rating</option><option value="low">Lowest Rating</option></select></label></div>
   <p class="rvcount" id="rv-c" aria-live="polite"></p><div id="rv-l"></div>`;
        app.append(s);
        s.querySelector('#rv-q').addEventListener('input', (e) => {
            cs.q = e.target.value;
            cs.shown = PAGE;
            cs.anim = false;
            renderCar();
        });
        s.querySelector('#rv-s').addEventListener('change', (e) => {
            cs.sort = e.target.value;
            cs.shown = PAGE;
            cs.anim = true;
            renderCar();
        });
        refresh();
        if (location.hash === '#reviews') setTimeout(scrollToReviews, 350);
    }
    function renderCar() {
        const sum = $('#rv-sum'),
            host = $('#rv-l');
        if (!sum || !host || cs.i === null) return;
        sum.innerHTML = summary(cs.i);
        const base = pub(cs.i),
            l = sorted(search(base, cs.q), cs.sort),
            cnt = $('#rv-c');
        cnt.textContent = base.length
            ? l.length
                ? `Showing ${Math.min(cs.shown, l.length)} of ${plural(l.length, 'review')}`
                : ''
            : '';
        host.innerHTML = !base.length
            ? emptyBox(
                  'No reviews yet',
                  'Be the first to share your experience. Reviews come from customers who have completed and returned this vehicle.',
              )
            : !l.length
              ? emptyBox(
                    'No reviews match your search',
                    'Try a different keyword, or clear the search box.',
                )
              : `<div class="rvlist${cs.anim ? ' anim' : ''}">${l
                    .slice(0, cs.shown)
                    .map((r, k) => card(r, cs.anim ? Math.min(k, PAGE) : undefined))
                    .join(
                        '',
                    )}</div>${l.length > cs.shown ? `<button type="button" class="rvmore" data-rv-more>Load More <span>(${l.length - cs.shown} more)</span></button>` : ''}`;
        cs.anim = false;
    }
    function scrollToReviews() {
        const s = document.getElementById('reviews');
        if (s) s.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block: 'start' });
    }

    /* ---------- Review form (leave a review / edit a review) ---------- */
    function openForm(bid, rid) {
        const u = A.user(),
            b = bk(bid),
            r = rid ? all().find((x) => x.id === rid) : null;
        try {
            if (!u || !b || b.email !== u.email) throw Error('Booking not found on this account.');
            if (r) {
                own(rid);
            } else {
                const w = why(b);
                if (w) throw Error(w);
                if (reviewOf(bid)) throw Error('You have already reviewed this booking.');
            }
        } catch (x) {
            return A.toast(x.message, 'err');
        }
        const c = carFor(b) || { mk: '', n: b.title, c: '#222' },
            st = {
                ratings: r ? Object.assign({}, r.ratings) : {},
                recommend: r ? r.recommend : null,
            };
        mState = { type: 'form' };
        openLayer(`<form class="rvm rvform" role="dialog" aria-modal="true" aria-labelledby="rvm-t" novalidate>
   <header><div><small>${r ? 'Edit your review' : 'Share your experience'}</small><h2 id="rvm-t">${r ? 'Edit Review' : 'Leave a Review'}</h2></div><button type="button" class="rvx" aria-label="Close">&times;</button></header>
   <div class="rvm-body"><div class="rvveh"><div class="rvveh-img"><em>${E(String(c.mk).split('-')[0])}</em>${typeof bookingImg === 'function' ? bookingImg(c) : ''}</div>
    <div class="rvveh-info"><h3>${E(b.title)}</h3><dl><div><dt>Booking ID</dt><dd>${E(b.id)}</dd></div><div><dt>Rental Dates</dt><dd>${E(b.from)} &rarr; ${E(b.to)}</dd></div></dl><span class="rvver">${ICON.check} Verified Rental</span></div></div>
    ${CATS.map(([k, l]) => `<div class="rvq"><span class="rvql" id="rvl-${k}">${l}</span><div class="rvin" role="radiogroup" aria-labelledby="rvl-${k}" data-cat="${k}">${[1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" aria-checked="false" aria-label="${n} star${n > 1 ? 's' : ''}: ${WORDS[n]}" data-v="${n}">&#9733;</button>`).join('')}<span class="rvin-t" aria-live="polite"></span></div></div>`).join('')}
    <div class="rvq col"><label class="rvql" for="rv-text">Your comments <small>(optional)</small></label><textarea id="rv-text" maxlength="${MAX}" rows="4" placeholder="Tell other renters about the car, the pickup and the return...">${r ? E(r.comment) : ''}</textarea><div class="rvcc"><span id="rv-cc">0 / ${MAX}</span></div></div>
    <fieldset class="rvrecs"><legend class="rvql">Do you recommend this vehicle?</legend>
     <label class="rvopt"><input type="radio" name="rec" value="yes"${r && r.recommend ? ' checked' : ''}><span>Yes, I recommend this vehicle</span></label>
     <label class="rvopt"><input type="radio" name="rec" value="no"${r && !r.recommend ? ' checked' : ''}><span>No, I do not recommend this vehicle</span></label></fieldset>
    <p class="rverr" id="rv-err" role="alert"></p></div>
   <footer class="rvm-act"><button type="button" class="btn rvcancel">Cancel</button><button type="submit" class="btn red">${r ? 'Save Changes' : 'Submit Review'}</button></footer></form>`);
        const f = layer.querySelector('form');
        /* star pickers */
        f.querySelectorAll('.rvin').forEach((g) => {
            const k = g.dataset.cat,
                bs = [...g.querySelectorAll('button')],
                tip = g.querySelector('.rvin-t');
            const paint = (v) => bs.forEach((x, n) => x.classList.toggle('on', n < v));
            const set = (v) => {
                st.ratings[k] = v;
                bs.forEach((x, n) => {
                    x.setAttribute('aria-checked', String(n + 1 === v));
                    x.tabIndex = n + 1 === v || (!v && n === 0) ? 0 : -1;
                });
                paint(v);
                tip.textContent = v ? WORDS[v] : '';
            };
            g.addEventListener('click', (e) => {
                const x = e.target.closest('button');
                if (x) set(+x.dataset.v);
            });
            g.addEventListener('mouseover', (e) => {
                const x = e.target.closest('button');
                if (x) {
                    paint(+x.dataset.v);
                    tip.textContent = WORDS[+x.dataset.v];
                }
            });
            g.addEventListener('mouseleave', () => {
                paint(st.ratings[k] || 0);
                tip.textContent = st.ratings[k] ? WORDS[st.ratings[k]] : '';
            });
            g.addEventListener('keydown', (e) => {
                const cur = st.ratings[k] || 0,
                    d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
                if (!d) return;
                e.preventDefault();
                const v = Math.max(1, Math.min(5, cur + d));
                set(v);
                bs[v - 1].focus();
            });
            set(st.ratings[k] || 0);
        });
        const first = f.querySelector('.rvin button[tabindex="0"]');
        if (first) first.focus({ preventScroll: true });
        const ta = f.querySelector('#rv-text'),
            cc = f.querySelector('#rv-cc'),
            count = () => {
                cc.textContent = ta.value.length + ' / ' + MAX;
                cc.classList.toggle('warn', ta.value.length >= MAX - 20);
            };
        ta.addEventListener('input', count);
        count();
        f.querySelectorAll('input[name="rec"]').forEach((x) =>
            x.addEventListener('change', () => {
                st.recommend = x.value === 'yes';
            }),
        );
        f.querySelector('.rvcancel').addEventListener('click', close);
        f.addEventListener('submit', (e) => {
            e.preventDefault();
            const err = f.querySelector('#rv-err'),
                go = f.querySelector('[type="submit"]');
            err.textContent = '';
            try {
                const d = { ratings: st.ratings, comment: ta.value, recommend: st.recommend };
                go.disabled = true;
                if (r) update(rid, d);
                else submit(bid, d);
                close();
                A.toast(
                    r ? 'Your review was updated.' : 'Thank you! Your review has been published.',
                );
            } catch (x) {
                err.textContent = x.message;
                go.disabled = false;
            }
        });
    }

    /* ---------- Customer dashboard: banner, tab, booking history button, My Reviews ---------- */
    const pendingLine = (b) =>
        `<div class="rvpend"><div><b>${E(b.title)}</b><small>${E(b.id)} &middot; ${E(b.from)} &rarr; ${E(b.to)}</small></div><button type="button" class="act red" data-rv-leave="${E(b.id)}">Leave Review</button></div>`;
    function banner(email) {
        const a = awaiting(email);
        if (!a.length) return '';
        return `<div class="rvbanner" role="status"><div class="rvbanner-i">${ICON.star}</div><div class="rvbanner-t"><b>Your rental has been completed successfully.</b><p>Share your experience by leaving a review.${a.length > 1 ? ` You have ${plural(a.length, 'rental')} waiting for a review.` : ''}</p></div>
   <button type="button" class="btn red" data-rv-leave="${E(a[0].id)}">Review ${E(a.length > 1 ? 'latest rental' : a[0].title)}</button></div>`;
    }
    function tab(selected, email) {
        const n = awaiting(email).length,
            total = mineList(email).length;
        return `<button type="button" role="tab" data-dtab="reviews" aria-selected="${selected}">${ICON.star} My Reviews${n ? ` <span class="cnt" title="${plural(n, 'rental')} awaiting your review">${n}</span>` : total ? ` <span class="cnt cnt-quiet">${total}</span>` : ''}</button>`;
    }
    function histBtn(b) {
        const r = reviewOf(b.id);
        if (r)
            return `<button type="button" class="act rv-done" disabled aria-label="Review submitted">Review Submitted &#10003;</button>`;
        return eligible(b)
            ? `<button type="button" class="act red rv-leave" data-rv-leave="${E(b.id)}">Leave Review</button>`
            : '';
    }
    function mineCard(r) {
        const b = bk(r.bookingId),
            c = (b && carFor(b)) || { mk: '', n: r.vehicleName, c: '#222' },
            t = r.ratings,
            ed = canEdit(r);
        return `<article class="rvcard rvmine${r.status === 'hidden' ? ' hid' : ''}"><div class="rvmine-img"><em>${E(String(c.mk).split('-')[0])}</em>${typeof bookingImg === 'function' ? bookingImg(c) : ''}</div>
   <div class="rvmine-b"><div class="rvmine-top"><div><small>${E(c.mk)}</small><h3>${E(r.vehicleName)}</h3></div><span class="rvver">${ICON.check} Verified Rental</span></div>
   <div class="rvmeta"><span>Booking ID <b>${E(r.bookingId)}</b></span><span>Reviewed <b>${fmt(r.createdAt)}</b>${r.editedAt ? ' (edited)' : ''}</span><span>Rental completed <b>${fmt(r.completedAt)}</b></span></div>
   <div class="rvrow">${stars(t.overall)}<b>${t.overall}.0</b>${r.recommend ? `<span class="rvyes">${ICON.thumb} Recommended</span>` : `<span class="rvno">Not recommended</span>`}</div>
   <ul class="rvgrid">${CATS.slice(1)
       .map(([k, l]) => `<li><span>${l.replace('Vehicle ', '')}</span>${stars(t[k], 'sm')}</li>`)
       .join('')}</ul>
   ${r.comment ? `<p class="rvtxt">&ldquo;${E(r.comment)}&rdquo;</p>` : `<p class="rvtxt dim">No written comment.</p>`}
   ${r.status === 'hidden' ? `<p class="rvnote">This review is currently hidden from other customers by AZoom moderation.</p>` : ''}
   <div class="rvfoot">${
       ed
           ? `<span class="rvwin">Editable until ${fmt(editUntil(r))}</span><div class="acts"><button type="button" class="act" data-rv-edit="${E(r.id)}">Edit Review</button><button type="button" class="act warn" data-rv-del="${E(r.id)}">Delete Review</button></div>`
           : `<span class="rvlock">${ICON.lock} Read-only &middot; the ${EDIT_DAYS}-day edit window has ended</span>`
   }</div></div></article>`;
    }
    function mine(email) {
        const a = awaiting(email),
            l = mineList(email);
        return (
            `<h2 class="sec">My Reviews</h2><p class="hint" style="margin:-6px 0 16px">Only completed and returned rentals can be reviewed, one review per booking. You can edit or delete a review within ${EDIT_DAYS} days.</p>` +
            (a.length
                ? `<div class="rvawait"><h3>Awaiting your review <span class="cnt">${a.length}</span></h3>${a.map(pendingLine).join('')}</div>`
                : '') +
            (l.length
                ? l.map(mineCard).join('')
                : `<div class="empty2">${ICON.star.replace('width="16" height="16"', 'width="36" height="36"')}<h3>No reviews yet</h3><p>${a.length ? 'Your completed rentals are waiting above.' : 'After a rental is returned and inspected you can review it here.'}</p></div>`)
        );
    }

    /* ---------- Notifications ---------- */
    function toastLeave(msg, bid) {
        const d = document.createElement('div');
        d.className = 'toast rvtoast';
        d.setAttribute('role', 'status');
        d.innerHTML = `<p>${E(msg)}</p><button type="button" class="act red" data-rv-leave="${E(bid)}">Leave Review</button>`;
        document.body.append(d);
        setTimeout(() => d.remove(), 12000);
    }
    function navDot() {
        document.querySelectorAll('.rvdot').forEach((x) => x.remove());
        const u = A.user();
        if (!u) return;
        const n = awaiting(u.email).length;
        if (!n) return;
        document
            .querySelectorAll(
                '.navpill[href="../dashboard/dashboard.html"],.mm-item[href="../dashboard/dashboard.html"]',
            )
            .forEach((a) =>
                a.insertAdjacentHTML(
                    'beforeend',
                    `<span class="rvdot" title="${plural(n, 'rental')} awaiting your review">${n}</span>`,
                ),
            );
    }
    /* After the employee finishes a return inspection, tell the customer once per booking (on the dashboard) */
    function check() {
        const u = A.user();
        if (!u) return;
        navDot();
        if (page !== 'dashboard') return;
        const seen = new Set(rd(NKEY, [])),
            fresh = awaiting(u.email).filter((b) => !seen.has(b.id));
        if (!fresh.length) return;
        wr(NKEY, [...seen, ...fresh.map((b) => b.id)]);
        toastLeave(
            fresh.length > 1
                ? `Your rentals have been completed successfully. Share your experience by leaving a review. (${fresh.length} waiting)`
                : 'Your rental has been completed successfully. Share your experience by leaving a review.',
            fresh[0].id,
        );
    }

    /* ---------- Employee portal: Review Management ---------- */
    const es = { q: '', veh: '', rate: '', from: '', to: '', st: '', open: {} };
    function empFiltered() {
        const q = es.q.trim().toLowerCase();
        return all()
            .filter((r) => {
                if (es.veh && r.vehicleId !== es.veh) return false;
                if (es.rate && r.ratings.overall !== +es.rate) return false;
                const d = ymd(r.createdAt);
                if (es.from && d < es.from) return false;
                if (es.to && d > es.to) return false;
                if (es.st === 'visible' && r.status === 'hidden') return false;
                if (es.st === 'hidden' && r.status !== 'hidden') return false;
                if (es.st === 'flagged' && !r.flagged) return false;
                if (
                    q &&
                    !(
                        r.customerName +
                        ' ' +
                        r.customerEmail +
                        ' ' +
                        r.vehicleName +
                        ' ' +
                        r.bookingId +
                        ' ' +
                        r.id +
                        ' ' +
                        (r.comment || '')
                    )
                        .toLowerCase()
                        .includes(q)
                )
                    return false;
                return true;
            })
            .sort((a, b) => b.createdAt - a.createdAt);
    }
    function empCard(r) {
        const b = bk(r.bookingId),
            open = !!es.open[r.id],
            last = (r.log || []).slice(-1)[0],
            g = (l, v) => `<div><dt>${l}</dt><dd>${v}</dd></div>`;
        const chips = `<div class="rvchips"><span class="rvchip ${r.status === 'hidden' ? 'bad' : 'ok'}">${r.status === 'hidden' ? 'Hidden' : 'Visible'}</span>${r.flagged ? `<span class="rvchip warn">Under moderation</span>` : ''}<span class="rvchip">${CATS.slice(
            3,
        )
            .map(([k, l]) => l.split(' ')[0] + ' ' + r.ratings[k] + '/5')
            .join(' &middot; ')}</span></div>`;
        const who = `<div class="rvwhobox"><b>Reviewer</b><dl>${g('Name', E(r.customerName)) + g('Email', E(r.customerEmail)) + g('Customer ID', E(A.uid(r.customerEmail))) + g('Review ID', E(r.id))}</dl></div>`;
        const det = open
            ? `<div class="rvwhobox"><b>Booking details</b>${b ? `<dl>${g('Booking ID', E(b.id)) + g('Status', E(typeof Refunds !== 'undefined' ? Refunds.statusLabel(b) : A.LABEL[b.status] || b.status)) + g('Vehicle', E(b.title)) + g('Rental dates', E(b.from) + ' &rarr; ' + E(b.to)) + g('Pick-up', E(Branches.label(b.pickup || '-'))) + g('Return', E(Branches.label(b.ret || '-'))) + g('Total rental', A.money(b.total || 0)) + g('Inspection', E(b.inspectionResult || 'Completed')) + g('Rental completed', fmt(r.completedAt))}</dl>` : `<p class="hint">The booking record is no longer available (account deleted). Booking ID ${E(r.bookingId)}, rental ${E(r.rentalFrom || '-')} &rarr; ${E(r.rentalTo || '-')}.</p>`}</div>`
            : '';
        const acts =
            `<div class="acts rvmodacts"><button type="button" class="act${open ? ' on' : ''}" data-rv-bkview="${E(r.id)}">${open ? 'Hide' : 'View'} Booking Details</button>` +
            (r.status === 'hidden'
                ? `<button type="button" class="act red" data-rv-mod="${E(r.id)}|restore">Restore Review</button>`
                : `<button type="button" class="act warn" data-rv-mod="${E(r.id)}|hide">Hide Review</button>`) +
            (r.flagged
                ? `<button type="button" class="act" data-rv-mod="${E(r.id)}|unflag">Clear Moderation Flag</button>`
                : `<button type="button" class="act" data-rv-mod="${E(r.id)}|flag">Mark for Moderation</button>`) +
            `</div>`;
        return card(
            r,
            undefined,
            `<div class="rvemp">${chips}${who}${det}${last ? `<p class="rvlog">Last action: ${E(last.action)} by ${E(last.byName)} on ${fmt(last.at)}</p>` : ''}${acts}</div>`,
        );
    }
    function empList() {
        const l = empFiltered(),
            tot = all().length,
            a = all();
        const k = [
            ['Total reviews', tot],
            ['Visible', a.filter((r) => r.status !== 'hidden').length],
            ['Hidden', a.filter((r) => r.status === 'hidden').length],
            ['Under moderation', a.filter((r) => r.flagged).length],
        ];
        return (
            `<div class="rvkpis">${k.map(([t, v]) => `<div><b>${v}</b><span>${t}</span></div>`).join('')}</div>` +
            (l.length
                ? `<p class="rvcount">Showing ${plural(l.length, 'review')}</p><div class="rvlist emp">${l.map(empCard).join('')}</div>`
                : emptyBox(
                      tot ? 'No reviews match these filters' : 'No reviews yet',
                      tot
                          ? 'Clear or change a filter above.'
                          : 'Customer reviews appear here after completed rentals are reviewed.',
                  ))
        );
    }
    function employeeHtml() {
        const veh = [...new Map(all().map((r) => [r.vehicleId, r.vehicleName])).entries()].sort(
            (x, y) => x[1].localeCompare(y[1]),
        );
        return `<h2 class="sec">Review Management</h2><p class="hint" style="margin:-6px 0 16px">Employees can hide, restore or flag reviews. Ratings and comments can never be changed by staff. Hidden reviews stop counting towards the vehicle's rating.</p>
   <div class="rvfilters"><label class="srch rvq-s">${A.ic('search', 18)}<span class="sr">Search reviews</span><input id="rvq" data-rvf="q" type="search" value="${E(es.q)}" placeholder="Search reviewer, email, vehicle, booking ID or comment..." autocomplete="off"></label>
   <label><span>Vehicle</span><select data-rvf="veh"><option value="">All vehicles</option>${veh.map(([id, n]) => `<option value="${E(id)}"${es.veh === id ? ' selected' : ''}>${E(n)}</option>`).join('')}</select></label>
   <label><span>Rating</span><select data-rvf="rate"><option value="">All ratings</option>${[5, 4, 3, 2, 1].map((n) => `<option value="${n}"${es.rate == n ? ' selected' : ''}>${n} star${n > 1 ? 's' : ''}</option>`).join('')}</select></label>
   <label><span>Status</span><select data-rvf="st"><option value="">All</option><option value="visible"${es.st === 'visible' ? ' selected' : ''}>Visible</option><option value="hidden"${es.st === 'hidden' ? ' selected' : ''}>Hidden</option><option value="flagged"${es.st === 'flagged' ? ' selected' : ''}>Under moderation</option></select></label>
   <label><span>From</span><input type="date" data-rvf="from" value="${E(es.from)}"></label><label><span>To</span><input type="date" data-rvf="to" value="${E(es.to)}"></label>
   <button type="button" class="act" data-rv-clear>Clear filters</button></div><div id="rvemp">${empList()}</div>`;
    }
    const empRedraw = () => {
        const h = $('#rvemp');
        if (h) h.innerHTML = empList();
    };
    function bindEmployee(root) {
        if (root._rvb) return;
        root._rvb = true;
        const on = (e) => {
            const f = e.target.dataset && e.target.dataset.rvf;
            if (!f) return;
            es[f] = e.target.value;
            empRedraw();
        };
        root.addEventListener('input', on);
        root.addEventListener('change', on);
    }

    /* ---------- Global clicks (capture phase, so the dashboards' own handlers never see these buttons) ---------- */
    document.addEventListener(
        'click',
        (e) => {
            const x = e.target.closest('.rvx');
            if (x && layer && layer.contains(x)) {
                e.stopPropagation();
                e.preventDefault();
                close(); /* the X button in the top-right corner */
                return;
            }
            const t = e.target.closest(
                '[data-rv-open],[data-rv-leave],[data-rv-edit],[data-rv-del],[data-rv-scroll],[data-rv-mod],[data-rv-bkview],[data-rv-modal-more],[data-rv-more],[data-rv-clear]',
            );
            if (!t) return;
            e.stopPropagation();
            e.preventDefault();
            const g = (n) => t.getAttribute(n);
            try {
                if (t.hasAttribute('data-rv-open')) {
                    const i = resolveCar(t);
                    if (i >= 0) openList(i);
                }
                else if (t.hasAttribute('data-rv-leave')) {
                    document.querySelectorAll('.rvtoast').forEach((x) => x.remove());
                    openForm(g('data-rv-leave'));
                } else if (t.hasAttribute('data-rv-edit')) {
                    const r = all().find((x) => x.id === g('data-rv-edit'));
                    if (r) openForm(r.bookingId, r.id);
                } else if (t.hasAttribute('data-rv-del')) {
                    const id = g('data-rv-del');
                    own(id);
                    if (confirm("Delete this review? This can't be undone.")) {
                        remove(id);
                        A.toast('Your review was deleted.');
                    }
                } else if (t.hasAttribute('data-rv-scroll')) scrollToReviews();
                else if (t.hasAttribute('data-rv-modal-more')) {
                    mState.shown += PAGE;
                    renderList();
                } else if (t.hasAttribute('data-rv-more')) {
                    cs.shown += PAGE;
                    cs.anim = false;
                    renderCar();
                } else if (t.hasAttribute('data-rv-bkview')) {
                    const id = g('data-rv-bkview');
                    es.open[id] = !es.open[id];
                    empRedraw();
                } else if (t.hasAttribute('data-rv-clear')) {
                    Object.assign(es, { q: '', veh: '', rate: '', from: '', to: '', st: '' });
                    const p = $('#pane');
                    if (p) p.innerHTML = employeeHtml();
                } else if (t.hasAttribute('data-rv-mod')) {
                    const [id, action] = g('data-rv-mod').split('|'),
                        u = A.user();
                    if (
                        action === 'hide' &&
                        !confirm(
                            "Hide this review from customers? It will stop counting towards the vehicle's rating. You can restore it later.",
                        )
                    )
                        return;
                    moderate(id, action, u && u.email);
                    A.toast(MODS[action] + '.');
                }
            } catch (x) {
                A.toast(x.message, 'err');
            }
        },
        true,
    );

    /* ---------- Keep every screen in step (same tab: custom event, other tabs: storage event) ---------- */
    function refresh() {
        document.querySelectorAll('[data-rv-badge]').forEach((el) => {
            const i = +el.dataset.rvBadge;
            if (!CARS[i]) return;
            el.innerHTML = badgeInner(i);
            el.setAttribute('aria-label', badgeLabel(i));
        });
        document.querySelectorAll('[data-rv-rating]').forEach((el) => {
            const i = +el.dataset.rvRating;
            if (CARS[i]) el.innerHTML = ratingRow(i);
        });
        renderCar();
        renderList();
        navDot();
    }
    addEventListener('azreviews', refresh);
    addEventListener('storage', (e) => {
        if (e.key === KEY)
            emit(); /* another tab changed reviews: same signal as a change made here, so dashboards redraw too */
        else if (e.key === A.K.b || e.key === A.K.i) {
            refresh();
            check();
        }
    });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) check();
    });
    setInterval(check, 60000);
    document.addEventListener('DOMContentLoaded', () =>
        CarsData.ready.then(
            () =>
                setTimeout(() => {
                    refresh();
                    check();
                }, 0),
            () => {},
        ),
    );

    //public API
    return {
        badge,
        btn,
        score,
        stats,
        mountCar,
        tab,
        banner,
        mine,
        histBtn,
        employeeHtml,
        bindEmployee,
        awaiting,
        eligible,
        submit,
        update,
        remove,
        moderate,
        all,
        refresh,
        open: openList,
        KEY,
    };
})();
