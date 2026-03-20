import InfoBlock from '../../../components/universal/InfoBlock.jsx'
import Section from '../../../components/universal/Section.jsx'
import PageHeader from '../../../components/universal/PageHeader.jsx'
import LinkButton from '../../../components/universal/LinkButton.jsx'

import '../../../components/css/containers.css'

function LegoBotDashboard() {
    return (
        <div className="main-content">
            <PageHeader
                title="LegoBot Dashboard"
                subtitle="Dashboard for managing and configuring LegoBot in your server."
                backTo="/projects/LegoBot"
                backLabel="LegoBot"
                badge="Online"
                badgeColor="good"
                meta={[
                    { label: "Version", value: "1.0.0" }
                ]}
                actions={
                    <>
                        <LinkButton to="https://discord.com/invite/example" variant="primary" size="lg" external>Invite</LinkButton>
                    </>
                }
            />
        </div>
    )
}

export default LegoBotDashboard