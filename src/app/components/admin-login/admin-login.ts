import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth';

@Component({
  standalone: true,
  selector: 'app-admin-login',
  templateUrl: './admin-login.html',
  styleUrls: ['./admin-login.scss'],
  imports: [CommonModule, FormsModule, RouterLink]
})
export class AdminLoginComponent implements OnInit {
  email: string = '';
  password: string = '';
  isLoading: boolean = false;
  errorMessage: string = '';

  constructor(public authService: AuthService, private router: Router) { }

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/admin-panel']);
    }
  }

  async login(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      const success = await this.authService.login(this.email, this.password);
      
      if (success) {
        this.router.navigate(['/admin-panel']);
      } else {
        this.errorMessage = 'Credenciales incorrectas';
      }
    } catch (error: any) {
      this.errorMessage = this.getErrorMessage(error.code);
      console.error('Error en login:', error);
    } finally {
      this.isLoading = false;
    }
  }

  private getErrorMessage(errorCode: string): string {
    const errorMessages: { [key: string]: string } = {
      'auth/invalid-email': 'Email inválido',
      'auth/user-disabled': 'Usuario deshabilitado',
      'auth/user-not-found': 'Usuario no encontrado',
      'auth/wrong-password': 'Contraseña incorrecta',
      'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde.'
    };
    
    return errorMessages[errorCode] || 'Error al iniciar sesión. Intenta nuevamente.';
  }
}