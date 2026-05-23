import { useState, useEffect } from 'react';
import { BookOpen, Star } from 'lucide-react';
import { FaGithub } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';

export function Navbar() {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    fetch('https://api.github.com/repos/neilblaze/portscope')
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.stargazers_count === 'number') {
          setStars(data.stargazers_count);
        }
      })
      .catch((err) => console.error('Failed to fetch GitHub stars:', err));
  }, []);
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center px-4 md:px-8">
        <div className="mr-4 flex items-center">
          <img
            src="https://res.cloudinary.com/dmlwye965/image/upload/v1777225620/portscope_logo_taf1id.png"
            alt="PortScope"
            className="h-7 w-auto transition-all hover:opacity-80"
          />
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2 md:space-x-4">
          <nav className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" className="hidden sm:flex" asChild>
              <a href="https://github.com/neilblaze/portscope/blob/main/README.md" target="_blank" rel="noreferrer">
                <BookOpen className="h-4 w-4 mr-2" />
                Docs
              </a>
            </Button>
            <Button variant="ghost" size="sm" asChild className="group relative">
              <a href="https://github.com/neilblaze/portscope" target="_blank" rel="noreferrer" className="flex items-center">
                <FaGithub className="h-4 w-4 mr-2" />
                <span className="font-medium">GitHub</span>
                {stars !== null && (
                  <span className="ml-2 flex items-center justify-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary group-hover:bg-accent-foreground/20 group-hover:text-accent-foreground transition-colors">
                    <Star className="h-3 w-3 mr-1 fill-primary group-hover:fill-accent-foreground transition-colors" />
                    {stars.toLocaleString()}
                  </span>
                )}
              </a>
            </Button>
            <ThemeToggle />
          </nav>
        </div>
      </div>
    </header>
  );
}
