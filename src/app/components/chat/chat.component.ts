import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService, ChatMessage, ChatStats } from '../../services/chat.service';
import { Subscription, debounceTime } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
  imports: [CommonModule, FormsModule]
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  @ViewChild('messageInput') private messageInput!: ElementRef;
  
  messages: ChatMessage[] = [];
  newMessage = '';
  currentUser = 'Usuario';
  typingUsers: string[] = [];
  onlineUsers = 0;
  isConnected = false;
  showUserModal = false;
  stats: ChatStats | null = null;
  
  private messagesSubscription!: Subscription;
  private typingSubscription!: Subscription;
  private onlineSubscription!: Subscription;
  private connectedSubscription!: Subscription;
  private typingTimeout: any;

  constructor(private chatService: ChatService) {}

  ngOnInit(): void {
    // Suscribirse a mensajes
    this.messagesSubscription = this.chatService.messages$.subscribe(messages => {
      this.messages = messages;
      this.scrollToBottom();
    });

    // Suscribirse a usuarios escribiendo
    this.typingSubscription = this.chatService.typingUsers$.subscribe(users => {
      this.typingUsers = users;
    });

    // Suscribirse a usuarios online
    this.onlineSubscription = this.chatService.onlineUsers$.subscribe(count => {
      this.onlineUsers = count;
    });

    // Suscribirse a estado de conexión
    this.connectedSubscription = this.chatService.connected$.subscribe(connected => {
      this.isConnected = connected;
    });

    // Cargar estadísticas
    this.loadStats();
  }

  ngAfterViewInit(): void {
    // Focus en el input al cargar
    setTimeout(() => {
      if (this.messageInput) {
        this.messageInput.nativeElement.focus();
      }
    }, 500);
  }

  ngOnDestroy(): void {
    this.messagesSubscription.unsubscribe();
    this.typingSubscription.unsubscribe();
    this.onlineSubscription.unsubscribe();
    this.connectedSubscription.unsubscribe();
    
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
  }

  sendMessage(): void {
    if (this.newMessage.trim() && this.isConnected) {
      this.chatService.sendMessage(this.newMessage);
      this.newMessage = '';
      this.stopTyping();
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

  loadStats(): void {
    this.chatService.getStats().subscribe({
      next: (stats) => {
        this.stats = stats;
      },
      error: (error) => {
        console.error('Error cargando estadísticas:', error);
      }
    });
  }

  scrollToBottom(): void {
    setTimeout(() => {
      if (this.messagesContainer) {
        const element = this.messagesContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
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
}