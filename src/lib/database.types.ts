export interface Database {
  public: {
    Tables: {
      shops: {
        Row: {
          id: string;
          shop_domain: string;
          access_token: string;
          webhook_secret: string;
          settings_json: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_domain: string;
          access_token: string;
          webhook_secret: string;
          settings_json?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_domain?: string;
          access_token?: string;
          webhook_secret?: string;
          settings_json?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
      };
      brands: {
        Row: {
          id: string;
          name: string;
          logo_url?: string;
          owner_user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          logo_url?: string;
          owner_user_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          logo_url?: string;
          owner_user_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      brand_shops: {
        Row: {
          id: string;
          brand_id: string;
          shop_domain: string;
          access_token: string;
          webhook_secret: string;
          default_location_id: string;
          printer_map: Record<string, string>;
          service_rules_json: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          shop_domain: string;
          access_token: string;
          webhook_secret: string;
          default_location_id: string;
          printer_map?: Record<string, string>;
          service_rules_json?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          shop_domain?: string;
          access_token?: string;
          webhook_secret?: string;
          default_location_id?: string;
          printer_map?: Record<string, string>;
          service_rules_json?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
      };
      brand_users: {
        Row: {
          id: string;
          brand_id: string;
          user_id: string;
          role: 'owner' | 'admin' | 'user';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          user_id: string;
          role?: 'owner' | 'admin' | 'user';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          user_id?: string;
          role?: 'owner' | 'admin' | 'user';
          created_at?: string;
          updated_at?: string;
        };
      };
      orders_cache: {
        Row: {
          id: string;
          shop_domain: string;
          order_id: string;
          status: string;
          payload_json: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_domain: string;
          order_id: string;
          status: string;
          payload_json: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_domain?: string;
          order_id?: string;
          status?: string;
          payload_json?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
      };
      inventory_events: {
        Row: {
          id: string;
          ts: string;
          actor_id: string;
          shop_domain: string;
          variant_id: string;
          location_id: string;
          delta: number;
          reason: string;
          note?: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          ts?: string;
          actor_id: string;
          shop_domain: string;
          variant_id: string;
          location_id: string;
          delta: number;
          reason: string;
          note?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          ts?: string;
          actor_id?: string;
          shop_domain?: string;
          variant_id?: string;
          location_id?: string;
          delta?: number;
          reason?: string;
          note?: string;
          created_at?: string;
        };
      };
      purchase_orders: {
        Row: {
          id: string;
          shop_domain: string;
          po_number: string;
          supplier: string;
          status: 'draft' | 'ordered' | 'received' | 'cancelled';
          expected_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_domain: string;
          po_number: string;
          supplier: string;
          status?: 'draft' | 'ordered' | 'received' | 'cancelled';
          expected_date: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_domain?: string;
          po_number?: string;
          supplier?: string;
          status?: 'draft' | 'ordered' | 'received' | 'cancelled';
          expected_date?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      po_lines: {
        Row: {
          id: string;
          po_id: string;
          variant_id: string;
          quantity: number;
          received_quantity: number;
          unit_cost: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          po_id: string;
          variant_id: string;
          quantity: number;
          received_quantity?: number;
          unit_cost: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          po_id?: string;
          variant_id?: string;
          quantity?: number;
          received_quantity?: number;
          unit_cost?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      bin_locations: {
        Row: {
          id: string;
          shop_domain: string;
          variant_id: string;
          bin_code: string;
          is_primary: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_domain: string;
          variant_id: string;
          bin_code: string;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_domain?: string;
          variant_id?: string;
          bin_code?: string;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      issues: {
        Row: {
          id: string;
          shop_domain: string;
          order_id: string;
          reason: string;
          state: 'open' | 'assigned' | 'resolved' | 'closed';
          assignee_id?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_domain: string;
          order_id: string;
          reason: string;
          state?: 'open' | 'assigned' | 'resolved' | 'closed';
          assignee_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_domain?: string;
          order_id?: string;
          reason?: string;
          state?: 'open' | 'assigned' | 'resolved' | 'closed';
          assignee_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      kpi_daily: {
        Row: {
          id: string;
          shop_domain: string;
          date: string;
          metrics_json: Record<string, any>;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_domain: string;
          date: string;
          metrics_json: Record<string, any>;
          created_at?: string;
        };
        Update: {
          id?: string;
          shop_domain?: string;
          date?: string;
          metrics_json?: Record<string, any>;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// Local SQLite types for offline functionality
export interface LocalDatabase {
  outbox_jobs: {
    id: string;
    type: 'fulfillment' | 'label' | 'inventory_adjust' | 'event';
    payload_json: Record<string, any>;
    idempotency_key: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    attempts: number;
    next_run_at: string;
    correlation_id?: string;
    created_at: string;
    updated_at: string;
  };
  seen_webhooks: {
    webhook_id: string;
    seen_at: string;
  };
  label_cache: {
    order_id: string;
    label_format: 'zpl' | 'pdf';
    bytes_hash: string;
    created_at: string;
  };
}
