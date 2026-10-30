/* AZoom branches: the single place to edit branch names, addresses, phone numbers and opening hours.
   This file is the ONLY source of branch data: every page reads it. PLACEHOLDER DETAILS: replace the addresses, postal codes, numbers and hours below with the real ones before launch.
   ONE_WAY_FEE: charged when the pickup and return branches are different. Set to 0 to switch it off. */
const BRANCHES = [
    {
        name: 'Orchard Road',
        type: 'City Branch',
        hq: false,
        address: '2 Orchard Turn, ION Orchard',
        postal: '238801',
        phone: '+65 7890 0534',
        hours: 'Daily, 8:00 AM - 10:00 PM',
    },
    {
        name: 'Alexandra Road',
        type: 'City Branch',
        address: '460 Alexandra Road',
        postal: '119963',
        phone: '+65 6247 9183',
        hours: 'Mon - Sat, 9:00 AM - 7:00 PM',
    },
    {
        name: 'Chinatown',
        type: 'City Branch',
        address: '133 New Bridge Road, Chinatown Point',
        postal: '059413',
        phone: '+65 8712 4659',
        hours: 'Daily, 9:00 AM - 8:00 PM',
    },
    {
        name: 'HarbourFront',
        type: 'Mall Branch',
        address: '1 HarbourFront Walk, VivoCity',
        postal: '098585',
        phone: '+65 6834 7521',
        hours: 'Daily, 9:00 AM - 9:00 PM',
    },
    {
        name: 'Suntec City & Millenia Walk Complex',
        type: 'Mall Branch',
        address: '3 Temasek Boulevard, Suntec City',
        postal: '038983',
        phone: '+65 7358 1946',
        hours: 'Daily, 10:00 AM - 9:00 PM',
    },
    {
        name: 'One-North & Buona Vista',
        type: 'Business Park Branch',
        address: '1 Fusionopolis Way, Connexis',
        postal: '138632',
        phone: '+65 8263 5071',
        hours: 'Mon - Fri, 8:30 AM - 7:00 PM',
    },
    {
        name: 'Raffles Place',
        displayName: 'Raffles Place (HQ)',
        type: 'Main Headquarters',
        hq: true,
        address: '1 Raffles Place',
        postal: '048616',
        phone: '+65 6941 8327',
        hours: 'Mon - Fri, 8:00 AM - 8:00 PM',
    },
    {
        name: 'Collyer Quay (CBD)',
        type: 'CBD Branch',
        address: '10 Collyer Quay, Ocean Financial Centre',
        postal: '049315',
        phone: '+65 7583 2614',
        hours: 'Mon - Fri, 8:00 AM - 8:00 PM',
    },
    {
        name: 'Ubi (Frontier Building)',
        type: 'Business Branch',
        address: 'Frontier Building, Ubi Avenue 3',
        postal: '408857',
        phone: '+65 8475 1932',
        hours: 'Mon - Sat, 9:00 AM - 6:30 PM',
    },
    {
        name: 'Marina Bay',
        type: 'Waterfront Branch',
        address: '10 Bayfront Avenue, Marina Bay Sands',
        postal: '018956',
        phone: '+65 6729 4581',
        hours: 'Daily, 9:00 AM - 10:00 PM',
    },
    {
        name: 'Changi Airport',
        type: 'Airport Branch',
        address: '65 Airport Boulevard, Changi Airport Terminal 3',
        postal: '819663',
        phone: '+65 9138 6247',
        hours: 'Open 24 hours, daily',
    },
    {
        name: 'Jurong East',
        type: 'Regional Branch',
        address: '50 Jurong Gateway Road, Jem',
        postal: '608549',
        phone: '+65 7814 3056',
        hours: 'Daily, 10:00 AM - 9:00 PM',
    },
];
const ONE_WAY_FEE = 50; /* S$ added when pickup branch and return branch differ */

const Branches = (() => {
    const esc = (s) =>
        String(s).replace(
            /[&<>"']/g,
            (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
        );
    const names = () => BRANCHES.map((b) => b.name);
    const find = (n) => BRANCHES.find((b) => b.name === n) || null;
    const label = (n) => {
        const b = find(n);
        return b ? b.displayName || b.name : n;
    };
    const pick = (n, d) => (find(n) ? n : d);
    const options = (sel) =>
        BRANCHES.map(
            (b) =>
                `<option value="${esc(b.name)}"${b.name === sel ? ' selected' : ''}>${esc(label(b.name))}</option>`,
        ).join('');
    const ic = (n) => (window.Auth && Auth.ic ? Auth.ic(n, 15) : '');
    /* Detail block: name, address, phone, opening hours. Falls back to the plain name for bookings made with an older branch name. */
    function detail(name, label) {
        const b = find(name);
        const head = `<div class="bd-top">${label ? `<span class="bd-label">${esc(label)}</span>` : ''}<b>${esc(Branches.label(name))}</b>${b && b.hq ? '<span class="hqbadge">HQ</span>' : ''}</div>`;
        if (!b) return `<div class="bdetail">${head}</div>`;
        return `<div class="bdetail">${head}<ul><li>${ic('doc')}<span><em>Branch type</em> ${esc(b.type)}</span></li><li>${ic('pin')}<span><em>Address</em>${addr(b)}</span></li><li>${ic('phone')}<span><em>Phone</em> ${esc(b.phone)}</span></li><li>${ic('clock')}<span><em>Hours</em> ${esc(b.hours)}</span></li></ul></div>`;
    }
    /* two lines: street address, then "Singapore <postal code>" */
    const addr = (b) => `<span class="addr">${esc(b.address)}<br>Singapore ${esc(b.postal)}</span>`;
    const fee = (pk, rt) => (pk !== rt ? ONE_WAY_FEE : 0);
    //public API
    return {
        names: names,
        find: find,
        label: label,
        pick: pick,
        options: options,
        detail: detail,
        addr: addr,
        fee: fee,
        esc: esc,
    };
})();
