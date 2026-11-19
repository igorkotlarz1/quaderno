"""Price list (USD per million tokens) and the cost of one call. These are list prices for the Claude API
as of 2026-11; the number in llm_calls is an estimate, Anthropic's console has the exact bill."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Price:
    input: float
    output: float
    cache_read: float
    cache_write: float  # 5-minute prompt cache: 1.25 x input


PRICES: dict[str, Price] = {
    "claude-haiku-5-5": Price(0.10, 0.50, 0.01, 0.125),  # prompts up to 100K tokens
    "claude-sonnet-5-5": Price(2.00, 10.00, 0.10, 2.50),
    "claude-sonnet-5": Price(2.00, 10.00, 0.20, 2.50),
    "claude-opus-5-5": Price(4.00, 20.00, 0.20, 5.00),
    "claude-opus-5": Price(5.00, 25.00, 0.50, 6.25),
}
UNKNOWN = PRICES["claude-opus-5-5"]  # a model not in the list is costed high rather than as free


def cost_usd(
    model: str, input_tokens: int, output_tokens: int, cache_read: int = 0, cache_write: int = 0
) -> float:
    p = PRICES.get(model, UNKNOWN)
    total = (
        input_tokens * p.input
        + output_tokens * p.output
        + cache_read * p.cache_read
        + cache_write * p.cache_write
    )
    return round(total / 1_000_000, 6)
