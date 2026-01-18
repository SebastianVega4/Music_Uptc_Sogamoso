import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BuitresService, BuitrePerson } from '../../services/buitres.service';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

@Component({
  selector: 'app-buitres',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './buitres.component.html',
  styleUrls: ['./buitres.component.scss']
})
export class BuitresComponent implements OnInit {
  people: BuitrePerson[] = [];
  searchQuery: string = '';
  loading: boolean = false;
  showCreateForm: boolean = false;
  
  newName: string = '';
  newGender: 'male' | 'female' | '' = '';
  newDescription: string = '';

  private searchSubject = new Subject<string>();

  constructor(private buitresService: BuitresService) {}

  ngOnInit() {
    this.loadPeople();

    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap(query => {
        this.loading = true;
        return this.buitresService.getPeople(query);
      })
    ).subscribe(results => {
      this.people = results;
      this.loading = false;
    });
  }

  loadPeople() {
    this.loading = true;
    this.buitresService.getPeople().subscribe(results => {
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
