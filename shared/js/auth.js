/* Shared accounts + bookings, loaded on EVERY page.
   DEMO ONLY: data lives in this browser's localStorage, so nothing is shared between devices.
   Before launch, replace it with a real backend (secure password storage, server-side roles, real payments). */
const Auth = (() => {
    const K = {
        u: 'az_users',
        s: 'az_session',
        b: 'az_bookings',
        i: 'az_inspections',
        f: 'az_fees',
        r: 'az_refunds',
    };
    const EMPLOYEE_DOMAIN =
        'azoom.sg'; /* sign-ups with an email ending @azoom.sg become employee accounts */
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
    const esc = (s) =>
        String(s).replace(
            /[&<>"']/g,
            (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
        );
    const money = (n) =>
        'S$' +
        (Number.isInteger(Number(n))
            ? Number(n).toLocaleString()
            : Number(n).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
              }));
    const today = () => {
        const d = new Date();
        return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    };
    const validDate = (value) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
        const [year, month, day] = value.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return (
            date.getFullYear() === year &&
            date.getMonth() === month - 1 &&
            date.getDate() === day
        );
    };

    const P = {
        mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
        lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
        grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
        shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
        out: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
        cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        up: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
        check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
        warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
        clip: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9zM9 14l2 2 4-4"/>',
        car: '<path d="M5 16l1.5-5a2 2 0 012-1.5h7a2 2 0 012 1.5L19 16"/><rect x="3" y="16" width="18" height="4" rx="1"/><path d="M7 18h.01M17 18h.01"/>',
        search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
        back: '<path d="M19 12H5M12 5l-7 7 7 7"/>',
        hist: '<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4M10 12h6M10 16h6"/>',
        card: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6 15h3"/>',
        user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>',
        phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',
        faq: '<circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.3 2.3 0 114.2 1.3c-.9 1.1-2 1.2-2 2.7M12 17h.01"/>',
        pin: '<path d="M12 22s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
        print: '<path d="M6 9V3h12v6"/><path d="M6 18H4a1 1 0 01-1-1v-6a2 2 0 012-2h14a2 2 0 012 2v6a1 1 0 01-1 1h-2"/><rect x="6" y="14" width="12" height="7"/>',
        doc: '<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4M10 12h6M10 16h4"/>',
        ret: '<path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.7L3 8"/><path d="M3 3v5h5"/>',
        x: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
        tick: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
        wrench: '<path d="M14.7 6.3a4 4 0 005 5L21 13l-8 8a2.1 2.1 0 01-3-3l8-8z"/><path d="M14.7 6.3a4 4 0 014-4l-2.5 2.5 1.5 1.5L20 3.8"/>',
        cone: '<path d="M12 3l4 14H8z"/><path d="M5 21h14M9.5 11h5"/>',
        ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
        heart: '<path d="M20.8 5.6a5 5 0 00-7.1 0L12 7.3l-1.7-1.7a5 5 0 10-7.1 7.1L12 21.5l8.8-8.8a5 5 0 000-7.1z"/><path d="M3 12h4l2-3 3 6 2-3h7"/>',
        home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
        menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
        close: '<path d="M6 6l12 12M18 6L6 18"/>',
        settings:
            '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
        trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
        hammer: '<path d="M14 6l4 4-8 8-4-4z"/><path d="M13 4l7 7M4 20l3-3"/>',
    };
    const ic = (n, s = 18) =>
        `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;

    async function hash(p, salt) {
        const s = salt + ':' + p;
        try {
            const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
            return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
        } catch (e) {
            return btoa(unescape(encodeURIComponent(s)));
        }
    }
    const start = (x) => {
        const s = { email: x.email, role: x.role };
        wr(K.s, s);
        return s;
    };
    /* Email format + strong password rules. One list, used by sign-up, change password and the live checklist on the settings page. */
    const validEmail = (e) => /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(String(e || '').trim());
    const PASSWORD_RULES = [
        ['At least 8 characters', (p) => p.length >= 8],
        ['An uppercase letter', (p) => /[A-Z]/.test(p)],
        ['A lowercase letter', (p) => /[a-z]/.test(p)],
    ];
    const passwordIssues = (pw) =>
        PASSWORD_RULES.filter((r) => !r[1](String(pw || ''))).map((r) => r[0]);
    const checkPassword = (pw) => {
        pw = String(pw == null ? '' : pw);
        const m = passwordIssues(pw);
        if (m.length)
            throw Error(
                'Password needs: ' +
                    m.map((x) => x.charAt(0).toLowerCase() + x.slice(1)).join(', ') +
                    '.',
            );
        if (pw.length > 128) throw Error('Password must be 128 characters or fewer.');
    };
    const newSalt = () => {
        try {
            return [...crypto.getRandomValues(new Uint8Array(12))]
                .map((x) => x.toString(16).padStart(2, '0'))
                .join('');
        } catch (e) {
            return Math.random().toString(36).slice(2) + Date.now().toString(36);
        }
    };
    /* First / last name: required, 1-40 characters, letters plus space ' . - (any language). Returns the cleaned text or throws. */
    const cleanName = (v, label) => {
        const s = String(v == null ? '' : v)
            .replace(/\s+/g, ' ')
            .trim();
        if (!s) throw Error(label + ' is required.');
        if (s.length > 40) throw Error(label + ' must be 40 characters or fewer.');
        if (!/^[\p{L}\p{M}][\p{L}\p{M} '.-]*$/u.test(s))
            throw Error(
                label + ' can only contain letters, spaces, apostrophes, hyphens and full stops.',
            );
        return s;
    };
    async function signup(email, pw, first, last) {
        first = cleanName(first, 'First name');
        last = cleanName(last, 'Last name');
        email = email.trim().toLowerCase();
        if (!validEmail(email)) throw Error('Enter a valid email address.');
        checkPassword(pw);
        const all = rd(K.u, []);
        if (all.some((u) => u.email === email))
            throw Error('An account with this email already exists.');
        const salt = newSalt();
        const x = {
            email,
            salt,
            hash: await hash(pw, salt),
            first,
            last,
            createdAt: Date.now(),
            lastLogin: Date.now(),
            role: email.endsWith('@' + EMPLOYEE_DOMAIN) ? 'employee' : 'customer',
        };
        all.push(x);
        wr(K.u, all);
        return start(x);
    }
    async function login(email, pw) {
        email = email.trim().toLowerCase();
        const x = rd(K.u, []).find((u) => u.email === email);
        if (!x || x.hash !== (await hash(pw, x.salt))) throw Error('Incorrect email or password.');
        const all = rd(K.u, []),
            y = all.find((u) => u.email === email);
        if (y) {
            y.prevLogin = y.lastLogin || null;
            y.lastLogin = Date.now();
            wr(K.u, all);
        }
        return start(x);
    }
    const user = () => rd(K.s, null);
    /* Current page as a link written from any page folder, e.g. "../payment/payment.html" (same form as the nav hrefs) */
    const page = () => '../' + location.pathname.split('/').slice(-2).join('/');
    function logout() {
        try {
            localStorage.removeItem(K.s);
        } catch (e) {}
        location.href = '../home/home.html';
    }
    const safeNext = (n) =>
        /^\.\.\/[\w-]+\/[\w-]+\.html(\?[\w%=&.+~-]*)?$/.test(n || '') ? n : null;
    const home = (u) =>
        u.role === 'employee' ? '../employee/employee.html' : '../dashboard/dashboard.html';
    function guard(role) {
        const u = user();
        if (!u) {
            location.replace(
                '../login/login.html?next=' + encodeURIComponent(page() + location.search),
            );
            return null;
        }
        if (role && u.role !== role) {
            location.replace('../dashboard/dashboard.html');
            return null;
        }
        return u;
    }
    /* Booking lifecycle:
    pending  ->  confirmed  ->  awaiting_inspection  ->  completed      (or cancelled / rejected)
    pending = paid, waiting for an employee to approve | confirmed = approved by an employee
    awaiting_inspection = car handed back by an employee, waiting for the inspection
    completed = inspection finished and its .txt report stored. Old "active" bookings are treated as "confirmed". */
    const LIVE = ['pending', 'confirmed', 'awaiting_inspection']; /* these still hold the car */
    const LABEL = {
        pending: 'Pending',
        confirmed: 'Approved',
        awaiting_inspection: 'Awaiting Inspection',
        completed: 'Completed',
        rejected: 'Rejected',
        cancelled: 'Cancelled',
    };
    const norm = (b) => (b.status === 'active' ? Object.assign({}, b, { status: 'confirmed' }) : b);
    /* Pop-up message at the bottom right. kind "err" = red error pop-up (only one at a time). */
    const toast = (t, kind) => {
        if (kind === 'err') document.querySelectorAll('.toast.err').forEach((x) => x.remove());
        const d = document.createElement('div');
        d.className = 'toast' + (kind === 'err' ? ' err' : '');
        d.setAttribute('role', kind === 'err' ? 'alert' : 'status');
        d.textContent = t;
        document.body.append(d);
        setTimeout(() => d.remove(), kind === 'err' ? 6000 : 4500);
    };
    const bookings = () => rd(K.b, []).map(norm),
        inspections = () => rd(K.i, []);
    const returnCompleted = (b) =>
        !!b.returnedAt && !!b.returnEmployeeId && !!b.returnedByEmail;
    const bookingEligibility = (email) => {
        const owner = String(email || '').trim().toLowerCase(),
            mine = bookings().filter(
                (b) => String(b.email || '').trim().toLowerCase() === owner,
            ),
            active = mine.some((b) => ['pending', 'confirmed'].includes(b.status)),
            processing = mine.some(
                (b) =>
                    b.status === 'awaiting_inspection' ||
                    (['returned', 'completed'].includes(b.status) &&
                        !returnCompleted(b)),
            );
        if (active)
            return {
                eligible: false,
                reason: 'active-rental',
                message:
                    'You currently have an active rental. Please return your vehicle before making another booking.',
                outstanding: 0,
            };
        if (processing)
            return {
                eligible: false,
                reason: 'return-processing',
                message:
                    'Your vehicle return is still being processed. You can make another booking after the return has been completed.',
                outstanding: 0,
            };

        const completed = mine.filter((b) =>
                ['returned', 'completed'].includes(b.status),
            ),
            fees = rd(K.f, []).filter((f) =>
                completed.some((b) => b.id === f.bookingId),
            ),
            balanceFor = (f) =>
                f.waiver
                    ? 0
                    : Math.max(
                          0,
                          r2(
                              (Array.isArray(f.charges) ? f.charges : []).reduce(
                                  (sum, charge) => sum + (Number(charge.amount) || 0),
                                  0,
                              ) -
                                  (Array.isArray(f.payments) ? f.payments : []).reduce(
                                      (sum, payment) => sum + (Number(payment.amount) || 0),
                                      0,
                                  ),
                          ),
                      ),
            outstanding = r2(fees.reduce((sum, f) => sum + balanceFor(f), 0));
        if (outstanding > 0) {
            const partial = fees.some(
                (f) =>
                    balanceFor(f) > 0 &&
                    (Array.isArray(f.payments) ? f.payments : []).some(
                        (payment) => Number(payment.amount) > 0,
                    ),
                ),
                amount = outstanding.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                });
            return {
                eligible: false,
                reason: partial ? 'partial-penalty' : 'unpaid-penalty',
                message: partial
                    ? `A remaining penalty balance of S$${amount} must be paid before you can make another booking.`
                    : `You have an outstanding penalty balance of S$${amount}. Please pay the full balance before making another booking.`,
                outstanding,
            };
        }
        return { eligible: true, reason: null, message: '', outstanding: 0 };
    };
    const bookingConflict = (email, carId, from, to) => {
        const all = bookings(),
            overlaps = (b) =>
                LIVE.includes(b.status) && b.from <= to && from <= b.to,
            owner = String(email || '').toLowerCase();
        if (all.some((b) => String(b.email || '').toLowerCase() === owner && overlaps(b)))
            return 'customer';
        if (
            all.some(
                (b) =>
                    Number(b.carId) === Number(carId) &&
                    Number.isFinite(Number(carId)) &&
                    overlaps(b),
            )
        )
            return 'vehicle';
        return null;
    };
    /* update(id,patch): change any fields of one booking and save */
    const newBookingId = () => {
        const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let r = '';
        for (let i = 0; i < 6; i++) r += abc[Math.floor(Math.random() * abc.length)];
        return 'AZ-' + r;
    };
    const newReceiptNo = () =>
        'RC-' +
        Date.now().toString(36).toUpperCase() +
        Math.random().toString(36).slice(2, 5).toUpperCase();
    /* Customer / employee ID: made once per account and saved with it */
    const uid = (email) => {
        email = String(email).toLowerCase();
        const all = rd(K.u, []),
            x = all.find((u) => u.email === email);
        if (!x) return 'N/A';
        if (!x.uid) {
            x.uid =
                (x.role === 'employee' ? 'EMP-' : 'CUST-') +
                Math.random().toString(36).slice(2, 8).toUpperCase();
            wr(K.u, all);
        }
        return x.uid;
    };
    /* Date / time text with the local UTC offset, e.g. 2026-10-17 23:28:05 (UTC+08:00) */
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = (ts) => {
        if (!ts) return 'N/A';
        const d = new Date(ts),
            o = -d.getTimezoneOffset(),
            sg = o < 0 ? '-' : '+';
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} (UTC${sg}${pad(Math.floor(Math.abs(o) / 60))}:${pad(Math.abs(o) % 60)})`;
    };
    /* Name of the signed-in user, read fresh from the account store every time (so it is always the current user and always up to date). */
    const profile = () => {
        const s = user();
        if (!s) return null;
        const x = rd(K.u, []).find((u) => u.email === s.email);
        if (!x) return null;
        const first = x.first || '',
            last = x.last || '';
        return {
            email: x.email,
            role: x.role,
            managed: isManaged(x),
            first,
            last,
            hasName: !!(first && last),
            fullName: (first + ' ' + last).trim(),
            createdAt: x.createdAt || null,
            lastLogin: x.lastLogin || null,
            prevLogin: x.prevLogin || null,
            passwordChangedAt: x.passwordChangedAt || null,
        };
    };
    /* Change the signed-in user's own name. Nobody can change another account's name through this. */
    function updateProfile(first, last) {
        first = cleanName(first, 'First name');
        last = cleanName(last, 'Last name');
        const s = user();
        if (!s) throw Error('Please sign in again.');
        const all = rd(K.u, []),
            x = all.find((u) => u.email === s.email);
        if (!x) throw Error('Account not found.');
        x.first = first;
        x.last = last;
        wr(K.u, all);
        return profile();
    }
    /* When an account's email changes, every record that points at the old email must follow it (bookings, audit fields, inspection reports). */
    const EMAIL_FIELDS = [
        'email',
        'approvedBy',
        'returnedByEmail',
        'inspectionEmployeeEmail',
        'contactEmail',
        'by',
    ];
    const migrateEmail = (from, to) => {
        [K.b, K.i].forEach((k) => {
            const a = rd(k, []);
            let n = 0;
            a.forEach((o) =>
                EMAIL_FIELDS.forEach((f) => {
                    if (o && o[f] === from) {
                        o[f] = to;
                        n++;
                    }
                }),
            );
            if (n) wr(k, a);
        });
    };
    /* "Managed" = employee account (role employee OR an @azoom.sg address). Their email is controlled by AZoom and cannot be edited. */
    const isManaged = (x) =>
        !!x &&
        (x.role === 'employee' ||
            String(x.email || '')
                .toLowerCase()
                .endsWith('@' + EMPLOYEE_DOMAIN));
    const EMP_EMAIL_LOCKED = 'Employee email addresses cannot be changed.';
    const signedIn = () => {
        const s = user();
        if (!s) throw Error('Please sign in again.');
        const x = rd(K.u, []).find((u) => u.email === s.email);
        if (!x) throw Error('Account not found. Please sign in again.');
        return x;
    };
    /* Save first name, last name and email for the signed-in user.
    Changing the email needs the current password (it is the login), must be a new valid address, and keeps the account type:
    employees keep an @azoom.sg address and customers cannot take one (so nobody can turn themselves into an employee). */
    async function updateAccount(f) {
        const cur = signedIn();
        const first = cleanName(f.first, 'First name'),
            last = cleanName(f.last, 'Last name');
        /* email is optional: when it is left out (employees never send it) the current email is kept */
        const email = f.email == null ? cur.email : String(f.email).trim().toLowerCase();
        /* SERVER-SIDE RULE: a managed (employee) account can never change its email, whatever the page sent */
        if (isManaged(cur) && email !== cur.email) throw Error(EMP_EMAIL_LOCKED);
        if (!validEmail(email)) throw Error('Enter a valid email address.');
        const changed = email !== cur.email;
        if (changed) {
            const emp = email.endsWith('@' + EMPLOYEE_DOMAIN);
            if (!isManaged(cur) && emp)
                throw Error('@' + EMPLOYEE_DOMAIN + ' addresses are reserved for AZoom employees.');
            if (rd(K.u, []).some((u) => u.email === email))
                throw Error('An account with this email already exists.');
            if (!f.currentPassword)
                throw Error('Enter your current password to change your email address.');
            if (cur.hash !== (await hash(String(f.currentPassword), cur.salt)))
                throw Error('Current password is incorrect.');
        }
        const all = rd(K.u, []),
            x = all.find((u) => u.email === cur.email); /* read again after the await */
        if (!x) throw Error('Account not found. Please sign in again.');
        if (changed && all.some((u) => u.email === email))
            throw Error('An account with this email already exists.');
        const old = x.email;
        x.first = first;
        x.last = last;
        x.email = email;
        wr(K.u, all);
        if (changed) {
            migrateEmail(old, email);
            start(x);
        }
        return { profile: profile(), emailChanged: changed };
    }
    /* Change the signed-in user's password. */
    async function changePassword(current, next, confirm) {
        const cur = signedIn();
        if (!current) throw Error('Enter your current password.');
        if (next !== confirm) throw Error('New password and confirmation do not match.');
        checkPassword(next);
        if (next === current)
            throw Error('Your new password must be different from your current password.');
        if (cur.hash !== (await hash(String(current), cur.salt)))
            throw Error('Current password is incorrect.');
        const all = rd(K.u, []),
            x = all.find((u) => u.email === cur.email);
        if (!x) throw Error('Account not found. Please sign in again.');
        x.salt = newSalt();
        x.hash = await hash(next, x.salt);
        x.passwordChangedAt = Date.now();
        wr(K.u, all);
        return profile();
    }
    /* Permanently delete the signed-in account, its bookings and its profile, then sign out.
    Blocked while a rental is still open or a damage charge is unpaid (that money is still owed to AZoom).
    Inspection records an employee made on OTHER people's bookings are kept for the company audit trail. */
    function deleteAccount(confirmText) {
        const x = signedIn();
        if (confirmText !== 'DELETE') throw Error('Type DELETE in capital letters to confirm.');
        const mine = bookings().filter((b) => b.email === x.email);
        const open = mine.filter((b) => LIVE.includes(b.status)).length,
            owed = mine.filter((b) => b.damageCost > 0 && b.damageStatus === 'unpaid').length;
        if (open || owed)
            throw Error(
                "You can't delete your account yet: " +
                    [
                        open ? open + ' active booking' + (open > 1 ? 's' : '') : '',
                        owed ? owed + ' unpaid damage charge' + (owed > 1 ? 's' : '') : '',
                    ]
                        .filter(Boolean)
                        .join(' and ') +
                    '. Cancel or complete ' +
                    (open + owed > 1 ? 'them' : 'it') +
                    ' first.',
            );
        const ids = new Set(mine.map((b) => b.id));
        wr(
            K.b,
            rd(K.b, []).filter((b) => b.email !== x.email),
        );
        wr(
            K.i,
            inspections().filter((i) => !ids.has(i.bookingId)),
        );
        wr(
            K.f,
            rd(K.f, []).filter((f) => !ids.has(f.bookingId)),
        ); /* inspection fee records follow their bookings */
        wr(
            K.r,
            rd(K.r, []).filter((r) => !ids.has(r.bookingId)),
        ); /* so do refund records */
        wr(
            K.u,
            rd(K.u, []).filter((u) => u.email !== x.email),
        );
        logout(); /* clears the session and goes to the Home page */
    }
    /* Display name for any account: real name when saved, otherwise a guess from the email (older accounts) */
    const nameOf = (email) => {
        const acc = rd(K.u, []).find((u) => u.email === String(email).trim().toLowerCase());
        if (acc && acc.first && acc.last) return acc.first + ' ' + acc.last;
        const n = String(email)
            .split('@')[0]
            .replace(/[._-]+/g, ' ')
            .trim();
        return n.replace(/\b\w/g, (c) => c.toUpperCase()) || String(email);
    };

    /* ===================== EMPLOYEE RENTAL POLICY =====================
    The single place where the employee rules are enforced. Every page goes through these functions, so a rule
    cannot be skipped by one screen. (Demo: data lives in localStorage. In production these checks must run on the server.)
    1. Employee accounts get EMP_DISCOUNT off the rental charge (the one-way fee is not discounted).
    2. Employees stay liable for damage, fines, fees: the acknowledgement is required and stored with the booking.
    3. BookingEmployeeId !== InspectionEmployeeId: the renter can never approve (pick-up), mark returned, or inspect their own rental.
    4. Audit trail: booking employee + inspection employee (ID, name) and the inspection date/time are stored on the booking and the inspection record. */
    const EMP_DISCOUNT = 0.5;
    const EMP_BADGE = 'Employee Discount Applied (50%)';
    const EMP_ACK_TEXT =
        'I understand that the employee discount does not waive my responsibility for damage costs, cleaning fees, traffic fines, late return fees, or other rental charges.';
    const EMP_NOTICE =
        'Employees receive a 50% rental discount but remain liable for all damages and rental-related charges.';
    const SELF_INSPECT_MSG =
        'You cannot inspect a vehicle that you rented yourself. Please ask another employee to perform the inspection.';
    const accountOf = (email) => {
        email = String(email || '')
            .trim()
            .toLowerCase();
        return rd(K.u, []).find((u) => u.email === email) || null;
    };
    const isEmployee = (email) => {
        const x = accountOf(email);
        return !!x && x.role === 'employee';
    };
    const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
    /* rental = daily rate x days, fee = one-way fee. Returns every figure shown in the booking summary. */
    const empPrice = (rental, fee) => {
        const original = r2(rental),
            discount = r2(original * EMP_DISCOUNT),
            f = r2(fee || 0);
        return {
            original,
            discount,
            net: r2(original - discount),
            fee: f,
            total: r2(original - discount + f),
        };
    };
    /* a booking made from an employee account (also older bookings made before the discount existed) */
    const isEmployeeBooking = (b) => !!b && (!!b.employeeRental || isEmployee(b.email));
    /* true when this employee is the one who rented the car */
    const isSelfBooking = (b, empEmail) => {
        if (!isEmployeeBooking(b)) return false;
        const e = String(empEmail || '')
            .trim()
            .toLowerCase();
        return b.email === e || (!!b.bookingEmployeeId && b.bookingEmployeeId === uid(e));
    };
    const needEmployee = (email, what) => {
        const x = accountOf(email);
        if (!x || x.role !== 'employee') throw Error('Only employee accounts can ' + what + '.');
        return x;
    };
    /* Throws if this person may not inspect this booking. The UI calls it first, completeInspection() calls it again. */
    function checkInspector(b, email) {
        needEmployee(email, 'perform inspections');
        if (isSelfBooking(b, email)) throw Error(SELF_INSPECT_MSG);
    }

    /* Create a booking. Rejects a booking that breaks the employee rules. */
    function addBooking(b) {
        const acct = accountOf(b.email);
        if (!acct) throw Error('Account not found. Please sign in again.');
        if (acct.role !== 'employee') {
            const eligibility = bookingEligibility(acct.email);
            if (!eligibility.eligible) throw Error(eligibility.message);
        }
        const pickup = String(b.from || ''),
            ret = String(b.to || ''),
            currentDate = today();
        if (!validDate(pickup))
            throw Error('Choose a pickup date.');
        if (pickup < currentDate)
            throw Error('Pickup date cannot be in the past.');
        if (pickup === currentDate)
            throw Error('Pickup date must be at least one day from today.');
        if (!validDate(ret)) throw Error('Choose a return date.');
        if (ret < currentDate) throw Error('Return date cannot be in the past.');
        if (ret === currentDate) throw Error('Return date cannot be today.');
        if (ret === pickup) throw Error('Same-day rentals are not allowed.');
        if (ret < pickup) throw Error('Return date must be after pickup date.');
        const conflict = bookingConflict(b.email, b.carId, pickup, ret);
        if (conflict === 'customer')
            throw Error('You already have an active booking for these dates.');
        if (conflict === 'vehicle')
            throw Error('This vehicle is unavailable for the selected dates.');
        if (acct.role === 'employee') {
            if (!b.employeeRental)
                throw Error('Employee accounts must be booked at the employee rate.');
            if (b.employeeAck !== true)
                throw Error(
                    'Please tick the employee acknowledgement checkbox before confirming your booking.',
                );
            const p = empPrice(b.rentalOriginal, b.oneWayFee);
            if (
                b.discountRate !== EMP_DISCOUNT ||
                b.discountAmount !== p.discount ||
                b.total !== p.total
            )
                throw Error(
                    'The employee discount does not match company policy. Booking rejected.',
                );
            b.bookingEmployeeId = uid(acct.email);
            b.bookingEmployeeName = nameOf(acct.email);
            b.employeeAckText = EMP_ACK_TEXT;
            b.employeeAckAt = Date.now();
        } else {
            if (b.employeeRental)
                throw Error('The employee discount is only available to employee accounts.');
            const car = CARS[Number(b.carId)];
            if (!car || !window.RentalDiscounts)
                throw Error('Rental discount details could not be verified. Please refresh and try again.');
            const [year, month, day] = ret.split('-').map(Number),
                [fromYear, fromMonth, fromDay] = pickup.split('-').map(Number),
                rentalDays =
                    (Date.UTC(year, month - 1, day) -
                        Date.UTC(fromYear, fromMonth - 1, fromDay)) /
                    864e5,
                expected = RentalDiscounts.calculate(car, rentalDays),
                expectedTotal =
                    Math.round(
                        (expected.total + Number(b.oneWayFee || 0) + Number.EPSILON) * 100,
                    ) / 100;
            if (
                b.days !== rentalDays ||
                b.rentalOriginal !== expected.original ||
                b.discountRate !== expected.rate ||
                b.discountAmount !== expected.discount ||
                b.discountLabel !== expected.label ||
                b.total !== expectedTotal
            )
                throw Error(
                    'The rental discount does not match the selected vehicle and dates. Booking rejected.',
                );
        }
        /* GPS tracking + travel-area acknowledgements and the Malaysia declaration are mandatory for every booking (checked again here, not only on the page) */
        if (
            b.gpsAcknowledged !== true ||
            b.gpsConsent !== true ||
            b.territoryAck !== true ||
            b.gpsTamperAck !== true
        )
            throw Error(
                'Please accept all GPS tracking and travel-area acknowledgements before confirming your booking.',
            );
        if (typeof b.malaysiaTravel !== 'boolean')
            throw Error('Please declare whether you intend to travel to Malaysia.');
        b.policyAckAt = Date.now();
        const a = rd(K.b, []);
        a.push(b);
        wr(K.b, a);
        return b;
    }
    /* update(id,patch): change fields of one booking and save. A booking cannot be completed except by another employee's inspection. */
    const update = (id, patch) => {
        const a = rd(K.b, []),
            b = a.find((x) => x.id === id);
        if (!b) return null;
        if (patch.status === 'completed' && isEmployeeBooking(b)) {
            if (!patch.inspectionEmployeeId)
                throw Error(
                    'An employee rental can only be completed through the inspection workflow.',
                );
            if (patch.inspectionEmployeeId === b.bookingEmployeeId) throw Error(SELF_INSPECT_MSG);
        }
        Object.assign(b, patch);
        wr(K.b, a);
        return norm(b);
    };
    const setStatus = (id, s, extra) => update(id, Object.assign({ status: s }, extra || {}));
    const addInspection = (i) => {
        const b = i.bookingId && rd(K.b, []).find((x) => x.id === i.bookingId);
        if (
            b &&
            isEmployeeBooking(b) &&
            (!i.inspectionEmployeeId || i.inspectionEmployeeId === b.bookingEmployeeId)
        )
            throw Error(SELF_INSPECT_MSG);
        const a = inspections();
        a.push(i);
        wr(K.i, a);
    };
    /* Employee approves a pending booking (this is the pick-up hand-over). Not allowed on your own rental. */
    function approveBooking(id, email) {
        const a = rd(K.b, []),
            b = a.find((x) => x.id === id);
        if (!b) throw Error('Booking not found.');
        const e = needEmployee(email, 'approve bookings');
        if (isSelfBooking(b, e.email)) throw Error(SELF_INSPECT_MSG);
        if (b.status !== 'pending') throw Error('Only pending bookings can be approved.');
        Object.assign(b, {
            status: 'confirmed',
            approvedAt: Date.now(),
            approvedBy: e.email,
            pickupEmployeeId: uid(e.email),
            pickupEmployeeName: nameOf(e.email),
        });
        wr(K.b, a);
        return norm(b);
    }
    /* Employee marks a car as returned (hand-back check). Not allowed on your own rental. */
    function markReturned(id, email) {
        const a = rd(K.b, []),
            b = a.find((x) => x.id === id);
        if (!b) throw Error('Booking not found.');
        const e = needEmployee(email, 'process returns');
        if (isSelfBooking(b, e.email)) throw Error(SELF_INSPECT_MSG);
        if (b.status !== 'confirmed')
            throw Error('Only confirmed bookings can be marked as returned.');
        Object.assign(b, {
            status: 'awaiting_inspection',
            vehicleReturnCompleted: true,
            returnedAt: Date.now(),
            returnedBy: 'employee',
            returnedByEmail: e.email,
            returnEmployeeId: uid(e.email),
            returnEmployeeName: nameOf(e.email),
        });
        wr(K.b, a);
        return norm(b);
    }
    /* Finish an inspection. Rejects it when the inspector is the booking employee. Saves the audit trail on the booking and on the inspection record.
    rec = inspection record (needs rec.at), patch = extra booking fields. Returns {booking, record}. */
    function completeInspection(id, email, rec, patch) {
        const a = rd(K.b, []),
            b = a.find((x) => x.id === id);
        if (!b) throw Error('Booking not found.');
        if (b.status !== 'awaiting_inspection')
            throw Error('This booking is not waiting for an inspection.');
        checkInspector(b, email);
        const insp = accountOf(email),
            audit = {
                inspectionEmployeeId: uid(insp.email),
                inspectionEmployeeName: nameOf(insp.email),
                inspectionEmployeeEmail: insp.email,
                inspectionAt: rec.at,
            };
        const bookingSide = b.employeeRental
            ? {
                  bookingEmployeeId: b.bookingEmployeeId,
                  bookingEmployeeName: b.bookingEmployeeName,
                  employeeRental: true,
              }
            : { employeeRental: false };
        Object.assign(b, patch || {}, audit, {
            status: 'completed',
            vehicleReturnCompleted: true,
        });
        wr(K.b, a);
        const record = Object.assign({}, rec, audit, bookingSide);
        addInspection(record);
        return { booking: norm(b), record };
    }

    /* Render all navbar auth controls from the current persisted session. */
    document.addEventListener('DOMContentLoaded', () => {
        const u = user(),
            box = document.querySelector('.auth');
        if (!box) return;
        const cur = page(),
            pill = (h, l, i, extra = '') =>
                `<a class="navpill${extra}${cur === h ? ' on' : ''}" href="${h}">${ic(i, 16)}<span class="lbl">${l}</span></a>`;
        box.replaceChildren();
        if (!u) {
            box.insertAdjacentHTML(
                'beforeend',
                '<a href="../login/login.html">Login</a><a href="../signup/signup.html" class="btn red">Sign Up</a>',
            );
        } else {
            box.insertAdjacentHTML(
                'beforeend',
                (u.role === 'employee'
                    ? pill('../employee/employee.html', 'Employee', 'shield')
                    : '') +
                    pill('../dashboard/dashboard.html', 'Dashboard', 'grid') +
                    pill('../settings/settings.html', 'Account Settings', 'settings', ' set') +
                    `<button type="button" class="navout" aria-label="Sign out">${ic('out', 18)}</button>`,
            );
            box.querySelector('.navout').addEventListener('click', logout);
        }
        box.insertAdjacentHTML(
            'beforeend',
            `<button type="button" class="burger" aria-label="Open menu" aria-expanded="false" aria-controls="mmenu">${ic('menu', 22)}</button>`,
        );
        document
            .querySelectorAll('footer a[href="../login/login.html"]')
            .forEach((a) => (a.href = '../dashboard/dashboard.html'));
        document.querySelectorAll('.plan a.btn').forEach((a) => (a.href = '../fleet/fleet.html'));
        const cta = document.querySelector('.banner a.btn');
        if (cta) {
            cta.href = '../dashboard/dashboard.html';
            cta.textContent = 'Go to my dashboard \u2192';
        }
    });

    /* Mobile navigation is rendered once from the same persisted session as the desktop auth controls. */
    document.addEventListener('DOMContentLoaded', () => {
        const nav = document.querySelector('nav'),
            box = document.querySelector('.auth'),
            btn = box && box.querySelector('.burger');
        if (!nav || !box || !btn || document.getElementById('mmenu')) return;
        const u = user(),
            cur = page(),
            ico = {
                home: 'home',
                fleet: 'car',
                contact: 'phone',
                faq: 'faq',
            };
        const item = (h, l, i) =>
            `<a class="mm-item${cur === h ? ' on' : ''}" href="${h}">${ic(i, 18)}<span>${l}</span></a>`;
        const main =
            item('../home/home.html', 'Home', ico.home) +
            item('../fleet/fleet.html', 'Fleet', ico.fleet) +
            item('../contact/contact.html', 'Contact', ico.contact) +
            item('../faq/faq.html', 'FAQ', ico.faq);
        const rest = u
            ? `<div class="mm-sep"></div>` +
              (u.role === 'employee'
                  ? item('../dashboard/dashboard.html', 'My Dashboard', 'grid') +
                    item('../employee/employee.html', 'Employee Portal', 'shield')
                  : item('../dashboard/dashboard.html', 'Dashboard', 'grid') +
                    item('../dashboard/dashboard.html', 'My Bookings', 'cal')) +
              item('../settings/settings.html', 'Account Settings', 'settings') +
              `<button type="button" class="mm-item mm-out" data-mmout>${ic('out', 18)}<span>Sign Out</span></button>`
            : `<div class="mm-sep"></div>` +
              item('../login/login.html', 'Login', 'user') +
              item('../signup/signup.html', 'Sign Up', 'check');
        nav.insertAdjacentHTML(
            'beforeend',
            `<div class="mmenu" id="mmenu" hidden>${main}${rest}</div>`,
        );
        const menu = document.getElementById('mmenu');
        const set = (o) => {
            menu.hidden = !o;
            menu.classList.toggle('open', o);
            btn.setAttribute('aria-expanded', o);
            btn.setAttribute('aria-label', o ? 'Close menu' : 'Open menu');
            btn.innerHTML = ic(o ? 'close' : 'menu', 22);
        };
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            set(menu.hidden);
        });
        menu.addEventListener('click', (e) => {
            if (e.target.closest('[data-mmout]')) logout();
        });
        document.addEventListener('click', (e) => {
            if (!menu.hidden && !menu.contains(e.target)) set(false);
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !menu.hidden) {
                set(false);
                btn.focus();
            }
        });
        matchMedia('(min-width:1025px)').addEventListener('change', (e) => {
            if (e.matches) set(false);
        });
    });

    //public API
    return {
        toast,
        K,
        LIVE,
        LABEL,
        esc,
        money,
        today,
        ic,
        user,
        signup,
        login,
        logout,
        safeNext,
        home,
        guard,
        bookings,
        bookingEligibility,
        bookingConflict,
        inspections,
        addBooking,
        update,
        setStatus,
        addInspection,
        newBookingId,
        newReceiptNo,
        uid,
        stamp,
        nameOf,
        profile,
        updateProfile,
        cleanName,
        validEmail,
        passwordIssues,
        checkPassword,
        PASSWORD_RULES,
        updateAccount,
        changePassword,
        deleteAccount,
        EMP_EMAIL_LOCKED,
        EMP_DISCOUNT,
        EMP_BADGE,
        EMP_ACK_TEXT,
        EMP_NOTICE,
        SELF_INSPECT_MSG,
        isEmployee,
        isEmployeeBooking,
        isSelfBooking,
        empPrice,
        checkInspector,
        approveBooking,
        markReturned,
        completeInspection,
    };
})();
