/**
 * API Plugin
 * Automatically adds Accept-Language header to all API requests
 * based on current i18n locale
 */
export default defineNuxtPlugin(() => {
  const nuxtApp = useNuxtApp();

  // Create a custom $fetch instance with Accept-Language header
  const apiFetch = $fetch.create({
    onRequest({ options }) {
      // Get current locale from i18n (defaults to 'fr' if not available)
      const locale = nuxtApp.$i18n?.locale?.value || 'fr';

      const headers = options.headers || {};

      // Handle different header formats
      if (headers instanceof Headers) {
        headers.set('Accept-Language', locale);
      } else if (Array.isArray(headers)) {
        // Remove existing Accept-Language header if present
        const filtered = headers.filter(
          ([key]) => key.toLowerCase() !== 'accept-language'
        );
        filtered.push(['Accept-Language', locale]);
        options.headers = filtered;
      } else {
        // Plain object format (most common)
        options.headers = {
          ...headers,
          'Accept-Language': locale,
        };
      }
    },
  });

  // Replace global $fetch with our custom instance
  globalThis.$fetch = apiFetch as typeof $fetch;
});
