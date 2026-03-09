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
            description={"LegoBot is a muilti-purpose discord bot that allows you to do almost anything any ordinary bot would do. This bot can handle moderation, logging, quality of life commands, and so much more!"}
            img={HeaderIcon}
            buttons={[
                {label: "View More", to: "/projects/LegoBot"},
                {label: "Invite", to: "/"},
            ]}
        />
    </div>
}

export default Home