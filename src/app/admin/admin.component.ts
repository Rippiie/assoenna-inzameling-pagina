import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EMPTY, Subscription } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { DEFAULT_SETTINGS, Settings } from '../settings.model';
import { SettingsService } from '../settings.service';

@Component({
  selector: 'app-admin',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css'
})
export class AdminComponent implements OnDestroy {
  model: Settings = this.clone(DEFAULT_SETTINGS);
  status = '';
  saving = false;

  private readonly subscription = new Subscription();
  private destroyed = false;

  constructor(
    private readonly settingsService: SettingsService,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.subscription.add(
      this.settingsService.settings$.subscribe((settings) => {
        this.model = this.clone(settings);
        this.safeDetectChanges();
      })
    );
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.subscription.unsubscribe();
  }

  addSlide(): void {
    this.model.slides = [...(this.model.slides ?? []), { src: '', title: '', sub: '' }];
  }

  removeSlide(index: number): void {
    this.model.slides = this.model.slides.filter((_, i) => i !== index);
    if (!this.model.slides.length) {
      this.addSlide();
    }
  }

  save(): void {
    this.status = '';
    this.saving = true;

    this.settingsService
      .update(this.model)
      .pipe(
        catchError(() => {
          this.status = 'Opslaan mislukt.';
          this.safeDetectChanges();
          return EMPTY;
        }),
        finalize(() => {
          this.saving = false;
          this.safeDetectChanges();
        })
      )
      .subscribe(() => {
        this.status = 'Opgeslagen.';
        this.safeDetectChanges();
      });
  }

  reset(): void {
    this.status = '';
    this.settingsService.reload().subscribe({
      next: (settings) => {
        this.model = this.clone(settings);
        this.status = 'Opnieuw geladen.';
        this.safeDetectChanges();
      },
      error: () => {
        this.status = 'Laden mislukt.';
        this.safeDetectChanges();
      }
    });
  }

  private clone(settings: Settings): Settings {
    return JSON.parse(JSON.stringify(settings));
  }

  private safeDetectChanges(): void {
    if (this.destroyed) {
      return;
    }
    queueMicrotask(() => {
      if (this.destroyed) {
        return;
      }
      try {
        this.cdr.detectChanges();
      } catch {
        // Ignore if a change detection pass is already running.
      }
    });
  }
}
