import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, interval } from 'rxjs';
import { map, startWith, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth';

@Injectable({
  providedIn: 'root',
})
export class VotingService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private authService: AuthService) {}

  // Helper para obtener una URL que evite el caché
  private getCacheBustedUrl(url: string): string {
    // Verificar si la URL ya tiene parámetros de consulta
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}_=${new Date().getTime()}`;
  }

  getRankedSongs(): Observable<any[]> {
    const url = this.getCacheBustedUrl(`${this.apiUrl}/api/votes`);
    return this.http.get<any[]>(url).pipe(
      map(songs => {
        if (!songs) {
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
      })
    );
  }

  // Sondeo para obtener el ranking de canciones cada 3 segundos
  getRankedSongsPolling(): Observable<any[]> {
    return interval(3000).pipe(
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

  voteForSong(trackId: string, trackInfo: any): Observable<any> {
    const songData = {
      trackId,
      trackInfo,
      createdAt: new Date().toISOString(),
    };
    return this.http.post(`${this.apiUrl}/api/vote`, songData);
  }

  deleteSong(trackId: string): Observable<any> {
    const token = this.authService.getAuthToken();
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  
    // Construir la URL correctamente - primero el parámetro trackId, luego el cache busting
    const baseUrl = `${this.apiUrl}/api/votes?trackId=${trackId}`;
    const url = this.getCacheBustedUrl(baseUrl);
    return this.http.delete(url, { headers });
  }

  deleteAllVotes(): Observable<any> {
    const token = this.authService.getAuthToken();
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  
    const url = this.getCacheBustedUrl(`${this.apiUrl}/api/votes/all`);
    return this.http.delete(url, { headers });
  }
}
