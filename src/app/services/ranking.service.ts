import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class RankingService {
  private apiUrl = environment.apiUrl; // Usar la URL base directamente

  constructor(private http: HttpClient) { }

  getSongHistory(sortBy: string = 'times_played', sortOrder: string = 'desc'): Observable<any[]> {
    let params = new HttpParams()
      .set('sort_by', sortBy)
      .set('order', sortOrder); // Cambiar 'sort_order' a 'order'

    return this.http.get<any[]>(`${this.apiUrl}/api/ranking/history`, { params });
  }

  voteFromHistory(trackId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/ranking/vote-from-history`, { track_id: trackId });
  }

  getRankingStats(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/ranking/stats`);
  }
  
  forceRankCurrentSong(): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/ranking/force-rank-current`, {});
  }
}