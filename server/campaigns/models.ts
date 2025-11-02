export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed' | 'cancelled';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Campaign {
  id: string;
  name: string;
  whatsappNumberId: string;
  templateName: string;
  language?: string; // Template language code (e.g., 'es', 'en_US'), defaults to 'es'
  recipients: string[]; // phone numbers
  variables?: Record<string, string[]>; // {{1}}: ["valor1", "valor2"]
  scheduledAt?: number; // timestamp
  status: CampaignStatus;
  createdAt: number;
  createdBy: string; // user ID
  startedAt?: number;
  completedAt?: number;
  throttleRate: number; // messages per minute (default: 20)
}

export interface CampaignMessageDetail {
  phone: string;
  status: MessageStatus;
  failReason?: string;
  sentAt?: number;
  deliveredAt?: number;
  readAt?: number;
  responded?: boolean;
  clickedButton?: string;
}

export interface CampaignMetrics {
  campaignId: string;
  campaignName: string;
  totalRecipients: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  responded: number;
  clicked: number;
  details: CampaignMessageDetail[];
}
