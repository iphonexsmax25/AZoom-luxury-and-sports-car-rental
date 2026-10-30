const faqCards = [...document.querySelectorAll('.faq-card')];
const faqSearch = document.querySelector('#faq-search');
const categoryFilters = [...document.querySelectorAll('.category-filter')];
const resultCount = document.querySelector('#faq-result-count');
const emptyMessage = document.querySelector('#faq-empty');

let activeCategory = 'all';
let searchTerm = '';

function highlightText(element, terms) {
    const text = element.textContent;
    if (terms.length === 0) {
        element.replaceChildren(document.createTextNode(text));
        return;
    }

    const matches = [];
    const expression = new RegExp(terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi');
    let match;

    while ((match = expression.exec(text)) !== null) {
        matches.push({ text: match[0], index: match.index });
    }

    element.replaceChildren();
    let position = 0;

    for (const item of matches) {
        element.append(document.createTextNode(text.slice(position, item.index)));
        const mark = document.createElement('mark');
        mark.textContent = item.text;
        element.append(mark);
        position = item.index + item.text.length;
    }

    element.append(document.createTextNode(text.slice(position)));
}

function updateFaqs() {
    const terms = searchTerm.trim().split(/\s+/).filter(Boolean);
    let visibleCount = 0;

    for (const card of faqCards) {
        const question = card.querySelector('.faq-question-text');
        const answer = card.querySelector('.faq-answer-copy');
        const content = `${question.textContent} ${answer.textContent} ${card.dataset.category}`.toLocaleLowerCase();
        const matchesCategory = activeCategory === 'all' || card.dataset.category === activeCategory;
        const matchesSearch = terms.every((term) => content.includes(term.toLocaleLowerCase()));
        const isVisible = matchesCategory && matchesSearch;

        card.hidden = !isVisible;
        visibleCount += Number(isVisible);

        const questionTerms = terms.filter((term) => question.textContent.toLocaleLowerCase().includes(term.toLocaleLowerCase()));
        const answerTerms = terms.filter((term) => answer.textContent.toLocaleLowerCase().includes(term.toLocaleLowerCase()));
        highlightText(question, questionTerms);
        highlightText(answer, answerTerms);
    }

    resultCount.textContent = `Showing ${visibleCount} ${visibleCount === 1 ? 'question' : 'questions'}`;
    emptyMessage.hidden = visibleCount > 0;
    document.querySelector('#faq-list').hidden = visibleCount === 0;
}

for (const question of document.querySelectorAll('.faq-question')) {
    question.addEventListener('click', () => {
        const isExpanded = question.getAttribute('aria-expanded') === 'true';
        const answer = document.getElementById(question.getAttribute('aria-controls'));
        const card = question.closest('.faq-card');

        question.setAttribute('aria-expanded', String(!isExpanded));
        answer.setAttribute('aria-hidden', String(isExpanded));
        answer.inert = isExpanded;
        card.classList.toggle('is-open', !isExpanded);
    });
}

faqSearch.addEventListener('input', () => {
    searchTerm = faqSearch.value;
    updateFaqs();
});

for (const filter of categoryFilters) {
    filter.addEventListener('click', () => {
        activeCategory = filter.dataset.category;
        for (const item of categoryFilters) {
            const isActive = item === filter;
            item.classList.toggle('is-active', isActive);
            item.setAttribute('aria-pressed', String(isActive));
        }
        updateFaqs();
    });
}

document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        faqSearch.focus();
    }
    if (event.key === 'Escape' && document.activeElement === faqSearch) {
        faqSearch.value = '';
        searchTerm = '';
        updateFaqs();
    }
});

updateFaqs();
