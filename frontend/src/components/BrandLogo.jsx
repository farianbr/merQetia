import logoMarkup from '../assets/merqetia-logo.svg?raw';

/**
 * Full merQetia logo (single artwork): the "mer"/"etia" lettering is outlined
 * and uses currentColor, while the "Q" chat-bubble keeps its gradient — so the
 * one logo adapts to dark sidebars (white) and light auth screens (navy).
 */
export default function BrandLogo({ className = '' }) {
  return (
    <span
      className={`mq-logo ${className}`}
      role="img"
      aria-label="merQetia"
      dangerouslySetInnerHTML={{ __html: logoMarkup }}
    />
  );
}
