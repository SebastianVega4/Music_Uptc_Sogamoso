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
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
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
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 6);
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