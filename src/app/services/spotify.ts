import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SpotifyService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  searchTracks(query: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/search?q=${encodeURIComponent(query)}`).pipe(
      map((tracks: any[]) => {
        return tracks.map(track => ({
          id: track.id,
          name: track.name,
          artists: track.artists,
          album: track.album,
          image: track.image,
          preview_url: track.preview_url,
          duration_ms: track.duration_ms
        }));
      })
    );
  }

  getAuthUrl(): Observable<{ authUrl: string }> {
    return this.http.get<{ authUrl: string }>(`${this.apiUrl}/api/spotify/auth`);
  }

  getCurrentlyPlaying(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/spotify/currently-playing`);
  }
  getStatus(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/spotify/admin/status`);
  }
}