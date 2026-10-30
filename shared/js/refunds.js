/* Booking cancellation, refund policy and refund records. Needs auth.js (load it after fees.js and before history.js / account.js).
   100% local: cancellations, refund transactions and refund status live in this browser's localStorage under "az_refunds"
   (one record per cancelled booking, linked by bookingId). The booking itself keeps the cancellation details (date, who, reason, log).
   Nothing is really refunded: this is a demo of the workflow.

   REFUND POLICY (terms section 8)
     1. Customer-request cancellations: 100% of the rental amount is refunded. Cancellation Fee = S$0.00. Refund Method = Original Payment Method.
        Message: "Customer requested cancellation. Full refund approved."
     2. AZoom-side cancellations (vehicle unavailable, maintenance issue, operational reasons): 100% of ALL payments made is refunded:
        rental fees, plus any deposit (b.depositPaid) and add-ons (b.addons = [{name, amount}]) the booking recorded.
        (This demo only charges the rental, including any one-way return fee, at booking time; the deposit is a hold placed at pick-up.)
     Customers can still only cancel online BEFORE the pick-up time (pending or approved bookings). Employees can cancel any pending / approved booking.
   REFUND RECORD (one per cancelled booking) saves: refundAmount, refundDate (ISO date-time), refundReason, refundMethod (plus rentalAmount,
     cancellationFee, status, history log ...). The refund is approved at the moment of cancellation, so its status is "Refunded" straight away and the
     booking shows "Cancelled - Fully Refunded". Records made under the older tiered policy keep their old amounts and statuses
     (Pending Refund / Processing / Partially Refunded / Non-Refundable) and an employee can still move those along. */
