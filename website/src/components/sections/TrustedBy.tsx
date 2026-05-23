import { MarqueeLogoScroller } from '@/components/ui/marquee-logo-scroller';

export function TrustedBy() {
  const partners = [
    {
      src: 'https://svgl.app/library/docker.svg',
      alt: 'Docker',
      scale: 1.4,
      gradient: { from: '#4CC2FF', via: '#2496ED', to: '#1A6BB0' },
    },
    {
      src: 'https://svgl.app/library/vercel.svg',
      alt: 'Vercel',
      scale: 1.1,
      gradient: { from: '#EAEAEA', via: '#888888', to: '#222222' },
    },
    {
      src: 'https://svgl.app/library/sentry.svg',
      alt: 'Sentry',
      scale: 1.1,
      gradient: { from: '#8F7ACC', via: '#5B4D8A', to: '#362D59' },
    },
    {
      src: 'https://svgl.app/library/datadog.svg',
      alt: 'Datadog',
      scale: 1.2,
      gradient: { from: '#A37BE6', via: '#7B42CC', to: '#632CA6' },
    },
    {
      src: 'https://svgl.app/library/grafana.svg',
      alt: 'Grafana',
      scale: 1.2,
      gradient: { from: '#FFA255', via: '#F46800', to: '#B34A00' },
    },
    {
      src: 'https://svgl.app/library/posthog.svg',
      alt: 'PostHog',
      scale: 1.6,
      gradient: { from: '#FF8A55', via: '#F54E00', to: '#B33800' },
    },
    {
      src: 'https://svgl.app/library/supabase.svg',
      alt: 'Supabase',
      scale: 1.2,
      gradient: { from: '#6BF3AC', via: '#3ECF8E', to: '#288A5E' },
    },
    {
      src: 'https://svgl.app/library/cloudflare.svg',
      alt: 'Cloudflare',
      scale: 0.8,
      gradient: { from: '#FFB373', via: '#F38020', to: '#B35D16' },
    },
  ];

  return (
    <section className="container mx-auto px-4 py-16 mb-8 border-t border-border/10">
      <div className="max-w-6xl mx-auto">
        <MarqueeLogoScroller
          title="Trusted by developers worldwide"
          description="Top engineering teams use PortScope to crush port collisions and instantly debug their local environments."
          logos={partners}
          speed="normal"
        />
      </div>
    </section>
  );
}
