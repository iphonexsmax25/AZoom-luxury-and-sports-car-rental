const d1 = document.getElementById('d1'),
    d2 = document.getElementById('d2'),
    dateError = document.getElementById('date-error'),
    findCars = document.getElementById('find-cars'),
    searchForm = document.getElementById('search-form');
let dateNotice = '';
function syncDates() {
    d1.min = BookingDates.tomorrow();
    d2.min = BookingDates.minimumReturn(d1.value);
    const beforeReset = BookingDates.validate(d1.value, d2.value);
    let reset = false;
    if (d2.value && d2.value < d2.min) {
        d2.value = d2.min;
        reset = true;
    }
    if (reset) dateNotice = beforeReset ? beforeReset.message : '';
    const error = BookingDates.validate(d1.value, d2.value);
    findCars.disabled = !!error;
    dateError.textContent = error ? error.message : dateNotice;
}
[d1, d2].forEach((input) => {
    ['input', 'change'].forEach((eventName) =>
        input.addEventListener(eventName, () => {
            dateNotice = '';
            syncDates();
        }),
    );
});
syncDates();
searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const error = BookingDates.validate(d1.value, d2.value);
    if (error) {
        dateError.textContent = error.message;
        findCars.disabled = true;
        return;
    }
    location.href = '../fleet/fleet.html';
});

CarsData.ready.then(() => {
    document.getElementById('loc').innerHTML = Branches.options();
    /* Home page script. Car photos come from images/cars/ (see images/cars/README.txt); place photos from images/places/; hero photo is set in home.css. */
    const cars = CARS.slice(0, 6); // first 6 cars in data/cars.json (loaded by cars-loader.js)
    document.getElementById('cars').innerHTML = cars
        .map(
            (c, i) => `
<article class="card"><div class="pic" style="background:linear-gradient(135deg,${c.c},#0b0b0e)">
 <em>${c.mk.split('-')[0]}</em>${carImg(c)}
 <div class="pic-top"><span class="tag">${c.t}</span>${Reviews.badge(i)}</div>
 </div><div class="pic-btns">${Reviews.btn(i)}<button type="button" class="cmp" data-id="${i}" aria-pressed="${Compare.has(i)}">${Compare.has(i) ? 'Comparing' : 'Compare'}</button></div>
 <div class="body"><small>${c.mk}</small><h3>${c.n}</h3>
 <div class="spec"><div>${c.hp}<span>HP</span></div><div>${c.s}<span>SEATS</span></div><div>${c.tr === 'Auto' ? 'Automatic' : c.tr}<span>TRANS</span></div><div>Petrol<span>FUEL</span></div></div>
 <div class="price"><div><b>S$${c.p.toLocaleString()}</b> <small>/day</small></div><a class="btn" href="../car/car.html?model=${encodeURIComponent(carKey(c))}">View <span class="arr">&rarr;</span></a></div>${RentalDiscounts.cardMarkup(c)}</div></article>`,
        )
        .join('');

    const dests = [
        [
            'Marina Bay',
            'Central',
            'Skyline loop past the Esplanade and Gardens by the Bay',
            '#3a1030,#0b1020',
            'marina-bay',
        ],
        [
            'Sentosa',
            'South',
            'Resort island cruising and beach clubs',
            '#0b3040,#0b0b12',
            'sentosa',
        ],
        [
            'Orchard Road',
            'Central',
            'Shopping belt pick-up, hotels at your door',
            '#3a1a10,#0b0b12',
            'orchard-road',
        ],
        [
            'East Coast Park',
            'East',
            'Sunrise drives along the coast',
            '#2a2a0b,#0b0b12',
            'east-coast-park',
        ],
        [
            'Changi Airport',
            'East',
            'Collect your car straight from arrivals',
            '#10203a,#0b0b12',
            'changi-airport',
        ],
        [
            'Mount Faber',
            'South',
            'Winding hill road with harbour views',
            '#10301a,#0b0b12',
            'mount-faber',
        ],
    ];
    /* Photo for each place: images/places/<last value>.jpg  (a missing file keeps the coloured gradient) */
    document.getElementById('dests').innerHTML = dests
        .map(
            (d) => `
<a class="dest" href="#fleet" style="background:linear-gradient(135deg,${d[3]})"><img src="../../images/places/${d[4]}.jpg" alt="${d[0]}" loading="lazy" onerror="this.remove()"><small>&#9679; ${d[1].toUpperCase()}</small><h3>${d[0]}</h3><p>${d[2]}</p></a>`,
        )
        .join('');

    const revs = [
        [
            'Daniel Tan',
            'Local · Porsche 911 Carrera S',
            5,
            'Booked for my anniversary weekend. Car was spotless and the handover took ten minutes.',
        ],
        [
            'Sarah Mitchell',
            'Visitor from UK · Ferrari Roma',
            5,
            'I was nervous about driving abroad, but the team met me at Changi and explained everything. A dream on the ECP.',
        ],
        [
            'Kenji Tanaka',
            'Visitor from Japan · Lamborghini Huracán',
            5,
            'Bucket-list drive across Marina Bay at night. Smooth booking and very helpful staff.',
        ],
        [
            'Priya Nair',
            'Local · Mercedes-Maybach S 580',
            4,
            'Used it for a client dinner. Comfortable, immaculate, and delivered right to my office.',
        ],
        [
            'Marcus Lim',
            'Local · BMW M4 Competition',
            5,
            'Great weekend car. Pricing was clear and there were no surprise charges.',
        ],
        [
            'Emily Johnson',
            'Visitor from USA · Bentley Continental GT',
            4,
            'Luxury and power in one. Hotel delivery on Orchard Road made the trip effortless.',
        ],
    ];
    document.getElementById('revs').innerHTML = revs
        .map(
            (r) => `
<article class="rev"><header><div class="av">${r[0][0]}</div><div><b>${r[0]}</b><small>${r[1]}</small></div><span class="st" aria-label="${r[2]} stars">${'&#9733;'.repeat(r[2])}${'&#9734;'.repeat(5 - r[2])}</span></header><p>${r[3]}</p></article>`,
        )
        .join('');

    /* Tourist / Local toggle */
    const notes = {
        tourist:
            'Foreign licence accepted. Free pick-up at Changi Airport and hotel delivery on the Weekender plan.',
        local: 'Singapore licence holders: flexible weekend slots and member rates after your first booking.',
    };
    const note = document.getElementById('note'),
        btns = document.querySelectorAll('.audience button');
    function setWho(w) {
        btns.forEach((b) => b.setAttribute('aria-pressed', b.dataset.who === w));
        note.textContent = notes[w];
    }
    btns.forEach((b) => b.addEventListener('click', () => setWho(b.dataset.who)));
    setWho('tourist');

});
