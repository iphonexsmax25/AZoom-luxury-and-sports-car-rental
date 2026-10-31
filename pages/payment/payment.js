/* Payment page (../payment/payment.html?car=<number>&pk=&rt=&fr=&to=). Opened from the "Book Now" button on the car page.
   Needs data/cars.json (loaded by cars-loader.js) and auth.js.
   DEMO ONLY: nothing is really charged. The full card number and CVC are never saved, only the last 4 digits. */
CarsData.ready.then(function () {
    const A = Auth,
        app = document.getElementById('app');
    const LOCS = Branches.names();
    const q = new URLSearchParams(location.search),
        id = Number(q.get('car')),
        c = CARS[id];
    if (!c || !Number.isInteger(id)) {
        app.innerHTML = `<a class="back" href="../fleet/fleet.html">${A.ic('back', 16)} Back to fleet</a><div class="empty2"><h3>Car not found</h3><p>Pick a car from our fleet first.</p><a class="btn red" href="../fleet/fleet.html">Browse Fleet</a></div>`;
        return;
    }
    const u = A.guard();
    if (!u) return;
    const emp =
        u.role === 'employee' &&
        A.isEmployee(
            u.email,
        ); /* employee account: 50% rental discount + liability acknowledgement */
    const eligibility = emp
        ? { eligible: true, message: '' }
        : A.bookingEligibility(u.email);
    if (!eligibility.eligible) {
        app.innerHTML = `<a class="back" href="${A.esc(carPage)}">${A.ic('back', 16)} Back to ${A.esc(c.n)}</a><div class="booking-restriction" role="alert">${A.esc(eligibility.message)}</div><a class="btn red" href="../dashboard/dashboard.html">View My Dashboard</a>`;
        return;
    }
    document.title = `Book ${c.mk} ${c.n} | AZoom`;
    const carPage = '../car/car.html?model=' + encodeURIComponent(carKey(c));
    const pick = Branches.pick,
        opts = Branches.options;
    const t0 = BookingDates.tomorrow(),
        queryFrom = q.get('fr'),
        queryTo = q.get('to'),
        from0 =
            BookingDates.isValidDate(queryFrom) && queryFrom >= t0 ? queryFrom : t0,
        to0 =
            BookingDates.isValidDate(queryTo) && queryTo > from0
                ? queryTo
                : BookingDates.addDays(from0, 1);
    const L = (ic, t, f) => `<label for="${f}">${A.ic(ic, 16)} ${t}</label>`;
    const EA = emp
        ? `<section class="acard pcard emp-ack"><h2>${A.ic('warn', 20)} Employee Rental Acknowledgement</h2>
   <p class="empnote">${A.esc(A.EMP_NOTICE)}</p>
   <div class="term"><label class="tchk"><input type="checkbox" name="ea" id="t-ea"><span class="box"></span><span class="ttl">${A.esc(A.EMP_ACK_TEXT)}</span></label>
   <ul><li>Damage costs</li><li>Cleaning fees</li><li>Traffic fines</li><li>Late return fees</li></ul></div></section>`
        : '';

    app.innerHTML = `<a class="back" href="${carPage}">${A.ic('back', 16)} Back to ${A.esc(c.n)}</a>
 <h1 class="ptitle">Book Your Car</h1><p class="psub">Fill in your details to reserve the ${A.esc(c.mk + ' ' + c.n)}</p>
 <form id="pay" class="paygrid" novalidate>
  <div class="paycol">
   <section class="acard pcard"><h2>Rental Details</h2>
    <div class="fld">${L('pin', 'Pickup Branch', 'pk')}<select id="pk" name="pk">${opts(pick(q.get('pk'), LOCS[0]))}</select><div id="pk-info" aria-live="polite"></div></div>
    <div class="two"><div class="fld">${L('cal', 'Pickup Date', 'fr')}<input id="fr" name="fr" type="date" min="${t0}" value="${from0}" aria-describedby="date-err" required></div>
    <div class="fld">${L('cal', 'Return Date', 'to')}<input id="to" name="to" type="date" min="${BookingDates.addDays(from0, 1)}" value="${to0}" aria-describedby="date-err" required></div></div>
    <p class="date-validation-error" id="date-err" role="alert" aria-live="polite"></p>
    <div class="fld">${L('pin', 'Return Branch', 'rt')}<select id="rt" name="rt">${opts(pick(q.get('rt'), LOCS[0]))}</select><div id="rt-info" aria-live="polite"></div><p class="hint">Returning to a different branch than pickup may add a one-way return fee.</p></div>
   </section>
   <section class="acard pcard"><h2>Driver Information</h2>
    <div class="fld">${L('user', 'Full Name', 'nm')}<input id="nm" name="nm" value="${A.esc((A.profile() || {}).fullName || '')}" autocomplete="name" placeholder="As shown on your driving licence" maxlength="80" required></div>
    <div class="two"><div class="fld">${L('mail', 'Email', 'em')}<input id="em" name="em" type="email" value="${A.esc(u.email)}" readonly></div>
    <div class="fld">${L('phone', 'Phone', 'ph')}<input id="ph" name="ph" type="tel" autocomplete="tel" placeholder="+65 9123 4567" maxlength="20" required></div></div>
    <div class="fld">${L('card', "Driver's License Number", 'dl')}<input id="dl" name="dl" placeholder="Your driving licence number" maxlength="30" required></div>
   </section>
   <section class="acard pcard"><h2>Payment Details <span class="secure">${A.ic('lock', 14)} Secure Payment</span></h2>
    <div class="brands"><span>Visa</span><span>Mastercard</span><span>JCB</span><span>Amex</span></div>
    <div class="fld">${L('card', 'Card Number', 'cd')}<input id="cd" name="cd" inputmode="numeric" autocomplete="cc-number" placeholder="1234 5678 9012 3456" maxlength="23" required></div>
    <div class="fld">${L('user', 'Card Holder Name', 'cn')}<input id="cn" name="cn" autocomplete="cc-name" placeholder="JOHN DOE" maxlength="60" required></div>
    <div class="two"><div class="fld"><label for="ex">Expiry Date</label><input id="ex" name="ex" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/YY" maxlength="5" required></div>
    <div class="fld"><label for="cv">CVC</label><input id="cv" name="cv" inputmode="numeric" autocomplete="cc-csc" placeholder="123" maxlength="4" required></div></div>
    <p class="note2">${A.ic('lock', 14)}<span>Demo only: nothing is charged. Your card details are not stored, apart from the last 4 digits kept for the receipt.</span></p>
   </section>
   <section class="acard pcard"><h2>${A.ic('doc', 20)} Terms &amp; Conditions <a class="tlink" href="../terms/terms.html" target="_blank" rel="noopener">Read the full terms</a><a class="tlink" href="../privacy/privacy.html" target="_blank" rel="noopener">Privacy policy (PDPA)</a></h2>
    ${[
        [
            'tc',
            'doc',
            'Rental Terms &amp; Conditions',
            [
                'I agree to return the vehicle to the designated return location on or before the return date.',
                'I understand that late returns beyond the 30-minute grace period will incur additional charges as set out in the Late Return Policy of the Terms &amp; Conditions.',
                'I confirm that the driver information provided is accurate and the driver holds a valid license.',
                'I authorize AZoom to charge the total amount to the provided payment card.',
            ],
        ],
        [
            'dm',
            'car',
            'Damage Liability Policy',
            [
                'I am responsible for any damage to the vehicle during the rental period, including scratches, dents, and interior damage.',
                'I understand that the cost of repairs for any damage will be charged to my payment card.',
                'I acknowledge that the vehicle will be inspected before and after the rental period.',
                'I understand that any charges found at inspection must be paid by the due date shown in my dashboard, and that unpaid charges stay linked to this booking.',
                'I agree to report any damage immediately to AZoom support.',
            ],
        ],
        [
            'tr',
            'warn',
            'Traffic Rules &amp; Regulations',
            [
                'I agree to obey all Singapore traffic laws and regulations during the rental period.',
                'I understand that Singapore drives on the left side of the road.',
                'I acknowledge that all traffic violations, fines, ERP charges and penalties incurred during the rental period are my sole responsibility.',
                'I will not operate the vehicle under the influence of alcohol or drugs.',
                'I will not use the vehicle for racing, track days, or illegal activities unless explicitly permitted by AZoom.',
            ],
        ],
    ]
        .map(
            ([k, i, t, l]) =>
                `<div class="term"><label class="tchk"><input type="checkbox" name="${k}" id="t-${k}"><span class="box"></span><span class="ttl">${A.ic(i, 16)} ${t}</span></label><ul>${l.map((x) => `<li>${x}</li>`).join('')}</ul></div>`,
        )
        .join('')}
   </section>
   <section class="acard pcard" id="gps-sec"><h2>${A.ic('pin', 20)} GPS Tracking &amp; Travel Area <a class="tlink" href="../terms/terms.html#gps" target="_blank" rel="noopener">GPS policy</a><a class="tlink" href="../terms/terms.html#crossborder" target="_blank" rel="noopener">Cross-border policy</a></h2>
    ${[
        [
            'g1',
            'I acknowledge that all AZoom vehicles are equipped with GPS tracking and telematics systems.',
        ],
        [
            'g2',
            'I consent to location tracking during the rental period for security, safety and operational purposes.',
        ],
        [
            'g3',
            'I understand AZoom vehicles may only be driven within Singapore and Malaysia unless written approval has been granted.',
        ],
        ['g4', 'I understand that tampering with GPS equipment is strictly prohibited.'],
    ]
        .map(
            ([k, t]) =>
                `<div class="term"><label class="tchk"><input type="checkbox" name="${k}" id="t-${k}"><span class="box"></span><span class="ttl">${t}</span></label></div>`,
        )
        .join('')}
    <div class="term" role="radiogroup" aria-labelledby="my-lbl"><p class="ttl" id="my-lbl" style="font-weight:600;font-size:15px;margin-bottom:10px">I declare that I intend / do not intend to travel to Malaysia.</p>
     <label class="tchk" style="margin-bottom:10px"><input type="radio" name="my" id="t-my-y" value="yes"><span class="box rbox"></span><span class="ttl">I intend to travel to Malaysia during this rental</span></label>
     <label class="tchk"><input type="radio" name="my" id="t-my-n" value="no"><span class="box rbox"></span><span class="ttl">I do not intend to travel to Malaysia during this rental</span></label>
     <ul><li>Malaysia may only be entered through legal checkpoints. You are responsible for tolls, parking, traffic offences, summonses, customs and immigration requirements and any penalties imposed by Singapore or Malaysian authorities.</li><li>Travel to any other country is prohibited without written approval from AZoom.</li></ul></div>
   </section>
   ${EA}
   <p class="err" id="err" role="alert"></p>
   <button class="btn red paybtn" type="submit" id="go">${A.ic('shield', 18)} <span id="golbl"></span></button>
  </div>
  <aside class="sumcard"><div class="sumimg" style="background:linear-gradient(135deg,${c.c},#0b0b0e)">${carImg(c)}</div>
   <div class="sumbody"><small>${A.esc(c.mk)}</small><h3>${A.esc(c.n)}</h3>
    <dl><div><dt>Daily Rate</dt><dd>${A.money(c.p)}</dd></div><div><dt>Duration</dt><dd id="s-days"></dd></div><div><dt>Rental Price</dt><dd id="s-rentalline"></dd></div><div><dt>Original Price</dt><dd id="s-orig"></dd></div><div class="discrow"><dt id="s-discount-label">Discount</dt><dd id="s-disc"></dd></div><div><dt>Insurance</dt><dd>Included</dd></div><div><dt>Pickup</dt><dd id="s-pk"></dd></div><div><dt>Return</dt><dd id="s-rt"></dd></div><div><dt>Malaysia Travel</dt><dd id="s-my"></dd></div><div><dt>GPS Tracking Acknowledged</dt><dd id="s-gps"></dd></div><div><dt>Refund Eligibility</dt><dd id="s-ref"></dd></div><div id="s-feerow" hidden><dt>One-way return fee</dt><dd id="s-fee"></dd></div></dl>
    <div class="stot"><span>${emp ? 'Final payable' : 'Total'}</span><b id="s-tot"></b></div>${emp ? `<div class="empdisc"><p class="empline">50% Employee Discount</p><span class="empbadge">${A.esc(A.EMP_BADGE)}</span><p class="empnote">${A.esc(A.EMP_NOTICE)}</p></div>` : ''}</div></aside>
 </form>`;

    const $ = (s) => document.querySelector(s),
        form = $('#pay'),
        fr = $('#fr'),
        to = $('#to'),
        err = $('#err'),
        dateErr = $('#date-err'),
        go = $('#go');
    let dateNotice = '';
    const days = () =>
        Math.max(1, Math.round((new Date(to.value) - new Date(fr.value)) / 864e5)) || 1;
    const fee = () => Branches.fee($('#pk').value, $('#rt').value),
        rental = () => c.p * days();
    /* Employee pricing retains its existing policy; customer deals use the shared duration tiers. */
    const price = () => {
            const rentalFee = fee();
            if (emp) {
                return {
                    ...A.empPrice(rental(), rentalFee),
                    rate: A.EMP_DISCOUNT,
                    percentage: A.EMP_DISCOUNT * 100,
                    label: 'Employee Rental',
                };
            }
            const deal = RentalDiscounts.calculate(c, days());
            return {
                ...deal,
                net: deal.total,
                fee: rentalFee,
                total: Math.round((deal.total + rentalFee + Number.EPSILON) * 100) / 100,
            };
        },
        total = () => price().total;
    function sum() {
        fr.min = BookingDates.tomorrow();
        to.min = BookingDates.minimumReturn(fr.value);
        const beforeReset = BookingDates.validate(fr.value, to.value);
        let reset = false;
        if (to.value && to.value < to.min) {
            to.value = to.min;
            reset = true;
        }
        if (reset) dateNotice = beforeReset ? beforeReset.message : '';
        const dateError = BookingDates.validate(fr.value, to.value);
        dateErr.textContent = dateError ? dateError.message : dateNotice;
        go.disabled = !!dateError || !!go.dataset.busy;
        $('#s-days').textContent = days() + (days() === 1 ? ' day' : ' days');
        $('#s-pk').textContent = $('#pk').value;
        $('#s-rt').textContent = $('#rt').value;
        $('#pk-info').innerHTML = Branches.detail($('#pk').value);
        $('#rt-info').innerHTML = Branches.detail($('#rt').value);
        $('#s-feerow').hidden = !fee();
        $('#s-fee').textContent = A.money(fee());
        const p = price();
        $('#s-rentalline').textContent =
            `${days()} × ${A.money(c.p)} = ${A.money(p.original)}`;
        $('#s-orig').textContent = A.money(p.original);
        $('#s-discount-label').textContent =
            `${p.label} (${p.percentage}%)`;
        $('#s-disc').textContent = '\u2212' + A.money(p.discount);
        $('#s-tot').textContent = A.money(total());
        /* travel / GPS / refund lines of the booking summary */
        const my = (form.querySelector('input[name="my"]:checked') || {}).value;
        $('#s-my').textContent = my === 'yes' ? 'Yes' : my === 'no' ? 'No' : 'Not declared yet';
        $('#s-gps').textContent = ['g1', 'g2', 'g3', 'g4'].every(
            (k) => form.querySelector(`input[name="${k}"]`).checked,
        )
            ? 'Yes'
            : 'Not yet';
        const hrs = (new Date(fr.value + 'T' + Refunds.PICKUP_TIME).getTime() - Date.now()) / 36e5;
        $('#s-ref').textContent =
            hrs > 0
                ? 'Full refund (100%) if you cancel before pick-up'
                : 'Online cancellation closes at pick-up time';
        $('#golbl').textContent =
            go.disabled && go.dataset.busy
                ? 'Processing payment…'
                : 'Pay & Confirm Booking - ' + A.money(total());
    }
    ['pk', 'rt'].forEach((k) => $('#' + k).addEventListener('input', sum));
    [fr, to].forEach((input) => {
        ['input', 'change'].forEach((eventName) =>
            input.addEventListener(eventName, () => {
                dateNotice = '';
                sum();
            }),
        );
    });
    form.addEventListener('change', sum);
    sum();

    /* Licence number: any format is accepted, because licences differ from country to country. It only has to be filled in. */
    const dl = $('#dl');
    form.addEventListener('input', (e) => {
        e.target.classList.remove('bad');
    });

    /* Card field helpers */
    $('#cd').addEventListener('input', (e) => {
        const d = e.target.value.replace(/\D/g, '').slice(0, 19);
        e.target.value = d.replace(/(.{4})/g, '$1 ').trim();
    });
    $('#ex').addEventListener('input', (e) => {
        let d = e.target.value.replace(/\D/g, '').slice(0, 4);
        if (d.length >= 3) d = d.slice(0, 2) + '/' + d.slice(2);
        e.target.value = d;
    });
    $('#cv').addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
    });
    form.addEventListener('input', () => {
        err.textContent = '';
    });

    let paying = false;
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (paying) return;
        err.textContent = '';
        const f = new FormData(form),
            from = fr.value,
            until = to.value,
            digits = String(f.get('cd')).replace(/\D/g, ''),
            nm = String(f.get('nm')).trim(),
            ph = String(f.get('ph')).trim(),
            dlv = String(f.get('dl')).trim(),
            cn = String(f.get('cn')).trim(),
            ex = String(f.get('ex')),
            cv = String(f.get('cv'));
        const bad = (m, el) => {
            err.textContent = m;
            A.toast(m, 'err');
            if (el) {
                $(el).classList.add('bad');
                $(el).focus();
            }
            return false;
        };
        form.querySelectorAll('.bad').forEach((x) => x.classList.remove('bad'));
        const eligibility = emp
            ? { eligible: true, message: '' }
            : A.bookingEligibility(u.email);
        if (!eligibility.eligible) return bad(eligibility.message);
        const dateError = BookingDates.validate(from, until);
        if (dateError) return bad(dateError.message, dateError.field === 'pickup' ? '#fr' : '#to');
        if (nm.length < 2 || !/[A-Za-z]/.test(nm))
            return bad(
                "Invalid full name. Enter the driver's name as shown on the licence.",
                '#nm',
            );
        if (ph.replace(/\D/g, '').length < 7 || !/^[+\d\s()-]+$/.test(ph))
            return bad('Invalid phone number. Use digits only, for example +65 9123 4567.', '#ph');
        if (!dlv) return bad("Enter the driver's licence number.", '#dl');
        if (digits.length < 13 || digits.length > 19)
            return bad('Invalid card number. Enter the 13 to 19 digits on your card.', '#cd');
        if (cn.length < 2)
            return bad('Invalid card holder name. Enter the name on the card.', '#cn');
        const m = /^(\d{2})\/(\d{2})$/.exec(ex);
        if (!m || +m[1] < 1 || +m[1] > 12)
            return bad('Invalid expiry date. Enter it as MM/YY, for example 08/29.', '#ex');
        const now = new Date(),
            yy = now.getFullYear() % 100,
            mm = now.getMonth() + 1;
        if (+m[2] < yy || (+m[2] === yy && +m[1] < mm))
            return bad('Invalid card: this card has expired.', '#ex');
        if (cv.length < 3)
            return bad('Invalid CVC. Enter the 3 or 4 digit code on your card.', '#cv');
        if (!['tc', 'dm', 'tr'].every((k) => f.get(k)))
            return bad('Please accept all three sets of terms to continue.');
        if (!['g1', 'g2', 'g3', 'g4'].every((k) => f.get(k)))
            return bad(
                'Please tick all four GPS tracking and travel-area acknowledgements to continue.',
                '#t-g1',
            );
        if (!['yes', 'no'].includes(String(f.get('my'))))
            return bad('Please declare whether you intend to travel to Malaysia.', '#t-my-y');
        if (emp && !f.get('ea'))
            return bad(
                'Please tick the employee acknowledgement checkbox to confirm your booking.',
                '#t-ea',
            );
        const conflict = A.bookingConflict(u.email, id, from, until);
        if (conflict === 'customer')
            return bad('You already have an active booking for these dates.', '#fr');
        if (conflict === 'vehicle')
            return bad('This vehicle is unavailable for the selected dates.', '#fr');

        /* "Process" the demo payment, then create the booking */
        paying = true;
        go.disabled = true;
        go.dataset.busy = '1';
        sum();
        setTimeout(() => {
            const n = days(),
                now = Date.now(),
                bid = A.newBookingId();
            const rec = {
                id: bid,
                email: u.email,
                name: nm,
                phone: ph,
                license: dlv,
                carId: id,
                title: c.mk + ' ' + c.n,
                pickup: Branches.pick(String(f.get('pk')), LOCS[0]),
                ret: Branches.pick(String(f.get('rt')), LOCS[0]),
                from,
                to: until,
                days: n,
                oneWayFee: fee(),
                total: price().total,
                rentalOriginal: price().original,
                discountRate: price().rate,
                discountAmount: price().discount,
                discountLabel: price().label,
                card4: digits.slice(-4),
                paymentStatus: 'paid',
                receipt: A.newReceiptNo(),
                paidAt: now,
                status: 'pending',
                created: now,
                malaysiaTravel: f.get('my') === 'yes',
                gpsAcknowledged: true,
                gpsConsent: true,
                territoryAck: true,
                gpsTamperAck: true,
            }; /* stored with the booking; the data layer re-checks them */
            if (emp) {
                rec.employeeRental = true;
                rec.employeeAck = true;
            }
            try {
                A.addBooking(rec);
            } catch (x) {
                /* the data layer refused the booking */
                paying = false;
                go.disabled = false;
                delete go.dataset.busy;
                sum();
                err.textContent = x.message;
                A.toast(x.message, 'err');
                return;
            }
            A.uid(u.email); /* make sure the customer has an ID */
            location.href =
                '../booking-confirmation/booking-confirmation.html?id=' + encodeURIComponent(bid);
        }, 1300);
    });
});
