import './InfoBlock.css'

function InfoBlock({
    header = "lorem ipsum", 
    headerPos = 'left', // center, left, right

    buttons=[],

    description = "lorem ipsum", 

    img = null, 
    imgPos = 'auto', // auto, left, right, top, bottom

    notes=[],

    maxWidth = null,
    maxHeight = null,

    divider = true
}) {
    // get the image direction
    const isBottom = imgPos === 'bottom';
    const isRight = imgPos === 'right';
    const isTop = imgPos === 'top';
    const isLeft = imgPos === 'left';

    const flexDir =
        isTop ? 'column' :
        isBottom ? 'column-reverse' :
        isRight ? 'row-reverse' :
        isLeft ? 'row' :
        null; // auto

    // button data
    const buttonsEl = buttons.length > 0 && (
        <div className="info-buttons">
            {buttons.map((btn, idx) => (
                <a key={idx} href={btn.to} className="info-button">{btn.label}</a>
            ))}
        </div>
    );

    // return info block
    return (
       <div className={`info-block ${!flexDir ? imgPos : ''}`} style={{
            ...(flexDir && { flexDirection: flexDir }),
            ...(maxWidth && { maxWidth }),
            ...(maxHeight && { maxHeight }),
        }}>

            {/*image*/}
            {img && <img src={img} />}

            {/*body text*/}
            <div className="info-body">

                {/*header + buttons*/}
                <div className="info-header-row">
                    {headerPos === 'right' && buttonsEl}
                    <h2 style={{ textAlign: headerPos }}>{header}</h2>
                    {(headerPos === 'left' || headerPos === 'center') && buttonsEl}
                </div>

                {/*divider*/}
                {divider && <div className="header-divider" />}

                {/*description*/}
                <p>{description}</p>

                {/*notes*/}
                {notes.length > 0 && (
                    <div className="info-notes">
                        {notes.map((note, idx) => (
                            <div key={idx} className="info-note">
                                <hr className="note-divider" />
                                <div className="info-note-body">
                                    <strong>{`${note.label}:`}</strong>
                                    <span>{note.text}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
       </div>
    );
}

export default InfoBlock