import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, interval } from 'rxjs';
import { environment } from '../../environments/environment';
import { switchMap, startWith } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class SpotifyNowPlayingService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  // Obtener la canción actual del admin (para todos los usuarios)
  getAdminCurrentlyPlaying(): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/spotify/admin/currently-playing`);
  }

  // Polling para obtener la canción actual del admin cada 5 segundos
  getAdminCurrentlyPlayingPolling(): Observable<any> {
    return interval(5000).pipe(
      startWith(0),
      switchMap(() => this.getAdminCurrentlyPlaying())
    );
  }

  // Verificar estado de autenticación de Spotify del admin
  getAdminSpotifyStatus(): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/spotify/admin/status`);
  }

  // Iniciar autenticación de Spotify para el admin
  startAdminSpotifyAuth(): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/spotify/admin/auth`);
  }

  // Desconectar Spotify del admin
  disconnectAdminSpotify(): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/spotify/admin/disconnect`, {});
  }

  // Métodos existentes para usuarios individuales
  startSpotifyAuth(): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/spotify/auth`);
  }

  getCurrentlyPlaying(): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/spotify/currently-playing`);
  }

  getCurrentlyPlayingPolling(): Observable<any> {
    return interval(5000).pipe(
      startWith(0),
      switchMap(() => this.getCurrentlyPlaying())
    );
  }
}