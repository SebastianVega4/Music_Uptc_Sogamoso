import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, interval, of } from 'rxjs';
import { map, startWith, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth';

@Injectable({
  providedIn: 'root',
})
export class VotingService {
  private apiUrl = environment.apiUrl;
  private cachedSongs: any[] = [];
  private lastFetchTime: number = 0;
  private readonly CACHE_DURATION = 30000;

  constructor(private http: HttpClient, private authService: AuthService) { }

  // Helper para obtener una URL que evite el caché
  private getCacheBustedUrl(url: string): string {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}_=${new Date().getTime()}`;
  }

  // Limpiar caché cuando se realizan operaciones que modifican los datos
  private invalidateCache(): void {
    this.cachedSongs = [];
    this.lastFetchTime = 0;
  }

  // Procesar y ordenar las canciones (método reusable)
  private processSongs(songs: any[]): any[] {
    if (!songs || songs.length === 0) {
      return [];
    }

    return songs.sort((a, b) => {
      if (a.votes > b.votes) {
        return -1;
      }
      if (a.votes < b.votes) {
        return 1;
      }
      if (a.votes === 1) {
        if (a.createdAt > b.createdAt) {
          return -1;
        }
        if (a.createdAt < b.createdAt) {
          return 1;
        }
      }
      return 0;
    });
  }

  getRankedSongs(): Observable<any[]> {
    const now = Date.now();

    // Usar caché si está disponible y no ha expirado
    if (this.cachedSongs.length > 0 && (now - this.lastFetchTime) < this.CACHE_DURATION) {
      return of([...this.cachedSongs]); // Devolver copia para evitar mutaciones
    }

    const url = this.getCacheBustedUrl(`${this.apiUrl}/api/votes`);

    return this.http.get<any[]>(url).pipe(
      map(songs => {
        const processedSongs = this.processSongs(songs || []);

        // Actualizar caché
        this.cachedSongs = processedSongs;
        this.lastFetchTime = now;

        return processedSongs;
      })
    );
  }

  // Sondeo para obtener el ranking de canciones cada 60 segundos
  getRankedSongsPolling(): Observable<any[]> {
    return interval(60000).pipe(
      startWith(0),
      switchMap(() => this.getRankedSongs())
    );
  }

  getRecentlyAddedSongs(): Observable<any[]> {
    return this.getRankedSongs().pipe(
      map(songs =>
        songs
          .filter(song => song.votes === 1)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5)
      )
    );
  }

  voteForSong(trackid: string, trackInfo: any): Observable<any> {
    const songData = {
      trackid,
      trackInfo,
      createdAt: new Date().toISOString(),
    };

    return this.http.post(`${this.apiUrl}/api/vote`, songData).pipe(
      tap(() => {
        // Invalidar caché después de votar
        this.invalidateCache();
      })
    );
  }

  deleteSong(trackid: string): Observable<any> {
    // Usar autenticación básica en lugar de Bearer token
    const headers = this.authService.getBasicAuthHeaders();

    const baseUrl = `${this.apiUrl}/api/votes?trackid=${trackid}`;
    const url = this.getCacheBustedUrl(baseUrl);

    return this.http.delete(url, { headers }).pipe(
      tap(() => {
        this.invalidateCache();
      })
    );
  }

  deleteAllVotes(): Observable<any> {
    // Usar autenticación básica en lugar de Bearer token
    const headers = this.authService.getBasicAuthHeaders();

    const url = this.getCacheBustedUrl(`${this.apiUrl}/api/votes/all`);

    return this.http.delete(url, { headers }).pipe(
      tap(() => {
        this.invalidateCache();
      })
    );
  }

  // Método para forzar la actualización del caché
  forceRefresh(): Observable<any[]> {
    this.invalidateCache();
    return this.getRankedSongs();
  }
}