import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, interval } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ChatMessage {
  id: string;
  user: string;
  user_id: string;
  message: string;
  timestamp: string;
  room: string;
  type: 'message' | 'system';
}

export interface ChatStats {
  total_messages: number;
  messages_today: number;
  online_users: number;
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = environment.apiUrl;
  
  // Subjects para estado reactivo
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  public messages$ = this.messagesSubject.asObservable();
  
  private typingUsersSubject = new BehaviorSubject<string[]>([]);
  public typingUsers$ = this.typingUsersSubject.asObservable();
  
  private statsSubject = new BehaviorSubject<ChatStats | null>(null);
  public stats$ = this.statsSubject.asObservable();

  // Estado del usuario
  private currentUser: string = 'Usuario';
  private userId: string = this.generateUserId();
  private currentRoom: string = 'general';
  
  // Polling intervals
  private messagePolling: any;
  private typingPolling: any;
  private statsPolling: any;

  constructor(private http: HttpClient) {
    this.startPolling();
    this.loadInitialHistory();
  }

  private startPolling(): void {
    // Polling para nuevos mensajes cada 2 segundos
    this.messagePolling = interval(2000).subscribe(() => {
      this.checkNewMessages();
    });

    // Polling para usuarios escribiendo cada 1 segundo
    this.typingPolling = interval(1000).subscribe(() => {
      this.checkTypingUsers();
    });

    // Polling para estadísticas cada 30 segundos
    this.statsPolling = interval(30000).subscribe(() => {
      this.loadStats();
    });
  }

  private loadInitialHistory(): void {
    this.http.get<{messages: ChatMessage[]}>(`${this.apiUrl}/api/chat/messages?limit=50`)
      .subscribe({
        next: (response) => {
          this.messagesSubject.next(response.messages);
        },
        error: (error) => {
          console.error('Error cargando historial:', error);
        }
      });
  }

  private checkNewMessages(): void {
    const currentMessages = this.messagesSubject.value;
    const lastMessage = currentMessages[currentMessages.length - 1];
    const lastTimestamp = lastMessage?.timestamp;

    this.http.get<{messages: ChatMessage[]}>(
      `${this.apiUrl}/api/chat/messages?limit=20${lastTimestamp ? `&since=${lastTimestamp}` : ''}`
    ).subscribe({
      next: (response) => {
        const newMessages = response.messages.filter(newMsg => 
          !currentMessages.find(existingMsg => existingMsg.id === newMsg.id)
        );

        if (newMessages.length > 0) {
          this.messagesSubject.next([...currentMessages, ...newMessages]);
        }
      },
      error: (error) => {
        console.error('Error checking new messages:', error);
      }
    });
  }

  private checkTypingUsers(): void {
    this.http.get<{typing_users: string[]}>(
      `${this.apiUrl}/api/chat/typing-users?room=${this.currentRoom}`
    ).subscribe({
      next: (response) => {
        this.typingUsersSubject.next(response.typing_users);
      },
      error: (error) => {
        console.error('Error checking typing users:', error);
      }
    });
  }

  // === MÉTODOS PÚBLICOS ===

  sendMessage(message: string): Observable<any> {
    if (!message.trim()) {
      throw new Error('El mensaje no puede estar vacío');
    }

    return this.http.post(`${this.apiUrl}/api/chat/send`, {
      message: message.trim(),
      user: this.currentUser,
      user_id: this.userId,
      room: this.currentRoom
    });
  }

  setTyping(isTyping: boolean): void {
    this.http.post(`${this.apiUrl}/api/chat/typing`, {
      user: this.currentUser,
      room: this.currentRoom,
      is_typing: isTyping
    }).subscribe({
      error: (error) => {
        console.error('Error setting typing status:', error);
      }
    });
  }

  setUser(name: string): void {
    this.currentUser = name || 'Usuario';
  }

  loadStats(): void {
    this.http.get<ChatStats>(`${this.apiUrl}/api/chat/stats`)
      .subscribe({
        next: (stats) => {
          this.statsSubject.next(stats);
        },
        error: (error) => {
          console.error('Error cargando estadísticas:', error);
        }
      });
  }

  // === HELPERS PRIVADOS ===

  private generateUserId(): string {
    const storedId = localStorage.getItem('chat_user_id');
    if (storedId) return storedId;
    
    const newId = Math.random().toString(36).substr(2, 9);
    localStorage.setItem('chat_user_id', newId);
    return newId;
  }

  // === LIMPIAR ===

  destroy(): void {
    if (this.messagePolling) {
      this.messagePolling.unsubscribe();
    }
    if (this.typingPolling) {
      this.typingPolling.unsubscribe();
    }
    if (this.statsPolling) {
      this.statsPolling.unsubscribe();
    }
  }
}