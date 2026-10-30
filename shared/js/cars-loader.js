/* Loads the fleet from data/cars.json (replaces the old cars-data.js) and keeps the small car helpers used by every page.
   Load this script BEFORE any other script that uses cars. It does not wait for the data itself: scripts that use CARS must run inside

       CarsData.ready.then(() => { ... });

   CARS is the same array object for the whole session. It starts empty and is filled in place once data/cars.json has loaded, so
   shared scripts that only read CARS inside functions (fees.js, history.js, ...) keep working unchanged.

   data/cars.json is a plain array. Each car is an object with these fields (one car per line):
     t  category (SPORTS | LUXURY)        r  sample rating text, e.g. "4.9"      mk brand           n  model
     ty body type                         hp horsepower                          s  seats           tr transmission (Auto | Manual)
     f  fuel (Petrol | Hybrid | Electric | Diesel)                               p  price in S$ per day
     z  0-100 km/h seconds                v  top speed km/h                      c  placeholder background colour
     img photo path (a .svg with the same name is tried if the .jpg is missing)  ft features (list)
     d  description (optional)            oid permanent number used for plates and CAR codes: never change it or reuse it
   Keep the first 12 cars where they are (the home page shows the first 6 and saved bookings point at list positions).
   Add new cars at the END with the next unused "oid" (current highest oid + 1). Chevrolet, Corvette and Dodge (left-hand-drive) were removed
   for the Singapore market: do not add LHD-only brands back. All figures are sample content: please verify before launch.

   NOTE: browsers block fetch() of local files, so open the site through a local web server (see HOW-TO-RUN.txt), not by double-clicking. */
const CARS = [];
const CAR_ASSET_BASE = document.currentScript ? document.currentScript.src : location.href;
const CAR_FALLBACK_IMG = new URL(
    '../../images/cars/car-placeholder.svg',
    CAR_ASSET_BASE,
).href; /* shown on booking cards only when a car's own photo cannot be found */
const CarsData = (() => {
    const base = document.currentScript ? document.currentScript.src : location.href,
        url = new URL('../../data/cars.json', base).href;
    const showError = (err) => {
        const msg =
            location.protocol === 'file:'
                ? 'This page cannot read data/cars.json when it is opened as a file. Start a local web server in the AZoom folder (for example: python3 -m http.server 8000) and open http://localhost:8000/ instead. See HOW-TO-RUN.txt.'
                : 'The car list (data/cars.json) could not be loaded. Please refresh the page or try again later.';
        const show = () => {
            const box = document.createElement('div');
            box.setAttribute('role', 'alert');
            box.style.cssText =
                'position:fixed;left:0;right:0;top:0;z-index:99999;padding:14px 18px;background:#7a1020;color:#fff;font:600 15px/1.4 system-ui,sans-serif;text-align:center';
            box.textContent = msg;
            document.body.appendChild(box);
        };
        if (document.body) show();
        else document.addEventListener('DOMContentLoaded', show);
        console.error('Could not load ' + url, err);
    };
    const ready = fetch(url, { cache: 'no-cache' })
        .then((r) => {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        })
        .then((list) => {
            if (!Array.isArray(list)) throw new Error('cars.json must be an array');
            CARS.length = 0;
            CARS.push(...list);
            repairSavedBookings();
            return CARS;
        });
    ready.catch(
        showError,
    ); /* pages that use CarsData.ready.then(...) simply never run when the data is missing */
    //public API
    return {
        ready: ready,
        url: url,
    };
})();

/* Models whose name changed: old title -> current title (used to keep saved bookings / reviews pointing at the right car) */
const RENAMED_TITLES = {
    'Mercedes-Benz AMG C 63 S Edition 1 V8 Biturbo (W205)':
        'Mercedes-Benz AMG C 63 S Edition 1 V8 Biturbo (C205)',
};
const carKey = (c) => c.mk + ' ' + c.n; /* used in ../car/car.html?model=... */

