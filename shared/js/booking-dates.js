/* Shared rental date rules for customer booking flows. */
window.BookingDates = (() => {
    const format = (date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const today = () => format(new Date());
    const addDays = (value, days) => {
        const [year, month, day] = value.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        date.setDate(date.getDate() + days);
        return format(date);
    };
    const isValidDate = (value) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
        const [year, month, day] = value.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return (
            date.getFullYear() === year &&
            date.getMonth() === month - 1 &&
            date.getDate() === day
        );
    };
    const tomorrow = () => addDays(today(), 1);
    const minimumReturn = (pickup) =>
        isValidDate(pickup) && pickup >= tomorrow() ? addDays(pickup, 1) : tomorrow();
    const validate = (pickup, ret) => {
        if (!isValidDate(pickup)) return { field: 'pickup', message: 'Choose a pickup date.' };
        const now = today();
        if (pickup < now)
            return { field: 'pickup', message: 'Pickup date cannot be in the past.' };
        if (pickup <= now)
            return {
                field: 'pickup',
                message: 'Pickup date must be at least one day from today.',
            };
        if (!isValidDate(ret)) return { field: 'return', message: 'Choose a return date.' };
        if (ret < now) return { field: 'return', message: 'Return date cannot be in the past.' };
        if (ret === now) return { field: 'return', message: 'Return date cannot be today.' };
        if (ret === pickup)
            return { field: 'return', message: 'Same-day rentals are not allowed.' };
        if (ret < pickup)
            return { field: 'return', message: 'Return date must be after pickup date.' };
        return null;
    };
    return { today, tomorrow, addDays, isValidDate, minimumReturn, validate };
})();
