import { ShopifyClient } from './shopify';

export interface ShopifyLabelCapability {
  supported: boolean;
  lastCheckedAt: string;
  reason?: string;
  graphqlSupported?: boolean;
  restSupported?: boolean;
  labelUrlFound?: boolean;
}

export interface BrandShopLabelConfig {
  labelProvider: 'shopify' | 'shippo' | 'easypost';
  allowFallback: boolean;
  shopifyLabels: ShopifyLabelCapability;
}

export interface CapabilityProbeResult {
  success: boolean;
  capability: ShopifyLabelCapability;
  error?: string;
}

/**
 * Probes Shopify shop to determine label capability
 */
export class ShopifyLabelCapabilityProbe {
  private client: ShopifyClient;

  constructor(client: ShopifyClient) {
    this.client = client;
  }

  /**
   * Run full capability probe for a shop
   */
  async probeShop(): Promise<CapabilityProbeResult> {
    try {
      const capability: ShopifyLabelCapability = {
        supported: false,
        lastCheckedAt: new Date().toISOString(),
        graphqlSupported: false,
        restSupported: false,
        labelUrlFound: false,
      };

      // Step 1: GraphQL probe
      const graphqlResult = await this.probeGraphQLLabels();
      capability.graphqlSupported = graphqlResult.supported;
      
      if (graphqlResult.supported && graphqlResult.labelUrlFound) {
        capability.supported = true;
        capability.labelUrlFound = true;
        capability.reason = 'GraphQL labels supported';
        return { success: true, capability };
      }

      // Step 2: REST API probe
      const restResult = await this.probeRestLabels();
      capability.restSupported = restResult.supported;
      
      if (restResult.supported && restResult.labelUrlFound) {
        capability.supported = true;
        capability.labelUrlFound = true;
        capability.reason = 'REST API labels supported';
        return { success: true, capability };
      }

      // Step 3: Determine reason for unsupported
      if (!capability.graphqlSupported && !capability.restSupported) {
        capability.reason = 'No label URL from Shopify Shipping - likely not enabled or not available in this region';
      } else if (capability.graphqlSupported || capability.restSupported) {
        capability.reason = 'API supports labels but no label URLs found in recent fulfillments';
      }

      return { success: true, capability };
    } catch (error) {
      return {
        success: false,
        capability: {
          supported: false,
          lastCheckedAt: new Date().toISOString(),
          reason: `Probe failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Probe GraphQL API for label support
   */
  private async probeGraphQLLabels(): Promise<{ supported: boolean; labelUrlFound: boolean }> {
    try {
      // Try to fetch a recent fulfilled order to check for label fields
      const { orders } = await this.client.getOrders({
        first: 5,
        query: 'fulfillment_status:fulfilled',
      });

      if (orders.length === 0) {
        return { supported: false, labelUrlFound: false };
      }

      // Check if any fulfillment has label information
      for (const order of orders) {
        // Look for fulfillment with label URL
        if (order.fulfillmentStatus === 'fulfilled') {
          // Try to get fulfillment details via GraphQL
          const fulfillmentQuery = `
            query GetFulfillment($orderId: ID!) {
              order(id: $orderId) {
                fulfillments(first: 10) {
                  edges {
                    node {
                      id
                      status
                      trackingInfo {
                        number
                        url
                        company
                      }
                      # Check if label fields are available
                      labelFile {
                        url
                        contentType
                      }
                      documents {
                        url
                        contentType
                      }
                    }
                  }
                }
              }
            }
          `;

          try {
            const result = await this.client.request(fulfillmentQuery, { orderId: order.id });
            
            if (result.order?.fulfillments?.edges) {
              for (const edge of result.order.fulfillments.edges) {
                const fulfillment = edge.node;
                
                // Check for label file or document URLs
                if (fulfillment.labelFile?.url || 
                    fulfillment.documents?.some((doc: any) => doc.url)) {
                  return { supported: true, labelUrlFound: true };
                }
              }
            }
          } catch (graphqlError: any) {
            // If GraphQL fails with unknown field errors, labels are not supported
            if (graphqlError.message?.includes('Unknown field') || 
                graphqlError.message?.includes('Cannot query field')) {
              return { supported: false, labelUrlFound: false };
            }
          }
        }
      }

      return { supported: true, labelUrlFound: false };
    } catch (error) {
      return { supported: false, labelUrlFound: false };
    }
  }

  /**
   * Probe REST API for label support
   */
  private async probeRestLabels(): Promise<{ supported: boolean; labelUrlFound: boolean }> {
    try {
      // Get recent fulfilled orders
      const { orders } = await this.client.getOrders({
        first: 5,
        query: 'fulfillment_status:fulfilled',
      });

      if (orders.length === 0) {
        return { supported: false, labelUrlFound: false };
      }

      // Check first order's fulfillments via REST
      const order = orders[0];
      const orderId = this.extractNumericOrderId(order.name);
      
      if (!orderId) {
        return { supported: false, labelUrlFound: false };
      }

      // Try REST API call to get fulfillment details
      const restUrl = `https://${this.client.getShopDomain()}/admin/api/2023-10/orders/${orderId}/fulfillments.json`;
      
      // Note: This would require the client to support REST calls
      // For now, we'll assume REST is not available if GraphQL failed
      return { supported: false, labelUrlFound: false };
    } catch (error) {
      return { supported: false, labelUrlFound: false };
    }
  }

  /**
   * Extract numeric order ID from order name
   */
  private extractNumericOrderId(orderName: string): string | null {
    const match = orderName.match(/^#(\d+)$/);
    return match ? match[1] : null;
  }
}

/**
 * Label adapter selector based on capability probe results
 */
export class LabelAdapterSelector {
  /**
   * Select the appropriate label adapter for a brand
   */
  static selectAdapter(
    brandConfig: BrandShopLabelConfig,
    fallbackAdapters: Array<'shippo' | 'easypost'>
  ): 'shopify' | 'shippo' | 'easypost' | 'exception' {
    
    // If Shopify labels are supported, use them
    if (brandConfig.labelProvider === 'shopify' && brandConfig.shopifyLabels.supported) {
      return 'shopify';
    }
    
    // If fallback is allowed, use the first available fallback adapter
    if (brandConfig.allowFallback && fallbackAdapters.length > 0) {
      return fallbackAdapters[0];
    }
    
    // No suitable adapter available
    return 'exception';
  }

  /**
   * Get fallback reason for logging
   */
  static getFallbackReason(
    brandConfig: BrandShopLabelConfig,
    selectedAdapter: string
  ): string {
    if (selectedAdapter === 'shopify') {
      return 'Shopify labels supported';
    }
    
    if (selectedAdapter === 'exception') {
      return `No label provider available. Shopify: ${brandConfig.shopifyLabels.reason || 'unknown'}, Fallback: ${brandConfig.allowFallback ? 'enabled' : 'disabled'}`;
    }
    
    return `Fallback to ${selectedAdapter} - Shopify labels not supported: ${brandConfig.shopifyLabels.reason || 'unknown'}`;
  }
}

/**
 * Update brand shop label configuration
 */
export async function updateBrandShopLabelConfig(
  brandId: string,
  shopDomain: string,
  config: Partial<BrandShopLabelConfig>
): Promise<void> {
  // This would integrate with your database to update brand_shops.service_rules_json
  // For now, we'll return a promise that resolves
  return Promise.resolve();
}
