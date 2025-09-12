import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class RankingService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  // Obtener el ranking histórico
  getSongHistory(sortBy: string = 'times_played', order: string = 'desc'): Observable<any[]> {
    let params = new HttpParams()
      .set('sort_by', sortBy)
      .set('order', order);

    return this.http.get<any[]>(`${this.apiUrl}/api/ranking/history`, { params });
  }

  // Votar por una canción desde el ranking histórico
  voteFromHistory(trackId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/ranking/vote-from-history`, {
      track_id: trackId
    });
  }

  // Agregar manualmente una canción al histórico (para admin)
  addToHistory(trackId: string, votes: number = 0, dislikes: number = 0): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/ranking/add-to-history`, {
      track_id: trackId,
      votes: votes,
      dislikes: dislikes
    });
  }
}