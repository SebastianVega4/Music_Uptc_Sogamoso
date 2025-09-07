import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth';

@Injectable({
  providedIn: 'root',
})
export class VotingService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private authService: AuthService) {}

  getRankedSongs(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/votes`).pipe(
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
          // If votes are equal, and votes are 1, sort by creation date
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

    return this.http.delete(`${this.apiUrl}/api/votes?trackId=${trackId}`, { headers });
  }

  deleteAllVotes(): Observable<any> {
    const token = this.authService.getAuthToken();
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  
    return this.http.delete(`${this.apiUrl}/api/votes/all`, { headers });
  }
}
