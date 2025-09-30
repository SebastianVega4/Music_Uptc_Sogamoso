import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, interval, tap, throwError } from 'rxjs';
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

  private connectedSubject = new BehaviorSubject<boolean>(false);
  public connected$ = this.connectedSubject.asObservable();

  private onlineUsersSubject = new BehaviorSubject<number>(0);
  public onlineUsers$ = this.onlineUsersSubject.asObservable();

  // Estado del usuario
  private currentUser: string = 'Usuario';
  private userId: string = this.generateUserId();
  private currentRoom: string = 'general';

  // Polling intervals
  private messagePolling: any;
  private typingPolling: any;
  private statsPolling: any;

  constructor(private http: HttpClient) {
    this.loadUserFromStorage();
    this.startPolling();
    this.loadInitialHistory();
  }

  private loadUserFromStorage(): void {
    const storedUser = localStorage.getItem('chat_user_name');
    if (storedUser) {
      this.currentUser = storedUser;
    }
  }

  private startPolling(): void {
    // Polling para nuevos mensajes
    this.messagePolling = interval(500).subscribe(() => {
      this.checkNewMessages();
    });

    // Polling para usuarios escribiendo
    this.typingPolling = interval(500).subscribe(() => {
      this.checkTypingUsers();
    });

    // Polling para estadísticas cada
    this.statsPolling = interval(15000).subscribe(() => {
      this.loadStats();
    });

    // Polling para usuarios online
    const onlinePolling = interval(10000).subscribe(() => {
      this.checkOnlineUsers();
    });

    this.connectedSubject.next(true);
  }

  private loadInitialHistory(): void {
    this.http.get<{ messages: ChatMessage[] }>(`${this.apiUrl}/api/chat/messages?limit=50`)
      .subscribe({
        next: (response) => {
          this.messagesSubject.next(response.messages.reverse());
        },
        error: (error) => {
          console.error('Error cargando historial:', error);
        }
      });
  }

  private checkNewMessages(): void {
    const currentMessages = this.messagesSubject.value;

    // Usar timestamp del último mensaje para obtener solo los nuevos
    const lastTimestamp = currentMessages.length > 0
      ? currentMessages[currentMessages.length - 1].timestamp
      : null;

    this.http.get<{ messages: ChatMessage[] }>(
      `${this.apiUrl}/api/chat/messages?limit=50${lastTimestamp ? `&since=${lastTimestamp}` : ''}`
    ).subscribe({
      next: (response) => {
        if (response.messages && response.messages.length > 0) {
          const newMessages = response.messages.filter(newMsg =>
            !currentMessages.find(existingMsg => existingMsg.id === newMsg.id)
          );

          if (newMessages.length > 0) {
            // Agregar nuevos mensajes al final
            this.messagesSubject.next([...currentMessages, ...newMessages]);
          }
        }
      },
      error: (error) => {
        console.error('Error checking new messages:', error);
      }
    });
  }

  private checkTypingUsers(): void {
    this.http.get<{ typing_users: string[] }>(
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

  private checkOnlineUsers(): void {
    this.http.get<{ online_users: number }>(`${this.apiUrl}/api/chat/online-users`)
      .subscribe({
        next: (response) => {
          this.onlineUsersSubject.next(response.online_users);
        },
        error: (error) => {
          console.error('Error checking online users:', error);
          // Valor por defecto si hay error
          this.onlineUsersSubject.next(1);
        }
      });
  }

  // === MÉTODOS PÚBLICOS ===
  sendMessage(message: string): Observable<any> {
    if (!message.trim()) {
      return throwError(() => new Error('El mensaje no puede estar vacío'));
    }

    return this.http.post(`${this.apiUrl}/api/chat/send`, {
      message: message.trim(),
      user: this.currentUser,
      user_id: this.userId,
      room: this.currentRoom
    }).pipe(
      tap((response: any) => {
        // Agregar el mensaje inmediatamente al estado local
        if (response.success && response.message) {
          const currentMessages = this.messagesSubject.value;
          this.messagesSubject.next([...currentMessages, response.message]);
        }
      })
    );
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
    localStorage.setItem('chat_user_name', this.currentUser);
  }

  getUser(): string {
    return this.currentUser;
  }

  // MÉTODO CORREGIDO: getStats ahora retorna Observable
  getStats(): Observable<ChatStats> {
    return this.http.get<ChatStats>(`${this.apiUrl}/api/chat/stats`);
  }

  // Método para cargar stats internamente
  loadStats(): void {
    this.getStats().subscribe({
      next: (stats: ChatStats) => {
        this.statsSubject.next(stats);
      },
      error: (error: any) => {
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
    this.connectedSubject.next(false);
  }
}