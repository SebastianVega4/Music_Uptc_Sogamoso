import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home';
import { AdminLoginComponent } from './components/admin-login/admin-login';
import { AdminPanelComponent } from './components/admin-panel/admin-panel';
import { RankingComponent } from './components/ranking/ranking.component';
import { AuthGuard } from './guards/auth.guard';
import { DiscussionComponent } from './components/discussion/discussion.component';
import { ThreadDetailComponent } from './components/thread-detail/thread-detail.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'home', component: HomeComponent },
  { path: 'ranking', component: RankingComponent },
  { path: 'discussion', component: DiscussionComponent }, // Nueva ruta
  { path: 'discussion/thread/:id', component: ThreadDetailComponent }, // Detalle de hilo
  { path: 'admin-login', component: AdminLoginComponent },
  { path: 'admin-panel', component: AdminPanelComponent, canActivate: [AuthGuard] },
  { path: '**', redirectTo: '' }
];
