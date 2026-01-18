import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BuitresService, BuitrePerson } from '../../services/buitres.service';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-buitres',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './buitres.component.html',
  styleUrls: ['./buitres.component.scss']
})
export class BuitresComponent implements OnInit {
  people: BuitrePerson[] = [];
  suggestions: BuitrePerson[] = [];
  searchQuery: string = '';
  loading: boolean = false;
  showCreateForm: boolean = false;
  totalPeople: number = 0;
  currentSort: 'recent' | 'likes' | 'comments' | 'tags' = 'recent';
  
  newName: string = '';
  newGender: 'male' | 'female' | '' = '';
  newDescription: string = '';

  private searchSubject = new Subject<string>();

  constructor(
    private buitresService: BuitresService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadPeople();
    this.loadTotalCount();

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

  createPerson(event: Event) {
    event.preventDefault();
    if (!this.newName || !this.newGender) return;

    // Normalizar a Title Case
    const normalizedName = this.newName
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    this.buitresService.createPerson(normalizedName, this.newDescription, this.newGender).subscribe({
      next: (res) => {
        this.showCreateForm = false;
        this.newName = '';
        this.newGender = '';
        this.newDescription = '';
        this.loadPeople();
        this.loadTotalCount();
      },
      error: (err: any) => {
        if (err.code === '23505') {
          alert('Esta persona ya existe en la base de datos.');
        } else {
          alert('Error al crear persona.');
        }
      }
    });
  }
}
