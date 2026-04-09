import { useEffect, useRef, useId } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    darkMode: true,
    background: 'transparent',
    primaryColor: '#7c3aed',
    primaryTextColor: '#fafafa',
    primaryBorderColor: '#7c3aed',
    lineColor: '#525252',
    secondaryColor: '#27272a',
    tertiaryColor: '#18181b',
    fontFamily: '"Geist Variable", sans-serif',
    fontSize: '14px',
    nodeBorder: '#7c3aed',
    mainBkg: '#27272a',
    nodeTextColor: '#fafafa',
    edgeLabelBackground: '#18181b',
    clusterBkg: '#18181b',
    clusterBorder: '#3f3f46',
    titleColor: '#fafafa',
  },
  flowchart: {
    curve: 'basis',
    padding: 16,
  },
});

interface MermaidProps {
  chart: string;
  className?: string;
}

export function Mermaid({ chart, className }: MermaidProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const uniqueId = useId().replace(/:/g, '-');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;

    async function render() {
      try {
        const { svg } = await mermaid.render(`mermaid-${uniqueId}`, chart);
        if (!cancelled && el) {
          el.innerHTML = svg;
          // Make the SVG responsive
          const svgEl = el.querySelector('svg');
          if (svgEl) {
            svgEl.style.maxWidth = '100%';
            svgEl.style.height = 'auto';
          }
        }
      } catch (err) {
        if (!cancelled && el) {
          el.innerHTML = `<pre class="text-sm text-red-400 p-3">${String(err)}</pre>`;
        }
      }
    }

    render();

    return () => {
      cancelled = true;
    };
  }, [chart, uniqueId]);

  return (
    <div
      ref={containerRef}
      className={`my-4 flex justify-center ${className ?? ''}`}
    />
  );
}
