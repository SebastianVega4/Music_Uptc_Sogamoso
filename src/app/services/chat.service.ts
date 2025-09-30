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

  // Para tracking de mensajes ya recibidos
  private receivedMessageIds: Set<string> = new Set();

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
    // Polling para nuevos mensajes - MÁS RÁPIDO Y EFICIENTE
    this.messagePolling = interval(1000).subscribe(() => { // Reducido a 1 segundo
      this.checkNewMessages();
    });

    // Polling para usuarios escribiendo
    this.typingPolling = interval(1000).subscribe(() => {
      this.checkTypingUsers();
    });

    // Polling para estadísticas cada 30 segundos
    this.statsPolling = interval(30000).subscribe(() => {
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
          const messages = response.messages.reverse();
          this.messagesSubject.next(messages);
          
          // Inicializar el set de IDs recibidos
          messages.forEach(msg => this.receivedMessageIds.add(msg.id));
        },
        error: (error) => {
          console.error('Error cargando historial:', error);
        }
      });
  }

  private checkNewMessages(): void {
    const currentMessages = this.messagesSubject.value;

    this.http.get<{ messages: ChatMessage[] }>(
      `${this.apiUrl}/api/chat/messages?limit=100` // Obtener más mensajes para asegurar que no nos perdemos ninguno
    ).subscribe({
      next: (response) => {
        if (response.messages && response.messages.length > 0) {
          // Filtrar solo los mensajes nuevos que no hemos recibido
          const newMessages = response.messages.filter(newMsg => {
            const isNew = !this.receivedMessageIds.has(newMsg.id);
            if (isNew) {
              this.receivedMessageIds.add(newMsg.id);
            }
            return isNew;
          });

          if (newMessages.length > 0) {
            console.log(`📨 Nuevos mensajes recibidos: ${newMessages.length}`);
            
            // Combinar mensajes existentes con nuevos, evitando duplicados
            const allMessages = [...currentMessages];
            
            newMessages.forEach(newMsg => {
              // Verificar que no existe ya en los mensajes actuales (doble verificación)
              if (!allMessages.find(existingMsg => existingMsg.id === newMsg.id)) {
                allMessages.push(newMsg);
              }
            });

            // Ordenar por timestamp
            allMessages.sort((a, b) => 
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );

            this.messagesSubject.next(allMessages);
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
          const newMessage = response.message;
          
          // Agregar al set de IDs recibidos
          this.receivedMessageIds.add(newMessage.id);
          
          // Verificar que no existe ya antes de agregar
          if (!currentMessages.find(msg => msg.id === newMessage.id)) {
            const updatedMessages = [...currentMessages, newMessage];
            this.messagesSubject.next(updatedMessages);
          }
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

  forceRefreshMessages(): void {
    this.receivedMessageIds.clear();
    this.checkNewMessages();
  }
}