import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SpotifyService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  searchTracks(query: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/search?q=${encodeURIComponent(query)}`);
  }
  
  getAuthUrl(): Observable<{ authUrl: string }> {
    return this.http.get<{ authUrl: string }>(`${this.apiUrl}/api/spotify/auth`);
  }
  
  getCurrentlyPlaying(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/spotify/currently-playing`);
  }
}