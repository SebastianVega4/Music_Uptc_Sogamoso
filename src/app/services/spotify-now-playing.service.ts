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

  // Iniciar autenticación con Spotify
  startSpotifyAuth(): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/spotify/auth`);
  }

  // Obtener la canción actualmente en reproducción
  getCurrentlyPlaying(): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/spotify/currently-playing`);
  }

  // Polling para obtener la canción actual cada 5 segundos
  getCurrentlyPlayingPolling(): Observable<any> {
    return interval(5000).pipe(
      startWith(0),
      switchMap(() => this.getCurrentlyPlaying())
    );
  }
}