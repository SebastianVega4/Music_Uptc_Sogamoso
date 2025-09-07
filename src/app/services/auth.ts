import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Auth, signInWithEmailAndPassword, signOut, IdTokenResult } from '@angular/fire/auth';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private firebaseAuth: Auth) {}

  async login(email: string, password: string): Promise<boolean> {
    try {
      // Autenticar directamente con Firebase
      const userCredential = await signInWithEmailAndPassword(this.firebaseAuth, email, password);
      const user = userCredential.user;
      
      // Obtener el token de Firebase
      const idToken = await user.getIdToken();
      
      localStorage.setItem('adminToken', idToken);
      localStorage.setItem('adminUid', user.uid);
      return true;
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
    return !!this.firebaseAuth.currentUser;
  }

  getAuthToken(): string | null {
    return localStorage.getItem('adminToken');
  }

  getAdminUid(): string | null {
    return localStorage.getItem('adminUid');
  }

  // Método para obtener el usuario actual de Firebase
  getCurrentUser() {
    return this.firebaseAuth.currentUser;
  }
}