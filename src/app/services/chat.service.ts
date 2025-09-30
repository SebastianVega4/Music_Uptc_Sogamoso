import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, interval, of } from 'rxjs';
import { map, tap, catchError, switchMap, startWith, distinctUntilChanged } from 'rxjs/operators';
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

  private connectedSubject = new BehaviorSubject<boolean>(true);
  public connected$ = this.connectedSubject.asObservable();

  private onlineUsersSubject = new BehaviorSubject<number>(1);
  public onlineUsers$ = this.onlineUsersSubject.asObservable();

  // Estado del usuario
  private currentUser: string = 'Usuario';
  private userId: string = this.generateUserId();
  private currentRoom: string = 'general';

  // Cache local
  private lastMessageId: string = '';
  private isTyping: boolean = false;

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
    // Polling para nuevos mensajes cada 2 segundos
    interval(2000).subscribe(() => {
      this.checkNewMessages();
    });

    // Polling para usuarios escribiendo cada 3 segundos
    interval(3000).subscribe(() => {
      this.checkTypingUsers();
    });

    // Polling para estadísticas cada 30 segundos
    interval(30000).subscribe(() => {
      this.loadStats();
    });

    // Polling para usuarios online cada 10 segundos
    interval(10000).subscribe(() => {
      this.checkOnlineUsers();
    });
  }

  private loadInitialHistory(): void {
    this.http.get<{ messages: ChatMessage[] }>(`${this.apiUrl}/api/chat/messages?limit=50`)
      .subscribe({
        next: (response) => {
          const messages = response.messages || [];
          this.messagesSubject.next(messages);
          
          // Guardar el ID del último mensaje para polling futuro
          if (messages.length > 0) {
            this.lastMessageId = messages[messages.length - 1].id;
          }
        },
        error: (error) => {
          console.error('Error cargando historial inicial:', error);
        }
      });
  }

  private checkNewMessages(): void {
    const currentMessages = this.messagesSubject.value;
    
    this.http.get<{ messages: ChatMessage[] }>(
      `${this.apiUrl}/api/chat/messages?limit=50`
    ).subscribe({
      next: (response) => {
        const newMessages = response.messages || [];
        
        // Encontrar mensajes que no están en el estado actual
        const existingIds = new Set(currentMessages.map(m => m.id));
        const trulyNewMessages = newMessages.filter(msg => !existingIds.has(msg.id));
        
        if (trulyNewMessages.length > 0) {
          // Combinar y ordenar por timestamp
          const allMessages = [...currentMessages, ...trulyNewMessages]
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          
          this.messagesSubject.next(allMessages);
          
          // Actualizar último ID si hay mensajes nuevos
          if (trulyNewMessages.length > 0) {
            this.lastMessageId = trulyNewMessages[trulyNewMessages.length - 1].id;
          }
        }
      },
      error: (error) => {
        console.error('Error checking new messages:', error);
        this.connectedSubject.next(false);
      }
    });
  }

  private checkTypingUsers(): void {
    this.http.get<{ typing_users: string[] }>(
      `${this.apiUrl}/api/chat/typing-users?room=${this.currentRoom}`
    ).pipe(
      catchError(error => {
        console.error('Error checking typing users:', error);
        return of({ typing_users: [] });
      })
    ).subscribe({
      next: (response) => {
        // Filtrar el usuario actual
        const otherUsers = response.typing_users.filter(user => user !== this.currentUser);
        this.typingUsersSubject.next(otherUsers);
      }
    });
  }

  private checkOnlineUsers(): void {
    this.http.get<{ online_users: number }>(`${this.apiUrl}/api/chat/online-users`)
      .pipe(
        catchError(error => {
          console.error('Error checking online users:', error);
          return of({ online_users: 1 });
        })
      )
      .subscribe({
        next: (response) => {
          this.onlineUsersSubject.next(response.online_users);
          this.connectedSubject.next(true);
        }
      });
  }

  // === MÉTODOS PÚBLICOS MEJORADOS ===

  sendMessage(message: string): Observable<any> {
    if (!message.trim()) {
      throw new Error('El mensaje no puede estar vacío');
    }

    return this.http.post(`${this.apiUrl}/api/chat/send`, {
      message: message.trim(),
      user: this.currentUser,
      user_id: this.userId,
      room: this.currentRoom
    }).pipe(
      tap((response: any) => {
        if (response.success && response.message) {
          // Agregar el mensaje inmediatamente al estado local
          const currentMessages = this.messagesSubject.value;
          const newMessage: ChatMessage = response.message;
          
          // Verificar que no exista ya
          if (!currentMessages.find(m => m.id === newMessage.id)) {
            const updatedMessages = [...currentMessages, newMessage]
              .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            
            this.messagesSubject.next(updatedMessages);
          }
        }
        
        // Dejar de escribir
        this.setTyping(false);
      }),
      catchError(error => {
        console.error('Error sending message:', error);
        this.connectedSubject.next(false);
        throw error;
      })
    );
  }

  setTyping(isTyping: boolean): void {
    if (this.isTyping === isTyping) return;
    
    this.isTyping = isTyping;
    
    this.http.post(`${this.apiUrl}/api/chat/typing`, {
      user: this.currentUser,
      room: this.currentRoom,
      is_typing: isTyping
    }).pipe(
      catchError(error => {
        console.error('Error setting typing status:', error);
        return of(null);
      })
    ).subscribe();
  }

  setUser(name: string): void {
    if (name && name.trim()) {
      this.currentUser = name.trim();
      localStorage.setItem('chat_user_name', this.currentUser);
    }
  }

  getUser(): string {
    return this.currentUser;
  }

  getStats(): Observable<ChatStats> {
    return this.http.get<ChatStats>(`${this.apiUrl}/api/chat/stats`);
  }

  loadStats(): void {
    this.getStats().pipe(
      catchError(error => {
        console.error('Error loading stats:', error);
        return of(null);
      })
    ).subscribe(stats => {
      if (stats) {
        this.statsSubject.next(stats);
      }
    });
  }

  // === HELPERS PRIVADOS ===

  private generateUserId(): string {
    let userId = localStorage.getItem('chat_user_id');
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('chat_user_id', userId);
    }
    return userId;
  }

  // Limpiar recursos si es necesario
  destroy(): void {
    // Dejar de escribir al destruir
    this.setTyping(false);
  }
}