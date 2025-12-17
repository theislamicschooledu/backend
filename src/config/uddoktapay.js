const uddoktapayConfig = {
  apiKey: process.env.UDDOKTAPAY_API_KEY,
  baseURL: process.env.UDDOKTAPAY_BASE_URL || 'https://sandbox.uddoktapay.com/api',
  successUrl: `${process.env.FRONTEND_URL}/payment/success`,
  cancelUrl: `${process.env.FRONTEND_URL}/payment/cancel`,
  webhookUrl: `https://cool-papayas-take.loca.lt/api/payments/webhook`
};

export default uddoktapayConfig;

// const uddoktapayConfig = {
//   apiKey: process.env.UDDOKTAPAY_API_KEY,
//   baseURL: process.env.UDDOKTAPAY_BASE_URL || 'https://sandbox.uddoktapay.com/api',
//   successUrl: `${process.env.FRONTEND_URL}/payment/success`,
//   cancelUrl: `${process.env.FRONTEND_URL}/payment/cancel`,
//   webhookUrl: `${process.env.BACKEND_URL}/api/payments/webhook`
// };

// export default uddoktapayConfig;