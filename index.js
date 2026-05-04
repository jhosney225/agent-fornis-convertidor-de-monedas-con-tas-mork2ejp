
```javascript
import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline";

const client = new Anthropic();

// Store exchange rates in cache to avoid repeated API calls
const exchangeRateCache = new Map();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

interface ExchangeRateInfo {
  rate: number;
  timestamp: number;
}

const tools: Anthropic.Tool[] = [
  {
    name: "get_exchange_rate",
    description:
      "Get the current exchange rate between two currencies. Uses cached rates when available.",
    input_schema: {
      type: "object" as const,
      properties: {
        from_currency: {
          type: "string",
          description:
            "The source currency code (e.g., USD, EUR, GBP, JPY, MXN)",
        },
        to_currency: {
          type: "string",
          description:
            "The target currency code (e.g., USD, EUR, GBP, JPY, MXN)",
        },
      },
      required: ["from_currency", "to_currency"],
    },
  },
  {
    name: "convert_currency",
    description:
      "Convert an amount from one currency to another using current exchange rates",
    input_schema: {
      type: "object" as const,
      properties: {
        amount: {
          type: "number",
          description: "The amount to convert",
        },
        from_currency: {
          type: "string",
          description: "The source currency code",
        },
        to_currency: {
          type: "string",
          description: "The target currency code",
        },
      },
      required: ["amount", "from_currency", "to_currency"],
    },
  },
];

function getExchangeRate(
  fromCurrency: string,
  toCurrency: string
): ExchangeRateInfo {
  const cacheKey = `${fromCurrency}_${toCurrency}`;

  // Check if we have a cached rate that's still valid
  if (exchangeRateCache.has(cacheKey)) {
    const cached = exchangeRateCache.get(
      cacheKey
    ) as ExchangeRateInfo | undefined;
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached;
    }
  }

  // Simulated exchange rates for demonstration
  // In a real application, this would call an actual API like fixer.io, exchangerate-api.com, etc.
  const rates: { [key: string]: number } = {
    USD_EUR: 0.92,
    EUR_USD: 1.09,
    USD_GBP: 0.79,
    GBP_USD: 1.27,
    USD_JPY: 149.5,
    JPY_USD: 0.0067,
    USD_MXN: 17.5,
    MXN_USD: 0.057,
    EUR_GBP: 0.86,
    GBP_EUR: 1.16,
    EUR_JPY: 162.5,
    JPY_EUR: 0.0062,
    EUR_MXN: 19.0,
    MXN_EUR: 0.053,
    GBP_JPY: 189.0,
    JPY_GBP: 0.0053,
    GBP_MXN: 22.1,
    MXN_GBP: 0.045,
    JPY_MXN: 0.117,
    MXN_JPY: 8.55,
  };

  // Default to 1:1 if exact rate not found, or try to calculate it
  let rate = rates[`${fromCurrency}_${toCurrency}`];
  if (!rate) {
    // Try reverse calculation
    const reverseKey = `${toCurrency}_${fromCurrency}`;
    if (rates[reverseKey]) {
      rate = 1 / rates[reverseKey];
    } else {
      // Default to 1:1 for unknown pairs
      rate = 1.0;
    }
  }

  const rateInfo: ExchangeRateInfo = {
    rate: rate,
    timestamp: Date.now(),
  };

  // Cache the rate
  exchangeRateCache.set(cacheKey, rateInfo);

  return rateInfo;
}

function processToolCall(
  toolName: string,
  toolInput: Record<string, unknown>
): string {
  if (toolName === "get_exchange_rate") {
    const fromCurrency = (toolInput.from_currency as string).toUpperCase();
    const toCurrency = (toolInput.to_currency as string).toUpperCase();

    const rateInfo = getExchangeRate(fromCurrency, toCurrency);
    return JSON.stringify({
      from: fromCurrency,
      to: toCurrency,
      rate: rateInfo.rate,
      timestamp: new Date(rateInfo.timestamp).toISOString(),
    });
  } else if (toolName === "convert_currency") {
    const amount = toolInput.amount as number;
    const fromCurrency = (toolInput.from_currency as string).toUpperCase();
    const toCurrency = (toolInput.to_currency as string).toUpperCase();

    const rateInfo = getExchangeRate(fromCurrency, toCurrency);
    const convertedAmount = amount * rateInfo.rate;

    return JSON.stringify({
      original_amount: amount,
      original_currency: fromCurrency,
      converted_amount: convertedAmount.toFixed(2),
      target_currency: toCurrency,
      exchange_rate: rateInfo.rate,
    });
  }

  return JSON.stringify({ error: "Unknown tool" });
}

async function chatWithClaude(userMessage: string): Promise<string> {
  const messages: Anthropic.MessageParam