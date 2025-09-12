import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class RankingService {
  private apiUrl = `${environment.apiUrl}/ranking`;

  constructor(private http: HttpClient) { }

  getSongHistory(sortBy: string = 'times_played', sortOrder: string = 'desc'): Observable<any[]> {
    let params = new HttpParams()
      .set('sort_by', sortBy)
      .set('sort_order', sortOrder);

    return this.http.get<any[]>(this.apiUrl, { params });
  }

  voteFromHistory(trackId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/vote`, { track_id: trackId });
  }

  getRankingStats(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/stats`);
  }
}