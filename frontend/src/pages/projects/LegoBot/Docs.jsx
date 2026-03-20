import InfoBlock from '../../../components/universal/InfoBlock.jsx'
import Section from '../../../components/universal/Section.jsx'
import PageHeader from '../../../components/universal/PageHeader.jsx'
import LinkButton from '../../../components/universal/LinkButton.jsx'

import '../../../components/css/containers.css'

function LegoBotDocs() {
    return (
        <div className="main-content">
            <PageHeader
                title="LegoBot Documentation"
                subtitle="This page shows all command and features of LegoBot."
                backTo="/projects/LegoBot"
                backLabel="LegoBot"
                meta={[
                    { label: "Version", value: "1.0.0" }
                ]}
                actions={
                    <>
                        <LinkButton to="https://github.com/llegonetwork/LegoBot" variant="default" size="md" external>Repo</LinkButton>
                        <LinkButton to="https://github.com/llegonetwork/LegoBot/blob/main/README.md" variant="primary" size="lg" external>README</LinkButton>
                    </>
                }
            />
        </div>
    )
}

export default LegoBotDocs