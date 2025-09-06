import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-admin-login',
  templateUrl: './admin-login.html',
  styleUrls: ['./admin-login.scss'],
})
export class AdminLoginComponent {
  username: string = '';
  password: string = '';
  isLoading: boolean = false;
  errorMessage: string = '';

  constructor(private authService: AuthService, private router: Router) {}

  login(): void {
    this.isLoading = true;
    this.errorMessage = '';

    if (this.authService.login(this.username, this.password)) {
      this.router.navigate(['/admin-panel']);
    } else {
      this.errorMessage = 'Credenciales incorrectas';
    }

    this.isLoading = false;
  }
}
