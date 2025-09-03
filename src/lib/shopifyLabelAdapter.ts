import { ShopifyClient } from './shopify';
import { LabelRequest, LabelResponse, Address, Package } from './labelService';

export interface ShopifyLabelRequest extends Omit<LabelRequest, 'carrierAccount' | 'serviceLevelToken'> {
  orderId: string;
  shopDomain: string;
  accessToken: string;
  locationId: string;
  shippingMethod?: string;
}

export interface ShopifyLabelResponse extends LabelResponse {
  source: 'shopify';
  fulfillmentId: string;
  trackingNumber: string;
  labelUrl: string;
  carrier: string;
  serviceLevel: string;
}

export interface ShopifyFulfillment {
  id: string;
  status: string;
  trackingInfo: Array<{
    number: string;
    url?: string;
    company?: string;
  }>;
  labelFile?: {
    url: string;
    contentType: string;
  };
  documents?: Array<{
    url: string;
    contentType: string;
  }>;
}

/**
 * Shopify Label Adapter
 * Integrates with Shopify's native label system
 */
export class ShopifyLabelAdapter {
  private client: ShopifyClient;
  private shopDomain: string;
  private accessToken: string;

  constructor(client: ShopifyClient, shopDomain: string, accessToken: string) {
    this.client = client;
    this.shopDomain = shopDomain;
    this.accessToken = accessToken;
  }

