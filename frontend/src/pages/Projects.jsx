import Card from '../components/universal/Card.jsx'
import PageHeader from '../components/universal/PageHeader.jsx'

import HeaderIcon from '/favicon.png'

import '../components/css/containers.css'

function Projects() {
    return (
        <div className="main-content">
            <PageHeader
                title="Projects"
                subtitle="Things I have built in my free time."
                backTo="/"
                backLabel="Home"
            />

            <div className="card-grid">
                <Card
                    title="LegoBot"
                    img={HeaderIcon}
                    badge="Online"
                    badgeColor="good"
                    description="A multi-purpose Discord bot for moderation, logging, quality of life commands, and more."
                    buttons={[
                        { label: "Dashboard", to: "/projects/LegoBot/dashboard" },
                        { label: "View More", to: "/projects/LegoBot" },
                        { label: "Invite", to: "/", external: true },
                    ]}
                />
            </div>
        </div>
    )
}

export default Projects