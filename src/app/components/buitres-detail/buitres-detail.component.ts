import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BuitresService, BuitrePerson, BuitreDetail, BuitreComment } from '../../services/buitres.service';

@Component({
  selector: 'app-buitres-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './buitres-detail.component.html',
  styleUrls: ['./buitres-detail.component.scss']
})
export class BuitresDetailComponent implements OnInit {
  person: BuitrePerson | null = null;
  details: BuitreDetail[] = [];
  comments: BuitreComment[] = [];
  
  newComment: string = '';
  newDetailContent: string = '';
  voting: boolean = false;
  fingerprint: string = '';
  private subscriptions: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private buitresService: BuitresService
  ) {}

  ngOnInit() {
    this.fingerprint = this.getFingerprint();
    this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.loadData(id);
        this.setupRealtime(id);
      }
    });
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  private getFingerprint(): string {
    let fp = localStorage.getItem('user_fingerprint');
    if (!fp) {
      fp = Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('user_fingerprint', fp);
    }
    return fp;
  }

  setupRealtime(id: string) {
    // Escuchar cambios en la persona (votos)
    this.subscriptions.push(
      this.buitresService.subscribeToChanges('buitres_people', (payload) => {
        if (payload.new && payload.new.id === id) {
          this.person = payload.new;
        }
      })
    );

    // Escuchar cambios en detalles (etiquetas)
    this.subscriptions.push(
      this.buitresService.subscribeToChanges('buitres_details', (payload) => {
        if (payload.new && payload.new.person_id === id) {
          this.loadDetails(id);
        }
      })
    );

    // Escuchar nuevos comentarios
    this.subscriptions.push(
      this.buitresService.subscribeToChanges('buitres_comments', (payload) => {
        if (payload.new && payload.new.person_id === id) {
          this.loadComments(id);
        }
      })
    );
  }

  loadData(id: string) {
    this.buitresService.getPersonById(id).subscribe(p => this.person = p);
    this.loadDetails(id);
    this.loadComments(id);
  }

  loadDetails(id: string) {
    this.buitresService.getDetails(id).subscribe(d => this.details = d);
  }

  loadComments(id: string) {
    this.buitresService.getComments(id).subscribe(c => this.comments = c);
  }

  vote(type: 'like' | 'dislike') {
    if (!this.person || this.voting) return;
    this.voting = true;
    this.buitresService.votePerson(this.person.id, type, this.fingerprint).subscribe({
      next: () => {
        this.loadData(this.person!.id);
        this.voting = false;
      },
      error: () => {
        alert('Ya has votado por esta persona.');
        this.voting = false;
      }
    });
  }

  submitComment() {
    if (!this.person || !this.newComment) return;
    this.buitresService.addComment(this.person.id, this.newComment, this.fingerprint).subscribe(() => {
      this.newComment = '';
      this.loadData(this.person!.id);
    });
  }

  addDetail() {
    if (!this.person || !this.newDetailContent) return;
    this.incrementDetail(this.newDetailContent);
    this.newDetailContent = '';
  }

  incrementDetail(content: string) {
    if (!this.person) return;
    this.buitresService.addOrIncrementDetail(this.person.id, content, this.fingerprint).subscribe({
      next: () => this.loadData(this.person!.id),
      error: (err) => console.error('Error incrementing detail:', err)
    });
  }
}
