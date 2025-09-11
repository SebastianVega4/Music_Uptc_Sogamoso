import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private currentUserSubject = new BehaviorSubject<any>(null);
  public currentUser = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    // Cargar usuario desde localStorage al iniciar
    const token = localStorage.getItem('adminToken');
    const userData = localStorage.getItem('adminUser');
    if (token && userData) {
      this.currentUserSubject.next(JSON.parse(userData));
    }
  }

  login(email: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/auth/login`, { email, password }).pipe(
      tap((response: any) => {
        if (response.token) {
          localStorage.setItem('adminToken', response.token);
          localStorage.setItem('adminUser', JSON.stringify(response.user));
          this.currentUserSubject.next(response.user);
        }
      })
  );
}

  logout(): void {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    this.currentUserSubject.next(null);
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('adminToken');
  }

  getAuthToken(): string | null {
    return localStorage.getItem('adminToken');
  }

  getAuthHeaders(): HttpHeaders {
    const token = this.getAuthToken();
    if (token) {
      return new HttpHeaders({
        'Authorization': `Bearer ${token}`
      });
    }
    return new HttpHeaders();
  }
}