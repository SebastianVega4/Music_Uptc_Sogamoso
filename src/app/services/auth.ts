import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Auth, signInWithEmailAndPassword, signOut } from '@angular/fire/auth';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private firebaseAuth: Auth) {}

  async login(email: string, password: string): Promise<boolean> {
    try {
      // Autenticar con Firebase
      const userCredential = await signInWithEmailAndPassword(this.firebaseAuth, email, password);
      const user = userCredential.user;

      // Obtener token personalizado del backend
      const response: any = await this.http
        .post(`${this.apiUrl}/api/auth`, { email, password })
        .toPromise();

      if (response.success) {
        localStorage.setItem('adminToken', response.token);
        localStorage.setItem('adminUid', user.uid);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error en login:', error);
      return false;
    }
  }

  logout(): void {
    signOut(this.firebaseAuth);
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUid');
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('adminToken');
  }

  getAuthToken(): string | null {
    return localStorage.getItem('adminToken');
  }

  getAdminUid(): string | null {
    return localStorage.getItem('adminUid');
  }
}
