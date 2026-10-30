/* Booking history for customers and employees. Needs data/cars.json (loaded by cars-loader.js), auth.js, fees.js and branches.js (load it before account.js).
   100% local: nothing is stored here. Every figure is worked out from the bookings, inspections and Penalty Fee records in localStorage each
   time a screen is drawn, so the Customer Dashboard, the Employee Portal, the receipt and the TXT reports can never disagree.

   ASSUMPTIONS (edit the settings below):
   - Bookings only store dates, so the pick-up time is PICKUP_TIME and the agreed return time is Fees.RETURN_TIME.
   - Deposit: a card hold of DEPOSIT per booking (terms section 4: placed at pick-up, released after the car is returned in satisfactory condition).
     It is released when the inspection is complete and any Penalty Fee is fully paid. Until then it is "Held" / "Retained".
     A booking can carry its own b.deposit to override the default.
   - Refund: only cancelled bookings refund rental money, using the terms (section 8, rules live in refunds.js): a customer-requested cancellation
     refunds 100% of the rental amount (fee S$0.00) and an AZoom-side cancellation refunds 100% of all payments made. A cancelled booking's
     Booking Status reads "Cancelled - Fully Refunded" (Refunds.statusLabel). Once a booking is completed, the Refund Amount is the released deposit. */
