(function () {
    const E = Branches.esc;
    document.getElementById('branches').innerHTML = BRANCHES.filter((b) => b.hq)
        .concat(BRANCHES.filter((b) => !b.hq))
        .map(
        (b) => `<article class="ccard${b.hq ? ' hq' : ''}">
  <div class="chead"><h3>${E(b.hq ? `Main Headquarters (HQ) - ${b.name}` : b.name)}</h3>${b.hq ? '<span class="hqbadge">MAIN HEADQUARTERS</span>' : ''}</div>
  <dl><div><dt>Branch Type</dt><dd>${E(b.type)}</dd></div><div><dt>Address</dt><dd>${Branches.addr(b)}</dd></div>
  <div><dt>Phone</dt><dd>${E(b.phone)}</dd></div><div><dt>Operating Hours</dt><dd>${E(b.hours)}</dd></div></dl></article>`,
    ).join('');
})();
