import InfoBlock from '../components/universal/InfoBlock.jsx'

import HeaderIcon from '/favicon.png'

import '../components/css/containers.css'

function Home() {
  return <div className="main-content">
        <InfoBlock 
            header={"llegonetwork"}
            description={"This website was made by me, Landon Lego, a current High School student to show off some things that I am able to devolop!\n\nDiscord bots, websites, and more!"}
            img={HeaderIcon}
            buttons={[
                {label: "About Me", to: "/about"},
            ]}
        />
        <InfoBlock 
            header={"Featured Project - LegoBot"}
            description={"blah blah blah"}
            img={HeaderIcon}
            buttons={[
                {label: "View More", to: "/"},
                {label: "Invite", to: "/"},
            ]}
        />
    </div>
}

export default Home