const History = (() => {
    const A = Auth,
        F = Fees,
        E = A.esc,
        M = F.money;
    const PICKUP_TIME = Refunds.PICKUP_TIME; /* one setting, kept in refunds.js */
    const DEPOSIT = 500;

    const car = (b) => (typeof carFor === 'function' ? carFor(b) : null);
    const plate = (b) => (car(b) ? carReg(carIndexOf(b)) : 'N/A');
    const code = (b) => (car(b) ? carCode(carIndexOf(b)) : 'N/A');
    const ts = (d, t) => {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''),
            x = /^(\d{1,2}):(\d{2})$/.exec(t || '');
        return m && x ? new Date(+m[1], +m[2] - 1, +m[3], +x[1], +x[2]).getTime() : 0;
    };
    const dt = (t) => (t ? A.stamp(t).slice(0, 16) : 'N/A');
    const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
    const g = (l, v) =>
        `<div><small>${E(l)}</small><span>${E(v == null || v === '' ? 'N/A' : v)}</span></div>`;
    const gh = (l, h) =>
        `<div><small>${E(l)}</small><span>${h}</span></div>`; /* value is already safe HTML */
    const pill = (cls, t) => `<span class="badge ${cls}">${E(String(t).toUpperCase())}</span>`;

    /* ---------- Everything a history screen needs about one booking ---------- */
    function model(b) {
        const c = car(b),
            s = F.forBooking(b.id),
            ins = F.latestInspection(b.id),
            today = A.today();
        const pickTs = ts(b.from, PICKUP_TIME),
            retTs = F.scheduledReturn(b),
            total = Number(b.total) || 0;
        let stage;
        if (b.status === 'cancelled') stage = 'cancelled';
        else if (b.status === 'rejected') stage = 'rejected';
        else if (b.status === 'completed') stage = 'completed';
        else if (b.status === 'awaiting_inspection') stage = 'returned';
        else if (b.status === 'confirmed' && b.from <= today) stage = 'active';
        else stage = 'upcoming';
        const returned = b.status === 'awaiting_inspection' || b.status === 'completed';
        const inspection =
            b.status === 'cancelled' || b.status === 'rejected'
                ? 'na'
                : ins
                  ? 'completed'
                  : b.status === 'awaiting_inspection'
                    ? 'pending'
                    : b.status === 'completed'
                      ? 'none'
                      : 'notdue';

        /* deposit + refund */
        let dep = 0,
            depState = 'Not applicable',
            refund = 0,
            refundNote = '';
        const rf = b.status === 'cancelled' || b.status === 'rejected' ? Refunds.view(b) : null;
        if (rf) {
            refund = r2(rf.refundAmount);
            refundNote = rf.note;
        } else {
            dep = b.deposit != null ? r2(b.deposit) : DEPOSIT;
            if (b.status === 'pending') depState = 'Hold placed at pick-up';
            else if (b.status === 'completed') {
                if (s.outstanding > 0) depState = 'Retained until the Penalty Fee is settled';
                else {
                    depState = 'Released';
                    refund = dep;
                    refundNote = 'Deposit hold released';
                }
            } else depState = 'Held';
        }
        /* rental payment status */
        let pay;
        if (rf)
            pay = {
                label: Refunds.PAY[rf.status] || 'Refund Pending',
                cls: (Refunds.ST[rf.status] || Refunds.ST.pending).cls,
            };
        else pay = { label: 'Paid', cls: 's-none' };
        return {
            b,
            c,
            s,
            ins,
            stage,
            returned,
            inspection,
            plate: plate(b),
            code: code(b),
            pickTs,
            retTs,
            pickup: b.from + ' ' + PICKUP_TIME,
            agreedReturn: b.to + ' ' + F.RETURN_TIME,
            deposit: dep,
            depositState: depState,
            refund,
            refundNote,
            pay,
            total,
            rf,
            refunded: !!rf && (rf.status === 'refunded' || rf.status === 'partial'),
            name: b.name || A.nameOf(b.email),
            vehicle: c ? c.mk + ' ' + c.n : b.title,
        };
    }
    const STAGE = {
        upcoming: 'Upcoming',
        active: 'Active',
        returned: 'Returned',
        completed: 'Completed',
        cancelled: 'Cancelled',
        rejected: 'Rejected',
    };
    const INSP = {
        pending: ['b-awaiting_inspection', 'Inspection Pending'],
        completed: ['b-completed', 'Inspection Completed'],
        na: ['b-cancelled', 'Not applicable'],
        notdue: ['b-cancelled', 'Not yet returned'],
        none: ['b-cancelled', 'No report on file'],
    };
    const inspPill = (m) => pill(INSP[m.inspection][0], INSP[m.inspection][1]);
    const payPill = (m) => `<span class="fbadge ${m.pay.cls}">${E(m.pay.label)}</span>`;
    const statusPill = (b) => pill('b-' + b.status, Refunds.statusLabel(b));

    /* ---------- Filters ---------- */
    const FILTERS = [
        ['all', 'All'],
        ['active', 'Active'],
        ['upcoming', 'Upcoming'],
        ['returned', 'Returned'],
        ['completed', 'Completed'],
        ['cancelled', 'Cancelled'],
        ['rejected', 'Rejected'],
        ['refunded', 'Refunded'],
        ['penalty', 'Penalty Fee History'],
        ['insp_pending', 'Inspection Pending'],
        ['insp_done', 'Inspection Completed'],
    ];
    const CUST_FILTERS = FILTERS.slice(0, 8);
    const matches = (m, k) =>
        k === 'all' ||
        (k === 'active' && m.stage === 'active') ||
        (k === 'upcoming' && m.stage === 'upcoming') ||
        (k === 'returned' && m.stage === 'returned') ||
        (k === 'completed' && m.stage === 'completed') ||
        (k === 'cancelled' && m.stage === 'cancelled' && !m.refunded) ||
        (k === 'rejected' && m.stage === 'rejected') ||
        (k === 'refunded' && m.refunded) ||
        (k === 'penalty' && m.s.total > 0) ||
        (k === 'insp_pending' && m.inspection === 'pending') ||
        (k === 'insp_done' && m.inspection === 'completed');
    const chips = (list, rows, cur) =>
        `<div class="fchips">${list.map(([k, l]) => `<button type="button" class="fchip${cur === k ? ' on' : ''}" data-hf="${k}">${l} <i>${rows.filter((m) => matches(m, k)).length}</i></button>`).join('')}</div>`;

    /* ---------- Detail sections (shared by customer and employee) ---------- */
    const feeBlock = (m, withPays) => {
        const s = m.s;
        const lines = [
            ['fuel_penalty', 'Fuel Penalty Fee', s.fuelPenalty],
            ['battery_penalty', 'Battery Penalty Fee', s.batteryPenalty],
            ['late', 'Late Return Fee', s.late],
            ['damage', 'Damage Fee', s.damage],
            ['cleaning', 'Cleaning Fee', s.cleaning],
            ['traffic', 'Traffic Fine', s.traffic],
        ];
        const chargeCards = lines
            .map(([type, label, amount]) => {
                const reason = ((s.fee && s.fee.charges) || [])
                    .filter((c) => c.type === type && c.note)
                    .map((c) => c.note)
                    .join('; ');
                return `<article class="charge-card${amount > 0 ? ' has-penalty' : ''}"><span class="charge-label">${E(label)}</span><b class="charge-amount">${M(amount)}</b>${reason ? `<small class="charge-reason">${E(reason)}</small>` : ''}</article>`;
            })
            .join('');
        const items =
            s.fee && s.fee.charges
                ? s.fee.charges
                      .map(
                          (c) =>
                              `<li><span>${E(F.TYPES[c.type] || c.label)} · ${M(c.amount)}</span><small>Date Applied: ${E(dt(c.at))} · Staff Member: ${E(c.byName || '-')} (${E(c.byId || '-')})${c.note ? ' · Reason: ' + E(c.note) : ''}</small></li>`,
                      )
                      .join('')
                : '';
        const pays = withPays
            ? ((s.fee && s.fee.payments) || [])
                  .map(
                      (p) =>
                          `<li><span>${E(dt(p.at))} · receipt ${E(p.receipt || '-')}</span><b>${M(p.amount)}</b></li>`,
                  )
                  .join('')
            : '';
        return `<h4>Additional Charges</h4><div class="charge-grid history-charge-grid">${chargeCards}</div>
   <div class="charge-summary"><div class="charge-total"><span>Total Additional Charges</span><b>${M(s.total)}</b></div><div class="pigrid charge-meta-grid">${g('Amount Paid', M(s.paid)) + g('Outstanding Balance', M(s.outstanding)) + g('Due Date', s.dueDate || 'N/A') + gh('Penalty Status', F.badge(s.status))}</div></div>
   ${items ? `<h4>Penalty Fee history</h4><ul class="hlist">${items}</ul>` : ''}${pays ? `<ul class="hlist">${pays}</ul>` : ''}`;
    };
    const bookingBlock = (m, emp) => {
        const b = m.b;
        return `<h4>Booking information</h4><div class="pigrid">${
            g('Booking ID', b.id) +
            g('Booking Date', dt(b.created)) +
            g('Booking Status', Refunds.statusLabel(b)) +
            g('Stage', STAGE[m.stage]) +
            g('Pick-up (scheduled)', m.pickup) +
            g('Return (agreed)', m.agreedReturn) +
            g(
                'Handed over',
                b.approvedAt
                    ? dt(b.approvedAt) +
                          (emp && b.approvedBy ? ' by ' + A.nameOf(b.approvedBy) : '')
                    : 'Not yet',
            ) +
            g(
                'Returned at',
                b.returnedAt
                    ? dt(b.returnedAt) +
                          (emp && b.returnedBy
                              ? ' (' +
                                (b.returnedBy === 'customer'
                                    ? 'by customer'
                                    : 'marked by employee') +
                                ')'
                              : '')
                    : 'Not yet',
            ) +
            g('Rental duration', b.days + (b.days === 1 ? ' day' : ' days')) +
            g(
                'Malaysia Travel',
                b.malaysiaTravel === true
                    ? 'Yes'
                    : b.malaysiaTravel === false
                      ? 'No'
                      : 'Not recorded',
            ) +
            g(
                'GPS & travel-area acknowledged',
                b.gpsAcknowledged === true
                    ? 'Yes' + (b.policyAckAt ? ' (' + dt(b.policyAckAt) + ')' : '')
                    : 'Not recorded',
            ) +
            (b.status === 'cancelled' ? g('Cancelled at', dt(b.cancelledAt)) : '') +
            (b.status === 'rejected'
                ? g('Rejected at', dt(b.rejectedAt || b.cancelledAt)) +
                  (emp
                      ? g(
                            'Rejected by',
                            (b.rejectedByName || b.cancelledByName || '-') +
                                ' (' +
                                (b.rejectedBy || b.cancelledById || '-') +
                                ')',
                        )
                      : '') +
                  g(
                      'Rejection reason',
                      b.rejectionReason || b.cancellationReason || 'Not recorded',
                  )
                : '')
        }</div>
   <div class="bgrid">${Branches.detail(b.pickup, 'Pick-up branch') + Branches.detail(b.ret, 'Return branch')}</div>`;
    };
    const vehicleBlock = (m) => {
        const c = m.c;
        return `<h4>Vehicle information</h4><div class="pigrid">${g('Vehicle', m.vehicle) + g('Car ID', m.code) + g('Plate Number', m.plate) + (c ? g('Category', c.t === 'SPORTS' ? 'Sports' : 'Luxury') + g('Body type', c.ty) + g('Power', c.hp + ' hp') + g('Seats', c.s) + g('Transmission', c.tr === 'Auto' ? 'Automatic' : c.tr) + g('Fuel type', c.f) + g('Daily rate', M(c.p)) : '')}</div>`;
    };
    const paymentBlock = (m, emp) => {
        const b = m.b,
            base = m.total - (Number(b.oneWayFee) || 0);
        return `<h4>Payment summary</h4><div class="pigrid">${
            (b.employeeRental
                ? g('Original rental', M(b.rentalOriginal)) +
                  g('Employee discount (50%)', '−' + M(b.discountAmount))
                : g('Rental (' + b.days + (b.days === 1 ? ' day)' : ' days)'), M(base))) +
            (b.oneWayFee > 0 ? g('One-way return fee', M(b.oneWayFee)) : '') +
            g('Total Rental Cost', M(m.total)) +
            gh('Payment Status', payPill(m)) +
            g('Paid by', 'Card •••• ' + (b.card4 || '----')) +
            g('Receipt no.', b.receipt || '-') +
            g('Paid on', dt(b.paidAt || b.created)) +
            g('Deposit Amount', M(m.deposit)) +
            g('Deposit status', m.depositState) +
            g('Refund Amount', M(m.refund)) +
            (m.refundNote ? g('Refund note', m.refundNote) : '')
        }</div>`;
    };
    const inspectionBlock = (m, emp) => {
        const i = m.ins;
        if (!i)
            return `<h4>Return condition assessment</h4><p class="hint">${m.inspection === 'pending' ? 'The car has been returned and is waiting for its inspection.' : m.inspection === 'na' ? 'This booking was cancelled or rejected, so there is no inspection.' : m.inspection === 'notdue' ? 'The car has not been returned yet.' : 'No inspection report is on file for this booking.'}</p>`;
        const ok = /perfect|good/i.test(i.cond || ''),
            cls = ok ? 'b-completed' : /minor/i.test(i.cond || '') ? 'b-pending' : 'b-major';
        const L = F.lateFee(F.dailyRate(m.b), m.retTs, m.b.returnedAt || 0);
        const name = i.inspectionEmployeeName || A.nameOf(i.by),
            id = i.inspectionEmployeeId || A.uid(i.by);
        return `<h4>Return condition assessment</h4><div class="pigrid">${
            gh(
                'Condition',
                `<span class="badge ${cls}">${E(String(i.cond || '').toUpperCase())}</span>`,
            ) +
            g('Inspected on', dt(i.at)) +
            g('Inspection report ref.', i.ref || m.s.ref || '-') +
            (emp ? g('Inspector', name + ' (' + id + ')') : '') +
            (i.fuelLevel != null ? g('Fuel Level', i.fuelLevel + '%') : '') +
            (i.batteryCharge != null ? g('Battery Charge', i.batteryCharge + '%') : '') +
            (i.penaltyApplied != null
                ? g('Penalty Status', i.penaltyApplied ? 'Applied' : 'Not applied')
                : '') +
            (i.penaltyAmount != null ? g('Penalty Amount', M(i.penaltyAmount)) : '') +
            g(
                'Return timing',
                L.fee > 0
                    ? Fees.human(L.minutesLate) + ' late (' + L.tier + ')'
                    : 'On time or within the grace period',
            ) +
            g('Damage description', i.desc || 'No damage found.') +
            g('Inspection notes', i.notes || 'None')
        }</div>`;
    };
    const customerBlock = (m) => {
        const b = m.b;
        return `<h4>Customer information</h4><div class="pigrid">${g('Customer Name', m.name) + g('Customer Email', b.email) + g('Customer ID', A.uid(b.email)) + g('Phone', b.phone || 'N/A') + g('Driver licence', b.license || 'N/A') + (b.employeeRental ? g('Employee rental', (b.bookingEmployeeName || '') + ' (' + (b.bookingEmployeeId || '') + ')') : '')}</div>`;
    };
    /* Cancellation and rejection refund details */
    const cancelBlock = (m, emp) => {
        const r = m.rf;
        if (!r) return '';
        const b = m.b;
        return `<div class="cancelbox"><div class="cbh">${b.status === 'rejected' ? 'Rejection' : 'Cancellation'} &amp; Refund</div><div class="pigrid">${
            g('Rental Amount', M(r.rentalAmount)) +
            g('Cancellation Fee', M(r.cancellationFee)) +
            g('Refund Amount', M(r.refundAmount)) +
            g(
                'Refund Method',
                r.refundAmount > 0
                    ? (r.refundMethod || r.method) +
                          (r.card4 ? ' (\u2022\u2022\u2022\u2022 ' + r.card4 + ')' : '')
                    : 'N/A',
            ) +
            g('Refund Date', r.refundedAt ? dt(r.refundedAt) : 'Not refunded yet') +
            g(
                'Refund Reason',
                r.refundReason || r.reason || b.cancellationReason || 'Not recorded',
            ) +
            g('Refund Reference Number', r.ref || '-') +
            g(
                b.status === 'rejected' ? 'Rejected because' : 'Cancelled because',
                b.status === 'rejected'
                    ? 'Employee rejection'
                    : Refunds.CATS[b.cancellationCategory || r.category || 'customer'] ||
                          'Customer Request',
            ) +
            (emp
                ? g(
                      b.status === 'rejected' ? 'Rejected by' : 'Cancelled by',
                      (b.rejectedByName || b.cancelledByName || r.cancelledByName || '-') +
                          ' (' +
                          (b.status === 'rejected'
                              ? b.rejectedBy || b.cancelledById || r.cancelledById || '-'
                              : b.cancelledBy || r.cancelledBy || '-') +
                          ')',
                  )
                : '')
        }</div></div>`;
    };
    /* Booking summary: Malaysia travel, GPS acknowledgement, refund eligibility / status / amount, cancellation date + reason. Same lines everywhere (Refunds.summary). */
    const policyBlock = (m) => {
        const rows = Refunds.summary(m.b, { refundAmount: m.refund })
            .map(([l, v, k]) => (k ? gh(l, Refunds.badge(k)) : g(l, v)))
            .join('');
        return `<div class="cancelbox policybox"><div class="cbh">Travel, GPS &amp; Refund</div><div class="pigrid">${rows}</div></div>`;
    };
    const logBlock = (m) => {
        const b = m.b,
            r = m.rf,
            rows = []
                .concat(
                    (b.cancellationLog || []).map((e) => ({
                        at: e.at,
                        t: e.action + (e.detail ? ': ' + e.detail : ''),
                        by: e.byName,
                    })),
                    ((r && r.history) || []).map((e) => ({
                        at: e.at,
                        t: 'Refund \u00b7 ' + e.action + (e.detail ? ': ' + e.detail : ''),
                        by: e.byName,
                    })),
                )
                .sort((x, y) => x.at - y.at);
        return rows.length
            ? `<h4>Cancellation &amp; refund log</h4><ul class="hlist">${rows.map((x) => `<li><span>${E(x.t)}</span><small>${E(dt(x.at))} \u00b7 ${E(x.by || 'System')}</small></li>`).join('')}</ul>`
            : '';
    };
    /* Full employee view */
    function detailEmployee(b) {
        const m = model(b);
        let rep;
        if (m.ins) {
            try {
                rep = F.reportText(b.id, (A.user() || {}).email);
            } catch (x) {
                rep = x.message;
            }
        }
        return `<div class="hpanel dsec"><div class="hphead"><b>Booking Details · ${E(b.id)}</b><small>Live view: always the latest data stored on this computer</small></div>
   ${bookingBlock(m, true) + vehicleBlock(m) + customerBlock(m) + paymentBlock(m, true) + logBlock(m) + feeBlock(m, true) + inspectionBlock(m, true)}
   <h4>Inspection report</h4>${rep ? `<pre class="rpt" tabindex="0">${E(rep)}</pre>` : `<p class="hint">No inspection report yet.</p>`}
   <div class="acts" style="margin:12px 0 0"><button type="button" class="act" data-hrec="${E(b.id)}">Download Receipt (.txt)</button></div></div>`;
    }
    function detailCustomer(b) {
        const m = model(b);
        return `<div class="hpanel dsec"><div class="hphead"><b>Booking Details · ${E(b.id)}</b>${statusPill(b)}</div>
   ${bookingBlock(m, false) + vehicleBlock(m) + paymentBlock(m, false) + logBlock(m) + feeBlock(m, true) + inspectionBlock(m, false)}</div>`;
    }

    /* ---------- Customer cards ---------- */
    function customerCard(m, open) {
        const b = m.b,
            c = m.c || { mk: '', n: b.title, c: '#222' },
            s = m.s,
            statusNote =
                b.status === 'cancelled'
                    ? 'Your previous booking was cancelled. You may create a new booking.'
                    : b.status === 'rejected'
                      ? 'Your booking was rejected. You may create a new booking for the same or different dates.'
                      : '';
        const rejectionReason =
            b.status === 'rejected'
                ? b.rejectionReason || b.cancellationReason || 'No reason was recorded.'
                : '';
        const rent = m.c
            ? `<a class="act" href="../payment/payment.html?${new URLSearchParams({ car: b.carId, pk: b.pickup, rt: b.ret })}">Rent Again</a>`
            : '';
        return `<article class="bk hist" data-hb="${E(b.id)}"><div class="bkimg"><em>${E(String(c.mk).split('-')[0])}</em>${typeof bookingImg === 'function' ? bookingImg(c) : ''}</div>
  <div class="bkbody"><div class="bktop"><div>${statusPill(b)}<small>${E(c.mk)}</small><h3>${E(c.n)}</h3><small>Plate ${E(m.plate)}</small></div><div class="bkprice"><b>${M(m.total)}</b><small>total rental cost</small></div></div>
  ${statusNote ? `<p class="hint">${statusNote}</p>` : ''}${rejectionReason ? `<div class="rejection-note"><b>Reason for Rejection</b><p>${E(rejectionReason)}</p></div>` : ''}<div class="bkmeta">${
      g('Booking ID', b.id) +
      g('Booking Date', dt(b.created)) +
      g('Pick-up Date & Time', m.pickup) +
      g('Return Date & Time', m.agreedReturn) +
      g('Pick-up Location', Branches.label(b.pickup)) +
      g('Return Location', Branches.label(b.ret)) +
      g('Rental Duration', b.days + (b.days === 1 ? ' day' : ' days')) +
      g('Deposit Amount', M(m.deposit)) +
      g('Refund Amount', M(m.refund)) +
      gh('Penalty Fee', s.total > 0 ? `<b>${M(s.total)}</b> ${F.badge(s.status)}` : 'None') +
      gh('Payment Status', payPill(m))
  }</div>${policyBlock(m)}${cancelBlock(m, false)}
  <div class="bkfoot"><span>Paid with card •••• ${E(b.card4 || '----')}</span><div class="acts">
   <button type="button" class="act${open ? ' on' : ''}" data-hview="${E(b.id)}">${open ? 'Hide' : 'View'} Booking Details</button>
   <button type="button" class="act" data-hrec="${E(b.id)}">Download Receipt</button>
   ${m.ins ? `<button type="button" class="act" data-hinsp="${E(b.id)}">Download Inspection Report</button>` : ''}${Refunds.canCustomerCancel(b) ? `<button type="button" class="act warn" data-cancel="${E(b.id)}">Cancel Booking</button>` : ''}${typeof Reviews !== 'undefined' ? Reviews.histBtn(b) : ''}${rent}</div></div>
  ${open ? detailCustomer(b) : ''}</div></article>`;
    }
    /* The customer's own booking history (all of it, forever). st = {f: filter key, open: {bookingId:true}} */
    function customer(email, st) {
        const rows = A.bookings()
                .filter((b) => b.email === email)
                .sort((x, y) => (y.created || 0) - (x.created || 0))
                .map(model),
            cur = st.f || 'all';
        const shown = rows.filter((m) => matches(m, cur));
        if (cur === 'penalty')
            return (
                `<h2 class="sec">Booking History</h2>` +
                chips(CUST_FILTERS, rows, cur) +
                penaltySection(penaltyRows(email), st, 'cust')
            );
        return (
            `<h2 class="sec">Booking History</h2><p class="hint" style="margin:-6px 0 16px">Every rental on your account stays here, including completed, returned, cancelled and rejected bookings.</p>` +
            chips(CUST_FILTERS, rows, cur) +
            (shown.length
                ? shown.map((m) => customerCard(m, !!(st.open || {})[m.b.id])).join('')
                : `<div class="empty2">${A.ic('car', 36)}<h3>${rows.length ? 'No bookings match this filter' : 'No bookings yet'}</h3><p>${rows.length ? 'Choose another filter above.' : 'Browse our fleet and reserve your first dream car.'}</p>${rows.length ? '' : '<a class="btn red" href="../fleet/fleet.html">Browse Fleet</a>'}</div>`)
        );
    }

    /* ---------- Employee cards: any booking, any status ---------- */
    function employeeCard(b, acts, panelHtml) {
        const m = model(b),
            c = m.c || { mk: '', n: b.title, c: '#222' },
            s = m.s;
        return `<article class="bk hist" data-hb="${E(b.id)}"><div class="bkimg"><em>${E(String(c.mk).split('-')[0])}</em>${typeof bookingImg === 'function' ? bookingImg(c) : ''}</div>
  <div class="bkbody"><div class="bktop"><div>${statusPill(b)}<small>${E(c.mk)}</small><h3>${E(c.n)}</h3><small>Plate ${E(m.plate)} · ${E(m.code)}</small></div><div class="bkprice"><b>${M(m.total)}</b><small>total rental cost</small></div></div>
  <div class="bkmeta">${
      g('Customer Name', m.name) +
      g('Customer Email', b.email) +
      g('Booking ID', b.id) +
      g('Vehicle', m.vehicle + (m.c ? ' (' + m.c.ty + ')' : '')) +
      g('Vehicle Plate Number', m.plate) +
      g('Pick-up Branch', Branches.label(b.pickup)) +
      g('Return Branch', Branches.label(b.ret)) +
      g('Booking Date', dt(b.created)) +
      g('Return Date', b.to + (b.returnedAt ? ' (returned ' + dt(b.returnedAt) + ')' : ''))
  }</div>
  <div class="hbadges"><span><small>Booking Status</small>${statusPill(b)}</span><span><small>Payment Status</small>${payPill(m)}</span><span><small>Inspection Status</small>${inspPill(m)}</span><span><small>Penalty Fee Status</small>${F.badge(s.status)}${s.total > 0 ? ` <b>${M(s.total)}</b>` : ''}</span>${m.rf ? `<span><small>Refund Status</small>${Refunds.badge(m.rf.status)}</span>` : ''}</div>${policyBlock(m)}${cancelBlock(m, true)}
  <div class="bkfoot"><span>${b.employeeRental ? 'Employee rental · ' : ''}Booking ${E(b.id)}</span><div class="acts">${acts || ''}</div></div>${panelHtml || ''}</div></article>`;
    }
    /* Search text for one booking: customer name, email, booking ID, plate number, vehicle model, car ID, branches */
    const haystack = (b) =>
        [b.email, b.name, A.nameOf(b.email), b.title, b.pickup, b.ret, b.id, plate(b), code(b)]
            .join(' ')
            .toLowerCase();

    /* ================= PENALTY FEE HISTORY (all penalty records, permanently) ================= */
    const PF_FILTERS = [
        ['all', 'All'],
        ['outstanding', 'Outstanding'],
        ['partial', 'Partially Paid'],
        ['paid', 'Fully Paid'],
        ['waived', 'Waived'],
    ];
    const pfMatch = (s, k) =>
        k === 'all' ||
        (k === 'outstanding' && (s.status === 'pending' || s.status === 'overdue')) ||
        s.status === k;
    /* every Penalty Fee record joined with its booking; email = only that customer's, null = everybody's */
    const penaltyRows = (email) =>
        F.list()
            .map((s) => ({ s, b: A.bookings().find((x) => x.id === s.bookingId) }))
            .filter((r) => r.b && (!email || r.b.email === email))
            .sort((x, y) => (y.s.createdAt || 0) - (x.s.createdAt || 0));
    const outstandingRows = (email) =>
        penaltyRows(email).filter((r) => r.s.outstanding > 0 && r.s.status !== 'waived');
    const payRow = (p, b, emp) =>
        `<li><span>${E(dt(p.at))} \u00b7 receipt ${E(p.receipt || '-')} \u00b7 ${E((p.method || 'Online card') + (p.card4 ? ' \u2022\u2022\u2022\u2022 ' + p.card4 : '') + (p.reference ? ' (ref ' + p.reference + ')' : ''))}${emp && p.recordedByName ? ' \u00b7 recorded by ' + E(p.recordedByName) : ''}</span><b>${M(p.amount)}</b><small>Balance after: ${M(p.balanceAfter || 0)} <button type="button" class="act" data-hpr1="${E(b.id + '|' + p.id)}">Download receipt</button></small></li>`;
    function penaltyDetail(r, mode) {
        const s = r.s,
            b = r.b,
            f = s.fee,
            emp = mode === 'emp';
        const charges = (f.charges || [])
            .map(
                (c) =>
                    `<li><span>${E(Fees.TYPES[c.type] || c.label)}</span><b>${M(c.amount)}</b><small>Date Applied: ${E(dt(c.at))} \u00b7 Staff Member: ${E(c.byName || '-')} (${E(c.byId || '-')})${c.note ? ' \u00b7 Reason: ' + E(c.note) : ''}</small></li>`,
            )
            .join('');
        const pays = (s.payments || []).map((p) => payRow(p, b, emp)).join('');
        const wv = []
            .concat(f.waiverHistory || [], s.waiver ? [s.waiver] : [])
            .map(
                (w) =>
                    `<li><span>Waived ${M(w.amount)} on ${E(dt(w.at))} by ${E(w.byName || '-')}: ${E(w.reason)}${w.reinstatedAt ? ' (reversed ' + E(dt(w.reinstatedAt)) + ' by ' + E(w.reinstatedBy || '-') + ': ' + E(w.reinstateReason || '') + ')' : ''}</span></li>`,
            )
            .join('');
        return `<div class="hpanel"><h4>Penalty Fee items</h4><ul class="hlist">${charges}</ul>
   <h4>Payment records</h4>${pays ? `<ul class="hlist">${pays}</ul>` : `<p class="hint">No payments yet.</p>`}
   ${wv ? `<h4>Waivers</h4><ul class="hlist">${wv}</ul>` : ''}
   ${
       emp
           ? `<h4>Audit trail</h4><ul class="hlist">${(f.audit || [])
                 .slice()
                 .reverse()
                 .map(
                     (e) =>
                         `<li><span>${E(e.action)}${e.detail ? ': ' + E(e.detail) : ''}</span><small>${E(A.stamp(e.at).slice(0, 19))} \u00b7 ${E(e.byName || 'System')}${e.byId && e.byId !== 'SYSTEM' ? ' (' + E(e.byId) + ')' : ''}</small></li>`,
                 )
                 .join('')}</ul>`
           : ''
   }</div>`;
    }
    function penaltyCard(r, mode, open) {
        const s = r.s,
            b = r.b,
            emp = mode === 'emp',
            id = E(b.id),
            m = model(b),
            session = A.user(),
            selfRental = emp && session && A.isSelfBooking(b, session.email),
            disabledTitle = selfRental ? ` disabled title="${E(F.SELF_RENTAL_TOOLTIP)}"` : '';
        const payDate = s.lastPaymentAt
            ? dt(s.lastPaymentAt)
            : s.status === 'waived'
              ? 'Waived ' + dt(s.waiver.at)
              : 'No payment yet';
        let acts = `<button type="button" class="act${open ? ' on' : ''}" data-hpv="${id}">${open ? 'Hide' : 'View'} ${emp ? 'Payment History' : 'Payment Records'}</button>`;
        if (s.payments.length)
            acts += `<button type="button" class="act" data-hpr="${id}">Download Penalty Receipt</button>`;
        if (m.ins)
            acts += `<button type="button" class="act" data-${emp ? 'dl' : 'hinsp'}="${id}">${emp ? 'Download Latest Inspection Report (.txt)' : 'Download Inspection Report'}</button>`;
        if (emp) {
            if (s.status === 'waived')
                acts =
                    `<button type="button" class="act" data-pa="reinstate" data-id="${id}"${disabledTitle}>Reinstate Penalty</button>` +
                    acts;
            else {
                if (s.outstanding > 0)
                    acts =
                        `<button type="button" class="act red" data-pa="pay" data-id="${id}"${disabledTitle}>Record Payment</button><button type="button" class="act warn" data-pa="waive" data-id="${id}"${disabledTitle}>Waive Penalty</button>` +
                        acts;
                acts =
                    `<button type="button" class="act" data-pa="issue" data-id="${id}"${disabledTitle}>Add Penalty</button>` +
                    acts;
            }
        } else if (s.outstanding > 0)
            acts =
                `<a class="act red" href="../damage-payment/damage-payment.html?id=${encodeURIComponent(b.id)}">${s.paid > 0 ? 'Pay Remaining Balance' : 'Pay Now'}</a>` +
                acts;
        return `<article class="payitem ${s.st.cls}" data-fee="${id}"><div class="pitop"><h3>${A.ic('card', 18)} ${E(m.vehicle)} \u00b7 ${id}</h3>${F.badge(s.status)}</div>
   <div class="pigrid">${
       g('Booking ID', b.id) +
       g('Inspection Report Reference', s.ref || 'No report') +
       g('Penalty Reference Number', s.penaltyRef) +
       g('Penalty Date', dt(s.createdAt)) +
       g('Penalty Amount', M(s.total)) +
       g('Amount Paid', M(s.paid)) +
       g('Outstanding Balance', M(s.outstanding)) +
       gh('Payment Status', F.badge(s.status)) +
       g('Payment Date', payDate) +
       g('Receipt Number', s.lastReceipt || '-') +
       g('Issued by', s.issuedBy + ' (' + s.issuedById + ')') +
       (emp ? g('Customer', m.name + ' \u00b7 ' + b.email) : '') +
       g('Due Date', s.dueDate)
   }</div>
   <div class="pfb"><b style="font-size:12px;letter-spacing:.08em;color:var(--mute);text-transform:uppercase">Penalty breakdown</b><div class="pigrid" style="margin-top:8px">${g('Damage Cost', M(s.damage)) + g('Cleaning Fee', M(s.cleaning)) + g('Traffic Fine', M(s.traffic)) + g('Late Return Fee', M(s.late))}</div></div>
   ${s.waiver ? `<p class="hint">Waived ${M(s.waivedAmount)} on ${E(dt(s.waiver.at))} by ${E(s.waiver.byName)}. Reason: ${E(s.waiver.reason)}</p>` : ''}
   ${selfRental ? `<p class="self-penalty-notice" role="note">${E(F.SELF_RENTAL_MESSAGE)}</p>` : ''}
   ${s.overdue ? `<p class="odmsg" role="alert">${A.ic('warn', 16)} ${E(F.OVERDUE_MSG)}</p>` : ''}
   <div class="acts">${acts}</div>${open ? penaltyDetail(r, mode) : ''}</article>`;
    }
    /* chips + cards. st = {pf: status filter, popen: {bookingId:true}} */
    function penaltySection(rows, st, mode) {
        const cur = st.pf || 'all',
            shown = rows.filter((r) => pfMatch(r.s, cur));
        const chip = ([k, l]) =>
            `<button type="button" class="fchip${cur === k ? ' on' : ''}" data-hpf="${k}">${l} <i>${rows.filter((r) => pfMatch(r.s, k)).length}</i></button>`;
        return (
            `<h2 class="sec" style="margin-top:6px">Penalty Fee History</h2><p class="hint" style="margin:-6px 0 14px">Every Penalty Fee is kept here permanently, including fully paid and waived ones, with its payment records.</p>
   <div class="fchips">${PF_FILTERS.map(chip).join('')}</div>` +
            (shown.length
                ? shown.map((r) => penaltyCard(r, mode, !!(st.popen || {})[r.b.id])).join('')
                : `<div class="empty2">${A.ic('card', 36)}<h3>${rows.length ? 'No penalties match this filter' : 'No Penalty Fee records'}</h3><p>${rows.length ? 'Choose another filter above.' : 'Penalty Fees appear here after an inspection or when an employee issues one.'}</p></div>`)
        );
    }
    /* Customer dashboard "Outstanding Penalties": unpaid balances only. Fully paid and waived ones move to Penalty Fee History. */
    function outstanding(email, st) {
        const rows = outstandingRows(email);
        return (
            `<h2 class="sec">Outstanding Penalties</h2>` +
            (rows.length
                ? rows.map((r) => penaltyCard(r, 'cust', !!(st.popen || {})[r.b.id])).join('')
                : `<div class="empty2 nopen">${A.ic('check', 36)}<h3>No Outstanding Penalties</h3><p>You have no unpaid Penalty Fees. Paid and waived penalties are kept in Penalty Fee History.</p></div>`)
        );
    }
    function downloadPenaltyReceipt(id, viewer, payId) {
        const b = A.bookings().find((x) => x.id === id),
            s = F.forBooking(id);
        if (!mayRead(b, viewer)) throw Error('This Penalty Fee belongs to another account.');
        return save(
            `PenaltyReceipt_${s.penaltyRef || id}_${stampName()}.txt`,
            F.penaltyReceiptText(id, viewer, payId),
        );
    }

    /* ---------- Small pop-up form used by the employee penalty actions ----------
    fields: [{id,label,type:"number|text|textarea|select|date",options:[[value,label]],value,hint,required,min,step}]. onSubmit(values) may throw an Error (shown in the pop-up) and may return a message. */
    function dialog(o) {
        if (document.querySelector('[data-modal]')) return;
        const opener = document.activeElement,
            wrap = document.createElement('div');
        wrap.className = 'mback';
        wrap.setAttribute('data-modal', '');
        const fld = (f) =>
            `<div class="fld"><label for="df-${f.id}">${E(f.label)}${f.required ? ' (required)' : ''}</label>${
                f.type === 'textarea'
                    ? `<textarea id="df-${f.id}" rows="3" maxlength="300" placeholder="${E(f.placeholder || '')}">${E(f.value || '')}</textarea>`
                    : f.type === 'select'
                      ? `<select id="df-${f.id}">${f.options.map(([v, l]) => `<option value="${E(v)}"${v === f.value ? ' selected' : ''}>${E(l)}</option>`).join('')}</select>`
                      : `<input id="df-${f.id}" type="${f.type || 'text'}" ${f.step ? `step="${f.step}"` : ''} ${f.min != null ? `min="${f.min}"` : ''} value="${E(f.value == null ? '' : f.value)}" placeholder="${E(f.placeholder || '')}" maxlength="80">`
            }${f.hint ? `<small class="fh">${E(f.hint)}</small>` : ''}</div>`;
        wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="dt-t"><h2 id="dt-t">${E(o.title)}</h2>${o.intro ? `<p class="hint">${E(o.intro)}</p>` : ''}
   ${o.rows ? `<dl class="mrows">${o.rows.map(([l, v]) => `<div class="mrow"><dt>${E(l)}</dt><dd>${E(v)}</dd></div>`).join('')}</dl>` : ''}
   <div id="dfields">${(o.fields || []).map(fld).join('')}</div><p class="err" id="derr" role="alert"></p>
   <div class="macts"><button type="button" class="act" id="dno">Cancel</button><button type="button" class="act ${o.danger ? 'warn' : 'red'} done" id="dgo">${E(o.confirm || 'Confirm')}</button></div></div>`;
        document.body.append(wrap);
        const q = (s) => wrap.querySelector(s),
            close = () => {
                wrap.remove();
                document.removeEventListener('keydown', key);
                if (opener && opener.focus) opener.focus();
            };
        const key = (e) => {
            if (e.key === 'Escape') close();
            if (e.key === 'Tab') {
                const f = [...wrap.querySelectorAll('textarea,input,select,button')],
                    i = f.indexOf(document.activeElement);
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
        q('#dno').addEventListener('click', close);
        q('#dfields').addEventListener('input', () => {
            q('#derr').textContent = '';
        });
        q('#dgo').addEventListener('click', () => {
            const v = {};
            (o.fields || []).forEach((f) => {
                v[f.id] = q('#df-' + f.id).value;
            });
            try {
                const msg = o.onSubmit(v);
                close();
                if (msg) A.toast(msg);
            } catch (x) {
                q('#derr').textContent = x.message;
            }
        });
        const first = q('#dfields input,#dfields textarea,#dfields select');
        if (first) first.focus();
        else q('#dgo').focus();
    }

    /* ---------- Receipt (.txt) ---------- */
    const line = (c = '-') => c.repeat(60),
        row = (l, v) => `${l.padEnd(28)}${v == null || v === '' ? 'N/A' : v}`;
    const mayRead = (b, viewer) => !!b && !!viewer && (b.email === viewer || A.isEmployee(viewer));
    function receiptText(id, viewer) {
        F.sync();
        const b = A.bookings().find((x) => x.id === id);
        if (!mayRead(b, viewer)) throw Error('Booking not found on this account.');
        const m = model(b),
            s = m.s,
            o = [
                'AZOOM CAR RENTAL RECEIPT',
                '='.repeat(60),
                '',
                row('Receipt No.:', b.receipt || '-'),
                row('Paid On:', A.stamp(b.paidAt || b.created)),
                row('Receipt Generated:', A.stamp(Date.now()) + ' (latest data)'),
                '',
                line(),
                'BOOKING',
                '',
                row('Booking ID:', b.id),
                row('Booking Date:', A.stamp(b.created)),
                row('Booking Status:', Refunds.statusLabel(b)),
                row('Customer:', m.name + ' <' + b.email + '>'),
                row('Vehicle:', m.vehicle),
                row('Plate Number:', m.plate),
                row(
                    'Malaysia Travel:',
                    b.malaysiaTravel === true
                        ? 'Yes'
                        : b.malaysiaTravel === false
                          ? 'No'
                          : 'Not recorded',
                ),
                row(
                    'GPS Tracking Acknowledged:',
                    b.gpsAcknowledged === true ? 'Yes' : 'Not recorded',
                ),
                row('Pick-up:', m.pickup + ' at ' + Branches.label(b.pickup)),
                row('Return:', m.agreedReturn + ' at ' + Branches.label(b.ret)),
                row('Rental Duration:', b.days + (b.days === 1 ? ' day' : ' days')),
                '',
                line(),
                'PAYMENT',
                '',
                ...(b.employeeRental
                    ? [
                          row('Original Rental:', M(b.rentalOriginal)),
                          row('Employee Discount (50%):', '-' + M(b.discountAmount)),
                      ]
                    : [row('Rental:', M(m.total - (Number(b.oneWayFee) || 0)))]),
                ...(b.oneWayFee > 0 ? [row('One-way Return Fee:', M(b.oneWayFee))] : []),
                row('Insurance:', 'Included'),
                row('Total Rental Cost:', M(m.total)),
                row('Payment Method:', 'Card **** ' + (b.card4 || '----')),
                row('Payment Status:', m.pay.label),
                row('Deposit Amount:', M(m.deposit) + ' (' + m.depositState + ')'),
                row(
                    'Refund Amount:',
                    M(m.refund) + (m.refundNote ? ' (' + m.refundNote + ')' : ''),
                ),
            ];
        if (m.rf) {
            const r = m.rf;
            o.push(
                '',
                '-'.repeat(60),
                b.status === 'rejected' ? 'BOOKING REJECTION & REFUND' : 'CANCELLATION & REFUND',
                '',
                row(
                    b.status === 'rejected' ? 'Rejection Date:' : 'Cancellation Date:',
                    A.stamp(b.rejectedAt || b.cancelledAt || r.cancelledAt),
                ),
                row(
                    b.status === 'rejected' ? 'Rejection Reason:' : 'Cancellation Reason:',
                    b.rejectionReason ||
                        b.cancellationReason ||
                        r.reason ||
                        'Not recorded',
                ),
                row('Rental Amount:', M(r.rentalAmount)),
                row('Cancellation Fee:', M(r.cancellationFee)),
                row('Refund Amount:', M(r.refundAmount)),
                row('Refund Status:', Refunds.ST[r.status].label),
                row(
                    'Refund Method:',
                    r.refundAmount > 0
                        ? (r.refundMethod || r.method) + ' (**** ' + r.card4 + ')'
                        : 'N/A',
                ),
                row('Refund Date:', r.refundedAt ? A.stamp(r.refundedAt) : 'Not refunded yet'),
                row(
                    'Refund Reason:',
                    r.refundReason || r.reason || b.cancellationReason || 'Not recorded',
                ),
                row('Refund Reference No.:', r.ref || '-'),
            );
        }
        o.push('', '-'.repeat(60), 'PENALTY FEE', '');
        if (s.total > 0) {
            o.push(
                row('Damage Cost:', M(s.damage)),
                row('Cleaning Fee:', M(s.cleaning)),
                row('Traffic Fine:', M(s.traffic)),
                row('Late Return Fee:', M(s.late)),
                row('Fuel Penalty Fee:', M(s.fuelPenalty)),
                row('Battery Penalty Fee:', M(s.batteryPenalty)),
                row('Total Additional Charges:', M(s.total)),
                row('Total Charges incl. rental:', M(m.total + s.total)),
                row('Amount Paid:', M(s.paid)),
                row('Outstanding Balance:', M(s.outstanding)),
                row('Due Date:', s.dueDate),
                row('Penalty Fee Status:', s.st.icon + ' ' + s.st.label),
            );
            o.push('', 'CHARGE DETAILS', '');
            (s.fee.charges || []).forEach((c) =>
                o.push(
                    row('Penalty Type:', Fees.TYPES[c.type] || c.label),
                    row('Amount:', M(c.amount)),
                    row('Date Applied:', c.at ? A.stamp(c.at).slice(0, 16) : 'N/A'),
                    row('Staff Member:', (c.byName || 'N/A') + ' (' + (c.byId || 'N/A') + ')'),
                    row('Reason:', c.note || 'Not recorded'),
                    '',
                ),
            );
            (s.fee.payments || []).forEach((p, n) =>
                o.push(
                    row(
                        'Payment ' + (n + 1) + ':',
                        `${A.stamp(p.at).slice(0, 16)}  ${M(p.amount)}  receipt ${p.receipt || '-'}`,
                    ),
                ),
            );
        } else o.push(row('Penalty Fee:', 'None (' + s.st.label + ')'));
        o.push(
            '',
            '-'.repeat(60),
            'This receipt is generated from the latest data stored on this computer at the time of download.',
            '',
        );
        return o.join('\n');
    }
    const stampName = () => {
        const d = new Date(),
            p = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    };
    function save(name, text) {
        const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })),
            a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        return name;
    }
    const downloadReceipt = (id, viewer) =>
        save(`Receipt_${id}_${stampName()}.txt`, receiptText(id, viewer));
    function downloadInspection(id, viewer) {
        const b = A.bookings().find((x) => x.id === id);
        if (!mayRead(b, viewer)) throw Error('Booking not found on this account.');
        return F.download(id, viewer);
    }
    /* Click handling shared by both dashboards. Returns true when the click was a history action (the caller then redraws). */
    function act(d, viewer, st) {
        if (d.hf) {
            st.f = d.hf;
            return true;
        }
        if (d.hpf) {
            st.pf = d.hpf;
            return true;
        }
        if (d.hpv) {
            st.popen = st.popen || {};
            st.popen[d.hpv] = !st.popen[d.hpv];
            return true;
        }
        if (d.hpr) {
            const n = downloadPenaltyReceipt(d.hpr, viewer);
            A.toast('Downloaded ' + n + '.');
            return false;
        }
        if (d.hpr1) {
            const [bid, pid] = d.hpr1.split('|'),
                n = downloadPenaltyReceipt(bid, viewer, pid);
            A.toast('Downloaded ' + n + '.');
            return false;
        }
        if (d.hview) {
            st.open = st.open || {};
            st.open[d.hview] = !st.open[d.hview];
            return true;
        }
        if (d.hrec) {
            downloadReceipt(d.hrec, viewer);
            A.toast('Receipt downloaded.');
            return false;
        }
        if (d.hinsp) {
            const n = downloadInspection(d.hinsp, viewer);
            A.toast('Downloaded ' + n + ' with the latest data.');
            return false;
        }
        return null;
    }
    //public API
    return {
        PICKUP_TIME,
        DEPOSIT,
        FILTERS,
        PF_FILTERS,
        pfMatch,
        penaltyRows,
        outstandingRows,
        penaltyCard,
        penaltySection,
        outstanding,
        penaltyDetail,
        dialog,
        model,
        matches,
        chips,
        customer,
        employeeCard,
        detailEmployee,
        detailCustomer,
        haystack,
        receiptText,
        downloadReceipt,
        downloadInspection,
        act,
        plate,
        code,
    };
})();
