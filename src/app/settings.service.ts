import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, of, timer } from 'rxjs';
import { catchError, map, switchMap, takeUntil, tap } from 'rxjs/operators';
import { DEFAULT_SETTINGS, Settings } from './settings.model';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly subject = new BehaviorSubject<Settings>(DEFAULT_SETTINGS);
  readonly settings$ = this.subject.asObservable();

  private stream?: EventSource;
  private readonly stop$ = new Subject<void>();

  constructor(private readonly http: HttpClient) {
    this.reload().subscribe();
    this.startStream();
  }

  reload(): Observable<Settings> {
    return this.http.get<Settings>('/api/settings').pipe(
      map((settings) => this.normalize(settings)),
      tap((settings) => this.subject.next(settings)),
      catchError(() => {
        this.subject.next(DEFAULT_SETTINGS);
        return of(DEFAULT_SETTINGS);
      })
    );
  }

  update(settings: Settings): Observable<Settings> {
    return this.http.post<Settings>('/api/settings', settings).pipe(
      map((next) => this.normalize(next)),
      tap((next) => this.subject.next(next))
    );
  }

  private startStream(): void {
    this.connectStream();

    timer(30000, 30000)
      .pipe(
        takeUntil(this.stop$),
        switchMap(() => this.reload())
      )
      .subscribe();
  }

  private connectStream(): void {
    if (this.stream) {
      this.stream.close();
    }

    this.stream = new EventSource('/api/stream');
    this.stream.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as Settings;
        this.subject.next(this.normalize(data));
      } catch {
        // Ignore malformed payloads.
      }
    };

    this.stream.onerror = () => {
      this.stream?.close();
      this.stream = undefined;
      setTimeout(() => this.connectStream(), 3000);
    };
  }

  private normalize(input: Settings): Settings {
    return {
      ...DEFAULT_SETTINGS,
      ...input,
      bullets: Array.isArray(input?.bullets) ? input.bullets : DEFAULT_SETTINGS.bullets,
      slides: Array.isArray(input?.slides) && input.slides.length
        ? input.slides
        : DEFAULT_SETTINGS.slides
    };
  }
}
