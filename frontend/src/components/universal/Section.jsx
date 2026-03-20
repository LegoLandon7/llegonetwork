import './Section.css'

function Section({
    title,
    description = null,
    img         = null,
    imgAlt      = '',
    imgPos      = 'right',
    actions     = null,
    children    = null,
}) {
    return (
        <div className={`section img-${imgPos}`}>
            <div className="section-text">
                {title && <h2>{title}</h2>}
                {description && <p>{description}</p>}
                {children}
                {actions && (
                    <div className="section-actions">{actions}</div>
                )}
            </div>

            {img && (
                <div className="section-img-wrap">
                    <img src={img} alt={imgAlt || title} />
                </div>
            )}
        </div>
    )
}

export default Section