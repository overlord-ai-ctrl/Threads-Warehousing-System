/**
 * Shopify Admin deep link helpers
 * Provides URLs to open specific pages in Shopify Admin
 */

export interface ShopifyDeepLinks {
  adminOrderUrl: string;
  adminOrderSearchByNameUrl: string;
  adminFulfillmentsSearchUrl: string;
  adminShippingSettingsUrl: string;
}

/**
 * Generate deep links for a Shopify shop
 */
export function generateShopifyDeepLinks(shopDomain: string): ShopifyDeepLinks {
  const baseUrl = `https://${shopDomain}/admin`;
  
  return {
    adminOrderUrl: (orderId: string) => `${baseUrl}/orders/${orderId}`,
    adminOrderSearchByNameUrl: (orderName: string) => `${baseUrl}/orders?query=name:${encodeURIComponent(orderName)}`,
    adminFulfillmentsSearchUrl: (orderName: string) => `${baseUrl}/orders?query=name:${encodeURIComponent(orderName)}`,
    adminShippingSettingsUrl: () => `${baseUrl}/settings/shipping`,
  };
}

/**
 * Extract numeric order ID from Shopify order name
 * Shopify order names include leading "#" (e.g., "#10234")
 */
export function extractOrderId(orderName: string): string | null {
  const match = orderName.match(/^#(\d+)$/);
  return match ? match[1] : null;
}

/**
 * Get the best URL to open an order in Shopify Admin
 * Prefers direct order URL if numeric ID is available, falls back to search
 */
export function getOrderAdminUrl(shopDomain: string, orderName: string): string {
  const links = generateShopifyDeepLinks(shopDomain);
  const orderId = extractOrderId(orderName);
  
  if (orderId) {
    return links.adminOrderUrl(orderId);
  }
  
  return links.adminOrderSearchByNameUrl(orderName);
}

/**
 * Get fulfillment search URL for an order
 */
export function getFulfillmentSearchUrl(shopDomain: string, orderName: string): string {
  const links = generateShopifyDeepLinks(shopDomain);
  return links.adminFulfillmentsSearchUrl(orderName);
}

/**
 * Get shipping settings URL
 */
export function getShippingSettingsUrl(shopDomain: string): string {
  const links = generateShopifyDeepLinks(shopDomain);
  return links.adminShippingSettingsUrl();
}

/**
 * Validate Shopify domain format
 */
export function isValidShopifyDomain(domain: string): boolean {
  // Shopify domains end with .myshopify.com or are custom domains
  return domain.includes('.myshopify.com') || 
         domain.includes('.shopify.com') || 
         /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/.test(domain);
}

/**
 * Clean and normalize shop domain
 */
export function normalizeShopDomain(domain: string): string {
  let cleanDomain = domain.trim().toLowerCase();
  
  // Remove protocol if present
  if (cleanDomain.startsWith('http://')) {
    cleanDomain = cleanDomain.substring(7);
  } else if (cleanDomain.startsWith('https://')) {
    cleanDomain = cleanDomain.substring(8);
  }
  
  // Remove trailing slash
  if (cleanDomain.endsWith('/')) {
    cleanDomain = cleanDomain.slice(0, -1);
  }
  
  return cleanDomain;
}
