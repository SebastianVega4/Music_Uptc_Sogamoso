import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BuitresService, BuitrePerson } from '../../services/buitres.service';
import { AuthService } from '../../services/auth';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

declare var google: any;

@Component({
  selector: 'app-buitres',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './buitres.component.html',
  styleUrls: ['./buitres.component.scss']
})
export class BuitresComponent implements OnInit, AfterViewInit {
  people: BuitrePerson[] = [];
  suggestions: BuitrePerson[] = [];
  searchQuery: string = '';
  loading: boolean = false;
  showCreateForm: boolean = false;
  totalPeople: number = 0;
  currentSort: 'recent' | 'likes' | 'comments' | 'tags' = 'recent';
  
  // Admin Features
  isAdmin: boolean = false;
  isMerging: boolean = false;
  mergeSelected: BuitrePerson | null = null;
  mergeQuery: string = '';

  newName: string = '';
  newEmail: string = '';
  newGender: 'male' | 'female' | '' = '';
  newDescription: string = '';

  private searchSubject = new Subject<string>();

  isLoggedIn: boolean = false;
  loginError: string = '';

  constructor(
    private buitresService: BuitresService,
    private authService: AuthService,
    public router: Router
  ) {}

  ngOnInit() {
    this.isLoggedIn = this.authService.isLoggedIn();
    this.isAdmin = this.authService.isRoleAdmin(); 
    if (this.isLoggedIn) {
      this.loadPeople();
      this.loadTotalCount();
    }

    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(query => {
      if (query.length >= 2) {
        this.buitresService.getPeople(query, this.currentSort).subscribe(res => {
          this.suggestions = res;
        });
      } else {
        this.suggestions = [];
        if (query.length === 0) this.loadPeople();
      }
    });
  }

  ngAfterViewInit() {
    if (!this.isLoggedIn) {
      this.initGoogleAuth();
    }
  }

  initGoogleAuth() {
    // Intentar inicializar Google Button cada 1s hasta que la librería cargue
    const interval = setInterval(() => {
      if (typeof google !== 'undefined' && google.accounts) {
        this.renderGoogleButton();
        clearInterval(interval);
      }
    }, 1000);
  }

  renderGoogleButton() {
    google.accounts.id.initialize({
      client_id: '361673258362-sf6ils8hu37d9b5ptmvds329aspgtiao.apps.googleusercontent.com',
      callback: (response: any) => this.handleGoogleLogin(response)
    });

    google.accounts.id.renderButton(
      document.getElementById('google-btn-container'),
      { theme: 'outline', size: 'large', width: '100%' }
    );
  }

  handleGoogleLogin(response: any) {
    const idToken = response.credential;
    this.loading = true;
    this.authService.googleLogin(idToken).subscribe({
      next: () => {
        this.isLoggedIn = true;
        this.isAdmin = this.authService.isRoleAdmin();
        this.loadPeople();
        this.loadTotalCount();
        this.loading = false;
      },
      error: (err) => {
        this.loginError = err.error?.error || 'Error al iniciar sesión';
        this.loading = false;
        alert(this.loginError);
      }
    });
  }

  logout() {
    this.authService.logout();
    this.isLoggedIn = false;
    this.isAdmin = false;
    this.people = [];
    // Reinicializar botón si decide volver a loguear
    setTimeout(() => this.initGoogleAuth(), 100);
  }

  loadTotalCount() {
    this.buitresService.getTotalPeopleCount().subscribe(count => {
      this.totalPeople = count;
    });
  }

  setSort(sort: 'recent' | 'likes' | 'comments' | 'tags') {
    this.currentSort = sort;
    this.loadPeople();
  }

  selectSuggestion(person: BuitrePerson) {
    this.router.navigate(['/buitres/person', person.id]);
    this.suggestions = [];
    this.searchQuery = '';
  }

  loadPeople() {
    this.loading = true;
    this.buitresService.getPeople('', this.currentSort).subscribe(results => {
      this.people = results;
      this.loading = false;
    });
  }

  onSearchChange(query: string) {
    this.searchSubject.next(query);
  }

  openCreateFormWithSearch() {
    this.newName = this.searchQuery;
    this.showCreateForm = true;
    this.suggestions = [];
    this.searchQuery = ''; // Clear search to hide suggestions
  }

  createPerson(event: Event) {
    event.preventDefault();
    if (!this.newName || !this.newGender) return;

    // Validación: Al menos un espacio para Nombre + Apellido
    if (!this.newName.trim().includes(' ')) {
      alert('Por favor, ingresa nombre y al menos un apellido (mínimo un espacio).');
      return;
    }

    // Normalizar a Title Case
    const normalizedName = this.newName
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    this.buitresService.createPerson(normalizedName, this.newEmail ? `Email: ${this.newEmail}` : this.newDescription, this.newGender, this.newEmail).subscribe({
      next: (res) => {
        this.showCreateForm = false;
        this.newName = '';
        this.newEmail = '';
        this.newGender = '';
        this.newDescription = '';
        this.loadPeople();
        this.loadTotalCount();
      },
      error: (err: any) => {
        // Fallback if email column doesn't exist
        if (err.message && err.message.includes('email" does not exist')) {
            this.buitresService.createPerson(normalizedName, this.newEmail ? `Email: ${this.newEmail}` : this.newDescription, this.newGender).subscribe(() => {
                this.showCreateForm = false;
                this.newName = '';
                this.newEmail = '';
                this.newGender = '';
                this.newDescription = '';
                this.loadPeople();
                this.loadTotalCount();
            });
        } else if (err.code === '23505') {
          alert('Esta persona ya existe en la base de datos.');
        } else {
          alert('Error al crear persona.');
        }
      }
    });
  }

  get filteredPeople() {
    if (!this.isMerging) return this.people;
    if (!this.mergeQuery) return this.people;
    return this.people.filter(p => 
      p.name.toLowerCase().includes(this.mergeQuery.toLowerCase()) && 
      p.id !== this.mergeSelected?.id
    );
  }

  // --- Admin Merging Logic ---

  startMerge(person: BuitrePerson) {
    this.mergeSelected = person;
    this.isMerging = true;
  }

  selectForMerge(target: BuitrePerson) {
    if (!this.mergeSelected || this.mergeSelected.id === target.id) return;

    if (confirm(`¿Estás seguro de fusionar a "${target.name}" dentro de "${this.mergeSelected.name}"? Los votos y comentarios se mantendrán, pero el perfil de "${target.name}" desaparecerá.`)) {
      this.buitresService.mergePersons(this.mergeSelected.id, target.id).subscribe({
        next: () => {
          alert('Perfiles fusionados correctamente.');
          this.resetMerge();
          this.loadPeople();
        },
        error: (err) => {
          console.error('Error merging:', err);
          alert('Error al fusionar perfiles.');
        }
      });
    }
  }

  resetMerge() {
    this.isMerging = false;
    this.mergeSelected = null;
  }


  deletePerson(person: BuitrePerson) {
    if (confirm(`¿Estás seguro de eliminar el perfil de "${person.name}" permanentemente? Se borrarán todos sus votos y comentarios.`)) {
      this.buitresService.deletePerson(person.id).subscribe({
        next: () => {
          this.loadPeople();
          this.loadTotalCount();
        },
        error: (err) => alert('Error al eliminar perfil.')
      });
    }
  }
}
