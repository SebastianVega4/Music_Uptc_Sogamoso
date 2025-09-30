import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService, ChatMessage, ChatStats } from '../../services/chat.service';
import { Subscription, interval } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

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
  lastMessageCount = 0;
  isNearBottom = true;
  
  private messagesSubscription!: Subscription;
  private typingSubscription!: Subscription;
  private onlineSubscription!: Subscription;
  private connectedSubscription!: Subscription;
  private statsSubscription!: Subscription;
  private typingTimeout: any;
  private messageCheckInterval: any;

  constructor(
    private chatService: ChatService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.setupSubscriptions();
    this.loadInitialMessages();
    this.startMessagePolling();
  }

  private setupSubscriptions(): void {
    // Suscribirse a mensajes - optimizado para tiempo real
    this.messagesSubscription = this.chatService.messages$.subscribe(
      (messages: ChatMessage[]) => {
        const previousCount = this.messages.length;
        this.messages = messages;
        
        // Detectar nuevos mensajes
        if (messages.length > previousCount && !this.isChatOpen) {
          const newMessagesCount = messages.length - previousCount;
          this.unreadMessages += newMessagesCount;
          
          // Efecto visual para nuevo mensaje
          this.pulseNotification();
        }
        
        // Scroll automático inteligente
        setTimeout(() => {
          this.autoScrollToBottom();
        }, 100);
        
        this.cdr.detectChanges();
      }
    );

    // Suscribirse a usuarios escribiendo con debounce
    this.typingSubscription = this.chatService.typingUsers$
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe((users: string[]) => {
        this.typingUsers = users.filter(user => user !== this.currentUser);
        this.cdr.detectChanges();
      });

    // Suscribirse a usuarios online
    this.onlineSubscription = this.chatService.onlineUsers$.subscribe(
      (count: number) => {
        this.onlineUsers = count;
        this.cdr.detectChanges();
      }
    );

    // Suscribirse a estado de conexión
    this.connectedSubscription = this.chatService.connected$.subscribe(
      (connected: boolean) => {
        this.isConnected = connected;
        if (connected) {
          this.loadInitialMessages();
          this.startMessagePolling();
        } else {
          this.stopMessagePolling();
        }
        this.cdr.detectChanges();
      }
    );

    // Suscribirse a estadísticas
    this.statsSubscription = this.chatService.stats$.subscribe(
      (stats: ChatStats | null) => {
        this.stats = stats;
        this.cdr.detectChanges();
      }
    );

    // Cargar usuario actual
    this.currentUser = this.chatService.getUser();
  }

  private startMessagePolling(): void {
    // Polling más frecuente para mensajes nuevos
    this.messageCheckInterval = interval(2000).subscribe(() => {
      if (this.isConnected) {
        this.chatService.checkNewMessages().subscribe();
      }
    });
  }

  private stopMessagePolling(): void {
    if (this.messageCheckInterval) {
      this.messageCheckInterval.unsubscribe();
    }
  }

  private loadInitialMessages(): void {
    this.chatService.loadStats();
  }

  private pulseNotification(): void {
    // Efecto visual para notificación de nuevo mensaje
    const button = document.querySelector('.floating-chat-button');
    if (button) {
      button.classList.add('pulse-effect');
      setTimeout(() => {
        button.classList.remove('pulse-effect');
      }, 1000);
    }
  }

  private autoScrollToBottom(): void {
    if (this.isChatOpen && this.isNearBottom) {
      setTimeout(() => {
        const messagesContainer = document.querySelector('.messages-container');
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }, 50);
    }
  }

  onMessagesScroll(event: Event): void {
    const messagesContainer = event.target as HTMLElement;
    if (messagesContainer) {
      // Verificar si el usuario está cerca del final (últimos 150px)
      const scrollThreshold = 150;
      this.isNearBottom = 
        messagesContainer.scrollHeight - messagesContainer.clientHeight - messagesContainer.scrollTop <= scrollThreshold;
    }
  }

  sendMessage(): void {
    if (this.newMessage.trim() && this.isConnected) {
      this.chatService.sendMessage(this.newMessage).subscribe({
        next: () => {
          this.newMessage = '';
          this.stopTyping();
          // Forzar scroll al fondo después de enviar
          this.isNearBottom = true;
          this.scrollToBottom();
        },
        error: (error: any) => {
          console.error('Error enviando mensaje:', error);
          alert('Error al enviar el mensaje: ' + error.message);
        }
      });
    }
  }

  scrollToBottom(): void {
    setTimeout(() => {
      const messagesContainer = document.querySelector('.messages-container');
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        this.isNearBottom = true;
      }
    }, 100);
  }

  ngOnDestroy(): void {
    this.messagesSubscription.unsubscribe();
    this.typingSubscription.unsubscribe();
    this.onlineSubscription.unsubscribe();
    this.connectedSubscription.unsubscribe();
    this.statsSubscription.unsubscribe();
    this.stopMessagePolling();
    
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
  }

  toggleChat(): void {
    this.isChatOpen = !this.isChatOpen;
    if (this.isChatOpen) {
      this.unreadMessages = 0; // Resetear contador al abrir
      this.scrollToBottom();
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
    return message.id || `${message.timestamp}-${message.user}`;
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

  // Manejar teclas rápidas
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    // Ctrl + Enter para enviar mensaje
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && this.isChatOpen) {
      this.sendMessage();
      event.preventDefault();
    }
    
    // Escape para cerrar chat
    if (event.key === 'Escape' && this.isChatOpen) {
      this.isChatOpen = false;
    }
  }
}