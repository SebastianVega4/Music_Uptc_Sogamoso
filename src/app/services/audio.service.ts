import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private audio: HTMLAudioElement;
  private currentUrlSubject = new BehaviorSubject<string | null>(null);
  private isPlayingSubject = new BehaviorSubject<boolean>(false);

  currentUrl$ = this.currentUrlSubject.asObservable();
  isPlaying$ = this.isPlayingSubject.asObservable();

  constructor() {
    this.audio = new Audio();
    this.audio.addEventListener('ended', () => {
      this.stop();
    });
    this.audio.addEventListener('pause', () => {
      this.isPlayingSubject.next(false);
    });
    this.audio.addEventListener('play', () => {
      this.isPlayingSubject.next(true);
    });
  }

  play(url: string): void {
    console.log('AudioService: Request to play', url);
    if (!url) {
      console.warn('AudioService: No URL provided');
      return;
    }

    if (this.currentUrlSubject.value === url) {
      // Toggle play/pause if same song
      if (this.audio.paused) {
        console.log('AudioService: Resuming audio');
        this.audio.play().catch(err => console.error('AudioService: Error resuming:', err));
      } else {
        console.log('AudioService: Pausing audio');
        this.audio.pause();
      }
    } else {
      // Play new song
      console.log('AudioService: Playing new song');
      this.stop();
      this.audio.src = url;
      this.audio.load();
      this.audio.play()
        .then(() => console.log('AudioService: Playback started'))
        .catch(err => console.error('AudioService: Error playing audio:', err));
      this.currentUrlSubject.next(url);
    }
  }

  pause(): void {
    this.audio.pause();
  }

  stop(): void {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.currentUrlSubject.next(null);
    this.isPlayingSubject.next(false);
  }

  isCurrentSong(url: string | null | undefined): boolean {
    if (!url) return false;
    return this.currentUrlSubject.value === url;
  }
}
