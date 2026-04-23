import { EventEmitter } from 'node:events';

export type DomainEvent =
  | {
      type: 'message.created';
      tenantId: string;
      conversationId: string;
      messageId: string;
      role: string;
      content: string;
      createdAt: string;
    }
  | {
      type: 'conversation.handoff_requested';
      tenantId: string;
      conversationId: string;
      summary: string;
    }
  | {
      type: 'conversation.assigned';
      tenantId: string;
      conversationId: string;
      userId: string;
    }
  | {
      type: 'conversation.closed';
      tenantId: string;
      conversationId: string;
    }
  | {
      type: 'conversation.ai_paused';
      tenantId: string;
      conversationId: string;
      pausedUntil: string;
    }
  | {
      type: 'instance.state_changed';
      tenantId: string;
      state: 'connected' | 'connecting' | 'disconnected' | 'pairing' | 'unknown';
      phone?: string;
      profileName?: string;
    };

class DomainEventBus extends EventEmitter {
  emitDomain(event: DomainEvent): void {
    this.emit('domain', event);
  }

  onDomain(listener: (event: DomainEvent) => void): () => void {
    this.on('domain', listener);
    return () => {
      this.off('domain', listener);
    };
  }
}

export const eventBus = new DomainEventBus();
eventBus.setMaxListeners(1000);
