// react-native-razorpay ships no type declarations and there is no
// @types/react-native-razorpay package — this covers the surface this app
// actually uses. Re-check against the installed version if the SDK's options
// or callback shape changes.
declare module "react-native-razorpay" {
	export interface RazorpayCheckoutOptions {
		key: string;
		amount: number;
		currency: string;
		order_id?: string;
		name?: string;
		description?: string;
		image?: string;
		prefill?: {
			email?: string;
			contact?: string;
			name?: string;
		};
		theme?: { color?: string };
	}

	export interface RazorpayCheckoutSuccess {
		razorpay_payment_id: string;
		razorpay_order_id?: string;
		razorpay_signature?: string;
	}

	export interface RazorpayCheckoutError {
		code: number | string;
		description: string;
	}

	const RazorpayCheckout: {
		open(options: RazorpayCheckoutOptions): Promise<RazorpayCheckoutSuccess>;
	};

	export default RazorpayCheckout;
}
