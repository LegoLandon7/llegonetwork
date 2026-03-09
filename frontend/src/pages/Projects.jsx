import InfoBlock from '../components/universal/InfoBlock.jsx'

import '../components/css/containers.css'

function Projects() {
  return <div className="main-content">
        <div className="flex-container-wrap">
            <InfoBlock 
                header={"LegoBot"}
                img={"https://cuddly-succotash-7vjr9r6g9q5vfx676-5173.app.github.dev/favicon.png"}
                description={"LegoBot is a muilti-purpose discord bot that allows you to do almost anything any ordinary bot would do. This bot can handle moderation, logging, quality of life commands, and so much more!"}
                buttons={[
                    {label: "View More", to: "/projects/LegoBot"},
                    {label: "Invite", to: "/"}
                ]}

            />
        </div>
    </div>
}

export default Projects