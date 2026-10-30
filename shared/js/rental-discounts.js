/* Duration-based rental discounts shared by vehicle cards, booking pages and booking validation. */
window.RentalDiscounts = (() => {
    const SUPER_CAR_BRANDS = new Set(['Lamborghini', 'Ferrari', 'McLaren', 'Aston Martin']);
    const r2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

    function tiersFor(car) {
        return SUPER_CAR_BRANDS.has(car.mk)
            ? [
                  { days: 3, rate: 0.03, icon: '🔥', label: '3+ Days' },
                  { days: 7, rate: 0.05, icon: '⭐', label: '7+ Days' },
                  { days: 30, rate: 0.1, icon: '💎', label: '30+ Days' },
              ]
            : [
                  { days: 3, rate: 0.05, icon: '🔥', label: '3+ Days' },
                  { days: 7, rate: 0.1, icon: '⭐', label: '7+ Days' },
                  { days: 30, rate: 0.15, icon: '💎', label: '30+ Days' },
              ];
    }

    function offerFor(car, days) {
        const tiers = tiersFor(car);
        return tiers.filter((tier) => days >= tier.days).pop() || {
            days: 0,
            rate: 0,
            icon: '',
            label: 'No duration discount',
        };
    }

    function calculate(car, days) {
        const offer = offerFor(car, days);
        const original = r2(car.p * days);
        const discount = r2(original * offer.rate);
        return {
            ...offer,
            original,
            discount,
            total: r2(original - discount),
            percentage: offer.rate * 100,
        };
    }

    function cardMarkup(car) {
        const tiers = tiersFor(car);
        return `<div class="rental-deals" aria-label="Rental Deals"><strong>Rental Deals</strong><div class="deal-badges">${tiers
            .map(
                (tier) =>
                    `<span class="deal-badge"><span aria-hidden="true">${tier.icon}</span> Save ${tier.rate * 100}% for ${tier.label}</span>`,
            )
            .join('')}</div><div class="deal-pills"><span class="deal-pill weekly">Weekly Deal</span><span class="deal-pill longterm">Long-Term Rental</span><span class="deal-pill best">Best Value</span></div></div>`;
    }

    return { offerFor, calculate, cardMarkup };
})();
