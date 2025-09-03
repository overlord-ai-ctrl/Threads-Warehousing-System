export interface LabelRequest {
  orderId: string;
  fromAddress: Address;
  toAddress: Address;
  packages: Package[];
  carrierAccount: string;
  serviceLevelToken: string;
  labelFileType: 'PDF' | 'PNG' | 'ZPL';
  metadata?: Record<string, any>;
}

export interface Address {
  name: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
  email?: string;
}

export interface Package {
  length: number;
  width: number;
  height: number;
  weight: number;
  distanceUnit: 'cm' | 'in';
  massUnit: 'g' | 'oz' | 'lb' | 'kg';
}

export interface LabelResponse {
  labelId: string;
  trackingNumber: string;
  labelUrl: string;
  labelData?: string; // Base64 encoded label data
  rate: {
    amount: string;
    currency: string;
    serviceLevel: string;
    days: number;
  };
  metadata?: Record<string, any>;
}

export interface RateRequest {
  fromAddress: Address;
  toAddress: Address;
  packages: Package[];
  carrierAccounts: string[];
  serviceLevels?: string[];
}

export interface RateResponse {
  rateId: string;
  amount: string;
  currency: string;
  serviceLevel: string;
  days: number;
  carrierAccount: string;
  carrier: string;
}

export abstract class LabelService {
  abstract getRates(request: RateRequest): Promise<RateResponse[]>;
  abstract createLabel(request: LabelRequest): Promise<LabelResponse>;
  abstract getLabel(labelId: string): Promise<LabelResponse>;
  abstract voidLabel(labelId: string): Promise<boolean>;
}

export class ShippoLabelService extends LabelService {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, isTestMode: boolean = false) {
    this.apiKey = apiKey;
    this.baseUrl = isTestMode 
      ? 'https://api.goshippo.com/shipments/'
      : 'https://api.goshippo.com/shipments/';
  }

  async getRates(request: RateRequest): Promise<RateResponse[]> {
    try {
      const shipmentData = {
        address_from: this.formatAddress(request.fromAddress),
        address_to: this.formatAddress(request.toAddress),
        parcels: request.packages.map(pkg => ({
          length: pkg.length,
          width: pkg.width,
          height: pkg.height,
          distance_unit: pkg.distanceUnit,
          weight: pkg.weight,
          mass_unit: pkg.massUnit,
        })),
        carrier_accounts: request.carrierAccounts,
        service_levels: request.serviceLevels,
      };

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `ShippoToken ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(shipmentData),
      });

      if (!response.ok) {
        throw new Error(`Shippo API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.rates) {
        return data.rates.map((rate: any) => ({
          rateId: rate.object_id,
          amount: rate.amount,
          currency: rate.currency,
          serviceLevel: rate.servicelevel.name,
          days: rate.estimated_days,
          carrierAccount: rate.carrier_account,
          carrier: rate.carrier,
        }));
      }

      return [];
    } catch (error) {
      console.error('Failed to get rates from Shippo:', error);
      throw error;
    }
  }

  async createLabel(request: LabelRequest): Promise<LabelResponse> {
    try {
      const shipmentData = {
        address_from: this.formatAddress(request.fromAddress),
        address_to: this.formatAddress(request.toAddress),
        parcels: request.packages.map(pkg => ({
          length: pkg.length,
          width: pkg.width,
          height: pkg.height,
          distance_unit: pkg.distanceUnit,
          weight: pkg.weight,
          mass_unit: pkg.massUnit,
        })),
        carrier_account: request.carrierAccount,
        servicelevel_token: request.serviceLevelToken,
        label_file_type: request.labelFileType,
        metadata: request.metadata,
      };

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `ShippoToken ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(shipmentData),
      });

      if (!response.ok) {
        throw new Error(`Shippo API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.label_file) {
        return {
          labelId: data.object_id,
          trackingNumber: data.tracking_number,
          labelUrl: data.label_file,
          labelData: data.label_file_data,
          rate: {
            amount: data.rate.amount,
            currency: data.rate.currency,
            serviceLevel: data.rate.servicelevel.name,
            days: data.rate.estimated_days,
          },
          metadata: data.metadata,
        };
      }

      throw new Error('No label file generated');
    } catch (error) {
      console.error('Failed to create label with Shippo:', error);
      throw error;
    }
  }

  async getLabel(labelId: string): Promise<LabelResponse> {
    try {
      const response = await fetch(`${this.baseUrl}${labelId}/`, {
        headers: {
          'Authorization': `ShippoToken ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Shippo API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        labelId: data.object_id,
        trackingNumber: data.tracking_number,
        labelUrl: data.label_file,
        labelData: data.label_file_data,
        rate: {
          amount: data.rate.amount,
          currency: data.rate.currency,
          serviceLevel: data.rate.servicelevel.name,
          days: data.rate.estimated_days,
        },
        metadata: data.metadata,
      };
    } catch (error) {
      console.error('Failed to get label from Shippo:', error);
      throw error;
    }
  }

  async voidLabel(labelId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}${labelId}/refund/`, {
        method: 'POST',
        headers: {
          'Authorization': `ShippoToken ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to void label with Shippo:', error);
      return false;
    }
  }

  private formatAddress(address: Address): any {
    return {
      name: address.name,
      company: address.company,
      street1: address.street1,
      street2: address.street2,
      city: address.city,
      state: address.state,
      zip: address.zip,
      country: address.country,
      phone: address.phone,
      email: address.email,
    };
  }
}

// Mock label service for development and testing
export class MockLabelService extends LabelService {
  async getRates(request: RateRequest): Promise<RateResponse[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return [
      {
        rateId: 'mock_rate_1',
        amount: '12.99',
        currency: 'USD',
        serviceLevel: 'Ground',
        days: 3,
        carrierAccount: 'mock_carrier_1',
        carrier: 'Mock Carrier',
      },
      {
        rateId: 'mock_rate_2',
        amount: '24.99',
        currency: 'USD',
        serviceLevel: 'Express',
        days: 1,
        carrierAccount: 'mock_carrier_1',
        carrier: 'Mock Carrier',
      },
    ];
  }

  async createLabel(request: LabelRequest): Promise<LabelResponse> {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    return {
      labelId: `mock_label_${Date.now()}`,
      trackingNumber: `MOCK${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      labelUrl: 'data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsO...',
      labelData: 'JVBERi0xLjQKJcOkw7zDtsO...',
      rate: {
        amount: '12.99',
        currency: 'USD',
        serviceLevel: 'Ground',
        days: 3,
      },
      metadata: request.metadata,
    };
  }

  async getLabel(labelId: string): Promise<LabelResponse> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      labelId,
      trackingNumber: `MOCK${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      labelUrl: 'data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsO...',
      labelData: 'JVBERi0xLjQKJcOkw7zDtsO...',
      rate: {
        amount: '12.99',
        currency: 'USD',
        serviceLevel: 'Ground',
        days: 3,
      },
    };
  }

  async voidLabel(labelId: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 100));
    return true;
  }
}
