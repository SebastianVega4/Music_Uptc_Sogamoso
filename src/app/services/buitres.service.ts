import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { from, Observable, map } from 'rxjs';

export interface BuitrePerson {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  gender: 'male' | 'female';
  likes_count: number;
  dislikes_count: number;
  is_merged: boolean;
  merged_into?: string;
  created_at: string;
}

export interface BuitreDetail {
  id: string;
  person_id: string;
  content: string;
  occurrence_count: number;
  is_verified: boolean;
}

export interface BuitreComment {
  id: string;
  person_id: string;
  content: string;
  author_fingerprint: string;
  likes_count: number;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class BuitresService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  // --- People Operations ---

  getPeople(search: string = ''): Observable<BuitrePerson[]> {
    let query = this.supabase
      .from('buitres_people')
      .select('*')
      .eq('is_merged', false)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    return from(query).pipe(map(res => res.data || []));
  }

  getPersonById(id: string): Observable<BuitrePerson | null> {
    return from(
      this.supabase
        .from('buitres_people')
        .select('*')
        .eq('id', id)
        .single()
    ).pipe(map(res => res.data));
  }

  createPerson(name: string, description: string, gender: string): Observable<any> {
    return from(
      this.supabase
        .from('buitres_people')
        .insert([{ name, description, gender }])
        .select()
    );
  }

  // --- Details Operations ---

  getDetails(personId: string): Observable<BuitreDetail[]> {
    return from(
      this.supabase
        .from('buitres_details')
        .select('*')
        .eq('person_id', personId)
        .order('occurrence_count', { ascending: false })
    ).pipe(map(res => res.data || []));
  }

  addOrIncrementDetail(personId: string, content: string, fingerprint: string): Observable<any> {
    return from(
      this.supabase.rpc('increment_detail', { 
        p_person_id: personId, 
        p_content: content.trim(),
        p_fingerprint: fingerprint
      })
    );
  }

  // --- Realtime Subscriptions ---

  subscribeToChanges(table: string, callback: (payload: any) => void) {
    return this.supabase
      .channel(`public:${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, callback)
      .subscribe();
  }

  // --- Comments Operations ---

  getComments(personId: string): Observable<BuitreComment[]> {
    return from(
      this.supabase
        .from('buitres_comments')
        .select('*')
        .eq('person_id', personId)
        .order('created_at', { ascending: false })
    ).pipe(map(res => res.data || []));
  }

  addComment(personId: string, content: string, fingerprint: string): Observable<any> {
    return from(
      this.supabase
        .from('buitres_comments')
        .insert([{ person_id: personId, content, author_fingerprint: fingerprint }])
        .select()
    );
  }

  // --- Interaction Operations ---

  votePerson(personId: string, type: 'like' | 'dislike', fingerprint: string): Observable<any> {
    return from(
      this.supabase.rpc('vote_person', {
        p_person_id: personId,
        p_type: type,
        p_fingerprint: fingerprint
      })
    );
  }
}
