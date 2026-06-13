import symbolUrl from '../assets/merqetia-symbol.svg';

/**
 * merQetia wordmark — the "Q" is rendered with the brand symbol so the
 * lockup matches the official logo. Text color inherits via currentColor,
 * so it works on both dark sidebars and light auth screens.
 */
export default function BrandLogo({ className = '', symbolSize }) {
  return (
    <span className={`mq-logo ${className}`}>
      <span className="mq-logo-text">mer</span>
      <img
        src={symbolUrl}
        alt=""
        aria-hidden="true"
        className="mq-logo-q"
        style={symbolSize ? { height: symbolSize } : undefined}
      />
      <span className="mq-logo-text">etia</span>
    </span>
  );
}
