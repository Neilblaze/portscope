import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Cookie, X } from 'lucide-react';

export function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      const timer = setTimeout(() => setIsVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleConsent = (accepted: boolean) => {
    localStorage.setItem('cookie-consent', accepted ? 'accepted' : 'declined');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-[19rem]">
      <div className="relative overflow-hidden rounded-xl border border-border/50 bg-background/60 p-4 text-card-foreground shadow-2xl backdrop-blur-xl transition-all dark:border-white/10 dark:bg-black/40 dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)]">
        <div className="absolute -left-10 -top-10 -z-10 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
        <div className="absolute -bottom-10 -right-10 -z-10 h-24 w-24 rounded-full bg-accent/20 blur-2xl" />

        <button
          onClick={() => setIsVisible(false)}
          className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:hover:bg-white/10 dark:hover:text-white"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary/20">
              <Cookie className="h-4 w-4" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold tracking-tight text-foreground pr-4">Cookie Preferences</h3>
              <p className="text-xs leading-relaxed text-muted-foreground dark:text-gray-300">
                We use cookies to improve your experience & analyze site usage.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="outline"
              className="h-8 text-xs flex-1 bg-transparent hover:bg-muted dark:hover:bg-white/10 dark:text-gray-300 dark:hover:text-white border-border/50"
              onClick={() => handleConsent(false)}
            >
              Decline
            </Button>
            <Button
              className="h-8 text-xs flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => handleConsent(true)}
            >
              Accept
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
