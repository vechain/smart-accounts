export const humanAddress = (
    address: string,
    charAtStart = 6,
    charAtEnd = 4
): string => `${address.slice(0, charAtStart)}...${address.slice(-charAtEnd)}`;

export const humanAmountNumber = (
    amount: string,
    symbol?: string,
    decimals = 2
): string => {
    const [integerPart, decimalPart] = amount.split(".");

    const hasDecimal = !!decimalPart;
    const decimalLabel = hasDecimal ? `.${decimalPart.slice(0, decimals)}` : "";

    if (symbol) return `${integerPart}${decimalLabel} ${symbol}`;

    return `${integerPart}${decimalLabel}`;
};

export const capitalizeFirstLetter = (text: string) =>
    text[0].toUpperCase() + text.slice(1);
