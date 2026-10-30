/* Account Settings (../settings/settings.html): profile + email, change password, account security info, delete account.
   For customers AND employees. Every save goes through auth.js (updateAccount / changePassword / deleteAccount), which re-checks the rules. */
(function () {
    const A = Auth,
        $ = (s) => document.querySelector(s),
        app = $('#app'),
        esc = A.esc;
    const u = A.guard();
    if (!u) return;
    const p0 = A.profile();
    if (!p0) {
        location.replace('../login/login.html');
        return;
    }
    const emp = p0.role === 'employee',
        locked = !!p0.managed,
        backHref = A.home(p0);
    const fld = (id, label, icon, attrs, extra = '') =>
        `<div class="fld"><label for="${id}">${A.ic(icon, 16)} ${label}</label><input id="${id}" ${attrs}>${extra}</div>`;
    const row = (l, v, id) =>
        `<div class="srow"><span>${l}</span><b${id ? ` id="${id}"` : ''}>${v}</b></div>`;
    const when = (ts, none) => (ts ? esc(A.stamp(ts)) : `<i class="muted">${none}</i>`);

    document.title = 'Account Settings | AZoom';
    app.innerHTML = `<a class="back" href="${backHref}">${A.ic('back', 16)} Back to ${emp ? 'employee portal' : 'dashboard'}</a>
 <div class="acct-head"><div><span class="eyebrow">${A.ic('settings', 16)}ACCOUNT</span><h1>Account Settings</h1><p id="s-email">${esc(p0.email)}</p></div></div>
 <div class="setgrid">
  <section class="acard scard" id="sec-profile"><h2>${A.ic('user', 20)} Profile Information</h2>
   <form id="fprofile" novalidate>
    <div class="two">${fld('pf', 'First Name', 'user', `name="first" value="${esc(p0.first)}" maxlength="40" autocomplete="given-name" required`)}${fld('pl', 'Last Name', 'user', `name="last" value="${esc(p0.last)}" maxlength="40" autocomplete="family-name" required`)}</div>
    ${
        locked
            ? `<div class="fld locked"><label for="pe">${A.ic('mail', 16)} Email Address <span class="managed" title="Managed by AZoom">${A.ic('lock', 13)} Managed Account</span></label><div class="lockwrap"><input id="pe" type="email" value="${esc(p0.email)}" readonly aria-readonly="true" tabindex="-1" autocomplete="off">${A.ic('lock', 16)}</div><p class="notice-lock">${A.ic('lock', 14)} Employee accounts must maintain their @azoom.sg email address. Email changes are not permitted.</p></div>`
            : fld(
                  'pe',
                  'Email Address',
                  'mail',
                  `name="email" type="email" value="${esc(p0.email)}" maxlength="120" autocomplete="email" required`,
                  `<p class="hint">This is the email you sign in with. Changing it needs your current password.</p>`,
              )
    }
    <div class="fld" id="pcw" hidden>${`<label for="pc">${A.ic('lock', 16)} Current Password</label><input id="pc" name="currentPassword" type="password" autocomplete="current-password"><p class="hint">Required to change your email address.</p>`}</div>
    <p class="msg" id="pmsg" role="status" aria-live="polite"></p>
    <button class="btn red" type="submit">Save Changes</button>
   </form></section>

  <section class="acard scard" id="sec-password"><h2>${A.ic('lock', 20)} Change Password</h2>
   <form id="fpass" novalidate>
    ${fld('cp', 'Current Password', 'lock', `name="current" type="password" autocomplete="current-password" required`)}
    ${fld('np', 'New Password', 'lock', `name="next" type="password" autocomplete="new-password" required`)}
    <ul class="rules" id="rules">${A.PASSWORD_RULES.map((r, i) => `<li data-r="${i}">${esc(r[0])}</li>`).join('')}</ul>
    ${fld('cn', 'Confirm New Password', 'lock', `name="confirm" type="password" autocomplete="new-password" required`)}
    <label class="showpw"><input type="checkbox" id="showpw"> Show passwords</label>
    <p class="msg" id="wmsg" role="status" aria-live="polite"></p>
    <button class="btn red" type="submit">Update Password</button>
   </form></section>

  <section class="acard scard" id="sec-security"><h2>${A.ic('shield', 20)} Account Security</h2>
   <div class="slist" id="slist"></div></section>

  <section class="acard scard danger" id="sec-delete"><h2>${A.ic('trash', 20)} Delete Account</h2>
   <div class="dwarn" role="alert">${A.ic('warn', 20)}<p><b>This cannot be undone.</b> Deleting your account permanently removes all account data, bookings, and profile information.${emp ? ' Inspection records you completed for customers are kept for the company audit trail.' : ''}</p></div>
   <p class="hint" id="dcount"></p>
   <form id="fdelete" novalidate>
    <div class="fld"><label for="dc">Type <b class="dword">DELETE</b> to confirm</label><input id="dc" name="confirm" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="DELETE"></div>
    <p class="msg" id="dmsg" role="alert" aria-live="polite"></p>
    <button class="btn danger" type="submit" id="dbtn" disabled>${A.ic('trash', 16)} Delete Account</button>
   </form></section>
 </div>`;

    const say = (id, t, ok) => {
        const e = $(id);
        e.textContent = t || '';
        e.className = 'msg' + (t ? (ok ? ' ok' : ' bad') : '');
    };
    const busy = (form, on) =>
        form.querySelectorAll('button[type=submit]').forEach((b) => (b.disabled = on));

    /* ----- Account Security card (read from the account store each time) ----- */
    function security() {
        const p = A.profile();
        if (!p) return;
        $('#slist').innerHTML =
            row(
                'Account type',
                `<span class="badge ${p.role === 'employee' ? 'b-pending' : 'b-confirmed'}">${p.role === 'employee' ? 'EMPLOYEE' : 'CUSTOMER'}</span>`,
            ) +
            row(p.role === 'employee' ? 'Employee ID' : 'Customer ID', esc(A.uid(p.email))) +
            row('Account created', when(p.createdAt, 'Not recorded (older account)')) +
            row('Last login', when(p.lastLogin, 'Not recorded yet')) +
            (p.prevLogin ? row('Previous login', when(p.prevLogin)) : '') +
            (p.passwordChangedAt ? row('Password last changed', when(p.passwordChangedAt)) : '');
        const n = A.bookings().filter((b) => b.email === p.email).length;
        $('#dcount').textContent = n
            ? `This will also delete your ${n} booking${n > 1 ? 's' : ''}.`
            : 'You have no bookings.';
    }
    security();

    /* ----- Profile + email ----- */
    const pe = $('#pe'),
        pcw = $('#pcw');
    const emailChanged = () => pe.value.trim().toLowerCase() !== (A.profile() || p0).email;
    if (!locked)
        pe.addEventListener('input', () => {
            pcw.hidden = !emailChanged();
        });
    $('#fprofile').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target,
            d = new FormData(f);
        say('#pmsg', '');
        busy(f, true);
        try {
            /* employees: email is NOT part of the request (and the server would refuse it anyway) */
            const req = locked
                ? { first: d.get('first'), last: d.get('last') }
                : {
                      first: d.get('first'),
                      last: d.get('last'),
                      email: d.get('email'),
                      currentPassword: d.get('currentPassword'),
                  };
            const r = await A.updateAccount(req);
            const p = r.profile;
            $('#pf').value = p.first;
            $('#pl').value = p.last;
            pe.value = p.email;
            if (!locked) {
                $('#pc').value = '';
                pcw.hidden = true;
            }
            $('#s-email').textContent = p.email;
            security();
            say(
                '#pmsg',
                r.emailChanged
                    ? 'Profile updated. You now sign in with ' + p.email + '.'
                    : 'Your profile was updated successfully.',
                true,
            );
            A.toast('Profile updated.');
        } catch (x) {
            say('#pmsg', x.message);
            A.toast(x.message, 'err');
        }
        busy(f, false);
    });

    /* ----- Password ----- */
    const np = $('#np'),
        pwFields = ['#cp', '#np', '#cn'];
    function meter() {
        /* live checklist (only one rule: at least 8 characters) */
        const v = np.value;
        document
            .querySelectorAll('#rules li')
            .forEach((li, i) => li.classList.toggle('ok', A.PASSWORD_RULES[i][1](v)));
    }
    np.addEventListener('input', meter);
    meter();
    $('#showpw').addEventListener('change', (e) =>
        pwFields.forEach((s) => ($(s).type = e.target.checked ? 'text' : 'password')),
    );
    $('#fpass').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target,
            d = new FormData(f);
        say('#wmsg', '');
        busy(f, true);
        try {
            await A.changePassword(
                String(d.get('current')),
                String(d.get('next')),
                String(d.get('confirm')),
            );
            f.reset();
            meter();
            pwFields.forEach((s) => ($(s).type = 'password'));
            $('#showpw').checked = false;
            security();
            say('#wmsg', 'Your password was updated successfully.', true);
            A.toast('Password updated.');
        } catch (x) {
            say('#wmsg', x.message);
            A.toast(x.message, 'err');
        }
        busy(f, false);
    });

    /* ----- Delete account ----- */
    const dc = $('#dc'),
        dbtn = $('#dbtn');
    dc.addEventListener('input', () => {
        dbtn.disabled = dc.value !== 'DELETE';
        say('#dmsg', '');
    });
    $('#fdelete').addEventListener('submit', (e) => {
        e.preventDefault();
        if (dc.value !== 'DELETE') return;
        try {
            A.deleteAccount(dc.value);
        } catch (x) {
            /* signs out and goes to the Home page */
            say('#dmsg', x.message);
            A.toast(x.message, 'err');
        }
    });

    /* signed out / changed in another tab */
    addEventListener('storage', (e) => {
        if (e.key === A.K.s || e.key === A.K.u) {
            if (!A.profile()) location.replace('../login/login.html');
            else security();
        }
    });
})();
