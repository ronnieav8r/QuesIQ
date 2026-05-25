const appUrl = process.env.QUESIQ_APP_URL;
const secret = process.env.PRICING_CHECK_SECRET;

if (!appUrl) {
  throw new Error("QUESIQ_APP_URL is required.");
}

if (!secret) {
  throw new Error("PRICING_CHECK_SECRET is required.");
}

const endpoint = `${appUrl.replace(/\/$/, "")}/api/pricing/review`;
const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${secret}`,
  },
});

const body = await response.text();

if (!response.ok) {
  throw new Error(`Pricing review failed with ${response.status}: ${body}`);
}

console.log(body);
