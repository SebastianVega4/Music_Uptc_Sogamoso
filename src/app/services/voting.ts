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
      if (a.votes > b.votes) return -1;
      if (a.votes < b.votes) return 1;
      return new Date(b.createdat).getTime() - new Date(a.createdat).getTime();
    });
  }

  voteForSong(trackid: string, trackInfo: any, isDislike: boolean = false): Observable<any> {
    const songData = {
      trackid,
      trackInfo,
      is_dislike: isDislike
    };

    return this.http.post(`${this.apiUrl}/api/vote`, songData).pipe(
      tap(() => {
        this.invalidateCache();
      })
    );
  }

  changeVote(trackid: string, trackInfo: any, newIsDislike: boolean): Observable<any> {
    // Esto se manejará automáticamente en el backend basado en el voto existente
    return this.voteForSong(trackid, trackInfo, newIsDislike);
  }
  
  // Sondeo para obtener el ranking de canciones cada 60 segundos
  getRankedSongsPolling(): Observable<any[]> {
    return interval(60000).pipe(
      startWith(0),
      switchMap(() => this.getRankedSongs())
    );
  }

  getRankedSongs(): Observable<any[]> {
    const now = Date.now();

    if (this.cachedSongs.length > 0 && (now - this.lastFetchTime) < this.CACHE_DURATION) {
      return of([...this.cachedSongs]);
    }

    const url = this.getCacheBustedUrl(`${this.apiUrl}/api/votes`);

    return this.http.get<any[]>(url).pipe(
      map(songs => {
        const processedSongs = this.processSongs(songs || []);

        this.cachedSongs = processedSongs;
        this.lastFetchTime = now;

        return processedSongs;
      })
    );
  }

  getRecentlyAddedSongs(): Observable<any[]> {
    return this.getRankedSongs().pipe(
      map(songs => {
        return [...songs]
          .sort((a, b) => new Date(b.createdat).getTime() - new Date(a.createdat).getTime())
          .slice(0, 10);
      })
    );
  }

  deleteSong(trackid: string): Observable<any> {
    // Usar autenticación básica en lugar de Bearer token
    const headers = this.authService.getAuthHeaders();

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
    const headers = this.authService.getAuthHeaders();

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