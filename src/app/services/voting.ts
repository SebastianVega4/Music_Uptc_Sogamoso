import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth';

@Injectable({
  providedIn: 'root',
})
export class VotingService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private authService: AuthService) {}

  getRankedSongs(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/votes`);
  }

  voteForSong(trackId: string, trackInfo: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/vote`, { trackId, trackInfo }); 
  }

  deleteSong(trackId: string): Observable<any> {
    const token = this.authService.getAuthToken();
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    return this.http.delete(`${this.apiUrl}/api/votes?trackId=${trackId}`, { headers });
  }
}