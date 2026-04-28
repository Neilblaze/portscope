import { BookOpen } from 'lucide-react';
import { FaGithub } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
            <Button variant="ghost" size="sm" asChild>
              <a href="https://github.com/neilblaze/portscope" target="_blank" rel="noreferrer">
                <FaGithub className="h-4 w-4 mr-2" />
                GitHub
              </a>
            </Button>
            <ThemeToggle />
          </nav>
        </div>
      </div>
    </header>
  );
}