const Refunds = (() => {
    const A = Auth,
        KEY = A.K.r || 'az_refunds';
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
        } catch (e) {}
    };
    const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
    const money = (n) =>
        'S$' +
        (Number(n) || 0).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    const E = A.esc;
    const isClosedBooking = (b) => b && (b.status === 'cancelled' || b.status === 'rejected');

    /* ---------- Settings ---------- */
    const PICKUP_TIME =
        '10:00'; /* bookings only store a pick-up DATE; the cancellation deadline counts from this time */
    /* Every cancellation is refunded in full. Kept as a function so older code that calls Refunds.shareFor(hours) keeps working. */
    const shareFor = () => 1;
    const MSG_CUSTOMER = 'Customer requested cancellation. Full refund approved.';
    /* who cancelled and why: only employees can pick an AZoom reason (every reason gets a full refund) */
    const CATS = {
        customer: 'Customer Request',
        unavailable: 'AZoom: vehicle unavailable',
        maintenance: 'AZoom: maintenance issue',
        operational: 'AZoom: operational reasons',
    };
    const METHOD = 'Original Payment Method';

    const ST = {
        pending: { key: 'pending', label: 'Pending Refund', cls: 's-pending' },
        processing: { key: 'processing', label: 'Processing', cls: 's-partial' },
        refunded: { key: 'refunded', label: 'Refunded', cls: 's-paid' },
        partial: { key: 'partial', label: 'Partially Refunded', cls: 's-partial' },
        none: { key: 'none', label: 'Non-Refundable', cls: 's-nonref' },
    };
    /* what the Payment Status of a cancelled booking says */
    const PAY = {
        pending: 'Refund Pending',
        processing: 'Refund Pending',
        refunded: 'Refunded',
        partial: 'Partially Refunded',
        none: 'Non-Refundable',
    };
    const badge = (k) => {
        const t = ST[k] || ST.pending;
        return `<span class="fbadge ${t.cls}">${E(t.label)}</span>`;
    };

    const ts = (d, t) => {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''),
            x = /^(\d{1,2}):(\d{2})$/.exec(t || '');
        return m && x ? new Date(+m[1], +m[2] - 1, +m[3], +x[1], +x[2]).getTime() : 0;
    };
    const pickTs = (b) => ts(b.from, PICKUP_TIME);
    const dt = (t) => (t ? A.stamp(t).slice(0, 16) : 'N/A');
    const all = () => rd(KEY, []);
    const save = (a) => wr(KEY, a);
    const newId = () =>
        'RF-' +
        Date.now().toString(36).toUpperCase() +
        Math.random().toString(36).slice(2, 5).toUpperCase();
    const actor = (email) =>
        email
            ? { id: A.uid(email), name: A.nameOf(email), email }
            : { id: 'SYSTEM', name: 'System', email: '' };

    /* ---------- Everything the customer has paid for a booking ---------- */
    function paid(b) {
        const rental = r2(b.total),
            deposit = r2(b.depositPaid),
            addons = r2(
                (Array.isArray(b.addons) ? b.addons : []).reduce(
                    (n, x) => n + (Number(x && x.amount) || 0),
                    0,
                ),
            );
        return { rental, deposit, addons, all: r2(rental + deposit + addons) };
    }
    /* ---------- The refund calculation (pure, easy to test) ----------
    Customer request: the full rental amount. AZoom-side (opts.byCompany): everything paid. Cancellation fee is always S$0.00. */
    function quote(b, opts) {
        opts = opts || {};
        const p = paid(b),
            at = opts.at || Date.now(),
            hours = (pickTs(b) - at) / 36e5,
            byCompany = !!opts.byCompany;
        const refund = byCompany ? p.all : p.rental;
        const note = byCompany
            ? 'Cancelled by AZoom (' +
              (CATS[opts.category] || CATS.operational).replace(/^AZoom: /, '') +
              '). Full refund approved: all payments made are returned.'
            : MSG_CUSTOMER;
        return {
            rental: p.rental,
            deposit: p.deposit,
            addons: p.addons,
            paidTotal: p.all,
            fee: 0,
            refund,
            share: 1,
            hours,
            note,
            method: refund > 0 ? METHOD : 'N/A',
            card4: b.card4 || '----',
        };
    }
    /* Customers may cancel (pending or approved) only BEFORE the scheduled pick-up time. After that no online cancellation, no refund. */
    const canCustomerCancel = (b) =>
        !!b && (b.status === 'pending' || b.status === 'confirmed') && Date.now() < pickTs(b);
    const canEmployeeCancel = (b) => !!b && (b.status === 'pending' || b.status === 'confirmed');
    const canEmployeeReject = (b) => !!b && b.status === 'pending';

    /* ---------- What a booking would refund (shown in every booking summary) ---------- */
    function eligibility(b) {
        if (isClosedBooking(b)) {
            const r = view(b);
            return r.refundAmount > 0 ? r.note : 'Non-refundable: ' + r.note;
        }
        if (b.status === 'pending' || b.status === 'confirmed') {
            if (Date.now() >= pickTs(b))
                return 'Online cancellation has closed: the pick-up time has passed. Contact AZoom support.';
            const q = quote(b, { at: Date.now() });
            return `Full refund (100%) if cancelled now: ${money(q.refund)}, no cancellation fee`;
        }
        return 'Not applicable: the rental has started';
    }
    /* The booking-summary lines: Malaysia travel, GPS acknowledgement and the refund / cancellation facts. [label, text, refundStatusKey?] */
    function summary(b, opts) {
        opts = opts || {};
        const r = isClosedBooking(b) ? view(b) : null;
        return [
            [
                'Malaysia Travel',
                b.malaysiaTravel === true
                    ? 'Yes'
                    : b.malaysiaTravel === false
                      ? 'No'
                      : 'Not recorded (booked before this policy)',
            ],
            [
                'GPS Tracking Acknowledged',
                b.gpsAcknowledged === true ? 'Yes' : 'Not recorded (booked before this policy)',
            ],
            ['Refund Eligibility', eligibility(b)],
            ['Refund Status', r ? ST[r.status].label : 'Not applicable', r ? r.status : ''],
            [
                'Refund Amount',
                r
                    ? money(r.refundAmount)
                    : opts.refundAmount != null
                      ? money(opts.refundAmount)
                      : 'N/A',
            ],
            ['Cancellation Date', r ? dt(b.cancelledAt || r.cancelledAt) : 'Not cancelled'],
            ['Cancellation Reason', r ? b.cancellationReason || r.reason || 'Not recorded' : 'N/A'],
        ];
    }

    /* ---------- Records ---------- */
    const forBooking = (bid) => all().find((r) => r.bookingId === bid) || null;
    const byRef = (id) => all().find((r) => r.id === id) || null;
    const list = () => all();
    const log = (r, by, action, detail) =>
        (r.history = r.history || []).push({
            at: Date.now(),
            byId: by.id,
            byName: by.name,
            action,
            detail: detail || '',
        });
    /* Look of a record that is shown on a screen; a cancelled booking with no saved record (should not happen) is worked out from the policy */
    function view(b) {
        const r = forBooking(b.id);
        if (r) return r;
        const cat = b.cancellationCategory || 'customer',
            q = quote(b, {
                at: b.cancelledAt || b.created,
                byCompany: cat !== 'customer',
                category: cat,
            }),
            why = b.cancellationReason || 'Customer requested cancellation';
        return {
            id: null,
            ref: '-',
            bookingId: b.id,
            rentalAmount: q.rental,
            cancellationFee: q.fee,
            refundAmount: q.refund,
            method: q.method,
            refundMethod: q.method,
            refundReason: why,
            refundDate: null,
            card4: q.card4,
            status: q.refund > 0 ? 'refunded' : 'none',
            note: q.note,
            history: [],
            virtual: true,
        };
    }
    /* The Booking Status text everywhere: a cancelled booking says what happened to the money, e.g. "Cancelled - Fully Refunded" */
    function statusLabel(b) {
        if (!b) return '';
        if (b.status !== 'cancelled')
            return (A.LABEL && A.LABEL[b.status]) || b.status;
        const r = view(b);
        return (
            'Cancelled - ' +
            (r.status === 'refunded' && r.refundAmount >= r.rentalAmount && r.refundAmount > 0
                ? 'Fully Refunded'
                : r.status === 'refunded' || r.status === 'partial'
                  ? 'Partially Refunded'
                  : r.status === 'none'
                    ? 'Non-Refundable'
                    : 'Refund Pending')
        );
    }
    function makeRecord(b, by, q, reason, cancelledAt, kind, category) {
        const id = newId(),
            full = q.refund > 0,
            r = {
                id,
                ref: id,
                bookingId: b.id,
                email: b.email,
                rentalAmount: q.rental,
                depositRefunded: q.deposit,
                addonsRefunded: q.addons,
                paidTotal: q.paidTotal,
                cancellationFee: q.fee,
                refundAmount: q.refund,
                refundDate: full ? new Date(cancelledAt).toISOString() : null,
                refundedAt: full ? cancelledAt : null,
                refundReason: reason,
                refundMethod: q.method,
                method: q.method,
                card4: q.card4,
                status: full ? 'refunded' : 'none',
                note: q.note,
                share: 1,
                hoursBeforePickup: Math.round(q.hours * 10) / 10,
                category: category || 'customer',
                createdAt: cancelledAt,
                cancelledAt,
                cancelledBy: kind,
                cancelledById: by.id,
                cancelledByName: by.name,
                reason,
                history: [],
            };
        log(
            r,
            by,
            'Refund created',
            `${money(q.refund)} of ${money(q.paidTotal)} paid. ${q.note} Cancellation fee ${money(q.fee)}.`,
        );
        if (full)
            log(
                r,
                by,
                'Status',
                `Refunded: approved at cancellation, returned to the ${q.method}${q.card4 && q.card4 !== '----' ? ' (\u2022\u2022\u2022\u2022 ' + q.card4 + ')' : ''}.`,
            );
        else log(r, by, 'Status', 'Non-Refundable: the refund amount is S$0.00.');
        return r;
    }

    /* ---------- Cancel a booking (customer or employee). Does ALL the work: booking status, booking log, refund record ---------- */
    function cancel(bookingId, actorEmail, reason, opts) {
        opts = opts || {};
        const b = A.bookings().find((x) => x.id === bookingId);
        if (!b) throw Error('Booking not found.');
        const by = actor(actorEmail),
            emp = A.isEmployee(actorEmail);
        if (!emp && b.email !== actorEmail) throw Error('You can only cancel your own bookings.');
        const outcome = opts.status || 'cancelled';
        if (outcome !== 'cancelled' && outcome !== 'rejected')
            throw Error('Unsupported booking status change.');
        if (outcome === 'rejected' && (!emp || !canEmployeeReject(b)))
            throw Error('Only pending bookings can be rejected by staff.');
        if (outcome !== 'rejected' && (emp ? !canEmployeeCancel(b) : !canCustomerCancel(b)))
            throw Error(
                b.status === 'rejected'
                    ? 'This booking has already been rejected.'
                    : b.status === 'cancelled'
                      ? 'This booking is already cancelled.'
                      : emp
                        ? 'Only pending or confirmed bookings can be cancelled.'
                        : 'The pick-up time has passed, so this booking can no longer be cancelled online. Please contact AZoom support.',
            );
        if (forBooking(bookingId)) throw Error('A refund record already exists for this booking.');
        reason = String(reason || '')
            .trim()
            .replace(/\s+/g, ' ');
        if (emp && reason.length < 3)
            throw Error(outcome === 'rejected' ? 'Enter a rejection reason.' : 'Enter a cancellation reason.');
        if (reason.length > 300)
            throw Error('The cancellation reason must be 300 characters or fewer.');
        if (!reason) reason = 'Customer requested cancellation';
        const now = Date.now(),
            kind = emp ? 'employee' : 'customer',
            category = emp && CATS[opts.category] ? opts.category : 'customer',
            byCompany = category !== 'customer';
        const q = quote(b, { at: now, byCompany, category }),
            rec = makeRecord(b, by, q, reason, now, kind, category);
        if (byCompany)
            log(
                rec,
                by,
                'Full refund',
                `${CATS[category]}: all payments made (${money(q.paidTotal)}) are refunded in full.`,
            );
        const a = all();
        a.push(rec);
        save(a);
        const entry = {
            at: now,
            byId: by.id,
            byName: by.name,
            action: outcome === 'rejected' ? 'Booking rejected' : 'Booking cancelled',
            detail: `${by.name} (${by.id}) ${outcome === 'rejected' ? 'rejected' : 'cancelled'} booking ${b.id}. Reason: ${reason}. Refund ${money(q.refund)} approved (${q.method}), reference ${rec.ref}.`,
        };
        A.update(b.id, {
            status: outcome,
            cancelledAt: now,
            cancelledBy: kind,
            cancelledById: by.id,
            cancelledByName: by.name,
            cancellationReason: reason,
            cancellationCategory: category,
            refundId: rec.id,
            ...(outcome === 'rejected'
                ? {
                      rejectedAt: now,
                      rejectedBy: by.id,
                      rejectedByName: by.name,
                      rejectionReason: reason,
                  }
                : {}),
            cancellationLog: (b.cancellationLog || []).concat([entry]),
        });
        return { booking: A.bookings().find((x) => x.id === b.id), refund: rec, quote: q };
    }

    /* ---------- Employee moves a refund along: pending -> processing -> refunded / partial ---------- */
    function advance(bookingId, to, empEmail) {
        if (!A.isEmployee(empEmail)) throw Error('Only employee accounts can update a refund.');
        const b = A.bookings().find((x) => x.id === bookingId),
            a = all(),
            r = a.find((x) => x.bookingId === bookingId);
        if (!b || !r) throw Error('No refund record for this booking.');
        if (A.isSelfBooking(b, empEmail))
            throw Error(
                'You cannot process a refund for a booking you made yourself. Please ask another employee.',
            );
        if (r.refundAmount <= 0)
            throw Error('This booking is non-refundable, so there is nothing to refund.');
        if (r.status === 'refunded' || r.status === 'partial')
            throw Error('This refund has already been paid out.');
        const final = r.refundAmount >= r.rentalAmount ? 'refunded' : 'partial',
            next = to === 'processing' ? 'processing' : final,
            by = actor(empEmail);
        if (next === 'processing' && r.status === 'processing')
            throw Error('This refund is already being processed.');
        const old = ST[r.status].label;
        r.status = next;
        if (next !== 'processing') r.refundedAt = Date.now();
        else r.processingAt = Date.now();
        log(
            r,
            by,
            'Status change',
            `${old} → ${ST[next].label}` +
                (next !== 'processing'
                    ? `. ${money(r.refundAmount)} returned to ${r.method} •••• ${r.card4}.`
                    : '.'),
        );
        save(a);
        const rows = A.bookings().find((x) => x.id === bookingId);
        A.update(bookingId, {
            cancellationLog: (rows.cancellationLog || []).concat([
                {
                    at: Date.now(),
                    byId: by.id,
                    byName: by.name,
                    action: 'Refund ' + ST[next].label.toLowerCase(),
                    detail: `Reference ${r.ref}`,
                },
            ]),
        });
        return r;
    }

    /* Bookings cancelled before refund records existed get a record the first time pages load. */
    function sync() {
        const a = all(),
            have = new Set(a.map((r) => r.bookingId));
        let changed = false;
        A.bookings()
            .filter((b) => isClosedBooking(b) && !have.has(b.id))
            .forEach((b) => {
                const at = b.cancelledAt || b.created || Date.now(),
                    by =
                        b.cancelledBy === 'employee'
                            ? {
                                  id: b.cancelledById || 'SYSTEM',
                                  name: b.cancelledByName || 'Employee',
                              }
                            : actor(b.email);
                const cat =
                        b.cancellationCategory && CATS[b.cancellationCategory]
                            ? b.cancellationCategory
                            : 'customer',
                    q = quote(b, { at, byCompany: cat !== 'customer', category: cat }),
                    r = makeRecord(
                        b,
                        by,
                        q,
                        b.cancellationReason ||
                            (b.cancelledBy === 'employee'
                                ? 'Cancelled by employee'
                                : 'Customer requested cancellation'),
                        at,
                        b.cancelledBy === 'employee' ? 'employee' : 'customer',
                        cat,
                    );
                a.push(r);
                changed = true;
                try {
                    A.update(b.id, { refundId: r.id });
                } catch (e) {}
            });
        if (changed) save(a);
        return changed;
    }
    const removeFor = (ids) => {
        const s = new Set(ids);
        save(all().filter((r) => !s.has(r.bookingId)));
    };

    /* ---------- Cancellation pop-up (customer and employee) ---------- */
    const row = (l, v, cls) =>
        `<div class="mrow${cls ? ' ' + cls : ''}"><dt>${E(l)}</dt><dd>${v}</dd></div>`;
    function openCancel(b, actorEmail, done, outcome) {
        if (document.querySelector('[data-modal]')) return;
        outcome = outcome || 'cancelled';
        const emp = A.isEmployee(actorEmail),
            rejecting = outcome === 'rejected',
            opener = document.activeElement;
        try {
            if (rejecting && (!emp || !canEmployeeReject(b)))
                throw Error('Only pending bookings can be rejected by staff.');
            if (!rejecting && (emp ? !canEmployeeCancel(b) : !canCustomerCancel(b)))
                throw Error(
                    'The pick-up time has passed, so this booking can no longer be cancelled online. Please contact AZoom support.',
                );
        } catch (x) {
            return A.toast(x.message, 'err');
        }
        const wrap = document.createElement('div');
        wrap.className = 'mback';
        wrap.setAttribute('data-modal', '');
        wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mt"><h2 id="mt">${rejecting ? 'Reject this booking?' : 'Cancel this booking?'}</h2>
   <p class="hint">${emp ? `You are ${rejecting ? 'rejecting' : 'cancelling'} on behalf of the customer. A reason is required. The refund is calculated below.` : 'Please check the refund below before you confirm. This cannot be undone.'}</p>
   <dl class="mrows" id="mrows"></dl>
   <div class="fld"><label for="mreason">${rejecting ? 'Rejection reason' : 'Cancellation reason'}${emp ? ' (required)' : ' (optional)'}</label><textarea id="mreason" rows="3" maxlength="300" placeholder="${emp ? `Why is this booking being ${rejecting ? 'rejected' : 'cancelled'}?` : 'Tell us why you are cancelling (optional)'}"></textarea></div>
   ${
       emp
           ? `<div class="fld"><label for="mcat">Why is the booking being ${rejecting ? 'rejected' : 'cancelled'}?</label><select id="mcat">${Object.entries(
                 CATS,
             )
                 .map(
                     ([k, v]) =>
                         `<option value="${k}">${E(v)}${k === 'customer' ? ' (full rental refund)' : ' (all payments refunded)'}</option>`,
                 )
                 .join('')}</select></div>`
           : ''
   }
   <p class="err" id="merr" role="alert"></p>
   <div class="macts"><button type="button" class="act" id="mkeep">Keep Booking</button><button type="button" class="act red done" id="mgo">Confirm Cancellation</button></div></div>`;
        document.body.append(wrap);
        const $ = (s) => wrap.querySelector(s),
            close = () => {
                wrap.remove();
                document.removeEventListener('keydown', key);
                if (opener && opener.focus) opener.focus();
            };
        const draw = () => {
            const cat = emp && $('#mcat') ? $('#mcat').value : 'customer',
                q = quote(b, { byCompany: cat !== 'customer', category: cat });
            $('#mrows').innerHTML =
                row('Booking ID', E(b.id)) +
                row('Vehicle', E(b.title)) +
                row('Rental Amount', money(q.rental)) +
                (cat !== 'customer' && q.deposit > 0 ? row('Deposit Paid', money(q.deposit)) : '') +
                (cat !== 'customer' && q.addons > 0 ? row('Add-ons Paid', money(q.addons)) : '') +
                row('Cancellation Fee', money(q.fee)) +
                row('Refund Amount', `<b>${money(q.refund)}</b>`, 'big') +
                (q.refund > 0
                    ? row('Refund Method', E(METHOD)) +
                      row('Payment Card', '\u2022\u2022\u2022\u2022 ' + E(q.card4))
                    : row('Refund Method', 'No refund due')) +
                `<p class="mnote">${E(q.note)}${q.refund > 0 ? ' The refund goes back to the original payment method within 5 to 10 business days.' : ''}</p>`;
        };
        const key = (e) => {
            if (e.key === 'Escape') close();
            if (e.key === 'Tab') {
                const f = [...wrap.querySelectorAll('textarea,input,button')];
                const i = f.indexOf(document.activeElement);
                if (e.shiftKey && i <= 0) {
                    e.preventDefault();
                    f[f.length - 1].focus();
                } else if (!e.shiftKey && i === f.length - 1) {
                    e.preventDefault();
                    f[0].focus();
                }
            }
        };
        document.addEventListener('keydown', key);
        wrap.addEventListener('click', (e) => {
            if (e.target === wrap) close();
        });
        if ($('#mcat')) $('#mcat').addEventListener('change', draw);
        $('#mkeep').addEventListener('click', close);
        $('#mreason').addEventListener('input', () => {
            $('#merr').textContent = '';
        });
        $('#mgo').textContent = rejecting ? 'Confirm Rejection' : 'Confirm Cancellation';
        $('#mgo').addEventListener('click', () => {
            try {
                const res = cancel(b.id, actorEmail, $('#mreason').value, {
                    category: emp && $('#mcat') ? $('#mcat').value : 'customer',
                    status: outcome,
                });
                close();
                A.toast(
                    `${rejecting ? `Booking ${b.id} was rejected.` : emp ? `Booking ${b.id} cancelled.` : 'Your previous booking was cancelled. You may create a new booking.'} ${res.quote.note} ` +
                        (res.refund.refundAmount > 0
                            ? `${money(res.refund.refundAmount)} refunded to the original payment method (${res.refund.ref}).`
                            : 'No refund is due.') +
                        (rejecting
                            ? ' The customer may create a new booking for the same or different dates.'
                            : emp
                              ? ''
                              : ' You may create a new booking.'),
                );
                if (done) done(res);
            } catch (x) {
                $('#merr').textContent = x.message;
            }
        });
        draw();
        $('#mreason').focus();
    }

    //public API
    return {
        PICKUP_TIME,
        shareFor,
        CATS,
        METHOD,
        MSG_CUSTOMER,
        paid,
        statusLabel,
        eligibility,
        summary,
        ST,
        PAY,
        badge,
        money,
        quote,
        canCustomerCancel,
        canEmployeeCancel,
        canEmployeeReject,
        cancel,
        advance,
        forBooking,
        byRef,
        list,
        view,
        sync,
        removeFor,
        openCancel,
        dt,
    };
})();
