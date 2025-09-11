import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, interval, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { switchMap, startWith, catchError } from 'rxjs/operators';
import { AuthService } from './auth';

@Injectable({
  providedIn: 'root'
})
export class SpotifyNowPlayingService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private authService: AuthService) { }

  // Helper to get a cache-busting URL
  private getCacheBustedUrl(url: string): string {
    return `${url}?_=${new Date().getTime()}`;
  }

  // Obtener la canción actual del admin (para todos los usuarios)
  getAdminCurrentlyPlaying(): Observable<any> {
    const url = this.getCacheBustedUrl(`${this.apiUrl}/api/spotify/admin/currently-playing`);
    return this.http.get(url).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          return this.refreshAdminToken().pipe(
            switchMap(() => {
              // Reintentar la solicitud después del refresco
              const newUrl = this.getCacheBustedUrl(`${this.apiUrl}/api/spotify/admin/currently-playing`);
              return this.http.get(newUrl);
            }),
            catchError(refreshError => {
              console.error('Error al refrescar token:', refreshError);
              return throwError(() => refreshError);
            })
          );
        }
        return throwError(() => error);
      })
    );
  }

  // Método para refrescar el token del admin
  private refreshAdminToken(): Observable<any> {
    const headers = this.authService.getAuthHeaders();
    return this.http.post(`${this.apiUrl}/api/spotify/admin/refresh-token`, {}, { headers });
  }
  // Polling para obtener la canción actual del admin cada 3 segundos
  getAdminCurrentlyPlayingPolling(): Observable<any> {
    return interval(30000).pipe(  // 30 segundos en lugar de 3
      startWith(0),
      switchMap(() => this.getAdminCurrentlyPlaying())
    );
  }

  // Verificar estado de autenticación de Spotify del admin
  getAdminSpotifyStatus(): Observable<any> {
    const url = this.getCacheBustedUrl(`${this.apiUrl}/api/spotify/admin/status`);
    return this.http.get(url);
  }

  // Iniciar autenticación de Spotify para el admin
  startAdminSpotifyAuth(): Observable<any> {
    const url = this.getCacheBustedUrl(`${this.apiUrl}/api/spotify/admin/auth`);
    return this.http.get(url);
  }

  // Desconectar Spotify del admin
  disconnectAdminSpotify(): Observable<any> {
    const headers = this.authService.getAuthHeaders();
    return this.http.post(`${this.apiUrl}/api/spotify/admin/disconnect`, {}, { headers });
  }

  // Métodos existentes para usuarios individuales
  startSpotifyAuth(): Observable<any> {
    const url = this.getCacheBustedUrl(`${this.apiUrl}/api/spotify/auth`);
    return this.http.get(url);
  }

  getCurrentlyPlaying(): Observable<any> {
    const url = this.getCacheBustedUrl(`${this.apiUrl}/api/spotify/currently-playing`);
    return this.http.get(url);
  }

  getCurrentlyPlayingPolling(): Observable<any> {
    return interval(3000).pipe(
      startWith(0),
      switchMap(() => this.getCurrentlyPlaying())
    );
  }

  addToQueue(trackUri: string): Observable<any> {
    const headers = this.authService.getAuthHeaders();
    return this.http.post(
      `${this.apiUrl}/api/spotify/admin/queue`,
      { uri: trackUri },
      { headers }
    );
  }

  // Obtener la cola de reproducción actual
  getQueue(): Observable<any> {
    const headers = this.authService.getAuthHeaders();
    return this.http.get(`${this.apiUrl}/api/spotify/admin/queue`, { headers });
  }
}
