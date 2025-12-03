import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, interval, of, throwError } from 'rxjs';
import { catchError, map, startWith, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth';

@Injectable({
  providedIn: 'root',
})
export class VotingService {
  private apiUrl = environment.apiUrl;
  private cachedSongs: any[] = [];
  private lastFetchTime: number = 0;
  private readonly CACHE_DURATION = 2000;
  private cachedVotingStatus: any = null;
  private lastVotingStatusFetch: number = 0;

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

  invalidateVotingStatusCache(): void {
    this.cachedVotingStatus = null;
    this.lastVotingStatusFetch = 0;
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

  voteForSong(trackid: string, trackInfo: any, isDislike: boolean = false, dedication: string = ''): Observable<any> {
    const songData = {
      trackid,
      trackInfo,
      is_dislike: isDislike,
      dedication
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

  // Sondeo para obtener el ranking de canciones
  getRankedSongsPolling(): Observable<any[]> {
    return interval(30000).pipe(
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

  getSongs(): Observable<any[]> {
    return this.getRankedSongs();
  }
  addToHistory(trackId: string) {
    return this.http.post(`${this.apiUrl}/spotify/history`, { trackId });
  }

  vote(song: any, isDislike: boolean, isAdmin: boolean = false) {
    return this.http.post(`${this.apiUrl}/vote`, {
      song,
      isDislike,
      isAdmin
    });
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
    const url = this.getCacheBustedUrl(`${this.apiUrl}/api/votes`);
    
    return this.http.get<any[]>(url).pipe(
      map(songs => {
        const processedSongs = this.processSongs(songs || []);
        this.cachedSongs = processedSongs;
        this.lastFetchTime = Date.now();
        return processedSongs;
      })
    );
  }

  // Obtener ranking sin caché - NUEVO MÉTODO para admin
  getRankedSongsImmediate(): Observable<any[]> {
    const url = this.getCacheBustedUrl(`${this.apiUrl}/api/votes`);
    return this.http.get<any[]>(url).pipe(
      map(songs => this.processSongs(songs || []))
    );
  }

  getVotingStatus(): Observable<any> {
    const url = this.getCacheBustedUrl(`${this.apiUrl}/api/voting/status`);
    return this.http.get(url);
  }
  
  submitVote(voteType: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/voting/vote`, { vote_type: voteType }).pipe(
      tap(() => {
        // Invalidar caché después de un voto exitoso
        this.invalidateVotingStatusCache();
      }),
      catchError(error => {
        let errorMessage = 'Error al votar';
        
        if (error.error?.error) {
          errorMessage = error.error.error;
        } else if (error.status === 400) {
          errorMessage = 'Solicitud incorrecta';
        } else if (error.status === 409) {
          errorMessage = error.error?.error || 'Ya has votado por esta opción';
        } else if (error.status === 500) {
          errorMessage = 'Error del servidor';
        } else if (error.status === 0) {
          errorMessage = 'Error de conexión';
        }
        
        // Invalidar caché también en caso de error (por si acaso)
        this.invalidateVotingStatusCache();
        
        return throwError(() => new Error(errorMessage));
      })
    );
  }
  getVotingStatusImmediate(): Observable<any> {
    const url = this.getCacheBustedUrl(`${this.apiUrl}/api/voting/status`);
    return this.http.get(url);
  }
}