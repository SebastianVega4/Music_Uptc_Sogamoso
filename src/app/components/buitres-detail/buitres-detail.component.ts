import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BuitresService, BuitrePerson, BuitreDetail, BuitreComment } from '../../services/buitres.service';
import { AuthService } from '../../services/auth';

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
  isAdmin: boolean = false;
  
  // Admin Edit State
  isEditing: boolean = false;
  editName: string = '';
  editEmail: string = '';
  editGender: 'male' | 'female' | '' = '';

  private subscriptions: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private buitresService: BuitresService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.isAdmin = this.authService.isRoleAdmin();
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

    // Seguridad: Bloquear si tiene 10 o más números (evitar spam de teléfonos)
    const digitCount = (this.newComment.match(/\d/g) || []).length;
    if (digitCount >= 10) {
      alert('Por seguridad, no se permiten comentarios con números de teléfono.');
      return;
    }

    this.buitresService.addComment(this.person.id, this.newComment, this.fingerprint).subscribe(() => {
      this.newComment = '';
      this.loadData(this.person!.id);
    });
  }

  addDetail() {
    if (!this.person || !this.newDetailContent) return;

    // Seguridad: Bloquear si tiene 10 o más números
    const digitCount = (this.newDetailContent.match(/\d/g) || []).length;
    if (digitCount >= 10) {
      alert('Por seguridad, no se permiten etiquetas con números de teléfono.');
      return;
    }

    // Normalizar a Title Case
    const normalizedTag = this.newDetailContent
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    this.incrementDetail(normalizedTag);
    this.newDetailContent = '';
  }

  incrementDetail(content: string) {
    if (!this.person) return;
    this.buitresService.addOrIncrementDetail(this.person.id, content, this.fingerprint).subscribe({
      next: () => this.loadData(this.person!.id),
      error: (err) => console.error('Error incrementing detail:', err)
    });
  }

  getEmail(p: BuitrePerson | null): string {
    if (!p) return '';
    let email = p.email || '';
    if (!email && p.description && p.description.includes('@')) {
      email = p.description;
    }
    return email.replace('Email: ', '').trim();
  }

  shouldShowDescription(p: BuitrePerson | null): boolean {
    if (!p || !p.description) return false;
    const email = this.getEmail(p);
    const cleanDesc = p.description.replace('Email: ', '').trim();
    // Hide if description is essentially just the email or a subset of it
    if (!cleanDesc || cleanDesc === email || email.includes(cleanDesc)) return false;
    return true;
  }

  // --- Admin Methods ---

  startEditing() {
    if (!this.person) return;
    this.editName = this.person.name;
    // Fallback: if email is not in the dedicated column, try to extract it from description
    this.editEmail = this.getEmail(this.person);
    this.editGender = this.person.gender as any;
    this.isEditing = true;
  }

  private extractEmailFromDesc(desc?: string): string {
    if (!desc) return '';
    return desc.replace('Email: ', '').trim();
  }

  saveEdits() {
    if (!this.person || !this.editName || !this.editGender) return;

    // Normalizar a Title Case
    const normalizedName = this.editName
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    const updates: any = { 
      name: normalizedName, 
      gender: this.editGender,
      description: this.editEmail || this.person.description
    };

    // We try to update the email column, but we also keep it in description as fallback
    // because the Supabase API cache might still be stale.
    updates.email = this.editEmail;

    this.buitresService.updatePerson(this.person.id, updates).subscribe({
      next: () => {
        this.isEditing = false;
        this.loadData(this.person!.id);
      },
      error: (err) => {
        console.error('Update error:', err);
        // If the email column fails (PGRST204 stale cache, 42703 not exists, or 400 Bad Request), try updating without it
        if (err.code === 'PGRST204' || err.code === '42703' || (err.message && err.message.includes('email" does not exist')) || err.status === 400) {
            const fallbackUpdates = { ...updates };
            delete fallbackUpdates.email;
            this.buitresService.updatePerson(this.person!.id, fallbackUpdates).subscribe({
                next: () => {
                    this.isEditing = false;
                    this.loadData(this.person!.id);
                },
                error: () => alert('Error al actualizar perfil.')
            });
        } else {
            alert('Error al actualizar perfil.');
        }
      }
    });
  }

  deleteComment(id: string) {
    if (!confirm('¿Estás seguro de eliminar este comentario?')) return;
    this.buitresService.deleteComment(id).subscribe(() => {
      if (this.person) this.loadComments(this.person.id);
    });
  }

  deleteDetail(id: string) {
    if (!confirm('¿Estás seguro de eliminar esta etiqueta?')) return;
    this.buitresService.deleteDetail(id).subscribe(() => {
      if (this.person) this.loadDetails(this.person.id);
    });
  }

  deletePerson() {
    if (!this.person) return;
    if (confirm(`¿Estás seguro de eliminar permanentemente el perfil de "${this.person.name}"? Esta acción no se puede deshacer.`)) {
      this.buitresService.deletePerson(this.person.id).subscribe({
        next: () => {
          this.router.navigate(['/buitres']);
        },
        error: (err) => alert('Error al eliminar perfil.')
      });
    }
  }

  requestRemoval() {
    if (!this.person) return;
    const email = 'johan.vega01@uptc.edu.co';
    const subject = encodeURIComponent(`Solicitud de eliminación de perfil: ${this.person.name}`);
    const body = encodeURIComponent(`Hola johan,\n\nDeseo solicitar la eliminación del perfil "${this.person.name}" (ID: ${this.person.id}) del directorio comunitario de Buitres UPTC.\n\nAtentamente,\nUn integrante de la comunidad.`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  }
}
