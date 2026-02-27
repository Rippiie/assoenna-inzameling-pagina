import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { DEFAULT_SETTINGS, Settings, Slide } from '../settings.model';
import { SettingsService } from '../settings.service';

@Component({
  selector: 'app-home',
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnDestroy {
  settings: Settings = DEFAULT_SETTINGS;
  activeIndex = 0;

  private formatter = this.buildFormatter(DEFAULT_SETTINGS);
  private slideshowTimer?: number;
  private readonly subscription = new Subscription();
  private destroyed = false;

  constructor(
    private readonly settingsService: SettingsService,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.subscription.add(
      this.settingsService.settings$.subscribe((settings) => {
        this.settings = settings;
        this.formatter = this.buildFormatter(settings);
        this.resetSlideshow();
        this.safeDetectChanges();
      })
    );
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.subscription.unsubscribe();
    this.clearTimer();
  }

  get percent(): number {
    const goal = Math.max(0, Number(this.settings.goalAmount) || 0);
    const raised = Math.max(0, Number(this.settings.raisedAmount) || 0);
    if (!goal) {
      return 0;
    }
    return Math.min(Math.max((raised / goal) * 100, 0), 999);
  }

  get clampedPercent(): number {
    return Math.min(this.percent, 100);
  }

  get remainingAmount(): number {
    const goal = Math.max(0, Number(this.settings.goalAmount) || 0);
    const raised = Math.max(0, Number(this.settings.raisedAmount) || 0);
    return Math.max(0, goal - raised);
  }

  get qrUrl(): string {
    const data = encodeURIComponent(this.settings.donationUrl || 'https://voorbeeld.nl/doneren');
    return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${data}`;
  }

  get activeSlide(): Slide {
    return this.settings.slides[this.activeIndex] ?? { src: '', title: '', sub: '' };
  }

  slideBackground(slide: Slide): string {
    if (slide?.src) {
      return `url("${slide.src}")`;
    }
    return (
      'radial-gradient(900px 500px at 30% 40%, rgba(74,163,255,0.35), transparent 60%),' +
      'radial-gradient(800px 500px at 70% 60%, rgba(67,209,122,0.30), transparent 60%)'
    );
  }

  formatMoney(amount: number): string {
    return this.formatter.format(amount);
  }

  private resetSlideshow(): void {
    this.activeIndex = 0;
    this.clearTimer();

    const slides = this.settings.slides ?? [];
    if (slides.length <= 1) {
      return;
    }

    const interval = Math.max(2, Number(this.settings.slideSeconds) || 0) * 1000;
    this.slideshowTimer = window.setInterval(() => {
      this.activeIndex = (this.activeIndex + 1) % slides.length;
      this.safeDetectChanges();
    }, interval);
  }

  private clearTimer(): void {
    if (this.slideshowTimer) {
      window.clearInterval(this.slideshowTimer);
      this.slideshowTimer = undefined;
    }
  }

  private buildFormatter(settings: Settings): Intl.NumberFormat {
    return new Intl.NumberFormat(settings.locale || 'nl-NL', {
      style: 'currency',
      currency: settings.currency || 'EUR',
      maximumFractionDigits: 0
    });
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
