import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; 
import { AuthService } from '../../services/auth';

@Component({
  standalone: true,
  selector: 'app-admin-login',
  templateUrl: './admin-login.html',
  styleUrls: ['./admin-login.scss'],
  imports: [CommonModule, FormsModule]
})
export class AdminLoginComponent {
  email: string = '';
  password: string = '';
  isLoading: boolean = false;
  errorMessage: string = '';

  constructor(public authService: AuthService, private router: Router) { }

  async login(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      const success = await this.authService.login(this.email, this.password);
      
      if (success) {
        this.router.navigate(['/admin-panel']);
      } else {
        this.errorMessage = 'Credenciales incorrectas o no tienes permisos de administrador';
      }
    } catch (error) {
      this.errorMessage = 'Error al iniciar sesión. Intenta nuevamente.';
      console.error('Error en login:', error);
    } finally {
      this.isLoading = false;
    }
  }
}