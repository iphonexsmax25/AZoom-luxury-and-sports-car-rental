document
    .querySelectorAll('[data-ic]')
    .forEach((e) => (e.innerHTML = Auth.ic(e.dataset.ic, e.classList.contains('big') ? 30 : 20)));
