import { MagneticField } from "@/components/ui/magnetic-field";

export function Footer() {
  return (
    <>
      <div className="border-t border-border/10 bg-muted/10 w-full">
        <div className="container mx-auto px-4 max-w-6xl">
          <MagneticField
            className="h-[180px] md:h-[200px] w-full"
            gradient={[
              [0, 230, 255],
              [0, 200, 255],
              [30, 170, 255],
              [80, 130, 255],
              [120, 100, 255],
              [160, 70, 240],
            ]}
          />
        </div>
      </div>
      <footer className="border-t border-border/10 bg-muted/20 pb-12 pt-16 md:pb-16 md:pt-24">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8">
            <div className="md:col-span-2 space-y-6">
              <div className="flex items-center">
                <img
                  src="https://res.cloudinary.com/dmlwye965/image/upload/v1777225620/portscope_logo_taf1id.png"
                  alt="PortScope"
                  className="h-8 w-auto"
                />
              </div>
              <p className="text-base text-muted-foreground max-w-sm leading-relaxed">
                Eliminate the operational friction of diagnosing port collisions and orphaned workloads with intelligent, high-fidelity tooling.
              </p>
            </div>

            <div className="space-y-6">
              <h4 className="font-semibold text-lg font-['Orbitron'] tracking-wide">Resources</h4>
              <ul className="space-y-4 text-muted-foreground">
                <li>
                  <a href="https://github.com/neilblaze/portscope/blob/main/README.md" className="hover:text-primary transition-colors inline-block relative after:absolute after:bottom-0 after:left-0 after:h-[1px] after:w-0 hover:after:w-full after:bg-primary after:transition-all after:duration-300">
                    Documentation
                  </a>
                </li>
                <li>
                  <a href="https://github.com/neilblaze/portscope/issues" className="hover:text-primary transition-colors inline-block relative after:absolute after:bottom-0 after:left-0 after:h-[1px] after:w-0 hover:after:w-full after:bg-primary after:transition-all after:duration-300">
                    Issues & Feedback
                  </a>
                </li>
                <li>
                  <a href="https://github.com/Neilblaze/portscope/pkgs/npm/portscope" className="hover:text-primary transition-colors inline-block relative after:absolute after:bottom-0 after:left-0 after:h-[1px] after:w-0 hover:after:w-full after:bg-primary after:transition-all after:duration-300">
                    NPM Package
                  </a>
                </li>
              </ul>
            </div>

            <div className="space-y-6">
              <h4 className="font-semibold text-lg font-['Orbitron'] tracking-wide">Legal</h4>
              <ul className="space-y-4 text-muted-foreground">
                <li>
                  <a href="https://github.com/neilblaze/portscope/blob/main/LICENSE" className="hover:text-primary transition-colors inline-block relative after:absolute after:bottom-0 after:left-0 after:h-[1px] after:w-0 hover:after:w-full after:bg-primary after:transition-all after:duration-300">
                    Apache-2.0 License
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-16 pt-8 border-t border-border/40 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center">
              <img
                src="https://res.cloudinary.com/dmlwye965/image/upload/v1779556049/gdpr-compliant_yk3uzx.png"
                alt="GDPR Compliant"
                className="h-14 w-auto opacity-80 hover:opacity-100 transition-opacity"
              />
            </div>
            <div className="text-md text-muted-foreground">
              &copy; {new Date().getFullYear()} PortScope. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