  /**
   * Create a shipping label for an order
   */
  async createLabel(request: ShopifyLabelRequest): Promise<ShopifyLabelResponse> {
    try {
      // Check if order already has a fulfillment with a label
      const existingLabel = await this.getExistingLabel(request.orderId);
      if (existingLabel) {
        return existingLabel;
      }

      // Create or update fulfillment to trigger label generation
      const fulfillment = await this.createOrUpdateFulfillment(request);
      
      // Wait for label to be generated (Shopify may take a moment)
      const label = await this.waitForLabel(fulfillment.id, request.orderId);
      
      return label;
    } catch (error) {
      throw new Error(`Shopify label creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get existing label for an order if available
   */
  private async getExistingLabel(orderId: string): Promise<ShopifyLabelResponse | null> {
    try {
      const fulfillments = await this.getOrderFulfillments(orderId);
      
      for (const fulfillment of fulfillments) {
        if (fulfillment.labelFile?.url || 
            fulfillment.documents?.some(doc => doc.url)) {
          return this.fulfillmentToLabelResponse(fulfillment, orderId);
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Create or update fulfillment to trigger label generation
   */
  private async createOrUpdateFulfillment(request: ShopifyLabelRequest): Promise<ShopifyFulfillment> {
    try {
      // Get order details to find line items
      const { orders } = await this.client.getOrders({
        first: 1,
        query: `id:${request.orderId}`,
      });

      if (orders.length === 0) {
        throw new Error('Order not found');
      }

      const order = orders[0];
      
      // Create fulfillment with line items
      const fulfillmentMutation = `
        mutation CreateFulfillment($input: FulfillmentInput!) {
          fulfillmentCreate(input: $input) {
            fulfillment {
              id
              status
              trackingInfo {
                number
                url
                company
              }
              labelFile {
                url
                contentType
              }
              documents {
                url
                contentType
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const lineItems = order.lineItems.map(item => ({
        id: item.id,
        quantity: item.quantity,
      }));

      const variables = {
        input: {
          orderId: request.orderId,
          lineItems,
          trackingInfo: [],
          notifyCustomer: false,
          locationId: request.locationId,
        },
      };

      const result = await this.client.request(fulfillmentMutation, variables);
      
      if (result.fulfillmentCreate.userErrors?.length > 0) {
        throw new Error(result.fulfillmentCreate.userErrors[0].message);
      }

      return result.fulfillmentCreate.fulfillment;
    } catch (error) {
      throw new Error(`Failed to create fulfillment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Wait for Shopify to generate the label
   */
  private async waitForLabel(fulfillmentId: string, orderId: string): Promise<ShopifyLabelResponse> {
    const maxAttempts = 10;
    const delayMs = 2000; // 2 seconds between attempts
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const fulfillments = await this.getOrderFulfillments(orderId);
        const fulfillment = fulfillments.find(f => f.id === fulfillmentId);
        
        if (fulfillment && (fulfillment.labelFile?.url || 
            fulfillment.documents?.some(doc => doc.url))) {
          return this.fulfillmentToLabelResponse(fulfillment, orderId);
        }
        
        // Wait before next attempt
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        // Continue trying
      }
    }
    
    throw new Error('Label generation timeout - Shopify did not generate label within expected time');
  }

  /**
   * Get fulfillments for an order
   */
  private async getOrderFulfillments(orderId: string): Promise<ShopifyFulfillment[]> {
    const query = `
      query GetOrderFulfillments($orderId: ID!) {
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

    const result = await this.client.request(query, { orderId });
    
    if (!result.order?.fulfillments?.edges) {
      return [];
    }

    return result.order.fulfillments.edges.map((edge: any) => edge.node);
  }

  /**
   * Convert fulfillment to label response
   */
  private fulfillmentToLabelResponse(fulfillment: ShopifyFulfillment, orderId: string): ShopifyLabelResponse {
    // Find label URL from either labelFile or documents
    const labelUrl = fulfillment.labelFile?.url || 
                    fulfillment.documents?.find(doc => doc.url)?.url;
    
    if (!labelUrl) {
      throw new Error('No label URL found in fulfillment');
    }

    // Extract tracking number
    const trackingNumber = fulfillment.trackingInfo?.[0]?.number || '';

    return {
      labelId: fulfillment.id,
      trackingNumber,
      labelUrl,
      source: 'shopify',
      fulfillmentId: fulfillment.id,
      carrier: 'Shopify Shipping',
      serviceLevel: 'Standard',
      rate: {
        amount: '0.00', // Shopify labels are typically free
        currency: 'USD',
        serviceLevel: 'Standard',
        days: 3,
      },
      metadata: {
        orderId,
        fulfillmentId: fulfillment.id,
      },
    };
  }

  /**
   * Fetch last label for reprint
   */
  async getLabel(labelId: string): Promise<ShopifyLabelResponse> {
    try {
      // Get fulfillment details
      const query = `
        query GetFulfillment($fulfillmentId: ID!) {
          fulfillment(id: $fulfillmentId) {
            id
            status
            trackingInfo {
              number
              url
              company
            }
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
      `;

      const result = await this.client.request(query, { fulfillmentId: labelId });
      
      if (!result.fulfillment) {
        throw new Error('Fulfillment not found');
      }

      // Extract order ID from fulfillment (this would need to be stored or retrieved)
      const orderId = 'unknown'; // Would need to be stored with the label
      
      return this.fulfillmentToLabelResponse(result.fulfillment, orderId);
    } catch (error) {
      throw new Error(`Failed to fetch Shopify label: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Void a label (may not be supported by Shopify)
   */
  async voidLabel(labelId: string): Promise<boolean> {
    try {
      // Shopify doesn't have a direct "void label" API
      // Instead, we can cancel the fulfillment
      const mutation = `
        mutation CancelFulfillment($id: ID!) {
          fulfillmentCancel(id: $id) {
            fulfillment {
              id
              status
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const result = await this.client.request(mutation, { id: labelId });
      
      if (result.fulfillmentCancel.userErrors?.length > 0) {
        throw new Error(result.fulfillmentCancel.userErrors[0].message);
      }

      return true;
    } catch (error) {
      // Log that voiding is not fully supported
      console.warn('Shopify label voiding not fully supported:', error);
      return false;
    }
  }

  /**
   * Check if labels are available for a shop
   */
  async checkLabelAvailability(): Promise<{ available: boolean; reason?: string }> {
    try {
      // Try to get a recent fulfilled order
      const { orders } = await this.client.getOrders({
        first: 1,
        query: 'fulfillment_status:fulfilled',
      });

      if (orders.length === 0) {
        return { available: false, reason: 'No fulfilled orders found to test label availability' };
      }

      const order = orders[0];
      const fulfillments = await this.getOrderFulfillments(order.id);
      
      // Check if any fulfillment has a label
      const hasLabel = fulfillments.some(f => 
        f.labelFile?.url || f.documents?.some(doc => doc.url)
      );

      return {
        available: hasLabel,
        reason: hasLabel ? 'Labels available' : 'No labels found in fulfillments',
      };
    } catch (error) {
      return {
        available: false,
        reason: `Error checking availability: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
