import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable } from 'rxjs';
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
    ).pipe(
      catchError(error => {
        console.error('Error adding to queue:', error);
        let errorMessage = 'Error desconocido al agregar a la cola';
        
        if (error.error?.error) {
          errorMessage = error.error.error;
        } else if (error.status === 401) {
          errorMessage = 'No autorizado - verifica la conexión de Spotify';
        } else if (error.status === 404) {
          errorMessage = 'Dispositivo de Spotify no encontrado';
        }
        
        throw new Error(errorMessage);
      })
    );
  }
}