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

  constructor(private chatService: ChatService) {}

  ngOnInit(): void {
    // Suscribirse a mensajes
    this.messagesSubscription = this.chatService.messages$.subscribe(
      (messages: ChatMessage[]) => {
        this.messages = messages;
        
        // Contar mensajes no leídos cuando el chat está cerrado
        if (!this.isChatOpen && messages.length > 0) {
          this.unreadMessages = messages.length;
        }
        
        this.scrollToBottom();
      }
    );

    // Suscribirse a usuarios escribiendo
    this.typingSubscription = this.chatService.typingUsers$.subscribe(
      (users: string[]) => {
        this.typingUsers = users;
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

    // Cargar estadísticas
    this.chatService.loadStats();
  }

  ngOnDestroy(): void {
    this.messagesSubscription.unsubscribe();
    this.typingSubscription.unsubscribe();
    this.onlineSubscription.unsubscribe();
    this.connectedSubscription.unsubscribe();
    this.statsSubscription.unsubscribe();
    
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
  }

  toggleChat(): void {
    this.isChatOpen = !this.isChatOpen;
    if (this.isChatOpen) {
      this.unreadMessages = 0; // Resetear contador al abrir
    }
  }

  sendMessage(): void {
    if (this.newMessage.trim() && this.isConnected) {
      this.chatService.sendMessage(this.newMessage).subscribe({
        next: () => {
          this.newMessage = '';
          this.stopTyping();
        },
        error: (error: any) => {
          console.error('Error enviando mensaje:', error);
        }
      });
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

  scrollToBottom(): void {
    setTimeout(() => {
      const messagesContainer = document.querySelector('.messages-container');
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }, 100);
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