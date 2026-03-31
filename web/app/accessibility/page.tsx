import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Accessibility Statement — Claude Code",
  description:
    "Claude Code accessibility statement: conformance level, known limitations, and how to report accessibility barriers.",
};

export default function AccessibilityPage() {
  return (
    <main
      id="main-content"
      className="min-h-screen bg-surface-950 text-surface-100 px-6 py-12"
    >
      <div className="max-w-2xl mx-auto space-y-10">
        {/* Heading */}
        <header>
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-2 text-sm text-surface-400 mb-6">
              <li>
                <Link href="/" className="hover:text-surface-100 underline focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none rounded">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="text-surface-100">
                Accessibility
              </li>
            </ol>
          </nav>
          <h1 className="text-3xl font-bold text-surface-100">Accessibility Statement</h1>
          <p className="mt-3 text-surface-400 text-sm">
            Last reviewed: <time dateTime="2026-03-31">March 31, 2026</time>
          </p>
        </header>

        {/* Conformance */}
        <section aria-labelledby="conformance-heading">
          <h2 id="conformance-heading" className="text-xl font-semibold text-surface-100 mb-3">
            Conformance status
          </h2>
          <p className="text-surface-300 leading-relaxed">
            We are committed to ensuring Claude Code is accessible to everyone. Our target
            conformance level is{" "}
            <strong className="text-surface-100">WCAG 2.1 Level AA</strong> — the internationally
            recognised standard for web accessibility. We are actively working toward full
            conformance and address reported barriers on an ongoing basis.
          </p>
        </section>

        {/* What we support */}
        <section aria-labelledby="support-heading">
          <h2 id="support-heading" className="text-xl font-semibold text-surface-100 mb-3">
            Accessibility features
          </h2>
          <ul className="space-y-2 text-surface-300">
            {[
              "Keyboard-navigable interface — all interactive elements are reachable and operable without a mouse",
              "Skip-to-content link — press Tab on load to skip the navigation sidebar",
              "Screen reader support — chat messages are announced via ARIA live regions; icons are hidden from assistive technology",
              "Visible focus indicators — all focusable elements display a clearly visible focus ring",
              "Semantic HTML landmarks — main, nav, aside, header, and footer elements structure each page",
              "Colour contrast — normal text meets the 4.5:1 minimum ratio against its background",
              "Reduced motion — all animations are disabled when the OS prefers-reduced-motion setting is active",
              "High Contrast Mode — the interface adapts to Windows High Contrast Mode via forced-colors media query",
              "Command palette — supports combobox keyboard pattern with arrow-key navigation and screen-reader announcements",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-brand-400" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Known limitations */}
        <section aria-labelledby="limitations-heading">
          <h2 id="limitations-heading" className="text-xl font-semibold text-surface-100 mb-3">
            Known limitations
          </h2>
          <p className="text-surface-300 leading-relaxed mb-3">
            The following known limitations are on our backlog. We aim to resolve each one in a
            future release:
          </p>
          <ul className="space-y-2 text-surface-300">
            {[
              "Streaming text: individual tokens are not announced as they arrive; only the completed reply is announced to avoid over-announcing.",
              "Syntax-highlighted code blocks: language name and line count are not yet announced to screen readers.",
              'Diff view: additions and removals are not yet described with supplemental text (e.g. "3 lines added, 1 line removed").',
              "File tree (when active): full tree keyboard pattern (expand/collapse with arrow keys) is not yet implemented.",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-surface-600" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Technical information */}
        <section aria-labelledby="tech-heading">
          <h2 id="tech-heading" className="text-xl font-semibold text-surface-100 mb-3">
            Technical information
          </h2>
          <p className="text-surface-300 leading-relaxed">
            Claude Code is built with Next.js and Radix UI primitives. Radix provides
            WAI-ARIA-compliant implementations for dialog, dropdown menu, tooltip, toast, tabs, and
            select components. Custom components are built against WCAG 2.1 AA guidelines and are
            tested with axe-core automated tooling.
          </p>
          <p className="mt-3 text-surface-300 leading-relaxed">
            We use the following assistive technologies in our testing:
          </p>
          <ul className="mt-2 space-y-1 text-surface-300">
            <li>VoiceOver on macOS and iOS</li>
            <li>NVDA on Windows</li>
            <li>Keyboard-only navigation (Chrome and Firefox)</li>
            <li>Windows High Contrast Mode</li>
          </ul>
        </section>

        {/* Feedback */}
        <section aria-labelledby="feedback-heading">
          <h2 id="feedback-heading" className="text-xl font-semibold text-surface-100 mb-3">
            Feedback and contact
          </h2>
          <p className="text-surface-300 leading-relaxed">
            If you experience an accessibility barrier or have feedback on how we can improve,
            please open an issue on our public tracker. We aim to respond to accessibility reports
            within 5 business days.
          </p>
          <a
            href="https://github.com/anthropics/claude-code/issues/new?template=accessibility.md"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-950"
            rel="noopener noreferrer"
            target="_blank"
          >
            Report an accessibility issue
          </a>
        </section>
      </div>
    </main>
  );
}
