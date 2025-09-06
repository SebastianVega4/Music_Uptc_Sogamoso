import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private adminSecret = 'uptc2026'; // En producción, esto debería venir de environment

  constructor() {}

  login(username: string, password: string): boolean {
    // Credenciales hardcodeadas para simplificar
    if (username === 'admin' && password === 'uptc2023') {
      localStorage.setItem('adminAuth', this.adminSecret);
      return true;
    }
    return false;
  }

  logout(): void {
    localStorage.removeItem('adminAuth');
  }

  isLoggedIn(): boolean {
    return localStorage.getItem('adminAuth') === this.adminSecret;
  }

  getAuthToken(): string | null {
    return localStorage.getItem('adminAuth');
  }
}
