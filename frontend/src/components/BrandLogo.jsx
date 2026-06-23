const DARK_LOGO = '/merqetia-wordmark-dark.png';
const WHITE_LOGO = '/merqetia-wordmark-white.png';

/**
 * merQetia full wordmark logo.
 *
 *  variant="white" — white lockup, for dark surfaces (sidebars). Default.
 *  variant="dark"  — dark lockup, for light surfaces.
 *  variant="auto"  — theme-aware: dark lockup in light mode, white in dark mode
 *                    (used on the auth screens whose card follows the theme).
 */
export default function BrandLogo({ className = '', variant = 'white' }) {
  if (variant === 'auto') {
    return (
      <span className={`mq-logo mq-logo--auto ${className}`}>
        <img src={DARK_LOGO} alt="merQetia" className="mq-logo-img mq-logo-img--light" />
        <img src={WHITE_LOGO} alt="merQetia" className="mq-logo-img mq-logo-img--dark" />
      </span>
    );
  }

  return (
    <span className={`mq-logo ${className}`}>
      <img
        src={variant === 'dark' ? DARK_LOGO : WHITE_LOGO}
        alt="merQetia"
        className="mq-logo-img"
      />
    </span>
  );
}
