import InfoBlock from '../../../components/universal/InfoBlock.jsx'
import Section from '../../../components/universal/Section.jsx'
import PageHeader from '../../../components/universal/PageHeader.jsx'
import LinkButton from '../../../components/universal/LinkButton.jsx'

import HeaderIcon from '/favicon.png'

import '../../../components/css/containers.css'

function LegoBot() {
    return (
        <div className="main-content">
            <PageHeader
                title="LegoBot"
                subtitle="A multi-purpose Discord bot for moderation, logging, and more."
                backTo="/projects"
                backLabel="Projects"
                badge="Online"
                badgeColor="good"
                meta={[
                    { label: "Version", value: "1.0.0" }
                ]}
                actions={
                    <>
                        <LinkButton to="https://discord.com/invite/example" variant="default" size="md" external>Invite</LinkButton>
                        <LinkButton to="/projects/LegoBot/docs" variant="default" size="md">Docs</LinkButton>
                        <LinkButton to="/projects/LegoBot/dashboard" variant="primary" size="lg">Dashboard</LinkButton>
                    </>
                }
            />

            <Section
                title="LegoBot"
                description={"LegoBot is a multi-purpose Discord bot that allows you to do almost anything any ordinary bot would do. This bot can handle moderation, logging, quality of life commands, and so much more!\n\nThis is the info page."}
                img={HeaderIcon}
                imgPos="left"
            />
        </div>
    )
}

export default LegoBot