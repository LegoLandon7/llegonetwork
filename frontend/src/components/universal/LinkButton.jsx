import './LinkButton.css'
import { Link } from 'react-router-dom'

function LinkButton({
    to        = null,
    href      = null,
    children,
    variant   = 'default',
    size      = 'md',
    external  = false,
    disabled  = false,
    className = '',
    onClick   = null,
}) {
    const classes = [
        'link-button',
        `variant-${variant}`,
        `size-${size}`,
        disabled ? 'disabled' : '',
        className,
    ].filter(Boolean).join(' ')

    if (external || href) {
        return (
            <a
                href={to ?? href}
                className={classes}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClick}
            >
                {children}
            </a>
        )
    }

    return (
        <Link
            to={disabled ? '#' : to}
            className={classes}
            onClick={disabled ? (e) => e.preventDefault() : onClick}
        >
            {children}
        </Link>
    )
}

export default LinkButton