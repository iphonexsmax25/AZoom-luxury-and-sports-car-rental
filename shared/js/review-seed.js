/* Preloaded sample reviews (localStorage only, no backend).
   Adds the records from data/seed-reviews.json to "az_reviews" so every vehicle already has a believable rental history.
   Load this script BEFORE reviews.js (it only needs the browser, not CARS or Auth).

   - It only ADDS records. Existing reviews (real ones written in this browser, moderated ones, edited ones) are never changed or removed.
   - It runs once per browser: after that it only checks a small flag and exits. It tops up any missing sample review if the list is cleared.
   - Each sample review uses the same fields as a review saved by reviews.js (vehicleId = the CAR code, verified, visible, 5 category ratings),
     so the average rating and review count on every card, badge and review pop-up are calculated from this data by reviews.js itself.
   - Sample reviews belong to made-up customers (@example.com) and are not linked to real booking records.
   To change the sample data, edit data/seed-reviews.json and raise SEED_VERSION below so browsers pick up the change. */
(() => {
    const KEY = 'az_reviews',
        FLAG = 'az_review_seed',
        SEED_VERSION = 'v2',
        FIRST_ID = 'RV-S-CAR001-1';
    try {
        const raw = localStorage.getItem(KEY) || '[]';
        if (localStorage.getItem(FLAG) === SEED_VERSION && raw.indexOf('"' + FIRST_ID + '"') >= 0)
            return;
        let list;
        try {
            list = JSON.parse(raw);
        } catch (e) {
            return; /* stored reviews are unreadable: leave them alone */
        }
        if (!Array.isArray(list)) return;

        const base = document.currentScript ? document.currentScript.src : location.href,
            xhr = new XMLHttpRequest();
        xhr.open('GET', new URL('../../data/seed-reviews.json', base).href, false); /* one-time synchronous read so reviews.js sees the data on first load */
        xhr.send();
        if (xhr.status !== 200 && !(xhr.status === 0 && xhr.responseText)) return;
        const data = JSON.parse(xhr.responseText);
        if (!Array.isArray(data)) return;

        const have = new Set(list.map((r) => r && r.id)),
            add = [];
        data.forEach((car) =>
            car.r.forEach((s) => {
                if (have.has(s.id)) return;
                add.push({
                    id: s.id,
                    bookingId: s.b,
                    vehicleId: car.v,
                    vehicleName: car.n,
                    customerEmail: s.em,
                    customerName: s.nm,
                    ratings: {
                        overall: s.o,
                        condition: s.cd,
                        cleanliness: s.cl,
                        pickup: s.pk,
                        ret: s.rt,
                    },
                    comment: s.c,
                    recommend: s.rec,
                    verified: true,
                    rentalFrom: s.f,
                    rentalTo: s.t,
                    completedAt: s.ce,
                    createdAt: s.cr,
                    editedAt: null,
                    status: 'visible',
                    flagged: false,
                    log: [],
                });
            }),
        );
        if (add.length) localStorage.setItem(KEY, JSON.stringify(list.concat(add)));
        localStorage.setItem(FLAG, SEED_VERSION);
    } catch (e) {
        /* storage full / blocked / file missing: the site simply works without the sample reviews */
    }
})();
