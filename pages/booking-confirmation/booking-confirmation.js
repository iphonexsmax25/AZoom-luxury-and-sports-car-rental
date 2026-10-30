/* Booking confirmation + receipt (../booking-confirmation/booking-confirmation.html?id=AZ-XXXXXX). Needs data/cars.json (loaded by cars-loader.js) and auth.js. */
CarsData.ready.then(function () {
    const A = Auth,
        app = document.getElementById('app');
    const u = A.guard();
    if (!u) return;
    const id = new URLSearchParams(location.search).get('id');
    const find = () => A.bookings().find((x) => x.id === id && x.email === u.email);
    let b = find();
    if (!b) {
        app.innerHTML = `<div class="confwrap"><div class="empty2"><h3>Booking not found</h3><p>We couldn't find that booking on your account.</p><a class="btn red" href="../dashboard/dashboard.html">My Dashboard</a></div></div>`;
        return;
    }
    const c = carFor(b) || { mk: '', n: b.title },
        row = (l, v, cls = '') => `<div class="${cls}"><span>${l}</span><b>${A.esc(v)}</b></div>`;
    const MSG = {
        pending:
            'Your payment was received and your reservation has been placed. An AZoom employee will review and approve it shortly.',
        confirmed:
            'An AZoom employee has approved your booking. Your car will be ready for pick-up.',
        awaiting_inspection: 'Your car has been returned and is waiting for its inspection.',
        completed: 'This rental is complete.',
        cancelled: 'Your previous booking was cancelled. You may create a new booking.',
        rejected:
            'Your booking was rejected. You may create a new booking for the same or different dates.',
    };
    function draw() {
        b = find() || b;
        const emp = !!b.employeeRental;
        const fees = Fees.forBooking(b.id),
            additional = fees.fee && fees.fee.charges ? fees.fee.charges : [],
            hasInspection = b.status === 'completed' || additional.length > 0,
            chargeValues = [
                ['Fuel Penalty Fee', fees.fuelPenalty, 'fuel_penalty'],
                ['Battery Penalty Fee', fees.batteryPenalty, 'battery_penalty'],
                ['Late Return Fee', fees.late, 'late'],
                ['Damage Fee', fees.damage, 'damage'],
                ['Cleaning Fee', fees.cleaning, 'cleaning'],
                ['Traffic Fine', fees.traffic, 'traffic'],
            ];
        const additionalRows = hasInspection
            ? chargeValues
                  .map(([label, amount, type]) => {
                      const reason = additional
                          .filter((c) => c.type === type && c.note)
                          .map((c) => c.note)
                          .join('; ');
                      return `<div class="rline"><span>${A.esc(label)}${reason ? `<small>${A.esc(reason)}</small>` : ''}</span><b>${A.money(amount)}</b></div>`;
                  })
                  .join('')
            : '';
        const chargeCards = hasInspection
            ? chargeValues
                  .map(([label, amount, type]) => {
                      const reason = additional
                          .filter((c) => c.type === type && c.note)
                          .map((c) => c.note)
                          .join('; ');
                      return `<article class="charge-card${amount > 0 ? ' has-penalty' : ''}"><span class="charge-label">${A.esc(label)}</span><b class="charge-amount">${A.money(amount)}</b>${reason ? `<small class="charge-reason">${A.esc(reason)}</small>` : ''}</article>`;
                  })
                  .join('')
            : '';
        const feeItems = hasInspection
            ? `<div class="additional-charges"><h3>Additional Charges</h3><div class="charge-grid confirmation-charge-grid">${chargeCards}</div><div class="charge-total"><span>Total Additional Charges</span><b>${A.money(fees.total)}</b></div>${fees.outstanding > 0 ? `<p class="hint">Penalty fee reason(s) are listed above. Outstanding additional charges are due by ${A.esc(fees.dueDate)}.</p>` : ''}</div>`
            : '';
        const totalIncludingFees = Number(b.total || 0) + fees.total;
        const title =
            b.status === 'rejected'
                ? 'Booking Rejected'
                : b.status === 'cancelled'
                  ? 'Booking Cancelled'
                  : 'Booking Confirmed!';
        document.title = `Booking ${b.id} | AZoom`;
        app.innerHTML = `<div class="confwrap"><div class="acard conf">
   <div class="tickbig">${A.ic('tick', 34)}</div>
   <h1>${title}</h1>
   <p class="csub">${b.status === 'pending' || b.status === 'confirmed' ? `Your reservation for the ${A.esc(b.title)} has been placed. We'll send a confirmation to ${A.esc(b.contactEmail || b.email)}.` : 'Booking status and next steps are shown below.'}</p>
   <p class="cstat"><span class="badge b-${b.status}">${A.esc(Refunds.statusLabel(b)).toUpperCase()}</span></p>
   <p class="cmsg" id="cmsg">${MSG[b.status] || ''}</p>
   <div class="csum">
    ${row('Booking ID', b.id) + row('Vehicle', b.title) + row('Dates', b.from + ' - ' + b.to) + row('Duration', b.days + (b.days === 1 ? ' day' : ' days')) + row('Payment', 'Card •••• ' + b.card4)}
    ${Refunds.summary(b)
        .map(([l, v]) => row(l, v))
        .join('')}
    ${b.rentalOriginal != null ? row('Original price', A.money(b.rentalOriginal)) + row(`${A.esc(b.discountLabel || 'Rental discount')} (${(Number(b.discountRate || 0) * 100).toLocaleString()}%)`, '\u2212' + A.money(b.discountAmount || 0), 'discrow') : ''}
    ${b.oneWayFee > 0 ? row('One-way return fee', A.money(b.oneWayFee)) : ''}
    ${feeItems}
    <div class="ctot"><span>${hasInspection ? 'Total including additional charges' : emp ? 'Final payable' : 'Total'}</span><b>${A.money(totalIncludingFees)}</b></div>
   </div>
   ${emp ? `<div class="empdisc conf-emp"><p class="empline">50% Employee Discount</p><span class="empbadge">${A.esc(A.EMP_BADGE)}</span><p class="empnote">${A.esc(A.EMP_NOTICE)}</p></div>` : ''}
   <div class="bgrid">${Branches.detail(b.pickup, 'Pickup branch') + Branches.detail(b.ret, 'Return branch')}</div>
   <div class="receipt" id="receipt"><h2>${A.ic('doc', 18)} Receipt</h2>
    ${row('Receipt no.', b.receipt || '-') + row('Paid on', A.stamp(b.paidAt || b.created)) + row('Payment status', 'Paid') + row('Billed to', b.name || b.email) + row('Driver licence', b.license || '-') + row('Phone', b.phone || '-')}
    ${
        b.rentalOriginal != null
            ? `<div class="rline"><span>Rental Price: ${b.days} × ${A.money(c.p)}</span><b>${A.money(b.rentalOriginal)}</b></div>
    <div class="rline discrow"><span>${A.esc(b.discountLabel || 'Rental discount')} (${(Number(b.discountRate || 0) * 100).toLocaleString()}%)</span><b>\u2212${A.money(b.discountAmount || 0)}</b></div>
    ${emp ? `<div class="rline"><span>Employee ID</span><b>${A.esc(b.bookingEmployeeId || '-')}</b></div>` : ''}`
            : emp
              ? `<div class="rline"><span>${A.esc(c.mk + ' ' + c.n)} × ${b.days} ${b.days === 1 ? 'day' : 'days'} (original)</span><b>${A.money(b.rentalOriginal)}</b></div>
    <div class="rline discrow"><span>Employee discount (50%)</span><b>\u2212${A.money(b.discountAmount)}</b></div>
    <div class="rline"><span>Employee ID</span><b>${A.esc(b.bookingEmployeeId || '-')}</b></div>`
              : `<div class="rline"><span>${A.esc(c.mk + ' ' + c.n)} × ${b.days} ${b.days === 1 ? 'day' : 'days'}</span><b>${A.money(b.total - (b.oneWayFee || 0))}</b></div>`
    }
    ${b.oneWayFee > 0 ? `<div class="rline"><span>One-way return fee</span><b>${A.money(b.oneWayFee)}</b></div>` : ''}
    <div class="rline"><span>Insurance</span><b>Included</b></div>
    ${hasInspection ? `${additionalRows}<div class="rline"><span>Total Additional Charges</span><b>${A.money(fees.total)}</b></div><div class="rline"><span>Additional Charges Status</span><b>${A.esc(fees.status === 'none' ? 'No additional charges' : fees.status === 'paid' ? 'Paid' : fees.outstanding > 0 ? 'Due' : fees.status)}</b></div>` : ''}
    <div class="rline"><span>Rental amount paid</span><b>${A.money(b.total)}</b></div>
    ${hasInspection ? `<div class="ctot"><span>Total charges including additional charges</span><b>${A.money(totalIncludingFees)}</b></div>` : ''}
   </div>
   <a class="btn red" href="../dashboard/dashboard.html">View My Bookings</a>
   <button type="button" class="btn ghost" id="prt">${A.ic('print', 16)} Print Receipt</button>
  </div></div>`;
        document.getElementById('prt').addEventListener('click', () => print());
    }
    draw();
    /* Status changes made by an employee show up here straight away */
    addEventListener('storage', (e) => {
        if (e.key === A.K.b || e.key === A.K.f) draw();
    });
});
