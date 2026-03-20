import './PageHeader.css'
import { Link } from 'react-router-dom'

function PageHeader({
    title,
    subtitle   = null,
    backTo     = null,
    backLabel  = 'Back',
    actions    = null,
    badge      = null,
    badgeColor = 'default',
    meta       = null,
}) {
    return (
        <div className="page-header">
            {backTo && (
                <Link to={backTo} className="page-header-back">
                    ← {backLabel}
                </Link>
            )}

            <div className="page-header-main">
                <div className="page-header-text">
                    <div className="page-header-title-row">
                        <h1>{title}</h1>
                        {badge && (
                            <span className={`page-header-badge badge-${badgeColor}`}>
                                {badge}
                            </span>
                        )}
                    </div>

                    {subtitle && (
                        <p className="page-header-subtitle">{subtitle}</p>
                    )}

                    {meta?.length > 0 && (
                        <div className="page-header-meta">
                            {meta.map((item, i) => (
                                <span key={i} className="page-header-meta-item">
                                    <span className="meta-label">{item.label}</span>
                                    <span className="meta-value">{item.value}</span>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {actions && (
                    <div className="page-header-actions">{actions}</div>
                )}
            </div>

            <div className="page-header-divider" />
        </div>
    )
}

export default PageHeader