export type AssistantResultCard = {
  id: string;
  type: 'user' | 'post' | 'reel' | 'catalog';
  title: string;
  subtitle?: string;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
};

export type AssistantMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  cards?: AssistantResultCard[];
  pending?: boolean;
};

export type GenieAction =
  | {
      id: string;
      version: 1;
      type: 'navigate';
      target: { route: string; params?: Record<string, unknown> };
    }
  | {
      id: string;
      version: 1;
      type: 'open_search_results';
      domain: 'services' | 'clips' | 'flash' | 'needs' | 'community' | 'knock' | 'shop';
      filters?: Record<string, unknown>;
    }
  | {
      id: string;
      version: 1;
      type: 'request_location';
      purpose: string;
    }
  | {
      id: string;
      version: 1;
      type: 'confirm_mutation';
      operation: string;
      preview?: Record<string, unknown>;
    };

export type AssistantStreamEvent =
  | { type: 'token'; delta: string }
  | { type: 'tool_start'; toolName: string; message: string }
  | { type: 'tool_result'; toolName: string; result: unknown }
  | { type: 'result_cards'; cards: AssistantResultCard[] }
  | { type: 'navigation'; route: string; params: Record<string, unknown> }
  | { type: 'action'; action: GenieAction }
  | {
      type: 'result';
      actionId: string;
      outcome: 'success' | 'no_results' | 'canceled' | 'failed';
      message?: string;
    }
  | { type: 'quick_actions'; actions: string[] }
  | {
      type: 'done';
      conversationId: string;
      responseId?: string;
      message: string;
      clientRequestId?: string;
    }
  | { type: 'error'; code: string; message: string };

export type AssistantConversation = {
  id: string;
  title: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type AssistantMessageRecord = {
  id: string;
  role: string;
  content: string | null;
  createdAt: string;
};
