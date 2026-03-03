import './InfoBlock.css'

function InfoBlock({header, description, img}) {
    

    return (
       <div className="info-block">
            <img src={img} />

            <div className="body">
                <h2>{header}</h2>
                <p>{description}</p>
            </div>
       </div>
    );
}

export default InfoBlock