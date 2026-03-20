import './Card.css'
import LinkButton from './LinkButton.jsx'

function Card({
    title,
    description = null,
    img         = null,
    badge       = null,
    badgeColor  = 'default',
    buttons     = [],
}) {
    return (
        <div className="card">
            {img && (
                <div className="card-img-wrap">
                    <img src={img} alt={title} />
                </div>
            )}

            <div className="card-body">
                <div className="card-header">
                    <h3>{title}</h3>
                    {badge && (
                        <span className={`card-badge badge-${badgeColor}`}>{badge}</span>
                    )}
                </div>

                {description && <p>{description}</p>}

                {buttons.length > 0 && (
                    <div className="card-actions">
                        {buttons.map((btn, i) => (
                            <LinkButton
                                key={i}
                                to={btn.to}
                                href={btn.href}
                                external={btn.external}
                                variant={btn.variant ?? 'default'}
                                size="sm"
                            >
                                {btn.label}
                            </LinkButton>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default Card