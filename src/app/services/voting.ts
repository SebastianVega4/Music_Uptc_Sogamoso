import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class VotingService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getRankedSongs(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/votes`);
  }

  voteForSong(trackId: string, trackInfo: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/votes`, { trackId, trackInfo });
  }

  deleteSong(trackId: string, adminSecret: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/api/votes?trackId=${trackId}`, {
      headers: { Authorization: `Bearer ${adminSecret}` },
    });
  }
}
