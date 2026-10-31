window.PaymentValidation = (() => {
    const cvvPattern = /^\d{3}$/,
        digitsOnlyPattern = /^[0-9]+$/,
        nonDigitPattern = /[^0-9]/;

    function validateCvv(value) {
        const submitted = String(value || '');
        if (!submitted) return 'CVV is required.';
        if (!digitsOnlyPattern.test(submitted)) return 'CVV can only contain numbers.';
        if (!cvvPattern.test(submitted)) return 'CVV must contain exactly 3 digits.';
        return '';
    }

    function bindCvv(input) {
        let invalidCharactersEntered = false;
        input.addEventListener('input', () => {
            const value = input.value;
            invalidCharactersEntered = nonDigitPattern.test(value);
            input.value = value.replace(nonDigitPattern, '').slice(0, 3);
        });

        return {
            validate(value) {
                if (invalidCharactersEntered) return 'CVV can only contain numbers.';
                return validateCvv(value);
            },
            clear() {
                input.value = '';
                invalidCharactersEntered = false;
            },
        };
    }

    return { bindCvv, validateCvv };
})();
