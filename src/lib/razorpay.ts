import { api } from "./api";

interface RazorpayUser {
  name: string;
  email: string;
  phone: string;
}

interface RazorpayOrderResponse {
  requiresPayment: boolean;
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  user: RazorpayUser;
}

export const processRazorpaySubscription = (
  orderData: RazorpayOrderResponse,
  planId: string,
  cycle: string,
  onSuccess: (verifyResponse: any) => void,
  onFailure: (err: Error) => void
) => {
  const RazorpayConstructor = (window as any).Razorpay;
  if (!RazorpayConstructor) {
    onFailure(new Error("Razorpay SDK is not loaded yet. Please refresh the page."));
    return;
  }

  const options = {
    key: orderData.keyId,
    amount: orderData.amount,
    currency: orderData.currency,
    name: "WAPIMI SENDER",
    description: `Upgrade to ${planId.toUpperCase()} (${cycle})`,
    order_id: orderData.orderId,
    handler: async function (response: any) {
      try {
        // Send verification tokens to backend
        const verifyRes = await api.verifyRazorpayPayment({
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature,
          planId,
          cycle
        });
        onSuccess(verifyRes);
      } catch (verifyErr: any) {
        onFailure(new Error(verifyErr.message || "Payment verification failed."));
      }
    },
    prefill: {
      name: orderData.user.name,
      email: orderData.user.email,
      contact: orderData.user.phone,
    },
    theme: {
      color: "#059669", // WAPIMI Emerald
    },
  };

  const rzp = new RazorpayConstructor(options);
  rzp.on("payment.failed", function (response: any) {
    onFailure(new Error(response.error.description || "Razorpay transaction failed."));
  });

  rzp.open();
};
