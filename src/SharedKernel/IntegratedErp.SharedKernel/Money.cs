using System.Globalization;

namespace IntegratedErp.SharedKernel;

/// <summary>
/// An amount in a currency. Arithmetic keeps full precision; <see cref="Round"/> applies the single
/// project-wide rule: 2 decimals, midpoint away from zero (e.g. 1000 / 30 = 33.33, 1000 − 33.33 = 966.67).
/// Mixing currencies is an error — conversions are explicit (finance module).
/// </summary>
public readonly record struct Money
{
    public const string Sar = "SAR";

    public Money(decimal amount, string currency)
    {
        if (string.IsNullOrWhiteSpace(currency) || currency.Length != 3 || !currency.All(char.IsAsciiLetterUpper))
        {
            throw new ArgumentException("Currency must be a 3-letter upper-case ISO code.", nameof(currency));
        }

        Amount = amount;
        Currency = currency;
    }

    public decimal Amount { get; }

    public string Currency { get; }

    public static Money Zero(string currency = Sar) => new(0m, currency);

    public static Money Of(decimal amount, string currency = Sar) => new(amount, currency);

    public static decimal RoundAmount(decimal amount) => Math.Round(amount, 2, MidpointRounding.AwayFromZero);

    public Money Round() => new(RoundAmount(Amount), Currency);

    public Money Add(Money other)
    {
        EnsureSameCurrency(other);
        return new Money(Amount + other.Amount, Currency);
    }

    public Money Subtract(Money other)
    {
        EnsureSameCurrency(other);
        return new Money(Amount - other.Amount, Currency);
    }

    public Money Multiply(decimal factor) => new(Amount * factor, Currency);

    /// <summary><c>amount × part ÷ whole</c> without intermediate rounding (e.g. monthly salary × days ÷ 30).</summary>
    public Money Prorate(decimal part, decimal whole)
    {
        if (whole == 0m)
        {
            throw new DivideByZeroException("Cannot prorate over zero.");
        }

        return new Money(Amount * part / whole, Currency);
    }

    public static Money operator +(Money left, Money right) => left.Add(right);

    public static Money operator -(Money left, Money right) => left.Subtract(right);

    public static Money operator *(Money left, decimal factor) => left.Multiply(factor);

    public override string ToString() => string.Create(CultureInfo.InvariantCulture, $"{RoundAmount(Amount):0.00} {Currency}");

    private void EnsureSameCurrency(Money other)
    {
        if (!string.Equals(Currency, other.Currency, StringComparison.Ordinal))
        {
            throw new InvalidOperationException($"Cannot combine {Currency} with {other.Currency}.");
        }
    }
}
