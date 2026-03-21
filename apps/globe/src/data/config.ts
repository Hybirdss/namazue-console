const R2_PUBLIC_HOST = "pub-bf7ee9c3b9f7430496681e94cbfa42cd.r2.dev";

export const R2_FEED_BASE = import.meta.env.PROD
	? `https://${R2_PUBLIC_HOST}`
	: "";

export const API_BASE = (() => {
	if (import.meta.env.VITE_API_URL)
		return import.meta.env.VITE_API_URL as string;
	if (import.meta.env.PROD) return "https://api.namazue.dev";
	return "";
})();
