/* Additional-charges payment (../damage-payment/damage-payment.html?id=AZ-XXXXXX). Opened from "Pay Now" on the customer dashboard.
   Pays the Penalty Fee (damage cost, cleaning fee, traffic fine, late return fee) created by an inspection. A customer can pay the full balance
   or a part of it; the balance, status and receipts all live in fees.js, so every other screen updates by itself.
   Needs data/cars.json (loaded by cars-loader.js), auth.js and fees.js. DEMO ONLY: nothing is really charged; only the last 4 card digits are kept. */
CarsData.ready.then(function () {
    const A = Auth,
        app = document.getElementById('app');
    const u = A.guard();
    if (!u) return;
    const id = new URLSearchParams(location.search).get('id');
    const mine = () => A.bookings().find((x) => x.id === id && x.email === u.email);
    const back = `<a class="back" href="../dashboard/dashboard.html">${A.ic('back', 16)} Back to dashboard</a>`;
    let b = mine(),
        s = b ? Fees.forBooking(id) : null;
    if (!b || !s || !(s.total > 0)) {
        app.innerHTML =
            back +
            `<div class="empty2"><h3>No Penalty Fee found</h3><p>There is nothing to pay for this booking.</p><a class="btn red" href="../dashboard/dashboard.html">My Dashboard</a></div>`;
        return;
    }
    const c = carFor(b) || { mk: '', n: b.title, c: '#222' },
        row = (l, v) => `<div><span>${l}</span><b>${A.esc(v)}</b></div>`;
    document.title = 'Pay Penalty Fee | AZoom';
    Fees.sync();

    /* receipt of ONE payment, plus what is still owed */
    function receipt(p) {
        s = Fees.forBooking(id);
        const done = s.outstanding <= 0;
        app.innerHTML = `<div class="confwrap"><div class="acard conf"><div class="tickbig">${A.ic('tick', 34)}</div>
   <h1>${done ? 'Penalty Fee Paid in Full' : 'Partial Payment Received'}</h1><p class="csub">${done ? 'Thank you. Your Penalty Fee for the ' + A.esc(b.title) + ' is fully paid.' : 'Thank you. Your payment was received. A balance of ' + Fees.money(s.outstanding) + ' remains and is due by ' + A.esc(s.dueDate) + '.'}</p>
   <div class="receipt" id="receipt"><h2>${A.ic('doc', 18)} Receipt</h2>
    ${row('Receipt no.', p.receipt || '-') + row('Paid on', A.stamp(p.at)) + row('Booking ID', b.id) + row('Inspection report', s.ref || '-') + row('Vehicle', b.title) + row('Payment', 'Card \u2022\u2022\u2022\u2022 ' + (p.card4 || '----')) + row('Penalty Fee', Fees.money(s.total)) + row('Amount Paid so far', Fees.money(s.paid))}
    <div class="ctot"><span>Amount paid now</span><b>${Fees.money(p.amount)}</b></div>
    <div class="ctot"><span>Outstanding balance</span><b>${Fees.money(s.outstanding)}</b></div></div>
   ${done ? '' : `<a class="btn red" href="../damage-payment/damage-payment.html?id=${encodeURIComponent(id)}">Pay Remaining Balance</a>`}
   <a class="btn ${done ? 'red' : 'ghost'}" href="../dashboard/dashboard.html">Back to My Dashboard</a>
   <button type="button" class="btn ghost" id="prt">${A.ic('print', 16)} Print Receipt</button></div></div>`;
        document.getElementById('prt').addEventListener('click', () => print());
    }
    /* fully paid already: show the payments */
    if (s.outstanding <= 0) {
        const last = (s.fee.payments || []).slice(-1)[0];
        if (last) return receipt(last);
    }

    const L = (ic, t, f) => `<label for="${f}">${A.ic(ic, 16)} ${t}</label>`;
    const charges = (s.fee.charges || [])
        .map(
            (x) =>
                `<div style="display:flex;justify-content:space-between;gap:12px"><span>${A.esc(Fees.TYPES[x.type] || x.label)}${x.note ? ` <small style="color:var(--mute)">${A.esc(x.note)}</small>` : ''}</span><b>${Fees.money(x.amount)}</b></div>`,
        )
        .join('');
    app.innerHTML =
        back +
        `<h1 class="ptitle">Pay Penalty Fee</h1><p class="psub">Our inspection of the ${A.esc(b.title)} resulted in a Penalty Fee. You can pay in full or make a partial payment. The outstanding balance stays linked to booking ${A.esc(b.id)} until it is fully settled.</p>
 <form id="pay" class="paygrid" novalidate><div class="paycol">
  <section class="acard pcard"><h2>${A.ic('warn', 20)} Penalty Fee</h2>
   <div class="csum" style="margin:0">${row('Booking ID', b.id) + row('Inspection report reference', s.ref || '-') + row('Inspection result', b.inspectionResult || '-') + row('Inspected on', A.stamp(b.completedAt)) + row('Due date', s.dueDate)}
    <div style="display:block"><span style="display:block;margin-bottom:6px">Penalty Fee breakdown</span><div style="display:grid;gap:6px">${charges}</div></div></div>
   ${s.overdue ? `<p class="odmsg" role="alert">${A.ic('warn', 16)} ${A.esc(Fees.OVERDUE_MSG)}</p>` : ''}
  </section>
  <section class="acard pcard"><h2>${A.ic('card', 20)} How much would you like to pay?</h2>
   <div class="amtopts">
    <label class="amt"><input type="radio" name="mode" value="full" checked><span>Pay the full outstanding balance <b>${Fees.money(s.outstanding)}</b></span></label>
    <label class="amt"><input type="radio" name="mode" value="part"><span>Pay a partial amount</span></label>
   </div>
   <div class="fld" id="partbox" hidden><label for="amt">Amount (S$)</label><input id="amt" name="amt" type="number" min="0.01" max="${s.outstanding}" step="0.01" inputmode="decimal" placeholder="e.g. ${Math.max(1, Math.floor(s.outstanding / 2))}"><p class="hint">A partial payment reduces the balance but the charge stays open until the full amount is paid.</p></div>
  </section>
  <section class="acard pcard"><h2>Payment Details <span class="secure">${A.ic('lock', 14)} Secure Payment</span></h2>
   <div class="brands"><span>Visa</span><span>Mastercard</span><span>JCB</span><span>Amex</span></div>
   <div class="fld">${L('card', 'Card Number', 'cd')}<input id="cd" name="cd" inputmode="numeric" autocomplete="cc-number" placeholder="1234 5678 9012 3456" maxlength="23" required></div>
   <div class="fld">${L('user', 'Card Holder Name', 'cn')}<input id="cn" name="cn" autocomplete="cc-name" placeholder="JOHN DOE" maxlength="60" required></div>
   <div class="two"><div class="fld"><label for="ex">Expiry Date</label><input id="ex" name="ex" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/YY" maxlength="5" required></div>
   <div class="fld"><label for="cv">CVC</label><input id="cv" name="cv" inputmode="numeric" autocomplete="cc-csc" placeholder="123" maxlength="4" required></div></div>
   <p class="note2">${A.ic('lock', 14)}<span>Demo only: nothing is charged. Only the last 4 digits of your card are kept for the receipt.</span></p>
  </section>
  <p class="err" id="err" role="alert"></p>
  <button class="btn red paybtn" type="submit" id="go">${A.ic('shield', 18)} <span id="golbl"></span></button>
 </div>
 <aside class="sumcard"><div class="sumimg" style="background:linear-gradient(135deg,${c.c},#0b0b0e)">${bookingImg(c)}</div>
  <div class="sumbody"><small>${A.esc(c.mk)}</small><h3>${A.esc(c.n)}</h3>
   <dl><div><dt>Rental total</dt><dd>${Fees.money(b.total)} (paid)</dd></div><div><dt>Penalty Fee</dt><dd>${Fees.money(s.total)}</dd></div><div><dt>Amount Paid</dt><dd>${Fees.money(s.paid)}</dd></div><div><dt>Payment Status</dt><dd>${A.esc(s.st.icon + ' ' + s.st.label)}</dd></div></dl>
   <div class="stot"><span>Outstanding</span><b>${Fees.money(s.outstanding)}</b></div></div></aside></form>`;

    const $ = (q) => document.querySelector(q),
        err = $('#err'),
        go = $('#go'),
        amt = $('#amt');
    const mode = () => document.querySelector('input[name="mode"]:checked').value;
    const toPay = () =>
        mode() === 'full' ? s.outstanding : Math.round(Number(amt.value || 0) * 100) / 100;
    const label = () => {
        const n = toPay();
        $('#golbl').textContent = go.dataset.busy
            ? 'Processing payment\u2026'
            : 'Pay ' +
              (n > 0 ? Fees.money(n) : 'Now') +
              (mode() === 'part' ? ' (partial payment)' : '');
    };
    document.querySelectorAll('input[name="mode"]').forEach((r) =>
        r.addEventListener('change', () => {
            $('#partbox').hidden = mode() !== 'part';
            if (mode() === 'part') amt.focus();
            label();
        }),
    );
    amt.addEventListener('input', label);
    label();
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
    $('#pay').addEventListener('input', (e) => {
        err.textContent = '';
        e.target.classList.remove('bad');
    });
    let paying = false;
    $('#pay').addEventListener('submit', (e) => {
        e.preventDefault();
        if (paying) return;
        err.textContent = '';
        const f = new FormData(e.target),
            digits = String(f.get('cd')).replace(/\D/g, ''),
            cn = String(f.get('cn')).trim(),
            ex = String(f.get('ex')),
            cv = String(f.get('cv'));
        const bad = (m, el) => {
            err.textContent = m;
            A.toast(m, 'err');
            $(el).classList.add('bad');
            $(el).focus();
        };
        e.target.querySelectorAll('.bad').forEach((x) => x.classList.remove('bad'));
        const cur = Fees.forBooking(id),
            n = toPay();
        if (cur.outstanding <= 0)
            return bad('This Penalty Fee has already been paid in full.', '#cd');
        if (mode() === 'part') {
            if (!(n > 0)) return bad('Enter the amount you want to pay.', '#amt');
            if (n > cur.outstanding)
                return bad(
                    'The amount is more than your outstanding balance of ' +
                        Fees.money(cur.outstanding) +
                        '.',
                    '#amt',
                );
        }
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
        paying = true;
        go.disabled = true;
        go.dataset.busy = '1';
        label();
        setTimeout(() => {
            try {
                const r = Fees.pay(
                    id,
                    u.email,
                    mode() === 'full' ? cur.outstanding : n,
                    digits.slice(-4),
                );
                b = mine();
                receipt(r.payment);
            } catch (x) {
                paying = false;
                go.disabled = false;
                delete go.dataset.busy;
                label();
                err.textContent = x.message;
                A.toast(x.message, 'err');
            }
        }, 1300);
    });
});
