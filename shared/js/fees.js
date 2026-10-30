/* Penalty Fee (inspection charges), payments, statuses, late-return fees and the live TXT inspection report.
   Penalty categories are recorded on one booking-linked fee record.
   Loaded after auth.js (and data/cars.json (loaded by cars-loader.js) where cars are shown). 100% local: everything is kept in this browser's localStorage
   under "az_fees" (one record per booking that has charges). No server, no network.

   HOW SYNCHRONISATION WORKS
   - The ONLY stored truth is: the charges, the payments and the due date of a fee record.
   - Status, amount paid and outstanding balance are NEVER stored. Fees.summary() works them out from the charges + payments + due date
     every time it is called, so the Employee Portal, Customer Dashboard, Booking History, Inspection Records, Payment Records,
     Reports and the TXT download can never disagree.
   - Pages listen to the browser "storage" event (other tabs) and re-draw, and Fees.sync() re-checks due dates every minute (overdue).
   - Fees.reportText() re-reads bookings, inspections and fees from localStorage at the moment of the download, so the file is never stale. */
const Fees = (() => {
    const A = Auth,
        KEY = A.K.f || 'az_fees',
        DENIED_KEY = 'az_penalty_access_denied',
        SELF_RENTAL_MESSAGE =
            'You cannot waive, modify, refund, or manage penalties issued for your own rental booking. However, you remain responsible for paying all valid penalties associated with your rental. Any adjustment or review must be handled by another authorized employee for audit and compliance purposes.',
        SELF_RENTAL_TOOLTIP = 'Self-rental penalties must be handled by another employee.';
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

    /* ---------- Settings (edit here) ---------- */
    const RETURN_TIME =
        '18:00'; /* bookings only store a return DATE, so this is the agreed return time on that date */
    const GRACE_MIN = 30; /* first 30 minutes after the agreed return time are free */
    const DUE_DAYS = 7; /* default payment term for a new fee */
    const OVERDUE_MSG = 'Payment overdue. Additional administrative charges may apply.';
    /* Late-return tiers: [up to this many minutes late, share of the daily rate]. Above the last tier = one extra full day (100%). */
    const TIERS = [
        [60, 0.1],
        [120, 0.2],
        [240, 0.5],
    ];

    /* ---------- Charge types ---------- */
    const TYPES = {
        damage: 'Damage Cost',
        cleaning: 'Cleaning Fee',
        traffic: 'Traffic Fine',
        late: 'Late Return Fee',
        fuel_penalty: 'Fuel Penalty Fee',
        battery_penalty: 'Battery Penalty Fee',
    };
    const TYPE_KEYS = [
        'damage',
        'cleaning',
        'traffic',
        'late',
        'fuel_penalty',
        'battery_penalty',
    ]; /* categories accepted by fee creation and manual issue forms */

    /* ---------- Statuses ---------- */
    const ST = {
        none: { key: 'none', label: 'No Penalty Fee', icon: '\u2705', cls: 's-none' },
        pending: { key: 'pending', label: 'Outstanding', icon: '\uD83D\uDFE1', cls: 's-pending' },
        partial: {
            key: 'partial',
            label: 'Partially Paid',
            icon: '\uD83D\uDFE0',
            cls: 's-partial',
        },
        paid: { key: 'paid', label: 'Fully Paid', icon: '\uD83D\uDD35', cls: 's-paid' },
        overdue: { key: 'overdue', label: 'Overdue', icon: '\uD83D\uDD34', cls: 's-overdue' },
        waived: { key: 'waived', label: 'Waived', icon: '\u26AA', cls: 's-waived' },
    };
    const badge = (s) => {
        const t = ST[s] || ST.none;
        return `<span class="fbadge ${t.cls}">${t.icon} ${t.label}</span>`;
    };

    /* money with 2 decimals everywhere in fee screens and reports (S$0.00, S$350.00) */
    const money = (n) =>
        'S$' +
        (Number(n) || 0).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });

    /* ---------- Dates ---------- */
    const pad = (n) => String(n).padStart(2, '0');
    const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const addDays = (ts, n) => {
        const d = new Date(ts);
        d.setDate(d.getDate() + n);
        return ymd(d);
    };
    /* a due date is the END of that day (local time) */
    const dueEnd = (s) => {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
        return m ? new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 59, 999).getTime() : 0;
    };
    const dOnly = (ts) => (ts ? A.stamp(ts).slice(0, 10) : 'N/A');
    const dTime = (ts) => (ts ? A.stamp(ts).slice(0, 16) : 'N/A');
    const inputDT = (ts) => {
        const d = new Date(ts);
        return `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }; /* value for <input type=datetime-local> */

    /* ---------- Late return fee ---------- */
    /* agreed return moment = return date + RETURN_TIME (local time) */
    const scheduledReturn = (b) => {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(b.to || ''),
            t = /^(\d{1,2}):(\d{2})$/.exec(b.returnTime || RETURN_TIME) || [0, '18', '00'];
        return m ? new Date(+m[1], +m[2] - 1, +m[3], +t[1], +t[2], 0, 0).getTime() : 0;
    };
    const dailyRate = (b) => {
        const c = (typeof CARS !== 'undefined' && CARS[b.carId]) || null;
        return Number(b.dailyRate) || (c ? Number(c.p) : 0) || 0;
    };
    /* Returns {minutesLate, billableMinutes, rate (share of daily rate), tier text, fee}. Pure function: easy to test. */
    function lateFee(dailyRateValue, scheduledTs, actualTs) {
        const rate = Number(dailyRateValue) || 0,
            lateMs = (actualTs || 0) - (scheduledTs || 0),
            mins = lateMs > 0 ? Math.floor(lateMs / 6e4) : 0;
        const out = {
            minutesLate: mins,
            lateMs: Math.max(0, lateMs),
            share: 0,
            tier: 'On time (or within the ' + GRACE_MIN + '-minute grace period)',
            fee: 0,
            dailyRate: rate,
        };
        if (lateMs <= GRACE_MIN * 6e4) return out;
        let share = 1,
            tier = 'More than 4 hours late: one additional full rental day';
        for (const [lim, s] of TIERS) {
            if (lateMs <= lim * 6e4) {
                share = s;
                tier =
                    (lim === 60
                        ? '31 minutes to 1 hour'
                        : lim === 120
                          ? 'More than 1 hour up to 2 hours'
                          : 'More than 2 hours up to 4 hours') +
                    ' late: ' +
                    Math.round(s * 100) +
                    '% of the daily rate';
                break;
            }
        }
        out.share = share;
        out.tier = tier;
        out.fee = r2(rate * share);
        return out;
    }
    const human = (m) =>
        m <= 0
            ? '0 minutes'
            : (m >= 60 ? Math.floor(m / 60) + ' h ' : '') +
              (m % 60 ? (m % 60) + ' min' : '').trim();

    /* ---------- Storage ---------- */
    const all = () => rd(KEY, []);
    const save = (a) => wr(KEY, a);
    const newId = () =>
        'FEE-' +
        Date.now().toString(36).toUpperCase() +
        Math.random().toString(36).slice(2, 5).toUpperCase();
    const newPayId = () =>
        'PAY-' +
        Date.now().toString(36).toUpperCase() +
        Math.random().toString(36).slice(2, 4).toUpperCase();
    const total = (f) => r2((f.charges || []).reduce((s, c) => s + Number(c.amount || 0), 0));
    const paidSum = (f) => r2((f.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0));
    const byType = (f, t) =>
        r2(
            (f.charges || [])
                .filter((c) => c.type === t)
                .reduce((s, c) => s + Number(c.amount || 0), 0),
        );
    const lastPay = (f) => (f.payments || []).reduce((m, p) => Math.max(m, p.at || 0), 0) || null;

    /* The ONE place a status is worked out. */
    function statusOf(f, now) {
        if (!f) return 'none';
        const t = total(f),
            p = paidSum(f),
            out = r2(t - p);
        if (!(t > 0)) return 'none';
        if (f.waiver)
            return 'waived'; /* an employee waived the remaining balance (with a reason) */
        if (out <= 0) return 'paid';
        if ((now || Date.now()) > dueEnd(f.dueDate))
            return 'overdue'; /* due date passed and money is still owed (also when partly paid) */
        return p > 0 ? 'partial' : 'pending';
    }
    /* Everything a screen needs about one fee record */
    function summarise(f, now) {
        const t = total(f),
            p = paidSum(f),
            s = statusOf(f, now),
            out = s === 'waived' ? 0 : Math.max(0, r2(t - p)),
            pays = f.payments || [],
            lp = pays[pays.length - 1] || null;
        return {
            fee: f,
            id: f.id,
            penaltyRef: f.id,
            bookingId: f.bookingId,
            ref: f.reportRef,
            status: s,
            st: ST[s],
            total: t,
            paid: p,
            outstanding: out,
            waiver: f.waiver || null,
            waivedAmount: f.waiver ? f.waiver.amount : 0,
            createdAt: f.createdAt,
            issuedBy: f.createdByName || '-',
            issuedById: f.createdBy || '-',
            inspectedBy: f.inspectedByName || '',
            lastReceipt: lp ? lp.receipt : null,
            payments: pays,
            dueDate: f.dueDate,
            lastPaymentAt: lastPay(f),
            completedAt: s === 'paid' ? f.completedAt || lastPay(f) : null,
            overdue: s === 'overdue',
            penalty: t,
            late: byType(f, 'late'),
            cleaning: byType(f, 'cleaning'),
            damage: byType(f, 'damage'),
            traffic: byType(f, 'traffic'),
            fuelPenalty: byType(f, 'fuel_penalty'),
            batteryPenalty: byType(f, 'battery_penalty'),
            description: (f.charges || [])
                .map((c) => TYPES[c.type] || c.label || c.type)
                .join(', '),
        };
    }
    /* Optional breakdown of the Penalty Fee components (plain text line used on cards) */
    const breakdown = (s) =>
        [
            ['Damage Cost', s.damage],
            ['Cleaning Fee', s.cleaning],
            ['Traffic Fine', s.traffic],
            ['Late Return Fee', s.late],
            ['Fuel Penalty Fee', s.fuelPenalty],
            ['Battery Penalty Fee', s.batteryPenalty],
        ]
            .filter((x) => x[1] > 0)
            .map((x) => x[0] + ' ' + money(x[1]))
            .join(' \u00b7 ');
    const NONE = (bid) => ({
        fee: null,
        id: null,
        penaltyRef: null,
        waiver: null,
        waivedAmount: 0,
        createdAt: null,
        issuedBy: '-',
        issuedById: '-',
        inspectedBy: '',
        lastReceipt: null,
        payments: [],
        bookingId: bid,
        ref: null,
        status: 'none',
        st: ST.none,
        total: 0,
        paid: 0,
        outstanding: 0,
        dueDate: null,
        lastPaymentAt: null,
        completedAt: null,
        overdue: false,
        penalty: 0,
        late: 0,
        cleaning: 0,
        damage: 0,
        traffic: 0,
        fuelPenalty: 0,
        batteryPenalty: 0,
        description: '',
    });
    const forBooking = (bid) => {
        const f = all().find((x) => x.bookingId === bid);
        return f ? summarise(f) : NONE(bid);
    };
    const list = () => all().map((f) => summarise(f));

    /* Keep the old booking fields (damageCost / damageStatus / damagePaidAt ...) in step, because older code paths read them
    (e.g. "cannot delete account while a charge is unpaid"). They are a MIRROR of the fee record, never a second source of truth. */
    function mirror(f) {
        const s = summarise(f);
        A.update(f.bookingId, {
            damageCost: s.total,
            damageStatus: s.total > 0 ? (s.outstanding > 0 ? 'unpaid' : 'paid') : 'none',
            feeStatus: s.status,
            damagePaidAt: s.status === 'paid' ? s.lastPaymentAt : null,
        });
    }
    function log(f, by, action, detail) {
        (f.audit = f.audit || []).push({
            at: Date.now(),
            byId: (by && by.id) || 'SYSTEM',
            byName: (by && by.name) || 'System',
            action,
            detail: detail || '',
        });
    }
    const actor = (email) => (email ? { id: A.uid(email), name: A.nameOf(email), email } : null);
    function auditDenied(booking, employeeEmail, action) {
        const at = Date.now();
        const record = {
            employeeId: A.uid(employeeEmail),
            bookingId: booking.id,
            customerAccountId: A.uid(booking.email),
            actionAttempted: action,
            at,
            dateTime: A.stamp(at),
            accessDeniedReason: SELF_RENTAL_MESSAGE,
        };
        let audit;
        try {
            audit = JSON.parse(localStorage.getItem(DENIED_KEY) || '[]');
            if (!Array.isArray(audit)) throw Error('The access-denial audit is not an array.');
        } catch (e) {
            console.error('Could not read the penalty access-denial audit.', e);
            audit = [];
        }
        audit.push(record);
        try {
            localStorage.setItem(DENIED_KEY, JSON.stringify(audit));
        } catch (e) {
            console.error('Could not persist the penalty access-denial audit.', e);
        }
        const fees = all(),
            f = fees.find((x) => x.bookingId === booking.id);
        if (f) {
            log(
                f,
                actor(employeeEmail),
                'Access denied',
                `${action} denied for employee-owned rental. ${SELF_RENTAL_MESSAGE}`,
            );
            save(fees);
        }
    }

    /* ---------- Create a fee (called when an inspection finds charges) ----------
    input: {bookingId, inspectionId, reportRef, inspectorEmail, creatorEmail, charges:[{type,amount,note}], dueDate} */
    function create(inp) {
        const session = A.user(),
            creatorEmail =
                inp.creatorEmail || inp.inspectorEmail || (session && session.email);
        guardEmp(inp.bookingId, creatorEmail, 'issue a Penalty Fee');
        const lines = (inp.charges || [])
            .filter((c) => TYPES[c.type])
            .map((c) => ({
                type: c.type,
                label: TYPES[c.type],
                amount: r2(c.amount),
                note: c.note || '',
            }))
            .filter((c) => c.amount > 0);
        if (!lines.length) return null;
        const a = all();
        if (a.some((x) => x.bookingId === inp.bookingId))
            throw Error('A fee record already exists for booking ' + inp.bookingId + '.');
        const by = actor(creatorEmail),
            insp = actor(inp.inspectorEmail),
            now = Date.now();
        const f = {
            id: newId(),
            bookingId: inp.bookingId,
            inspectionId: inp.inspectionId || '',
            reportRef: inp.reportRef || '',
            createdAt: now,
            createdBy: by && by.id,
            createdByName: by && by.name,
            inspectedBy: insp && insp.id,
            inspectedByName: insp && insp.name,
            dueDate: inp.dueDate || addDays(now, DUE_DAYS),
            charges: lines.map((c) =>
                Object.assign({ at: now, byId: by && by.id, byName: by && by.name }, c),
            ),
            payments: [],
            audit: [],
            lastStatus: 'pending',
        };
        lines.forEach((c) =>
            log(
                f,
                by,
                'Penalty Fee item created',
                `${c.label}: ${money(c.amount)}${c.note ? ' (' + c.note + ')' : ''}`,
            ),
        );
        log(
            f,
            by,
            'Penalty Fee created',
            `Total ${money(total(f))}, due ${f.dueDate}. Linked to booking ${f.bookingId} and inspection report ${f.reportRef}.`,
        );
        if (insp && f.reportRef)
            log(
                f,
                insp,
                'Inspection performed',
                `Inspection ${f.reportRef} recorded by ${insp.name} (${insp.id}).`,
            );
        log(f, null, 'Status change', 'No Penalty Fee \u2192 ' + ST.pending.label);
        a.push(f);
        save(a);
        mirror(f);
        return summarise(f);
    }

    /* ---------- Customer payment (full or partial) ---------- */
    function pay(bookingId, payerEmail, amount, card4) {
        const a = all(),
            f = a.find((x) => x.bookingId === bookingId);
        if (!f) throw Error('No Penalty Fee found for this booking.');
        const b = A.bookings().find((x) => x.id === bookingId);
        if (!b || b.email !== payerEmail)
            throw Error('This Penalty Fee belongs to another account.');
        const session = A.user();
        if (!session || session.email !== payerEmail)
            throw Error('Please sign in to the customer account linked to this Penalty Fee.');
        const s = summarise(f),
            amt = r2(amount);
        if (!(amt > 0)) throw Error('Enter an amount greater than S$0.00.');
        if (s.status === 'waived') throw Error('This Penalty Fee has been waived. Nothing is due.');
        if (s.outstanding <= 0) throw Error('This Penalty Fee is already fully paid.');
        if (amt > s.outstanding)
            throw Error(
                'The amount is more than the outstanding balance of ' + money(s.outstanding) + '.',
            );
        const before = s.status,
            by = actor(payerEmail),
            p = {
                id: newPayId(),
                at: Date.now(),
                amount: amt,
                method: 'Online card',
                card4: card4 || '',
                receipt: A.newReceiptNo(),
                byId: by.id,
                byName: by.name,
                balanceAfter: r2(s.outstanding - amt),
            };
        (f.payments = f.payments || []).push(p);
        log(
            f,
            by,
            session.role === 'employee' ? 'Employee self-rental payment' : 'Customer payment',
            `${money(amt)} received (receipt ${p.receipt}, card \u2022\u2022\u2022\u2022 ${p.card4 || '----'}). Outstanding balance ${money(p.balanceAfter)}.`,
        );
        const after = statusOf(f);
        if (after !== before)
            log(f, null, 'Status change', ST[before].label + ' \u2192 ' + ST[after].label);
        if (after === 'paid') {
            f.completedAt = p.at;
            log(f, null, 'Payment completed', 'Penalty Fee fully paid on ' + dOnly(p.at) + '.');
        }
        f.lastStatus = after;
        save(a);
        mirror(f);
        return { payment: p, summary: summarise(f) };
    }

    /* ---------- Employee penalty actions. Every one is logged in the fee's audit trail. ---------- */
    const METHODS = ['Cash at counter', 'Card at counter', 'Bank transfer'];
    const guardEmp = (bookingId, email, what) => {
        const b = A.bookings().find((x) => x.id === bookingId);
        if (!b) throw Error('Booking not found.');
        const session = A.user(),
            sessionEmail = session && String(session.email || '').trim().toLowerCase(),
            action = what;
        if (session && session.role === 'employee' && A.isSelfBooking(b, sessionEmail)) {
            auditDenied(b, sessionEmail, action);
            throw Error(SELF_RENTAL_MESSAGE);
        }
        if (
            !A.isEmployee(email) ||
            !session ||
            session.role !== 'employee' ||
            sessionEmail !== String(email || '').trim().toLowerCase()
        )
            throw Error('Only the signed-in employee account can ' + what + '.');
        return b;
    };
    const cleanNote = (t, min, label) => {
        t = String(t || '')
            .trim()
            .replace(/\s+/g, ' ');
        if (t.length < min) throw Error(label + ' is required.');
        if (t.length > 300) throw Error(label + ' must be 300 characters or fewer.');
        return t;
    };
    const settle = (f, before, by) => {
        const after = statusOf(f);
        if (after !== before) {
            log(f, by || null, 'Status change', ST[before].label + ' \u2192 ' + ST[after].label);
        }
        f.lastStatus = after;
        return after;
    };
    /* Issue a penalty on a booking whose car has been returned. items = {damage,cleaning,traffic,late} amounts. Adds to the booking's Penalty Fee (one per booking). */
    function issue(bookingId, empEmail, items, dueDate, note) {
        const b = guardEmp(bookingId, empEmail, 'issue a Penalty Fee');
        if (b.status !== 'completed' && b.status !== 'awaiting_inspection')
            throw Error('A Penalty Fee can only be issued once the car has been returned.');
        note = cleanNote(note, 3, 'A reason or description for the penalty');
        const lines = TYPE_KEYS.filter((k) => Number(items && items[k]) > 0).map((k) => {
            const n = r2(items[k]);
            if (!isFinite(n) || n > 1e6)
                throw Error(TYPES[k] + ' must be between S$0.01 and S$1,000,000.');
            return { type: k, amount: n, note };
        });
        if (!lines.length)
            throw Error(
                'Enter at least one penalty amount.',
            );
        if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw Error('Enter a valid due date.');
        if (dueDate && dueDate < A.today())
            throw Error('The payment due date cannot be in the past.');
        const a = all(),
            f = a.find((x) => x.bookingId === bookingId),
            by = actor(empEmail),
            now = Date.now();
        if (!f) {
            const ins = latestInspection(bookingId);
            return create({
                bookingId,
                inspectionId: ins ? ins.id : '',
                reportRef: ins ? ins.ref : '',
                inspectorEmail: ins ? empEmail : '',
                creatorEmail: empEmail,
                charges: lines,
                dueDate: dueDate || addDays(now, DUE_DAYS),
            });
        }
        const duplicateAutomatic = lines.find(
            (c) =>
                (c.type === 'fuel_penalty' || c.type === 'battery_penalty') &&
                (f.charges || []).some((existing) => existing.type === c.type),
        );
        if (duplicateAutomatic)
            throw Error(
                TYPES[duplicateAutomatic.type] + ' has already been recorded for this return.',
            );
        if (f.waiver)
            throw Error(
                'This Penalty Fee was waived. Reinstate it first if you need to add to it.',
            );
        const before = statusOf(f);
        lines.forEach((c) => {
            f.charges.push({
                type: c.type,
                label: TYPES[c.type],
                amount: c.amount,
                note: c.note,
                at: now,
                byId: by.id,
                byName: by.name,
            });
            log(f, by, 'Penalty item added', `${TYPES[c.type]}: ${money(c.amount)} (${c.note})`);
        });
        if (dueDate && dueDate !== f.dueDate) {
            log(f, by, 'Due date changed', f.dueDate + ' \u2192 ' + dueDate);
            f.dueDate = dueDate;
        }
        if (statusOf(f) !== 'paid') delete f.completedAt;
        log(f, by, 'Penalty Fee increased', `New total ${money(total(f))}.`);
        settle(f, before);
        save(a);
        mirror(f);
        return summarise(f);
    }
    /* Employee records a payment received in person or by transfer (the customer pays online through pay()). */
    function recordPayment(bookingId, empEmail, amount, method, reference) {
        const b = guardEmp(bookingId, empEmail, 'record a payment'),
            a = all(),
            f = a.find((x) => x.bookingId === bookingId);
        if (!f) throw Error('No Penalty Fee found for this booking.');
        const s = summarise(f),
            amt = r2(amount);
        if (s.status === 'waived') throw Error('This Penalty Fee has been waived. Nothing is due.');
        if (!METHODS.includes(method)) throw Error('Choose how the payment was received.');
        if (!(amt > 0)) throw Error('Enter an amount greater than S$0.00.');
        if (s.outstanding <= 0) throw Error('This Penalty Fee is already fully paid.');
        if (amt > s.outstanding)
            throw Error(
                'The amount is more than the outstanding balance of ' + money(s.outstanding) + '.',
            );
        reference = String(reference || '')
            .trim()
            .slice(0, 60);
        const by = actor(empEmail),
            payer = actor(b.email),
            before = s.status;
        const p = {
            id: newPayId(),
            at: Date.now(),
            amount: amt,
            method,
            reference,
            card4: '',
            receipt: A.newReceiptNo(),
            byId: payer.id,
            byName: payer.name,
            recordedById: by.id,
            recordedByName: by.name,
            balanceAfter: r2(s.outstanding - amt),
        };
        (f.payments = f.payments || []).push(p);
        log(
            f,
            by,
            'Payment recorded',
            `${money(amt)} received (${method}${reference ? ', ref ' + reference : ''}, receipt ${p.receipt}). Outstanding balance ${money(p.balanceAfter)}.`,
        );
        const after = settle(f, before, null);
        if (after === 'paid') {
            f.completedAt = p.at;
            log(f, null, 'Payment completed', 'Penalty Fee fully paid on ' + dOnly(p.at) + '.');
        }
        save(a);
        mirror(f);
        return { payment: p, summary: summarise(f) };
    }
    /* Waive what is still owed (reason required). The penalty stays on record as "Waived". */
    function waive(bookingId, empEmail, reason) {
        guardEmp(bookingId, empEmail, 'waive a Penalty Fee');
        reason = cleanNote(reason, 3, 'A reason for waiving the penalty');
        const a = all(),
            f = a.find((x) => x.bookingId === bookingId);
        if (!f) throw Error('No Penalty Fee found for this booking.');
        const s = summarise(f),
            by = actor(empEmail);
        if (s.status === 'waived') throw Error('This Penalty Fee is already waived.');
        if (s.outstanding <= 0) throw Error('There is no outstanding balance to waive.');
        const before = s.status;
        f.waiver = { at: Date.now(), byId: by.id, byName: by.name, reason, amount: s.outstanding };
        log(f, by, 'Penalty waived', `${money(s.outstanding)} waived. Reason: ${reason}`);
        settle(f, before, null);
        save(a);
        mirror(f);
        return summarise(f);
    }
    /* Undo a waiver (reason required): the balance becomes payable again. */
    function reinstate(bookingId, empEmail, reason) {
        guardEmp(bookingId, empEmail, 'reinstate a Penalty Fee');
        reason = cleanNote(reason, 3, 'A reason for reinstating the penalty');
        const a = all(),
            f = a.find((x) => x.bookingId === bookingId);
        if (!f || !f.waiver) throw Error('This Penalty Fee is not waived.');
        const by = actor(empEmail),
            before = 'waived';
        (f.waiverHistory = f.waiverHistory || []).push(
            Object.assign({}, f.waiver, {
                reinstatedAt: Date.now(),
                reinstatedBy: by.name,
                reinstateReason: reason,
            }),
        );
        log(
            f,
            by,
            'Waiver reversed',
            `${money(f.waiver.amount)} is payable again. Reason: ${reason}`,
        );
        f.waiver = null;
        settle(f, before, null);
        save(a);
        mirror(f);
        return summarise(f);
    }
    /* Receipt (.txt) for the Penalty Fee: every payment, or just one (paymentId). Owner or employee only. */
    function penaltyReceiptText(bookingId, viewerEmail, paymentId) {
        sync();
        const b = A.bookings().find((x) => x.id === bookingId);
        if (!b) throw Error('Booking not found.');
        if (!viewerEmail || (b.email !== viewerEmail && !A.isEmployee(viewerEmail)))
            throw Error('This Penalty Fee belongs to another account.');
        const s = forBooking(bookingId);
        if (!s.fee) throw Error('No Penalty Fee found for this booking.');
        const pays = (s.payments || []).filter((p) => !paymentId || p.id === paymentId);
        if (!pays.length)
            throw Error(
                paymentId
                    ? 'Payment not found.'
                    : 'No payments have been made yet, so there is no receipt.',
            );
        const o = [
            'AZOOM PENALTY FEE RECEIPT',
            '='.repeat(60),
            '',
            free('Penalty Reference No.:', s.penaltyRef),
            free('Booking ID:', b.id),
            free('Inspection Report Ref.:', s.ref || 'N/A'),
            free('Customer:', (b.name || A.nameOf(b.email)) + ' <' + b.email + '>'),
            free('Penalty Date:', A.stamp(s.createdAt)),
            free('Issued By:', s.issuedBy + ' (' + s.issuedById + ')'),
            free('Receipt Generated:', A.stamp(Date.now()) + ' (latest data)'),
            '',
            line(),
            'PENALTY FEE',
            '',
            free('Damage Cost:', money(s.damage)),
            free('Cleaning Fee:', money(s.cleaning)),
            free('Traffic Fine:', money(s.traffic)),
            free('Late Return Fee:', money(s.late)),
            free('Fuel Penalty Fee:', money(s.fuelPenalty)),
            free('Battery Penalty Fee:', money(s.batteryPenalty)),
            free('Penalty Fee (total):', money(s.total)),
            '',
            'CHARGE DETAILS',
            '',
            ...(s.fee.charges || []).map((ch) =>
                free(
                    (TYPES[ch.type] || ch.label) + ':',
                    `${money(ch.amount)}  applied ${dTime(ch.at)}  by ${ch.byName || 'N/A'} (${ch.byId || 'N/A'})${ch.note ? '  Reason: ' + ch.note : ''}`,
                ),
            ),
            '',
            line(),
            'PAYMENTS',
            '',
            ...pays.map((p, n) =>
                [
                    free('Receipt No.:', p.receipt || '-'),
                    free('Payment Date:', A.stamp(p.at)),
                    free('Amount Paid:', money(p.amount)),
                    free(
                        'Method:',
                        (p.method || 'Online card') +
                            (p.card4 ? ' **** ' + p.card4 : '') +
                            (p.reference ? ' (ref ' + p.reference + ')' : ''),
                    ),
                    free('Balance After:', money(p.balanceAfter || 0)),
                    '',
                ].join('\n'),
            ),
            line(),
            'STATUS (latest)',
            '',
            free('Total Amount Paid:', money(s.paid)),
            free('Outstanding Balance:', money(s.outstanding)),
            free('Payment Status:', s.st.icon + ' ' + s.st.label),
            ...(s.waiver
                ? [free('Waived:', money(s.waivedAmount) + ' (' + s.waiver.reason + ')')]
                : []),
            '',
            'This receipt is generated from the latest data stored on this computer at the time of download.',
            '',
        ];
        return o.join('\n');
    }

    /* ---------- Sync: overdue detection, status-change audit, migration of older data ---------- */
    function migrate() {
        const a = all(),
            have = new Set(a.map((f) => f.bookingId));
        let changed = false;
        /* Remove retired generic fuel/admin items while preserving the dedicated return fuel and battery penalty categories. */
        a.forEach((f) => {
            const gone = (f.charges || []).filter((c) => c.type === 'fuel' || c.type === 'admin');
            if (!gone.length) return;
            f.charges = f.charges.filter((c) => c.type !== 'fuel' && c.type !== 'admin');
            log(
                f,
                null,
                'Charge category removed',
                'Retired charge(s) removed from the Penalty Fee: ' +
                    gone.map((c) => (c.label || c.type) + ' ' + money(c.amount)).join(', ') +
                    '.',
            );
            if (!(total(f) > 0)) log(f, null, 'Status change', 'Penalty Fee is now S$0.00.');
            changed = true;
        });
        /* a fee record with no charges left is no longer a penalty fee */
        for (let n = a.length - 1; n >= 0; n--)
            if (!(a[n].charges || []).length && !(a[n].payments || []).length) {
                const bid = a[n].bookingId;
                a.splice(n, 1);
                try {
                    A.update(bid, { damageCost: 0, damageStatus: 'none', feeStatus: 'none' });
                } catch (e) {}
            }
        if (changed) save(a);
        A.bookings()
            .filter((b) => b.status === 'completed' && b.damageCost > 0 && !have.has(b.id))
            .forEach((b) => {
                const at = b.completedAt || b.paidAt || Date.now(),
                    ie = b.inspectionEmployeeId
                        ? { id: b.inspectionEmployeeId, name: b.inspectionEmployeeName }
                        : { id: 'SYSTEM', name: 'Earlier inspection' };
                const f = {
                    id: newId(),
                    bookingId: b.id,
                    inspectionId: '',
                    reportRef: 'IR-' + Number(at).toString(36).toUpperCase(),
                    createdAt: at,
                    createdBy: ie.id,
                    createdByName: ie.name,
                    inspectedBy: ie.id,
                    inspectedByName: ie.name,
                    dueDate: addDays(at, DUE_DAYS),
                    charges: [
                        {
                            type: 'damage',
                            label: TYPES.damage,
                            amount: r2(b.damageCost),
                            note: b.damageNote || '',
                            at,
                            byId: ie.id,
                            byName: ie.name,
                        },
                    ],
                    payments: [],
                    audit: [],
                    lastStatus: 'pending',
                };
                log(
                    f,
                    ie,
                    'Charge created',
                    'Damage Charge: ' +
                        money(b.damageCost) +
                        ' (imported from the earlier inspection record)',
                );
                if (b.damageStatus === 'paid') {
                    f.payments.push({
                        id: newPayId(),
                        at: b.damagePaidAt || at,
                        amount: r2(b.damageCost),
                        card4: b.damageCard4 || '',
                        receipt: b.damageReceipt || '',
                        byId: A.uid(b.email),
                        byName: b.name || A.nameOf(b.email),
                        balanceAfter: 0,
                    });
                    f.completedAt = b.damagePaidAt || at;
                    log(
                        f,
                        null,
                        'Customer payment',
                        money(b.damageCost) + ' received (earlier payment).',
                    );
                    log(f, null, 'Payment completed', 'Full amount paid.');
                    f.lastStatus = 'paid';
                }
                a.push(f);
                changed = true;
            });
        /* attach a report reference to inspection records that predate this feature (kept in the inspection record, not in a file) */
        if (changed) save(a);
        return changed;
    }
    /* Re-check every fee. Writes only when a status really changed. Returns true when something changed. */
    function sync() {
        let changed = migrate();
        if (typeof Refunds !== 'undefined' && Refunds.sync())
            changed = true; /* cancelled bookings made before refund records existed get one */
        const a = all(),
            now = Date.now();
        a.forEach((f) => {
            const s = statusOf(f, now);
            if (f.lastStatus !== s) {
                if (s === 'overdue')
                    log(
                        f,
                        null,
                        'Status change',
                        (ST[f.lastStatus] || ST.pending).label +
                            ' \u2192 ' +
                            ST.overdue.label +
                            '. ' +
                            OVERDUE_MSG,
                    );
                else
                    log(
                        f,
                        null,
                        'Status change',
                        (ST[f.lastStatus] || ST.pending).label + ' \u2192 ' + ST[s].label,
                    );
                f.lastStatus = s;
                changed = true;
            }
        });
        if (changed) {
            save(a);
            a.forEach((f) => {
                const b = A.bookings().find((x) => x.id === f.bookingId);
                if (b && b.feeStatus !== statusOf(f, now))
                    try {
                        mirror(f);
                    } catch (e) {}
            });
        }
        return changed;
    }
    /* Employee changes the due date (audited). */
    function setDueDate(bookingId, date, empEmail) {
        guardEmp(bookingId, empEmail, 'change a Penalty Fee due date');
        const a = all(),
            f = a.find((x) => x.bookingId === bookingId);
        if (!f) throw Error('No Penalty Fee record for this booking.');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw Error('Enter a valid due date.');
        const old = f.dueDate;
        f.dueDate = date;
        log(f, actor(empEmail), 'Due date changed', old + ' \u2192 ' + date);
        const s = statusOf(f);
        if (s !== f.lastStatus) {
            log(
                f,
                null,
                'Status change',
                (ST[f.lastStatus] || ST.pending).label + ' \u2192 ' + ST[s].label,
            );
            f.lastStatus = s;
        }
        save(a);
        mirror(f);
        return summarise(f);
    }
    /* When an account is deleted its fee records go with its bookings. */
    const removeFor = (ids) => {
        const s = new Set(ids);
        const session = A.user();
        if (session && session.role === 'employee') {
            const ownBooking = A.bookings().find(
                (b) => s.has(b.id) && A.isSelfBooking(b, session.email),
            );
            if (ownBooking) {
                auditDenied(ownBooking, session.email, 'remove a Penalty Fee');
                throw Error(SELF_RENTAL_MESSAGE);
            }
        }
        save(all().filter((f) => !s.has(f.bookingId)));
    };

    /* ---------- The TXT report, built from fresh local data every time ---------- */
    const free = (label, txt) =>
        `${label.padEnd(28)}${String(txt == null || txt === '' ? 'N/A' : txt).replace(/\r?\n/g, '\n' + ' '.repeat(28))}`;
    const line = (c = '-') => c.repeat(60);
    /* The newest inspection record of a booking, or null */
    const latestInspection = (bid) =>
        A.inspections()
            .filter((i) => i.bookingId === bid)
            .sort((x, y) => (y.at || 0) - (x.at || 0))[0] || null;
    function reportText(bookingId, viewerEmail) {
        sync(); /* make sure overdue / status changes are applied before reading */
        const b = A.bookings().find((x) => x.id === bookingId);
        if (!b) throw Error('Booking not found.');
        if (viewerEmail && b.email !== viewerEmail && !A.isEmployee(viewerEmail))
            throw Error(
                'This booking belongs to another account.',
            ); /* customers can only read their own report */
        const i = latestInspection(bookingId);
        if (!i) throw Error('No inspection report exists for this booking yet.');
        const s = forBooking(bookingId),
            c = (typeof CARS !== 'undefined' && CARS[b.carId]) || { mk: '', n: b.title, ty: '' },
            has = typeof CARS !== 'undefined' && !!CARS[b.carId];
        const reg = has ? carReg(b.carId) : 'N/A',
            cid = has ? carCode(b.carId) : 'N/A';
        const cust = b.name || A.nameOf(b.email),
            inspName = i.inspectionEmployeeName || A.nameOf(i.by),
            inspId = i.inspectionEmployeeId || A.uid(i.by);
        const sched = scheduledReturn(b),
            actual = b.returnedAt || 0,
            lf = lateFee(dailyRate(b), sched, actual);
        const lateCh = s.fee && (s.fee.charges || []).find((x) => x.type === 'late'),
            lateLine = lateCh
                ? money(s.late) + (lateCh.note ? ' (' + lateCh.note + ')' : '')
                : 'None';
        const out = [];
        out.push(
            'AZOOM CAR INSPECTION REPORT',
            '='.repeat(60),
            '',
            free(
                'Report Reference:',
                i.ref ||
                    s.ref ||
                    'IR-' +
                        Number(i.at || 0)
                            .toString(36)
                            .toUpperCase(),
            ),
            free('Report Generated:', A.stamp(Date.now()) + ' (latest data from the local system)'),
            free(
                'Downloaded By:',
                viewerEmail ? A.nameOf(viewerEmail) + ' (' + A.uid(viewerEmail) + ')' : 'N/A',
            ),
            '',
            line(),
            'BOOKING',
            '',
            free('Booking ID:', b.id),
            free('Vehicle Information:', c.mk + ' ' + c.n + (c.ty ? ' (' + c.ty + ')' : '')),
            free('Car ID / Plate Number:', cid + ' / ' + reg),
            free('Customer Name:', cust),
            free('Customer ID:', A.uid(b.email)),
            free('Customer Email:', b.email),
            free(
                'Rental Period:',
                b.from + ' to ' + b.to + ' (' + b.days + (b.days === 1 ? ' day)' : ' days)'),
            ),
            free('Pickup Location:', Branches.label(b.pickup)),
            free('Return Location:', Branches.label(b.ret)),
            free('Agreed Return Time:', A.stamp(sched).slice(0, 16)),
            free(
                'Actual Return Time:',
                actual
                    ? A.stamp(actual).slice(0, 16) +
                          (b.returnedBy ? ' (marked by ' + b.returnedBy + ')' : '')
                    : 'N/A',
            ),
            free('Daily Rental Rate:', money(dailyRate(b))),
            free(
                'Malaysia Travel:',
                b.malaysiaTravel === true
                    ? 'Yes'
                    : b.malaysiaTravel === false
                      ? 'No'
                      : 'Not recorded',
            ),
            free('GPS Tracking Acknowledged:', b.gpsAcknowledged === true ? 'Yes' : 'Not recorded'),
            '',
            line(),
            'INSPECTION',
            '',
            free('Inspection Date & Time:', A.stamp(i.at)),
            free('Inspector Name:', inspName),
            free('Inspector Employee ID:', inspId),
            free('Damage Category:', i.cond),
            free('Damage Description:', i.desc || 'No damage found.'),
            free('Inspection Notes:', i.notes || 'None'),
            ...(i.fuelLevel != null ? [free('Fuel Level:', i.fuelLevel + '%')] : []),
            ...(i.batteryCharge != null ? [free('Battery Charge:', i.batteryCharge + '%')] : []),
            ...(i.penaltyApplied != null
                ? [free('Penalty Status:', i.penaltyApplied ? 'Applied' : 'Not applied')]
                : []),
            ...(i.penaltyAmount != null ? [free('Penalty Amount:', money(i.penaltyAmount))] : []),
            '',
            line(),
            'PENALTY FEE',
            '',
            free('Damage Cost:', s.damage > 0 ? money(s.damage) : 'None'),
            free('Cleaning Fee:', s.cleaning > 0 ? money(s.cleaning) : 'None'),
            free('Traffic Fine:', s.traffic > 0 ? money(s.traffic) : 'None'),
            free('Late Return Fee:', lateLine),
            free('Fuel Penalty Fee:', s.fuelPenalty > 0 ? money(s.fuelPenalty) : 'None'),
            free('Battery Penalty Fee:', s.batteryPenalty > 0 ? money(s.batteryPenalty) : 'None'),
            free('Total Penalty Fee:', money(s.total)),
            '',
            line(),
            'PAYMENT STATUS',
            '',
            free('Payment Status:', s.st.icon + ' ' + s.st.label),
            free('Penalty Fee:', money(s.total)),
            free('Amount Paid:', money(s.paid)),
            free('Outstanding Balance:', money(s.outstanding)),
            free('Due Date:', s.dueDate || 'N/A'),
            free(
                'Latest Payment Date:',
                s.lastPaymentAt ? A.stamp(s.lastPaymentAt) : 'No payment received',
            ),
            ...(s.status === 'overdue' ? [free('Notice:', OVERDUE_MSG)] : []),
            ...(s.waiver
                ? [
                      free(
                          'Waived:',
                          money(s.waivedAmount) +
                              ' on ' +
                              dOnly(s.waiver.at) +
                              ' (' +
                              s.waiver.reason +
                              ')',
                      ),
                  ]
                : []),
            free(
                'Final Booking Status:',
                (A.LABEL[b.status] || b.status) +
                    (s.outstanding > 0
                        ? ' (Penalty Fee outstanding)'
                        : s.status === 'paid'
                          ? ' (Penalty Fee fully paid)'
                          : ''),
            ),
        );
        if (s.fee) {
            out.push('', '-'.repeat(60), 'PAYMENT HISTORY', '');
            if ((s.fee.payments || []).length)
                s.fee.payments.forEach((p, n) =>
                    out.push(
                        free(
                            'Payment ' + (n + 1) + ':',
                            `${A.stamp(p.at)}  ${money(p.amount)}  receipt ${p.receipt || '-'}  balance after ${money(p.balanceAfter || 0)}`,
                        ),
                    ),
                );
            else out.push('No payments received yet.');
            out.push(
                '',
                '-'.repeat(60),
                'AUDIT TRAIL',
                '',
                free(
                    'Fee Created By:',
                    `${s.fee.createdByName || 'N/A'} (${s.fee.createdBy || 'N/A'})`,
                ),
                free(
                    'Inspection Performed By:',
                    `${s.fee.inspectedByName || inspName} (${s.fee.inspectedBy || inspId})`,
                ),
                free('Fee Created On:', A.stamp(s.fee.createdAt)),
                free('Payment Completed On:', s.completedAt ? A.stamp(s.completedAt) : 'Not yet'),
                '',
            );
            (s.fee.charges || []).forEach((ch) =>
                out.push(
                    free(
                        'Penalty Fee item:',
                        `${TYPES[ch.type] || ch.label}  ${money(ch.amount)}  (${dOnly(ch.at)})${ch.note ? '  Reason: ' + ch.note : ''}`,
                    ),
                ),
            );
            out.push('');
            (s.fee.audit || []).forEach((e) =>
                out.push(
                    `${A.stamp(e.at).slice(0, 19)}  ${e.byName}${e.byId && e.byId !== 'SYSTEM' ? ' (' + e.byId + ')' : ''}: ${e.action}${e.detail ? ' - ' + e.detail : ''}`,
                ),
            );
        }
        if (A.isEmployeeBooking(b))
            out.push(
                '',
                '-'.repeat(60),
                'EMPLOYEE RENTAL',
                '',
                free('Employee Rental:', 'Yes'),
                free(
                    'Discount Applied:',
                    b.employeeRental
                        ? '50% (original ' +
                              money(b.rentalOriginal) +
                              ', discount ' +
                              money(b.discountAmount) +
                              ', final ' +
                              money(b.total) +
                              ')'
                        : 'None (booked before the discount policy)',
                ),
                free(
                    'Booking Employee:',
                    `${b.bookingEmployeeName || A.nameOf(b.email)} (${b.bookingEmployeeId || A.uid(b.email)})`,
                ),
                free('Inspection Employee:', `${inspName} (${inspId})`),
                free(
                    'Liability:',
                    'Employee remains liable for damage costs, cleaning fees, traffic fines and late return fees.',
                ),
            );
        out.push(
            '',
            '-'.repeat(60),
            'This report is generated from the latest data stored on this computer at the time of download.',
            '',
        );
        return out.join('\n');
    }
    /* Inspection_{CarID}_{YYYYMMDD_HHMMSS}.txt, time = moment of download so every download has its own name */
    function fileName(b) {
        const d = new Date(),
            ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
        return `Inspection_${typeof CARS !== 'undefined' && CARS[b.carId] ? carCode(b.carId) : 'CAR000'}_${ts}.txt`;
    }
    /* Re-reads everything, builds the text, hands it to the browser as a normal .txt download. Returns the file name. */
    function download(bookingId, viewerEmail) {
        const text = reportText(bookingId, viewerEmail),
            b = A.bookings().find((x) => x.id === bookingId),
            name = fileName(b);
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

    /* Every minute: re-check due dates. Pages pass a callback to re-draw when something changed. */
    const watch = (cb) => {
        const run = () => {
            try {
                if (sync() && cb) cb();
            } catch (e) {}
        };
        addEventListener('storage', (e) => {
            if ([A.K.f, A.K.b, A.K.i, A.K.r].includes(e.key) && cb) cb();
        });
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) run();
        });
        setInterval(run, 60000);
        run();
    };

    //public API
    return {
        money,
        breakdown,
        ST,
        TYPES,
        TYPE_KEYS,
        badge,
        RETURN_TIME,
        GRACE_MIN,
        DUE_DAYS,
        OVERDUE_MSG,
        TIERS,
        lateFee,
        scheduledReturn,
        dailyRate,
        human,
        inputDT,
        addDays,
        ymd,
        dOnly,
        dTime,
        METHODS,
        SELF_RENTAL_MESSAGE,
        SELF_RENTAL_TOOLTIP,
        deniedAttempts: () => {
            const attempts = rd(DENIED_KEY, []);
            return Array.isArray(attempts) ? attempts : [];
        },
        issue,
        recordPayment,
        waive,
        reinstate,
        penaltyReceiptText,
        list,
        forBooking,
        create,
        pay,
        sync,
        setDueDate,
        removeFor,
        reportText,
        download,
        fileName,
        latestInspection,
        watch,
        statusOf,
        summarise,
    };
})();
