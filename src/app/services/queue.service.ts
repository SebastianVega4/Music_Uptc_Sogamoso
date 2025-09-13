import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth';

@Injectable({
  providedIn: 'root'
})
export class QueueService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }

  // Obtener la cola de reproducción
  getQueue(): Observable<any> {
    const headers = this.authService.getAuthHeaders();
    return this.http.get(`${this.apiUrl}/api/spotify/admin/queue`, { headers });
  }

  // Agregar canción a la cola
  addToQueue(trackUri: string): Observable<any> {
    const headers = this.authService.getAuthHeaders();
    return this.http.post(
      `${this.apiUrl}/api/spotify/admin/queue`,
      { uri: trackUri },
      { headers }
    );
  }

  // Remover canción de la cola
  removeFromQueue(trackUri: string): Observable<any> {
    const headers = this.authService.getAuthHeaders();
    // Nota: Spotify Web API no tiene endpoint directo para remover de la cola
    // Esta implementación dependerá de cómo manejes la cola en tu backend
    return this.http.delete(
      `${this.apiUrl}/api/spotify/admin/queue?uri=${encodeURIComponent(trackUri)}`,
      { headers }
    );
  }

  // Limpiar toda la cola
  clearQueue(): Observable<any> {
    const headers = this.authService.getAuthHeaders();
    return this.http.delete(
      `${this.apiUrl}/api/spotify/admin/queue/all`,
      { headers }
    );
  }
}