/* Photos: put files in ../../images/cars/ named like ../../images/cars/ferrari-roma.jpg (full list: ../../images/cars/README.txt).
   The photo path of each car is stored in data/cars.json ("img"). A car without a photo automatically keeps the dark placeholder. */
const slug = (s) =>
    s
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
const carPhotoUrl = (c) => (c.img ? new URL(c.img, CAR_ASSET_BASE).href : '');
const carImg = (c) =>
    c.img ? `<img data-car src="${carPhotoUrl(c)}" alt="${c.mk} ${c.n}" loading="lazy">` : '';

/* Finds the car of a booking (or any record that names a car) in CARS, using the first value that matches:
   carId (list position, accepted only when it still points at the car named by the booking), vehicleId / CAR code (e.g. CAR012),
   slug, then the model / title text. Returns the CARS index or -1. One lookup shared by every page that shows a booking. */
const carIndexOf = (b) => {
    if (!b || !CARS.length) return -1;
    const sl = (v) => slug(String(v == null ? '' : v)),
        named = [b.title, b.vehicleName, b.model, b.name].filter((v) => typeof v === 'string' && v),
        keys = named.map(sl);
    const fileOf = (c) => sl(String(c.img || '').replace(/^.*\//, '').replace(/\.\w+$/, ''));
    const id = b.carId != null ? b.carId : b.vehicleId != null ? b.vehicleId : b.carID;
    if (typeof id === 'number' || (typeof id === 'string' && /^\d+$/.test(id))) {
        const c = CARS[Number(id)];
        if (c && (!keys.length || keys.includes(sl(carKey(c))) || keys.includes(sl(c.n)))) return Number(id);
    }
    for (const v of [b.vehicleId, b.carId, b.carCode]) {
        const m = /^CAR0*(\d+)$/i.exec(String(v || ''));
        if (m) {
            const i = CARS.findIndex((c) => c.oid === Number(m[1]) - 1);
            if (i >= 0) return i;
        }
    }
    const tokens = [b.slug, b.carSlug, ...(typeof id === 'string' ? [id] : []), ...named].map(sl).filter(Boolean);
    for (const t of tokens) {
        let i = CARS.findIndex((c) => sl(carKey(c)) === t || fileOf(c) === t);
        if (i < 0) {
            const hits = CARS.map((c, n) => (sl(c.n) === t ? n : -1)).filter((n) => n >= 0);
            if (hits.length === 1) i = hits[0];
        }
        if (i >= 0) return i;
    }
    return typeof id === 'number' && CARS[id] ? id : -1;
};
const carFor = (b) => CARS[carIndexOf(b)] || null;
/* Car record for a booking card: the real car when found, otherwise a plain stand-in that still names the booked vehicle */
const carOf = (b) => carFor(b) || { mk: '', n: (b && (b.title || b.vehicleName)) || '', c: '#222', img: '' };
/* Photo for a booking card: the car's own photo (cars.json "img"; .svg tried if the .jpg is missing), and the fallback image only if neither exists */
const bookingImg = (c) => {
    const alt = (c.mk + ' ' + c.n).trim();
    return c.img
        ? `<img data-car data-fallback src="${carPhotoUrl(c)}" alt="${alt}" loading="lazy">`
        : `<img data-car data-fallback src="${CAR_FALLBACK_IMG}" alt="${alt}" loading="lazy">`;
};
document.addEventListener(
    'error',
    (e) => {
        const t = e.target;
        if (t.tagName !== 'IMG' || !t.hasAttribute('data-car')) return;
        if (/\.jpg$/.test(t.src) && !t.dataset.tried) {
            t.dataset.tried = 1;
            t.src = t.getAttribute('src').replace(/\.jpg$/, '.svg');
        } else if (t.hasAttribute('data-fallback') && t.src !== CAR_FALLBACK_IMG) {
            console.warn('Car photo not found, using fallback image:', t.getAttribute('src'));
            t.src = CAR_FALLBACK_IMG;
        } else t.remove();
    },
    true,
);

/* Sample registration number for each car (Singapore style, e.g. SKD 4821 M). Made from the car's "oid" in cars.json,
   so it never changes. Replace with the real plates when you have them. */
const carReg = (i) => {
    i = CARS[i] ? CARS[i].oid : i;
    const L = 'ABCDEFGHJKLMNPRSTUVXYZ',
        h = (n) => (i * 2654435761 + n * 40503) >>> 0;
    return (
        'S' +
        L[h(1) % L.length] +
        L[h(2) % L.length] +
        ' ' +
        String(1000 + (h(3) % 9000)) +
        ' ' +
        L[h(4) % L.length]
    );
};

/* Car ID used in inspection reports, e.g. CAR001. Made from the car's "oid" in cars.json, so it never changes. */
const carCode = (i) => 'CAR' + String((CARS[i] ? CARS[i].oid : Number(i)) + 1).padStart(3, '0');

/* One-time clean-up of data saved by older versions (positions moved when LHD brands were removed).
   1) bookings are re-pointed to the same car by its title; 2) bookings of removed brands or of cars that are no longer in data/cars.json are taken out of the app (a copy is kept
   under "az_removed_fleet_backup" in this browser); 3) a stale comparison list is cleared. Safe to run again.
   Runs once the car list has loaded. */
function repairSavedBookings() {
    try {
        const rd = (k) => {
                try {
                    return JSON.parse(localStorage.getItem(k));
                } catch (e) {
                    return null;
                }
            },
            wr = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        const rv = rd('az_reviews');
        if (Array.isArray(rv)) {
            /* reviews of cars that are no longer in data/cars.json (their CAR code is no longer in use) */
            const live = new Set(CARS.map((c) => 'CAR' + String(c.oid + 1).padStart(3, '0')));
            const rvKeep = rv.filter(
                (r) => !(r && /^CAR\d+$/.test(r.vehicleId) && !live.has(r.vehicleId)),
            );
            let rvChanged = rvKeep.length !== rv.length;
            rvKeep.forEach((r) => {
                if (r && RENAMED_TITLES[r.vehicleName]) {
                    r.vehicleName = RENAMED_TITLES[r.vehicleName];
                    rvChanged = true;
                }
            });
            if (rvChanged) wr('az_reviews', rvKeep);
        }
        const bk = rd('az_bookings');
        if (!Array.isArray(bk) || !bk.length) return;
        const idx = new Map(CARS.map((c, i) => [carKey(c), i])),
            LHD =
                /^(Chevrolet|Corvette|Dodge)\b|^Ford (GT|Ford GT \(2005\)|Ford GT Mk II|Ford GT Liquid Carbon|Taurus SHO|Explorer ST|Bronco Raptor|Edge ST)$/;
        let changed = false;
        const drop = [],
            keep = [];
        bk.forEach((b) => {
            if (RENAMED_TITLES[b.title]) {
                b.title = RENAMED_TITLES[b.title];
                changed = true;
            }
            const t = b.title || '';
            if (LHD.test(t) || !idx.has(t)) {
                drop.push(b);
                changed = true;
                return;
            }
            if (idx.has(t) && b.carId !== idx.get(t)) {
                b.carId = idx.get(t);
                changed = true;
            }
            keep.push(b);
        });
        if (!changed) return;
        if (drop.length) {
            const ids = new Set(drop.map((b) => b.id)),
                pick = (k) => (rd(k) || []).filter((x) => ids.has(x.bookingId));
            const old = rd('az_removed_fleet_backup') || {
                bookings: [],
                inspections: [],
                fees: [],
                refunds: [],
            };
            old.bookings.push(...drop);
            old.inspections.push(...pick('az_inspections'));
            old.fees.push(...pick('az_fees'));
            old.refunds.push(...pick('az_refunds'));
            wr('az_removed_fleet_backup', old);
            ['az_inspections', 'az_fees', 'az_refunds'].forEach((k) => {
                const a = rd(k);
                if (Array.isArray(a))
                    wr(
                        k,
                        a.filter((x) => !ids.has(x.bookingId)),
                    );
            });
        }
        wr('az_bookings', keep);
        sessionStorage.removeItem('veloce_compare');
    } catch (e) {}
}
