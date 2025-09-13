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

  // Agregar canción a la cola - MEJORADO con manejo de errores
  addToQueue(trackUri: string): Observable<any> {
    const headers = this.authService.getAuthHeaders();
    return this.http.post(
      `${this.apiUrl}/api/spotify/admin/queue`,
      { uri: trackUri },
      { headers }
    );
  }
}