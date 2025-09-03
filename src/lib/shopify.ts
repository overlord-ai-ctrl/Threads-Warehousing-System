import { GraphQLClient } from 'graphql-request';

export interface ShopifyConfig {
  shopDomain: string;
  accessToken: string;
  apiVersion: string;
}

export interface ShopifyOrder {
  id: string;
  name: string;
  email: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
  fulfillmentStatus: string;
  financialStatus: string;
  tags: string[];
  lineItems: ShopifyLineItem[];
  shippingAddress?: ShopifyAddress;
  billingAddress?: ShopifyAddress;
  totalPriceSet: ShopifyMoney;
  subtotalPriceSet: ShopifyMoney;
  totalShippingPriceSet: ShopifyMoney;
  totalTaxSet: ShopifyMoney;
}

export interface ShopifyLineItem {
  id: string;
  title: string;
  quantity: number;
  variant: ShopifyVariant;
  fulfillmentStatus: string;
  customAttributes: ShopifyAttribute[];
}

export interface ShopifyVariant {
  id: string;
  title: string;
  sku: string;
  barcode?: string;
  inventoryQuantity: number;
  inventoryItem: {
    id: string;
    tracked: boolean;
  };
  product: {
    id: string;
    title: string;
    handle: string;
    images: ShopifyImage[];
  };
}

export interface ShopifyAddress {
  address1: string;
  address2?: string;
  city: string;
  province: string;
  country: string;
  zip: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface ShopifyMoney {
  shopMoney: {
    amount: string;
    currencyCode: string;
  };
}

export interface ShopifyImage {
  id: string;
  url: string;
  altText?: string;
}

export interface ShopifyAttribute {
  key: string;
  value: string;
}

export interface ShopifyLocation {
  id: string;
  name: string;
  address: ShopifyAddress;
}

export class ShopifyClient {
  private client: GraphQLClient;
  private config: ShopifyConfig;

  constructor(config: ShopifyConfig) {
    this.config = config;
    this.client = new GraphQLClient(
      `https://${config.shopDomain}/admin/api/${config.apiVersion}/graphql.json`,
      {
        headers: {
          'X-Shopify-Access-Token': config.accessToken,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // Fetch orders with filtering and pagination
  async getOrders(options: {
    first?: number;
    after?: string;
    query?: string;
    status?: string;
    fulfillmentStatus?: string;
  }): Promise<{ orders: ShopifyOrder[]; pageInfo: any }> {
    const query = `
      query GetOrders($first: Int!, $after: String, $query: String) {
        orders(first: $first, after: $after, query: $query) {
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
          edges {
            node {
              id
              name
              email
              phone
              createdAt
              updatedAt
              fulfillmentStatus
              financialStatus
              tags
              lineItems(first: 250) {
                edges {
                  node {
                    id
                    title
                    quantity
                    fulfillmentStatus
                    customAttributes {
                      key
                      value
                    }
                    variant {
                      id
                      title
                      sku
                      barcode
                      inventoryQuantity
                      inventoryItem {
                        id
                        tracked
                      }
                      product {
                        id
                        title
                        handle
                        images(first: 1) {
                          edges {
                            node {
                              id
                              url
                              altText
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
              shippingAddress {
                address1
                address2
                city
                province
                country
                zip
                firstName
                lastName
                phone
              }
              billingAddress {
                address1
                address2
                city
                province
                country
                zip
                firstName
                lastName
                phone
              }
              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              subtotalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              totalShippingPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              totalTaxSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    `;

    const variables = {
      first: options.first || 50,
      after: options.after,
      query: options.query,
    };

    try {
      const data = await this.client.request(query, variables);
      return {
        orders: data.orders.edges.map((edge: any) => edge.node),
        pageInfo: data.orders.pageInfo,
      };
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      throw error;
    }
  }

  // Fulfill an order
  async fulfillOrder(input: {
    orderId: string;
    lineItems: Array<{
      id: string;
      quantity: number;
    }>;
    trackingInfo?: Array<{
      number: string;
      url?: string;
      company?: string;
    }>;
    notifyCustomer?: boolean;
  }): Promise<any> {
    const mutation = `
      mutation FulfillOrder($input: FulfillmentInput!) {
        fulfillmentCreate(input: $input) {
          fulfillment {
            id
            status
            trackingInfo {
              number
              url
              company
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        orderId: input.orderId,
        lineItems: input.lineItems,
        trackingInfo: input.trackingInfo,
        notifyCustomer: input.notifyCustomer,
      },
    };

    try {
      const data = await this.client.request(mutation, variables);
      if (data.fulfillmentCreate.userErrors.length > 0) {
        throw new Error(data.fulfillmentCreate.userErrors[0].message);
      }
      return data.fulfillmentCreate.fulfillment;
    } catch (error) {
      console.error('Failed to fulfill order:', error);
      throw error;
    }
  }

  // Update inventory quantities
  async updateInventoryQuantities(input: Array<{
    inventoryItemId: string;
    locationId: string;
    delta: number;
  }>): Promise<any> {
    const mutation = `
      mutation UpdateInventoryQuantities($input: [InventoryAdjustQuantityInput!]!) {
        inventoryAdjustQuantities(input: $input) {
          inventoryLevels {
            id
            available
            incoming
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: input.map((item) => ({
        inventoryItemId: item.inventoryItemId,
        locationId: item.locationId,
        delta: item.delta,
      })),
    };

    try {
      const data = await this.client.request(mutation, variables);
      if (data.inventoryAdjustQuantities.userErrors.length > 0) {
        throw new Error(data.inventoryAdjustQuantities.userErrors[0].message);
      }
      return data.inventoryAdjustQuantities.inventoryLevels;
    } catch (error) {
      console.error('Failed to update inventory:', error);
      throw error;
    }
  }

  // Get locations
  async getLocations(): Promise<ShopifyLocation[]> {
    const query = `
      query GetLocations {
        locations(first: 250) {
          edges {
            node {
              id
              name
              address {
                address1
                address2
                city
                province
                country
                zip
              }
            }
          }
        }
      }
    `;

    try {
      const data = await this.client.request(query);
      return data.locations.edges.map((edge: any) => edge.node);
    } catch (error) {
      console.error('Failed to fetch locations:', error);
      throw error;
    }
  }

  // Search products by barcode
  async searchProductsByBarcode(barcode: string): Promise<ShopifyVariant[]> {
    const query = `
      query SearchProducts($query: String!) {
        productVariants(first: 10, query: $query) {
          edges {
            node {
              id
              title
              sku
              barcode
              inventoryQuantity
              inventoryItem {
                id
                tracked
              }
              product {
                id
                title
                handle
                images(first: 1) {
                  edges {
                    node {
                      id
                      url
                      altText
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const data = await this.client.request(query, { query: `barcode:${barcode}` });
      return data.productVariants.edges.map((edge: any) => edge.node);
    } catch (error) {
      console.error('Failed to search products:', error);
      throw error;
    }
  }
}
