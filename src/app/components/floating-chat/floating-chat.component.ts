import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService, ChatMessage, ChatStats } from '../../services/chat.service';
import { Subscription } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-floating-chat',
  templateUrl: './floating-chat.component.html',
  styleUrls: ['./floating-chat.component.scss'],
  imports: [CommonModule, FormsModule]
})
export class FloatingChatComponent implements OnInit, OnDestroy {
  isChatOpen = false;
  messages: ChatMessage[] = [];
  newMessage = '';
  currentUser = 'Usuario';
  typingUsers: string[] = [];
  onlineUsers = 0;
  isConnected = false;
  showUserModal = false;
  stats: ChatStats | null = null;
  unreadMessages = 0;
  
  private messagesSubscription!: Subscription;
  private typingSubscription!: Subscription;
  private onlineSubscription!: Subscription;
  private connectedSubscription!: Subscription;
  private statsSubscription!: Subscription;
  private typingTimeout: any;

  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval: any;
  
  constructor(private chatService: ChatService) {}

  ngOnInit(): void {
    this.setupSubscriptions();
    this.loadInitialMessages();
    this.startReconnectionHandler();
  }

  private setupSubscriptions(): void {
    this.messagesSubscription = this.chatService.messages$.subscribe(
      (messages: ChatMessage[]) => {
        const previousCount = this.messages.length;
        this.messages = messages;
        
        // Detectar nuevos mensajes
        if (messages.length > previousCount && !this.isChatOpen) {
          const newMessagesCount = messages.length - previousCount;
          this.unreadMessages += newMessagesCount;
          
          // Opcional: Mostrar notificación
          if (newMessagesCount > 0) {
            this.showNewMessageNotification(newMessagesCount);
          }
        }
        
        // Scroll automático mejorado
        this.autoScrollToBottom();
      }
    );

    // Suscribirse a usuarios escribiendo
    this.typingSubscription = this.chatService.typingUsers$.subscribe(
      (users: string[]) => {
        this.typingUsers = users.filter(user => user !== this.currentUser);
      }
    );

    // Suscribirse a usuarios online
    this.onlineSubscription = this.chatService.onlineUsers$.subscribe(
      (count: number) => {
        this.onlineUsers = count;
      }
    );

    // Suscribirse a estado de conexión
    this.connectedSubscription = this.chatService.connected$.subscribe(
      (connected: boolean) => {
        this.isConnected = connected;
        if (connected) {
          this.loadInitialMessages();
        }
      }
    );

    // Suscribirse a estadísticas
    this.statsSubscription = this.chatService.stats$.subscribe(
      (stats: ChatStats | null) => {
        this.stats = stats;
      }
    );

    // Cargar usuario actual
    this.currentUser = this.chatService.getUser();
  }

  // MÉTODO AÑADIDO: Calcular mensajes no leídos
  private calculateUnreadMessages(messages: ChatMessage[]): number {
    // Solo contar mensajes que no sean del usuario actual y sean de tipo mensaje
    return messages.filter(msg => 
      msg.user !== this.currentUser && 
      msg.type === 'message'
    ).length;
  }

  private startReconnectionHandler(): void {
    // Intentar reconexión automática cada 10 segundos si está desconectado
    this.reconnectInterval = setInterval(() => {
      if (!this.isConnected && this.reconnectAttempts < this.maxReconnectAttempts) {
        console.log('🔄 Intentando reconexión...');
        this.reconnectAttempts++;
        this.loadInitialMessages();
      }
    }, 10000);
  }

  private loadInitialMessages(): void {
    // Este método ya está implementado en el servicio
    // Solo necesitamos asegurarnos de que las suscripciones estén activas
    this.chatService.loadStats();
  }

  private autoScrollToBottom(): void {
    if (this.isChatOpen) {
      setTimeout(() => {
        const messagesContainer = document.querySelector('.messages-container');
        if (messagesContainer) {
          const isNearBottom = 
            messagesContainer.scrollHeight - messagesContainer.clientHeight - messagesContainer.scrollTop <= 150;
          
          if (isNearBottom) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }
        }
      }, 100);
    }
  }

  sendMessage(): void {
    if (this.newMessage.trim() && this.isConnected) {
      const messageText = this.newMessage.trim();
      this.newMessage = ''; // Limpiar inmediatamente para mejor UX
      
      this.chatService.sendMessage(messageText).subscribe({
        next: () => {
          console.log('✅ Mensaje enviado exitosamente');
          this.stopTyping();
        },
        error: (error: any) => {
          console.error('❌ Error enviando mensaje:', error);
          // Revertir el mensaje si falla
          this.newMessage = messageText;
          
          // Intentar reconexión
          if (error.status === 0 || error.status >= 500) {
            this.isConnected = false;
            this.reconnectAttempts = 0;
          }
        }
      });
    }
  }

  scrollToBottom(): void {
    setTimeout(() => {
      const messagesContainer = document.querySelector('.messages-container');
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }, 50);
  }

  private showNewMessageNotification(count: number): void {
    // Solo notificar si la ventana no está enfocada
    if (!document.hasFocus()) {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`Nuevo${count > 1 ? 's' : ''} mensaje${count > 1 ? 's' : ''}`, {
          body: `Tienes ${count} mensaje${count > 1 ? 's' : ''} nuevo${count > 1 ? 's' : ''} en el chat`,
          icon: '/assets/icons/chat-icon.png'
        });
      }
    }
  }

  ngOnDestroy(): void {
    this.messagesSubscription.unsubscribe();
    this.typingSubscription.unsubscribe();
    this.onlineSubscription.unsubscribe();
    this.connectedSubscription.unsubscribe();
    this.statsSubscription.unsubscribe();

    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }
  }

  toggleChat(): void {
    this.isChatOpen = !this.isChatOpen;
    if (this.isChatOpen) {
      this.unreadMessages = 0;
      this.reconnectAttempts = 0; // Resetear intentos de reconexión
      this.scrollToBottom();
      
      // Forzar actualización de mensajes al abrir
      this.chatService.loadInitialMessages();
    }
  }

  onInputChange(): void {
    if (this.newMessage.trim() && this.isConnected) {
      this.chatService.setTyping(true);
      
      // Limpiar timeout anterior
      if (this.typingTimeout) {
        clearTimeout(this.typingTimeout);
      }
      
      // Detener indicador después de 2 segundos
      this.typingTimeout = setTimeout(() => {
        this.stopTyping();
      }, 2000);
    } else {
      this.stopTyping();
    }
  }

  stopTyping(): void {
    this.chatService.setTyping(false);
  }

  updateUser(): void {
    if (this.currentUser.trim()) {
      this.chatService.setUser(this.currentUser.trim());
      this.showUserModal = false;
    }
  }

  formatTime(timestamp: string): string {
    return new Date(timestamp).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDate(timestamp: string): string {
    return new Date(timestamp).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit'
    });
  }

  trackByMessage(index: number, message: ChatMessage): string {
    return message.id;
  }

  // Cerrar chat al hacer clic fuera
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const chatContainer = document.querySelector('.floating-chat-container');
    
    if (this.isChatOpen && chatContainer && !chatContainer.contains(target)) {
      // No cerrar si se hace clic en el botón flotante
      const floatingButton = document.querySelector('.floating-chat-button');
      if (!floatingButton?.contains(target)) {
        this.isChatOpen = false;
      }
    }
  }
}