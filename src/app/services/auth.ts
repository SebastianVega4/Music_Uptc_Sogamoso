import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  async login(email: string, password: string): Promise<boolean> {
    try {
      // Crear credenciales en base64 para autenticación básica
      const credentials = btoa(`${email}:${password}`);
      
      // Configurar headers con autenticación básica
      const headers = new HttpHeaders({
        'Authorization': `Basic ${credentials}`
      });

      // Verificar credenciales con el backend
      const response: any = await this.http.post(
        `${this.apiUrl}/api/auth`, 
        { email, password },
        { headers }
      ).toPromise();

      if (response && response.success) {
        // Guardar token básico (opcional, para mantener compatibilidad)
        localStorage.setItem('adminToken', response.token);
        localStorage.setItem('adminEmail', email);
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Error en login:', error);
      return false;
    }
  }

  logout(): void {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminEmail');
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('adminToken');
  }

  getAuthToken(): string | null {
    return localStorage.getItem('adminToken');
  }

  getAdminEmail(): string | null {
    return localStorage.getItem('adminEmail');
  }

  // Método para obtener headers de autenticación básica
  getBasicAuthHeaders(): HttpHeaders {
    const token = this.getAuthToken();
    if (token) {
      return new HttpHeaders({
        'Authorization': `Basic ${token}`
      });
    }
    return new HttpHeaders();
  }
}